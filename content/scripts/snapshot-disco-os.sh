#!/usr/bin/env bash
# Snapshot manual del disco de sistema operativo de una o varias VMs (Azure CLI).
set -uo pipefail

# ---------------------------------------------------------------------------
# PARÁMETROS
# ---------------------------------------------------------------------------
VM_NAMES="<vmNames>"          # VMs separadas por coma
IDENTIFICADOR="<identificador>"  # Sufijo del nombre del snapshot
SKU="<sku>"                   # Tipo de almacenamiento del snapshot

FECHA=$(date '+%Y%m%d')
IFS=',' read -ra VMS <<< "${VM_NAMES// /}"

for VM in "${VMS[@]}"; do
  [ -z "$VM" ] && continue
  echo "--------------------------------------------------"
  echo "Procesando VM: $VM"

  # 1. Buscar la VM en toda la suscripción activa
  VM_INFO=$(az vm list \
    --query "[?name=='${VM}'].{rg:resourceGroup,osDiskId:storageProfile.osDisk.managedDisk.id,location:location}" \
    -o tsv | head -n1)

  if [ -z "$VM_INFO" ]; then
    echo "  [!] No se encontró la VM '$VM' en la suscripción activa."
    continue
  fi

  RG=$(echo "$VM_INFO" | cut -f1)
  OS_DISK_ID=$(echo "$VM_INFO" | cut -f2)
  LOCATION=$(echo "$VM_INFO" | cut -f3)

  if [ -z "$OS_DISK_ID" ]; then
    echo "  [!] La VM existe pero no usa Managed Disks."
    continue
  fi

  # 2. Crear el snapshot en el mismo grupo de recursos y región
  SNAPSHOT_NAME="${VM}-OsDisk_${IDENTIFICADOR}-${FECHA}"
  echo "  Creando snapshot '${SNAPSHOT_NAME}' en el RG '${RG}'..."

  az snapshot create \
    --resource-group "$RG" \
    --name "$SNAPSHOT_NAME" \
    --location "$LOCATION" \
    --source "$OS_DISK_ID" \
    --sku "$SKU" \
    --tags "vm=${VM}" "origen=snapshot-manual" \
    --output none

  if [ $? -eq 0 ]; then
    echo "  [OK] Snapshot creado: $SNAPSHOT_NAME"
  else
    echo "  [ERROR] No se pudo crear el snapshot de '$VM'."
  fi
done

echo "--------------------------------------------------"
echo "Proceso finalizado."
