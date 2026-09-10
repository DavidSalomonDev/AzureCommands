#!/usr/bin/env bash
# Inventario de VMs afectadas por el despliegue de MANA (Azure CLI).
# Marca RequiereRevision cuando el tamaño está en una familia afectada,
# tiene Accelerated Networking habilitado y el SO no es compatible de fábrica.
set -uo pipefail

# ---------------------------------------------------------------------------
# PARÁMETROS
# ---------------------------------------------------------------------------
SUBSCRIPTION="<subscription>"   # ID o nombre; vacío = suscripción activa
CSV_PATH="<csvPath>"            # Archivo de salida
ONLY_AFFECTED="<onlyAffected>"  # true = exporta solo las que requieren revisión

# SO compatibles con MANA out-of-the-box
COMPATIBLE_OS='(2022|2025|20[._]04|22[._]04|24[._]04|8[._][6-9]|9[._][0-9]|15-sp[3-7]|azure-linux|al2022)'

# Familias afectadas (Av2, Bsv2, Dv1-v5, Dpsv6, Ev3-v5, Epsv6, Ebsv5, F, G, L)
AFFECTED_SIZES='^Standard_(A[0-9]+.*v2|B[0-9]+.*sv2|D.*_v[1-5]|Dp.*_v6|E.*_v[3-5]|Ep.*_v6|Eb.*_v5|F.*|G.*|L.*)$'
# Las variantes AMD (D/E con "a" tras el número) no están afectadas
AMD_SIZES='^Standard_[ED][0-9]+a(d)?s?_v[0-9]+$'

if [ -n "$SUBSCRIPTION" ]; then
  az account set --subscription "$SUBSCRIPTION"
fi

echo "Analizando VMs de la suscripción activa..."
echo "VMName;ResourceGroup;PrivateIP;VMSize;IsAffectedSize;AcceleratedNet;OSImage;IsOSCompatible;RequiereRevision" > "$CSV_PATH"

az vm list --show-details \
  --query "[].{name:name,rg:resourceGroup,size:hardwareProfile.vmSize,ips:privateIps,offer:storageProfile.imageReference.offer,sku:storageProfile.imageReference.sku,ostype:storageProfile.osDisk.osType}" \
  -o tsv |
while IFS=$'\t' read -r NAME RG SIZE IPS OFFER SKU OSTYPE; do
  [ -z "$NAME" ] && continue

  # 1. ¿El tamaño pertenece a una familia afectada?
  IS_AFFECTED=false
  if echo "$SIZE" | grep -Eq "$AFFECTED_SIZES" && ! echo "$SIZE" | grep -Eq "$AMD_SIZES"; then
    IS_AFFECTED=true
  fi

  # 2. ¿Alguna NIC tiene Accelerated Networking?
  HAS_ACCNET=false
  NIC_IDS=$(az vm show --name "$NAME" --resource-group "$RG" \
    --query "networkProfile.networkInterfaces[].id" -o tsv)
  for NIC_ID in $NIC_IDS; do
    ACCNET=$(az network nic show --ids "$NIC_ID" --query "enableAcceleratedNetworking" -o tsv)
    if [ "$ACCNET" = "true" ]; then
      HAS_ACCNET=true
      break
    fi
  done

  # 3. ¿La imagen del SO es compatible de fábrica?
  OS_IMAGE="${OFFER:-CustomImage} ${SKU:-$OSTYPE}"
  IS_OS_COMPATIBLE=false
  if [ -n "$SKU" ] && echo "$OS_IMAGE" | grep -Eiq "$COMPATIBLE_OS"; then
    IS_OS_COMPATIBLE=true
  fi

  REQUIERE_REVISION=false
  if [ "$IS_AFFECTED" = true ] && [ "$HAS_ACCNET" = true ] && [ "$IS_OS_COMPATIBLE" = false ]; then
    REQUIERE_REVISION=true
  fi

  if [ "$ONLY_AFFECTED" = "true" ] && [ "$REQUIERE_REVISION" = false ]; then
    continue
  fi

  echo "${NAME};${RG};${IPS};${SIZE};${IS_AFFECTED};${HAS_ACCNET};${OS_IMAGE};${IS_OS_COMPATIBLE};${REQUIERE_REVISION}" \
    | tee -a "$CSV_PATH"
done

echo "Reporte generado en: $CSV_PATH"
