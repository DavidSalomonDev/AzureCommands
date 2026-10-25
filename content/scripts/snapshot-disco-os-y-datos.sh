#!/usr/bin/env bash
# Snapshot manual del disco de SO y de todos los discos de datos (Azure CLI).
set -uo pipefail

# ---------------------------------------------------------------------------
# PARÁMETROS
# ---------------------------------------------------------------------------
SUBSCRIPTION_ID="<subscriptionId>"  # ID o nombre de la suscripción de trabajo
VM_NAMES="<vmNames>"                # VMs separadas por coma
IDENTIFICADOR="<identificador>"     # Sufijo del nombre de los snapshots
SKU="<sku>"                         # Tipo de almacenamiento de los snapshots

# ---------------------------------------------------------------------------
# SUSCRIPCIÓN DE TRABAJO
# ---------------------------------------------------------------------------
az account set --subscription "$SUBSCRIPTION_ID" || {
  echo "No se pudo seleccionar la suscripción '${SUBSCRIPTION_ID}'."
  exit 1
}

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

  # JMESPath distingue mayúsculas de minúsculas y no tiene función para
  # normalizarlas, así que la coincidencia se resuelve en bash sobre la lista
  # completa. No cuesta una llamada extra: --query se aplica del lado del
  # cliente, sobre la misma respuesta.
  #
  # La proyección es una LISTA, no un diccionario: con -o tsv, Azure CLI ordena
  # las claves de un diccionario alfabéticamente y los valores salen
  # intercambiados.
  VM_BUSCADA=$(printf '%s' "$VM" | tr '[:upper:]' '[:lower:]')
  VM_INFO=$(az vm list \
    --query "[].[name, resourceGroup, location, storageProfile.osDisk.managedDisk.id]" \
    -o tsv | tr -d '\r' \
    | awk -F'\t' -v buscada="$VM_BUSCADA" 'tolower($1) == buscada { print; exit }')

  if [ -z "$VM_INFO" ]; then
    echo "  [!] No se encontró la VM '$VM' en la suscripción activa."
    continue
  fi

  # Se usa el nombre tal como lo tiene Azure para que el snapshot no herede la
  # forma en que se escribió la VM al llamar al script.
  VM_REAL=$(echo "$VM_INFO" | cut -f1)
  RG=$(echo "$VM_INFO" | cut -f2)
  LOCATION=$(echo "$VM_INFO" | cut -f3)
  OS_DISK_ID=$(echo "$VM_INFO" | cut -f4)

  # El TSV de Azure CLI imprime los nulos como el literal "None"
  [ "$OS_DISK_ID" = "None" ] && OS_DISK_ID=""

  if [ "$VM_REAL" != "$VM" ]; then
    echo "  En Azure se llama '${VM_REAL}'; se usa esa forma."
  fi

  # A. Disco de sistema operativo
  if [ -n "$OS_DISK_ID" ]; then
    crear_snapshot "$RG" "${VM_REAL}-OsDisk_${IDENTIFICADOR}-${FECHA}" "$LOCATION" "$OS_DISK_ID"
  else
    echo "  [!] La VM no usa Managed Disks para el disco de SO."
  fi

  # B. Discos de datos, uno por LUN
  DATA_DISKS=$(az vm show --name "$VM_REAL" --resource-group "$RG" \
    --query "storageProfile.dataDisks[].[lun, managedDisk.id]" -o tsv | tr -d '\r')

  if [ -z "$DATA_DISKS" ]; then
    echo "  La VM no tiene discos de datos."
    continue
  fi

  while IFS=$'\t' read -r LUN DISK_ID; do
    [ -z "$DISK_ID" ] && continue
    crear_snapshot "$RG" "${VM_REAL}-DataDisk-${LUN}_${IDENTIFICADOR}-${FECHA}" "$LOCATION" "$DISK_ID"
  done <<< "$DATA_DISKS"
done

echo "=================================================="
echo "Proceso finalizado."
