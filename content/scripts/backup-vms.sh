#!/usr/bin/env bash
# Respaldo masivo de VMs con monitoreo de la fase de snapshot (Azure CLI).
set -uo pipefail

# ---------------------------------------------------------------------------
# PARÁMETROS
# ---------------------------------------------------------------------------
VM_NAMES="<vmNames>"                 # VMs separadas por coma
RETENTION_DAYS="<retentionDays>"     # Días de retención del punto de recuperación
WAIT_FOR_SNAPSHOT="<waitForSnapshot>"  # true = libera la VM al terminar el snapshot
POLL_SECONDS="<pollSeconds>"         # Intervalo entre consultas de estado

# Minutos tras los cuales se asume el snapshot terminado si el job no lo reporta
SNAPSHOT_TIMEOUT_MINUTES=12

# Fecha de expiración (GNU date; en macOS usa la variante BSD)
EXPIRY_DATE=$(date -u -d "+${RETENTION_DAYS} days" '+%d-%m-%Y' 2>/dev/null \
  || date -u -v+"${RETENTION_DAYS}"d '+%d-%m-%Y')

IFS=',' read -ra VMS <<< "${VM_NAMES// /}"

echo "=========================================================="
echo " RESPALDO MASIVO Y MONITOREO DE SNAPSHOTS"
echo " Retención: ${RETENTION_DAYS} días | Expira: ${EXPIRY_DATE} | VMs: ${#VMS[@]}"
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
  FOUND=0

  while IFS=$'\t' read -r VAULT_NAME VAULT_RG; do
    [ -z "$VAULT_NAME" ] && continue

    ITEM=$(az backup item list \
      --vault-name "$VAULT_NAME" \
      --resource-group "$VAULT_RG" \
      --backup-management-type AzureIaasVM \
      --query "[?properties.friendlyName=='${VM}'].{container:properties.containerName,item:name}" \
      -o tsv)

    [ -z "$ITEM" ] && continue

    CONTAINER=$(echo "$ITEM" | head -n1 | cut -f1)
    ITEM_NAME=$(echo "$ITEM" | head -n1 | cut -f2)

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
      FOUND=1
    fi
    break
  done <<< "$VAULTS"

  [ "$FOUND" -eq 0 ] && echo "[$VM] No está protegida en ningún vault de la suscripción."
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

    JOB_JSON=$(az backup job show \
      --name "${JOB_IDS[$i]}" \
      --vault-name "${JOB_VAULTS[$i]}" \
      --resource-group "${JOB_RGS[$i]}" \
      --query "{status:properties.status,snapshot:properties.extendedInfo.subTasks[?taskName=='Take Snapshot'].status|[0]}" \
      -o tsv)

    STATUS=$(echo "$JOB_JSON" | cut -f1)
    SNAPSHOT_PHASE=$(echo "$JOB_JSON" | cut -f2)
    ELAPSED_MIN=$(( ($(date +%s) - START_EPOCH) / 60 ))

    if [ "$STATUS" = "Completed" ] || [ "$STATUS" = "CompletedWithWarnings" ]; then
      echo "[${JOB_VMS[$i]}] Respaldo completado."
      DONE[$i]=1
    elif [ "$STATUS" = "Failed" ]; then
      echo "[${JOB_VMS[$i]}] El respaldo FALLÓ. Revísalo en el portal."
      DONE[$i]=1
    elif [ "$WAIT_FOR_SNAPSHOT" = "true" ] && [ "$SNAPSHOT_PHASE" = "Completed" ]; then
      echo "[${JOB_VMS[$i]}] Snapshot completado, transfiriendo al vault. Servidor liberado."
      DONE[$i]=1
    elif [ "$WAIT_FOR_SNAPSHOT" = "true" ] && [ "$ELAPSED_MIN" -gt "$SNAPSHOT_TIMEOUT_MINUTES" ]; then
      echo "[${JOB_VMS[$i]}] Más de ${SNAPSHOT_TIMEOUT_MINUTES} min: se asume el snapshot terminado."
      DONE[$i]=1
    else
      echo "[${JOB_VMS[$i]}] En progreso (estado: ${STATUS}, ${ELAPSED_MIN} min)..."
      PENDING=1
    fi
  done

  [ "$PENDING" -eq 0 ] && break
  sleep "$POLL_SECONDS"
done

echo "=========================================================="
echo " Todos los servidores procesaron su snapshot."
echo " Ya puedes continuar con el mantenimiento."
echo "=========================================================="
