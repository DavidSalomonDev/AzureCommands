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

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

# Acepta True/TRUE sin romper la comparacion
WAIT_FOR_SNAPSHOT=$(lower "$WAIT_FOR_SNAPSHOT")

# Fecha de expiración (GNU date; en macOS usa la variante BSD)
EXPIRY_DATE=$(date -u -d "+${RETENTION_DAYS} days" '+%d-%m-%Y' 2>/dev/null \
  || date -u -v+"${RETENTION_DAYS}"d '+%d-%m-%Y')

IFS=',' read -ra VMS <<< "${VM_NAMES// /}"

echo "=========================================================="
echo " RESPALDO MASIVO Y MONITOREO DE SNAPSHOTS"
echo " Retención: ${RETENTION_DAYS} días | Expira: ${EXPIRY_DATE} | VMs: ${#VMS[@]}"
if [ "$WAIT_FOR_SNAPSHOT" = "true" ]; then
  echo " Modo: libera cada VM al completarse su snapshot."
else
  echo " Modo: espera el respaldo completo (snapshot + transferencia al vault)."
fi
echo "=========================================================="

# ---------------------------------------------------------------------------
# 1. Vaults de la suscripción activa
# ---------------------------------------------------------------------------
echo "Listando almacenes de Recovery Services..."
VAULTS=$(az backup vault list --query "[].[name, resourceGroup]" -o tsv </dev/null | tr -d '\r')

if [ -z "$VAULTS" ]; then
  echo "No se encontraron Recovery Services Vaults en la suscripción activa."
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. Inventario de las VMs protegidas en esos vaults
# ---------------------------------------------------------------------------
# El inventario se arma una sola vez y la búsqueda se hace en bash, no con
# JMESPath: un "[?properties.friendlyName=='VM']" compara distinguiendo
# mayúsculas y minúsculas, así que pedir 'B1client02' no encontraba a la VM
# registrada como 'b1client02' y el script la reportaba como no protegida.
# Azure no admite dos recursos cuyo nombre difiera solo en el caso, así que
# comparar en minúsculas no introduce ambigüedad.
#
# Cada línea: nombre en minúsculas, nombre tal como está registrado, vault,
# grupo de recursos del vault, elemento protegido y contenedor.
#
# El contenedor debe ir con su nombre completo
# (IaasVMContainer;iaasvmcontainerv2;GRUPO_RECURSOS;NOMBRE_VM). No sirve
# properties.containerName del elemento: llega sin el prefijo
# "IaasVMContainer;" y la API responde con
# BMSUserErrorContainerNameIncorrectFormat. Tampoco conviene armarlo a mano,
# porque incluye el grupo de recursos con la misma combinación de mayúsculas y
# minúsculas con que se registró la VM en el vault.
INVENTORY=$(mktemp)
trap 'rm -f "$INVENTORY"' EXIT

while IFS=$'\t' read -r VAULT_NAME VAULT_RG; do
  [ -z "$VAULT_NAME" ] && continue

  ITEMS=$(az backup item list \
    --vault-name "$VAULT_NAME" \
    --resource-group "$VAULT_RG" \
    --backup-management-type AzureIaasVM \
    --workload-type VM \
    --query "[].[properties.friendlyName, name]" \
    -o tsv </dev/null | tr -d '\r')

  [ -z "$ITEMS" ] && continue

  CONTAINERS=$(az backup container list \
    --vault-name "$VAULT_NAME" \
    --resource-group "$VAULT_RG" \
    --backup-management-type AzureIaasVM \
    --query "[].[properties.friendlyName, name]" \
    -o tsv </dev/null | tr -d '\r')

  while IFS=$'\t' read -r FRIENDLY ITEM_NAME; do
    [ -z "$FRIENDLY" ] && continue
    FRIENDLY_LOWER=$(lower "$FRIENDLY")
    CONTAINER=$(awk -F'\t' -v vm="$FRIENDLY_LOWER" 'tolower($1) == vm { print $2; exit }' <<< "$CONTAINERS")
    printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
      "$FRIENDLY_LOWER" "$FRIENDLY" "$VAULT_NAME" "$VAULT_RG" "$ITEM_NAME" "$CONTAINER" >> "$INVENTORY"
  done <<< "$ITEMS"
done <<< "$VAULTS"

PROTECTED_COUNT=$(wc -l < "$INVENTORY" | tr -d ' ')
echo "VMs protegidas encontradas: ${PROTECTED_COUNT}"

if [ "$PROTECTED_COUNT" -eq 0 ]; then
  echo "Ningún vault de la suscripción tiene VMs protegidas; revisa que sea la suscripción correcta."
  exit 1
fi

# Inventario de VMs de la suscripción: solo sirve para explicar mejor un fallo,
# así que se consulta la primera vez que una VM no aparece en los vaults y no
# cuando todo coincide. Requiere permiso de lectura sobre las VMs; si no lo hay,
# se queda vacío y los mensajes caen a la variante genérica.
VM_LIST=""
VM_LIST_LOADED=0

load_vm_list() {
  [ "$VM_LIST_LOADED" = "1" ] && return
  VM_LIST_LOADED=1
  echo "Consultando las VMs de la suscripción para explicar el fallo..."
  VM_LIST=$(az vm list --query "[].[name, resourceGroup]" -o tsv </dev/null 2>/dev/null | tr -d '\r')
}

# ---------------------------------------------------------------------------
# 3. Disparar el respaldo de cada VM
# ---------------------------------------------------------------------------
JOB_IDS=()
JOB_VMS=()
JOB_VAULTS=()
JOB_RGS=()

for VM in "${VMS[@]}"; do
  [ -z "$VM" ] && continue
  VM_LOWER=$(lower "$VM")

  MATCHES=$(awk -F'\t' -v vm="$VM_LOWER" '$1 == vm' "$INVENTORY")

  if [ -z "$MATCHES" ]; then
    # El nombre no está en ningún vault. Se distingue entre "la VM no existe en
    # la suscripción", "existe pero nadie la respalda" y "está escrita de otra
    # forma", porque cada caso se corrige de manera distinta.
    load_vm_list
    VM_IN_SUB=$(awk -F'\t' -v vm="$VM_LOWER" 'tolower($1) == vm { print $1 "\t" $2; exit }' <<< "$VM_LIST")

    if [ -n "$VM_IN_SUB" ]; then
      REAL_NAME=$(cut -f1 <<< "$VM_IN_SUB")
      REAL_RG=$(cut -f2 <<< "$VM_IN_SUB")
      echo "[$VM] La VM existe en la suscripción (nombre real '${REAL_NAME}', grupo '${REAL_RG}') pero no está protegida en ningún vault: no hay respaldo que disparar. Habilítale primero la protección."
      continue
    fi

    if [ -n "$VM_LIST" ]; then
      echo "[$VM] No existe ninguna VM con ese nombre en la suscripción ni protegida en sus vaults (el nombre se compara ignorando mayúsculas y minúsculas)."
    else
      echo "[$VM] No está protegida en ningún vault de la suscripción (el nombre se compara ignorando mayúsculas y minúsculas)."
    fi

    # Sugerencias por coincidencia parcial: casi siempre el nombre venía con un
    # prefijo, un sufijo o una errata.
    SUGGESTIONS=$(awk -F'\t' -v vm="$VM_LOWER" \
      'index($1, vm) || index(vm, $1) { printf "  - %s (vault: %s)\n", $2, $3 }' "$INVENTORY")

    if [ -n "$SUGGESTIONS" ]; then
      echo "[$VM] VMs protegidas con un nombre parecido:"
      printf '%s\n' "$SUGGESTIONS"
    else
      echo "[$VM] VMs protegidas en esta suscripción:"
      cut -f2,3 "$INVENTORY" | sort | head -20 | awk -F'\t' '{ printf "  - %s (vault: %s)\n", $1, $2 }'
      [ "$PROTECTED_COUNT" -gt 20 ] && echo "  ... y $((PROTECTED_COUNT - 20)) más."
    fi
    continue
  fi

  MATCH_COUNT=$(printf '%s\n' "$MATCHES" | wc -l | tr -d ' ')
  if [ "$MATCH_COUNT" -gt 1 ]; then
    echo "[$VM] Aparece protegida en más de un vault; se respalda en el primero:"
    printf '%s\n' "$MATCHES" | awk -F'\t' '{ printf "  - %s (vault: %s)\n", $2, $3 }'
  fi

  IFS=$'\t' read -r _ FRIENDLY VAULT_NAME VAULT_RG ITEM_NAME CONTAINER <<< "$(printf '%s\n' "$MATCHES" | head -1)"

  if [ "$FRIENDLY" != "$VM" ]; then
    echo "[$VM] En el vault está registrada como '${FRIENDLY}'; se usa ese nombre."
  fi

  if [ -z "$CONTAINER" ]; then
    echo "[$FRIENDLY] Está protegida en el vault '${VAULT_NAME}', pero su contenedor no aparece en 'az backup container list'; revísala en el portal."
    continue
  fi

  echo "[$FRIENDLY] Respaldando en el vault '$VAULT_NAME'..."
  JOB_ID=$(az backup protection backup-now \
    --vault-name "$VAULT_NAME" \
    --resource-group "$VAULT_RG" \
    --container-name "$CONTAINER" \
    --item-name "$ITEM_NAME" \
    --backup-management-type AzureIaasVM \
    --retain-until "$EXPIRY_DATE" \
    --query name -o tsv </dev/null | tr -d '\r')

  if [ -n "$JOB_ID" ]; then
    JOB_IDS+=("$JOB_ID")
    JOB_VMS+=("$FRIENDLY")
    JOB_VAULTS+=("$VAULT_NAME")
    JOB_RGS+=("$VAULT_RG")
  else
    echo "[$FRIENDLY] No se pudo iniciar el respaldo (revisa el error de Azure CLI)."
  fi
done

if [ "${#JOB_IDS[@]}" -eq 0 ]; then
  echo "No se inició ningún respaldo."
  exit 1
fi

echo "Respaldos iniciados: ${#JOB_IDS[@]} de ${#VMS[@]} VM(s) solicitadas."

# ---------------------------------------------------------------------------
# 4. Monitoreo: la VM se libera cuando termina la fase "Take Snapshot"
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
