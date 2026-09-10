#!/usr/bin/env bash
# Snapshot manual del disco de SO y de todos los discos de datos (Azure CLI).
set -uo pipefail

# ---------------------------------------------------------------------------
# PARÁMETROS
# ---------------------------------------------------------------------------
VM_NAMES="<vmNames>"             # VMs separadas por coma
IDENTIFICADOR="<identificador>"  # Sufijo del nombre de los snapshots
SKU="<sku>"                      # Tipo de almacenamiento de los snapshots

FECHA=$(date '+%Y%m%d')
IFS=',' read -ra VMS <<< "${VM_NAMES// /}"

crear_snapshot() {
  local RG="$1" NOMBRE="$2" LOCATION="$3" DISK_ID="$4"

  echo "  Creando snapshot '${NOMBRE}'..."
  if az snapshot create \
    --resource-group "$RG" \
    --name "$NOMBRE" \
    --location "$LOCATION" \
    --source "$DISK_ID" \
    --sku "$SKU" \
    --output none; then
    echo "  [OK] $NOMBRE"
  else
    echo "  [ERROR] No se pudo crear $NOMBRE"
  fi
}

for VM in "${VMS[@]}"; do
  [ -z "$VM" ] && continue
  echo "=================================================="
  echo "Procesando VM: $VM"

  VM_INFO=$(az vm list \
    --query "[?name=='${VM}'].{rg:resourceGroup,location:location,osDiskId:storageProfile.osDisk.managedDisk.id}" \
    -o tsv | head -n1)

  if [ -z "$VM_INFO" ]; then
    echo "  [!] No se encontró la VM '$VM' en la suscripción activa."
    continue
  fi

  RG=$(echo "$VM_INFO" | cut -f1)
  LOCATION=$(echo "$VM_INFO" | cut -f2)
  OS_DISK_ID=$(echo "$VM_INFO" | cut -f3)

  # A. Disco de sistema operativo
  if [ -n "$OS_DISK_ID" ]; then
    crear_snapshot "$RG" "${VM}-OsDisk_${IDENTIFICADOR}-${FECHA}" "$LOCATION" "$OS_DISK_ID"
  else
    echo "  [!] La VM no usa Managed Disks para el disco de SO."
  fi

  # B. Discos de datos, uno por LUN
  DATA_DISKS=$(az vm show --name "$VM" --resource-group "$RG" \
    --query "storageProfile.dataDisks[].{lun:lun,id:managedDisk.id}" -o tsv)

  if [ -z "$DATA_DISKS" ]; then
    echo "  La VM no tiene discos de datos."
    continue
  fi

  while IFS=$'\t' read -r LUN DISK_ID; do
    [ -z "$DISK_ID" ] && continue
    crear_snapshot "$RG" "${VM}-DataDisk-${LUN}_${IDENTIFICADOR}-${FECHA}" "$LOCATION" "$DISK_ID"
  done <<< "$DATA_DISKS"
done

echo "=================================================="
echo "Proceso finalizado."
