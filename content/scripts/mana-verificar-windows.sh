#!/usr/bin/env bash
# Verificación remota del driver MANA en VMs Windows, vía el agente de Azure.
set -uo pipefail

# ---------------------------------------------------------------------------
# PARÁMETROS
# ---------------------------------------------------------------------------
VM_NAMES="<vmNames>"      # VMs Windows separadas por coma
CSV_PATH="<csvPath>"      # Archivo de salida (deja vacío para no exportar)

# Comando PowerShell que se ejecuta DENTRO de cada VM Windows
CHECK_COMMAND='Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceName -like "*Microsoft Azure Network Adapter*" -or $_.DeviceName -like "*MANA*" } | Select-Object DeviceName, DriverVersion | Format-List'

IFS=',' read -ra VMS <<< "${VM_NAMES// /}"

echo "Iniciando validación remota en VMs Windows mediante Azure CLI..."
[ -n "$CSV_PATH" ] && echo "VMName;ResourceGroup;HasManaDriver;DriverVersion" > "$CSV_PATH"

for VM in "${VMS[@]}"; do
  [ -z "$VM" ] && continue
  echo ""
  echo "[+] Procesando VM: $VM"

  RG=$(az vm list --query "[?name=='${VM}'].resourceGroup" -o tsv | head -n1)

  if [ -z "$RG" ]; then
    echo "    [-] No se encontró la VM en la suscripción activa."
    [ -n "$CSV_PATH" ] && echo "${VM};NOT_FOUND;false;N/A" >> "$CSV_PATH"
    continue
  fi

  echo "    -> Grupo de recursos: $RG"
  echo "    -> Consultando drivers mediante el agente de Azure..."

  OUTPUT=$(az vm run-command invoke \
    --resource-group "$RG" \
    --name "$VM" \
    --command-id RunPowerShellScript \
    --scripts "$CHECK_COMMAND" \
    --query "value[0].message" -o tsv)

  if echo "$OUTPUT" | grep -qi "DriverVersion"; then
    VERSION=$(echo "$OUTPUT" | grep -i "DriverVersion" | head -n1 | awk -F': ' '{print $2}' | tr -d '\r')
    echo "    [OK] Driver MANA presente (versión ${VERSION})."
    [ -n "$CSV_PATH" ] && echo "${VM};${RG};true;${VERSION}" >> "$CSV_PATH"
  else
    echo "    [!] Sin driver MANA detectado."
    [ -n "$CSV_PATH" ] && echo "${VM};${RG};false;N/A" >> "$CSV_PATH"
  fi
done

echo ""
echo "Validación finalizada."
[ -n "$CSV_PATH" ] && echo "Reporte: $CSV_PATH"
