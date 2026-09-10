#!/usr/bin/env bash
# Verificación remota del driver MANA en VMs Linux, vía el agente de Azure.
set -uo pipefail

# ---------------------------------------------------------------------------
# PARÁMETROS
# ---------------------------------------------------------------------------
VM_NAMES="<vmNames>"      # VMs Linux separadas por coma
CSV_PATH="<csvPath>"      # Archivo de salida (deja vacío para no exportar)

# Comando que se ejecuta DENTRO de cada VM
CHECK_COMMAND='grep /mana*.ko /lib/modules/$(uname -r)/modules.builtin || find /lib/modules/$(uname -r)/kernel -name mana*.ko*'

IFS=',' read -ra VMS <<< "${VM_NAMES// /}"

echo "Iniciando validación remota mediante Azure CLI..."
[ -n "$CSV_PATH" ] && echo "VMName;ResourceGroup;HasManaDriver;Detalle" > "$CSV_PATH"

for VM in "${VMS[@]}"; do
  [ -z "$VM" ] && continue
  echo ""
  echo "[+] Procesando VM: $VM"

  # 1. Resolver el grupo de recursos automáticamente
  RG=$(az vm list --query "[?name=='${VM}'].resourceGroup" -o tsv | head -n1)

  if [ -z "$RG" ]; then
    echo "    [-] No se encontró la VM en la suscripción activa."
    [ -n "$CSV_PATH" ] && echo "${VM};NOT_FOUND;false;VM no encontrada" >> "$CSV_PATH"
    continue
  fi

  echo "    -> Grupo de recursos: $RG"
  echo "    -> Ejecutando comando en el agente de la VM..."

  # 2. Invocar el comando dentro de la VM
  OUTPUT=$(az vm run-command invoke \
    --resource-group "$RG" \
    --name "$VM" \
    --command-id RunShellScript \
    --scripts "$CHECK_COMMAND" \
    --query "value[0].message" -o tsv)

  # 3. Evaluar la salida
  if echo "$OUTPUT" | grep -q "mana"; then
    DETALLE=$(echo "$OUTPUT" | grep "mana" | head -n1 | tr -d '\r')
    echo "    [OK] Driver MANA presente: $DETALLE"
    [ -n "$CSV_PATH" ] && echo "${VM};${RG};true;${DETALLE}" >> "$CSV_PATH"
  else
    echo "    [!] Sin driver MANA detectado."
    [ -n "$CSV_PATH" ] && echo "${VM};${RG};false;Sin coincidencias" >> "$CSV_PATH"
  fi
done

echo ""
echo "Validación finalizada."
[ -n "$CSV_PATH" ] && echo "Reporte: $CSV_PATH"
