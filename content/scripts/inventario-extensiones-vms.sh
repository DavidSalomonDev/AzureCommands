#!/usr/bin/env bash
# Inventario de extensiones instaladas en las VMs de una suscripción de Azure.
set -uo pipefail

# ---------------------------------------------------------------------------
# PARÁMETROS
# ---------------------------------------------------------------------------
SUBSCRIPTION_ID="<subscriptionId>"    # ID o nombre de la suscripción de trabajo
VM_NAMES="<vmNames>"                  # VMs separadas por coma; vacío = todas
RESOURCE_GROUP="<resourceGroup>"      # Limita el barrido a un grupo de recursos
FILTRO="<filtro>"                     # Texto a buscar en nombre/publicador; vacío = todo
RESUMEN_CONSOLA="<resumenConsola>"    # true = tabla consolidada al terminar
CSV_PATH="<csvPath>"                  # Archivo de salida; vacío = no exportar

# ---------------------------------------------------------------------------
# SUSCRIPCIÓN DE TRABAJO
# ---------------------------------------------------------------------------
az account set --subscription "$SUBSCRIPTION_ID" || {
  echo "No se pudo seleccionar la suscripción '${SUBSCRIPTION_ID}'."
  exit 1
}

echo "Suscripción: $(az account show --query name -o tsv | tr -d '\r')"

# ---------------------------------------------------------------------------
# 1. Determinar las VMs a inspeccionar (pares nombre + grupo de recursos)
# ---------------------------------------------------------------------------
# En Windows az devuelve CRLF: sin tr -d '\r' el grupo de recursos arrastra un
# retorno de carro y las consultas posteriores fallan con "Bad Request".
TARGETS=$(mktemp)

if [ -n "$VM_NAMES" ]; then
  IFS=',' read -ra WANTED <<< "${VM_NAMES// /}"
  for VM in "${WANTED[@]}"; do
    [ -z "$VM" ] && continue
    # Sólo el grupo de recursos: una proyección de dos campos saldría en dos
    # líneas en tsv, no tabulada.
    if [ -n "$RESOURCE_GROUP" ]; then
      RG=$(az vm show --resource-group "$RESOURCE_GROUP" --name "$VM" \
        --query resourceGroup -o tsv 2>/dev/null | tr -d '\r' | head -n1)
    else
      RG=$(az vm list --query "[?name=='${VM}'].resourceGroup" -o tsv | tr -d '\r' | head -n1)
    fi
    if [ -z "$RG" ]; then
      echo "[!] VM no encontrada: $VM"
    else
      printf '%s\t%s\n' "$VM" "$RG" >> "$TARGETS"
    fi
  done
else
  echo "Listando todas las VMs${RESOURCE_GROUP:+ del grupo $RESOURCE_GROUP}..."
  if [ -n "$RESOURCE_GROUP" ]; then
    az vm list --resource-group "$RESOURCE_GROUP" --query "[].[name,resourceGroup]" -o tsv \
      | tr -d '\r' > "$TARGETS"
  else
    az vm list --query "[].[name,resourceGroup]" -o tsv | tr -d '\r' > "$TARGETS"
  fi
fi

TOTAL_VMS=$(grep -c . "$TARGETS" || true)
if [ "$TOTAL_VMS" -eq 0 ]; then
  echo "No hay VMs que inspeccionar."
  rm -f "$TARGETS"
  exit 0
fi

echo "VMs a inspeccionar: $TOTAL_VMS"
[ -n "$FILTRO" ] && echo "Filtro: $FILTRO"
[ -n "$CSV_PATH" ] && echo "VMName;ResourceGroup;Extension;Publisher;Type;Version;ProvisioningState;AutoUpgradeMinor" > "$CSV_PATH"

# ---------------------------------------------------------------------------
# 2. Consultar las extensiones de cada VM
# ---------------------------------------------------------------------------
TOTAL_EXT=0
SIN_EXT=""
CON_ERROR=""
ERR_FILE=$(mktemp)
ROWS=$(mktemp)   # acumula el detalle para el resumen final en consola

while IFS=$'\t' read -r VM RG; do
  [ -z "${VM:-}" ] && continue
  echo ""
  echo "[+] ${VM}  (grupo: ${RG})"

  # typePropertiesType es el "type" real de la extensión (properties.type)
  if ! EXTS=$(az vm extension list \
    --resource-group "$RG" \
    --vm-name "$VM" \
    --query "[].[name,typeHandlerVersion,provisioningState,publisher,typePropertiesType,autoUpgradeMinorVersion]" \
    -o tsv 2>"$ERR_FILE" | tr -d '\r'); then
    echo "    [-] No se pudieron consultar las extensiones:"
    sed 's/^/        /' "$ERR_FILE"
    CON_ERROR="${CON_ERROR}${VM} "
    continue
  fi

  if [ -n "$FILTRO" ]; then
    EXTS=$(printf '%s\n' "$EXTS" | grep -i -- "$FILTRO")
  fi

  if [ -z "$EXTS" ]; then
    echo "    (sin extensiones${FILTRO:+ que coincidan con el filtro})"
    SIN_EXT="${SIN_EXT}${VM} "
    continue
  fi

  # printf cuenta bytes: las cabeceras acentuadas necesitan un ancho mayor
  printf '    %-43s %-11s %-12s %s\n' "EXTENSIÓN" "VERSIÓN" "ESTADO" "PUBLICADOR"
  while IFS=$'\t' read -r NAME VERSION STATE PUB TYPE AUTOUP; do
    [ -z "${NAME:-}" ] && continue
    printf '    %-42s %-10s %-12s %s\n' "$NAME" "${VERSION:-n/d}" "${STATE:-n/d}" "${PUB:-n/d}"
    TOTAL_EXT=$((TOTAL_EXT + 1))
    printf '%s\t%s\t%s\t%s\t%s\n' \
      "$VM" "$NAME" "${VERSION:-n/d}" "${STATE:-n/d}" "${PUB:-n/d}" >> "$ROWS"
    if [ -n "$CSV_PATH" ]; then
      echo "${VM};${RG};${NAME};${PUB};${TYPE};${VERSION};${STATE};${AUTOUP}" >> "$CSV_PATH"
    fi
  done <<< "$EXTS"
done < "$TARGETS"

rm -f "$TARGETS" "$ERR_FILE"

# ---------------------------------------------------------------------------
# 3. Resumen final
# ---------------------------------------------------------------------------
if [ "$RESUMEN_CONSOLA" = "true" ] && [ "$TOTAL_EXT" -gt 0 ]; then
  echo ""
  echo "=== Detalle consolidado ==="
  printf '%-22s %-43s %-11s %-12s %s\n' "VM" "EXTENSIÓN" "VERSIÓN" "ESTADO" "PUBLICADOR"
  while IFS=$'\t' read -r R_VM R_NAME R_VER R_STATE R_PUB; do
    [ -z "${R_VM:-}" ] && continue
    printf '%-22s %-42s %-10s %-12s %s\n' "$R_VM" "$R_NAME" "$R_VER" "$R_STATE" "$R_PUB"
  done < "$ROWS"
fi

rm -f "$ROWS"

echo ""
echo "Resumen: ${TOTAL_VMS} VMs | ${TOTAL_EXT} extensiones encontradas"
if [ -n "$SIN_EXT" ]; then
  echo "Sin extensiones: ${SIN_EXT}"
fi
if [ -n "$CON_ERROR" ]; then
  echo "Con error de consulta: ${CON_ERROR}"
fi
if [ -n "$CSV_PATH" ]; then
  echo "Reporte: $CSV_PATH"
fi
