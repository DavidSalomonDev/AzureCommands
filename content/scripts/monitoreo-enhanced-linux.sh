#!/usr/bin/env bash
# Instala o actualiza la extensión Azure Enhanced Monitoring (SAP) en VMs Linux.
set -uo pipefail

# ---------------------------------------------------------------------------
# PARÁMETROS
# ---------------------------------------------------------------------------
SUBSCRIPTION_ID="<subscriptionId>"    # ID o nombre de la suscripción de trabajo
VM_NAMES="<vmNames>"                  # VMs Linux separadas por coma
RESOURCE_GROUP="<resourceGroup>"      # Déjalo vacío para resolverlo automáticamente
PUBLISHER="<publisher>"               # Publicador de la extensión
EXTENSION="<extension>"               # Tipo de extensión
HANDLER_VERSION="<handlerVersion>"    # Versión major.minor, o "latest"
AUTO_UPGRADE_MINOR="<autoUpgradeMinor>"
API_VERSION="<apiVersion>"

# ---------------------------------------------------------------------------
# SUSCRIPCIÓN DE TRABAJO
# ---------------------------------------------------------------------------
az account set --subscription "$SUBSCRIPTION_ID" || {
  echo "No se pudo seleccionar la suscripción '${SUBSCRIPTION_ID}'."
  exit 1
}

# ID canónico, por si se indicó el nombre de la suscripción
SUBSCRIPTION_ID=$(az account show --query id -o tsv) || exit 1
echo "Suscripción: $(az account show --query name -o tsv) ($SUBSCRIPTION_ID)"
echo "Extensión:   ${PUBLISHER}/${EXTENSION}"

IFS=',' read -ra VMS <<< "${VM_NAMES// /}"
OK=0
FAIL=0

for VM in "${VMS[@]}"; do
  [ -z "$VM" ] && continue
  echo ""
  echo "[+] Procesando VM: $VM"

  # 1. Resolver grupo de recursos y región
  if [ -n "$RESOURCE_GROUP" ]; then
    RG="$RESOURCE_GROUP"
    LOCATION=$(az vm show --resource-group "$RG" --name "$VM" --query location -o tsv 2>/dev/null)
  else
    read -r RG LOCATION < <(az vm list \
      --query "[?name=='${VM}'] | [0].[resourceGroup,location]" -o tsv)
  fi

  if [ -z "${LOCATION:-}" ]; then
    echo "    [-] No se encontró la VM en la suscripción activa."
    FAIL=$((FAIL + 1))
    continue
  fi

  echo "    -> Grupo de recursos: $RG"
  echo "    -> Región: $LOCATION"

  VM_ID="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RG}/providers/Microsoft.Compute/virtualMachines/${VM}"

  # 2. Resolver la versión del handler cuando se pide "latest"
  VERSION="$HANDLER_VERSION"
  if [ -z "$VERSION" ] || [ "$(echo "$VERSION" | tr "[:upper:]" "[:lower:]")" = "latest" ]; then
    IMAGES_URL="https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/providers/Microsoft.Compute/locations/${LOCATION}/publishers/${PUBLISHER}/artifacttypes/vmextension/types/${EXTENSION}/versions"
    FULL_VERSION=$(az rest --method get --url "$IMAGES_URL" \
      --query "[].name" -o tsv 2>/dev/null | sort -V | tail -n1)

    if [ -z "$FULL_VERSION" ]; then
      echo "    [-] No se pudo listar versiones de la extensión en $LOCATION."
      FAIL=$((FAIL + 1))
      continue
    fi
    # typeHandlerVersion sólo acepta major.minor
    VERSION=$(echo "$FULL_VERSION" | cut -d. -f1,2)
    echo "    -> Versión detectada: $VERSION (publicada: $FULL_VERSION)"
  fi

  # 3. Construir el cuerpo de la petición
  BODY=$(mktemp)
  cat > "$BODY" <<EOF
{
  "location": "${LOCATION}",
  "properties": {
    "publisher": "${PUBLISHER}",
    "type": "${EXTENSION}",
    "typeHandlerVersion": "${VERSION}",
    "autoUpgradeMinorVersion": ${AUTO_UPGRADE_MINOR},
    "settings": {
      "cfg": []
    }
  }
}
EOF

  # 4. Instalar / actualizar la extensión
  echo "    -> Aplicando extensión..."
  if az rest \
    --method put \
    --url "https://management.azure.com${VM_ID}/extensions/${EXTENSION}?api-version=${API_VERSION}" \
    --headers "Content-Type=application/json" \
    --body @"$BODY" \
    --output none; then

    # 5. Verificar el estado resultante
    az rest \
      --method get \
      --url "https://management.azure.com${VM_ID}/extensions/${EXTENSION}?api-version=${API_VERSION}" \
      --query "{VM:'${VM}',Nombre:name,Estado:properties.provisioningState,Version:properties.typeHandlerVersion}" \
      --output table
    OK=$((OK + 1))
  else
    echo "    [-] Falló la instalación de la extensión."
    FAIL=$((FAIL + 1))
  fi

  rm -f "$BODY"
done

echo ""
echo "Finalizado. Aplicadas: $OK | Con error: $FAIL"
