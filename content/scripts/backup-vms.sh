#!/usr/bin/env bash
# Respaldo masivo de VMs con monitoreo de la fase de snapshot (Azure CLI).
set -uo pipefail

# ---------------------------------------------------------------------------
# PARÁMETROS
# ---------------------------------------------------------------------------
SUBSCRIPTION_ID="<subscriptionId>"   # ID o nombre de la suscripción de trabajo
VM_NAMES="<vmNames>"                 # VMs separadas por coma
RETENTION_DAYS="<retentionDays>"     # Días de retención del punto de recuperación
WAIT_FOR_SNAPSHOT="<waitForSnapshot>"  # true = libera la VM al terminar el snapshot
POLL_SECONDS="<pollSeconds>"         # Intervalo entre consultas de estado

# ---------------------------------------------------------------------------
# SUSCRIPCIÓN DE TRABAJO
# ---------------------------------------------------------------------------
az account set --subscription "$SUBSCRIPTION_ID" || {
  echo "No se pudo seleccionar la suscripción '${SUBSCRIPTION_ID}'."
  exit 1
}

# Minutos tras los cuales se asume el snapshot terminado si Azure no reporta la subtarea
SNAPSHOT_TIMEOUT_MINUTES=12

# Acepta True/TRUE sin romper la comparacion
WAIT_FOR_SNAPSHOT=$(printf '%s' "$WAIT_FOR_SNAPSHOT" | tr '[:upper:]' '[:lower:]')

# Fecha de expiración (GNU date; en macOS usa la variante BSD)
EXPIRY_DATE=$(date -u -d "+${RETENTION_DAYS} days" '+%d-%m-%Y' 2>/dev/null \
  || date -u -v+"${RETENTION_DAYS}"d '+%d-%m-%Y')

IFS=',' read -ra VMS <<< "${VM_NAMES// /}"

echo "=========================================================="
echo " RESPALDO MASIVO Y MONITOREO DE SNAPSHOTS"
echo " Retención: ${RETENTION_DAYS} días | Expira: ${EXPIRY_DATE} | VMs: ${#VMS[@]}"
if [ "$WAIT_FOR_SNAPSHOT" = "true" ]; then
  echo " Modo: libera cada VM al completarse su snapshot (no espera la transferencia)."
else
  echo " Modo: espera el respaldo completo (snapshot + transferencia al vault)."
fi
echo "=========================================================="

# ---------------------------------------------------------------------------
# 1. Vaults de la suscripción activa
# ---------------------------------------------------------------------------
echo "Listando almacenes de Recovery Services..."
VAULTS=$(az backup vault list --query "[].{name:name,rg:resourceGroup}" -o tsv)

if [ -z "$VAULTS" ]; then
  echo "No se encontraron Recovery Services Vaults en la suscripción activa."
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. Disparar el respaldo de cada VM
# ---------------------------------------------------------------------------
JOB_IDS=()
JOB_VMS=()
JOB_VAULTS=()
JOB_RGS=()

for VM in "${VMS[@]}"; do
  [ -z "$VM" ] && continue
  PROTECTED=0

  while IFS=$'\t' read -r VAULT_NAME VAULT_RG; do
    [ -z "$VAULT_NAME" ] && continue

    # Nombre completo del elemento protegido: VM;iaasvmcontainerv2;GRUPO_RECURSOS;NOMBRE_VM
    ITEM_NAME=$(az backup item list \
      --vault-name "$VAULT_NAME" \
      --resource-group "$VAULT_RG" \
      --backup-management-type AzureIaasVM \
      --workload-type VM \
      --query "[?properties.friendlyName=='${VM}'].name | [0]" \
      -o tsv)

    [ -z "$ITEM_NAME" ] && continue
    PROTECTED=1

    # El contenedor debe ir con su nombre completo
    # (IaasVMContainer;iaasvmcontainerv2;GRUPO_RECURSOS;NOMBRE_VM). No sirve
    # properties.containerName del elemento: llega sin el prefijo
    # "IaasVMContainer;" y la API responde con
    # BMSUserErrorContainerNameIncorrectFormat. Tampoco conviene armarlo a mano,
    # porque incluye el grupo de recursos con la misma combinación de
    # mayúsculas y minúsculas con que se registró la VM en el vault.
    CONTAINER=$(az backup container list \
      --vault-name "$VAULT_NAME" \
      --resource-group "$VAULT_RG" \
      --backup-management-type AzureIaasVM \
      --query "[?properties.friendlyName=='${VM}'].name | [0]" \
      -o tsv)

    if [ -z "$CONTAINER" ]; then
      echo "[$VM] No se pudo resolver el contenedor en el vault '$VAULT_NAME'."
      break
    fi

    echo "[$VM] Respaldando en el vault '$VAULT_NAME'..."
    JOB_ID=$(az backup protection backup-now \
      --vault-name "$VAULT_NAME" \
      --resource-group "$VAULT_RG" \
      --container-name "$CONTAINER" \
      --item-name "$ITEM_NAME" \
      --backup-management-type AzureIaasVM \
      --retain-until "$EXPIRY_DATE" \
      --query name -o tsv)

    if [ -n "$JOB_ID" ]; then
      JOB_IDS+=("$JOB_ID")
      JOB_VMS+=("$VM")
      JOB_VAULTS+=("$VAULT_NAME")
      JOB_RGS+=("$VAULT_RG")
    else
      echo "[$VM] No se pudo iniciar el respaldo (revisa el error de Azure CLI)."
    fi
    break
  done <<< "$VAULTS"

  [ "$PROTECTED" -eq 0 ] && echo "[$VM] No está protegida en ningún vault de la suscripción."
done

if [ "${#JOB_IDS[@]}" -eq 0 ]; then
  echo "No se inició ningún respaldo."
  exit 1
fi

# ---------------------------------------------------------------------------
# 3. Monitoreo: la VM se libera cuando termina la fase "Take Snapshot"
# ---------------------------------------------------------------------------
START_EPOCH=$(date +%s)
DONE=()
for _ in "${JOB_IDS[@]}"; do DONE+=("0"); done

while true; do
  PENDING=0

  for i in "${!JOB_IDS[@]}"; do
    [ "${DONE[$i]}" = "1" ] && continue

    # La subtarea del snapshot vive en properties.extendedInfo.tasksList y se
    # identifica por su taskId ("Take Snapshot"). No existe ningún subTasks ni
    # ningún taskName: un JMESPath hacia esos nombres devuelve null en silencio
    # y la fase nunca se detecta.
    #
    # La proyección debe ser una LISTA, no un diccionario: con -o tsv, Azure CLI
    # ordena las claves de un diccionario alfabéticamente y los valores salen
    # intercambiados. En una lista se respeta el orden escrito, un valor por
    # línea, y los nulos se imprimen como el literal "None".
    JOB_TSV=$(az backup job show \
      --name "${JOB_IDS[$i]}" \
      --vault-name "${JOB_VAULTS[$i]}" \
      --resource-group "${JOB_RGS[$i]}" \
      --query "[properties.status, properties.extendedInfo.tasksList[?taskId != null && contains(taskId, 'Snapshot')].status | [0], properties.extendedInfo.tasksList[?taskId != null && contains(taskId, 'Snapshot')].duration | [0]]" \
      -o tsv 2>/dev/null | tr -d '\r')

    STATUS=$(sed -n 1p <<< "$JOB_TSV")
    SNAPSHOT_PHASE=$(sed -n 2p <<< "$JOB_TSV")
    SNAPSHOT_DURATION=$(sed -n 3p <<< "$JOB_TSV")
    [ "$SNAPSHOT_PHASE" = "None" ] && SNAPSHOT_PHASE=""
    [ "$SNAPSHOT_DURATION" = "None" ] && SNAPSHOT_DURATION=""

    ELAPSED_MIN=$(( ($(date +%s) - START_EPOCH) / 60 ))

    if [ -z "$STATUS" ]; then
      echo "[${JOB_VMS[$i]}] No se pudo consultar el job ${JOB_IDS[$i]}; se reintenta."
      PENDING=1
      continue
    fi

    case "$STATUS" in
      Completed|CompletedWithWarnings)
        echo "[${JOB_VMS[$i]}] Respaldo completado (incluida la transferencia al vault)."
        DONE[$i]=1
        continue
        ;;
      Failed|Cancelled|Cancelling)
        echo "[${JOB_VMS[$i]}] El respaldo terminó en '${STATUS}'. Revísalo en el portal."
        DONE[$i]=1
        continue
        ;;
    esac

    if [ "$WAIT_FOR_SNAPSHOT" != "true" ]; then
      echo "[${JOB_VMS[$i]}] En progreso (estado: ${STATUS}, ${ELAPSED_MIN} min)..."
      PENDING=1
      continue
    fi

    case "$SNAPSHOT_PHASE" in
      Completed|Success|Succeeded)
        echo "[${JOB_VMS[$i]}] Snapshot completado en ${SNAPSHOT_DURATION:-n/d}; sigue la transferencia al vault. Servidor liberado."
        DONE[$i]=1
        ;;
      "")
        if [ "$ELAPSED_MIN" -gt "$SNAPSHOT_TIMEOUT_MINUTES" ]; then
          echo "[${JOB_VMS[$i]}] Azure no reporta la subtarea de snapshot tras ${SNAPSHOT_TIMEOUT_MINUTES} min: se asume terminada."
          DONE[$i]=1
        else
          echo "[${JOB_VMS[$i]}] Esperando que Azure reporte la subtarea de snapshot (estado: ${STATUS}, ${ELAPSED_MIN} min)..."
          PENDING=1
        fi
        ;;
      *)
        echo "[${JOB_VMS[$i]}] Snapshot en progreso (subtarea: ${SNAPSHOT_PHASE}, ${ELAPSED_MIN} min)..."
        PENDING=1
        ;;
    esac
  done

  [ "$PENDING" -eq 0 ] && break
  sleep "$POLL_SECONDS"
done

echo "=========================================================="
echo " Todos los servidores procesaron su snapshot."
echo " Ya puedes continuar con el mantenimiento."
echo "=========================================================="
