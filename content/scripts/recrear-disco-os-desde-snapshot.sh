#!/usr/bin/env bash
# Recrea un disco de sistema operativo "limpio" a partir de un snapshot (Azure CLI + azcopy).
#
# Para que sirve: Azure se niega a habilitar replicacion (Azure Site Recovery) en VMs creadas
# antes de 2024 y migradas despues a Trusted Launch, porque el disco heredado arrastra un perfil
# de seguridad que ya no cumple lo que exige la plataforma. Un disco creado en modo Upload nace
# sin securityProfile, asi que al crear la VM nueva Azure lo configura como corresponde hoy.
#
# Por que no sirve "az disk create --source" apuntando al snapshot: ese camino arrastra el perfil de
# seguridad y el VM guest state del snapshot. Aqui se crea un disco vacio y se copia solo el VHD.
#
# El script no modifica ni el snapshot ni la VM original: unicamente crea un disco nuevo.
set -uo pipefail

# ---------------------------------------------------------------------------
# PARÁMETROS
# ---------------------------------------------------------------------------
SUBSCRIPTION_ID="<subscriptionId>"       # ID o nombre de la suscripción de trabajo
SNAPSHOT_RG="<snapshotResourceGroup>"    # Grupo de recursos del snapshot de origen
SNAPSHOT_NAME="<snapshotName>"           # Snapshot del disco de SO que se va a clonar
TARGET_RG="<resourceGroup>"              # Grupo donde quedará el disco nuevo. Vacío = el del snapshot
NEW_DISK_NAME="<newDiskName>"            # Nombre del disco nuevo
SKU="<sku>"                              # Tipo de almacenamiento del disco nuevo
ZONE="<zone>"                            # Zona de disponibilidad. Vacío = disco regional
SAS_DURATION="<sasDuration>"             # Segundos de validez de los SAS. Vacío = 7200

[ -z "$TARGET_RG" ] && TARGET_RG="$SNAPSHOT_RG"
[ -z "$SAS_DURATION" ] && SAS_DURATION="7200"

# ---------------------------------------------------------------------------
# REQUISITOS
# ---------------------------------------------------------------------------
for BIN in az azcopy; do
  if ! command -v "$BIN" >/dev/null 2>&1; then
    echo "[ERROR] Falta '${BIN}' en el PATH. Cloud Shell ya trae los dos."
    exit 1
  fi
done

exigir() {
  if [ -z "$2" ]; then
    echo "[ERROR] Falta el parámetro: $1."
    exit 1
  fi
}
exigir "grupo de recursos del snapshot" "$SNAPSHOT_RG"
exigir "nombre del snapshot" "$SNAPSHOT_NAME"
exigir "nombre del disco nuevo" "$NEW_DISK_NAME"
exigir "tipo de almacenamiento" "$SKU"

az account set --subscription "$SUBSCRIPTION_ID" || {
  echo "[ERROR] No se pudo seleccionar la suscripción '${SUBSCRIPTION_ID}'."
  exit 1
}

# ---------------------------------------------------------------------------
# REVOCACIÓN DE ACCESOS
# ---------------------------------------------------------------------------
# Los SAS se revocan siempre, incluso si el script muere a medias: mientras haya
# un acceso concedido el disco se queda en ActiveUpload y no se puede adjuntar.
ACCESOS_REVOCADOS=0

revocar_accesos() {
  [ "$ACCESOS_REVOCADOS" -eq 1 ] && return 0
  ACCESOS_REVOCADOS=1
  echo "Revocando accesos SAS..."
  az disk revoke-access -g "$TARGET_RG" -n "$NEW_DISK_NAME" --output none 2>/dev/null
  az snapshot revoke-access -g "$SNAPSHOT_RG" -n "$SNAPSHOT_NAME" --output none 2>/dev/null
  return 0
}

# ---------------------------------------------------------------------------
# 1. DATOS DEL SNAPSHOT DE ORIGEN
# ---------------------------------------------------------------------------
# La consulta devuelve una lista y no un diccionario a propósito: en formato TSV
# la CLI ordena las claves de un diccionario alfabéticamente y cruza las columnas.
echo "=================================================="
echo "Snapshot de origen: ${SNAPSHOT_NAME} (RG ${SNAPSHOT_RG})"

SNAP_INFO=$(az snapshot show -g "$SNAPSHOT_RG" -n "$SNAPSHOT_NAME" \
  --query "[diskSizeBytes, diskSizeGB, osType, hyperVGeneration, location, sku.name, diskState]" \
  -o tsv 2>/dev/null)

if [ -z "$SNAP_INFO" ]; then
  echo "[ERROR] No se encontró el snapshot '${SNAPSHOT_NAME}' en el grupo '${SNAPSHOT_RG}'."
  exit 1
fi

SIZE_BYTES=$(echo "$SNAP_INFO" | cut -f1)
SIZE_GB=$(echo "$SNAP_INFO" | cut -f2)
OS_TYPE=$(echo "$SNAP_INFO" | cut -f3)
HYPERV_GEN=$(echo "$SNAP_INFO" | cut -f4)
LOCATION=$(echo "$SNAP_INFO" | cut -f5)
SNAP_SKU=$(echo "$SNAP_INFO" | cut -f6)
SNAP_STATE=$(echo "$SNAP_INFO" | cut -f7)

if [ -z "$OS_TYPE" ] || [ "$OS_TYPE" = "None" ]; then
  echo "[ERROR] El snapshot no declara 'osType': no es un snapshot de disco de sistema operativo."
  exit 1
fi

if [ -z "$HYPERV_GEN" ] || [ "$HYPERV_GEN" = "None" ]; then
  echo "[ERROR] El snapshot no declara 'hyperVGeneration', y Trusted Launch exige V2."
  echo "        Revisa el disco original antes de continuar."
  exit 1
fi

# El VHD lleva 512 bytes de footer que diskSizeBytes no cuenta.
UPLOAD_BYTES=$((SIZE_BYTES + 512))

echo "  Tamaño       : ${SIZE_GB} GB (${SIZE_BYTES} bytes, upload ${UPLOAD_BYTES})"
echo "  SO           : ${OS_TYPE} / ${HYPERV_GEN}"
echo "  Región       : ${LOCATION}"
echo "  SKU snapshot : ${SNAP_SKU}"
echo "  Estado       : ${SNAP_STATE}"
echo "--------------------------------------------------"
echo "Disco nuevo   : ${NEW_DISK_NAME} (RG ${TARGET_RG}, ${SKU}${ZONE:+, zona ${ZONE}})"
echo "=================================================="

# ---------------------------------------------------------------------------
# 2. EL DISCO DESTINO NO DEBE EXISTIR
# ---------------------------------------------------------------------------
if az disk show -g "$TARGET_RG" -n "$NEW_DISK_NAME" --output none 2>/dev/null; then
  echo "[ERROR] Ya existe un disco '${NEW_DISK_NAME}' en el grupo '${TARGET_RG}'."
  echo "        Usa otro nombre: el script nunca sobrescribe un disco."
  exit 1
fi

# ---------------------------------------------------------------------------
# 3. CERRAR CUALQUIER EXPORT ABIERTO DEL SNAPSHOT
# ---------------------------------------------------------------------------
# Un "Disk Export" lanzado desde el portal deja el snapshot con acceso concedido
# y entonces el grant-access del paso 5 falla. Si no había nada abierto, revocar
# no hace daño.
az snapshot revoke-access -g "$SNAPSHOT_RG" -n "$SNAPSHOT_NAME" --output none 2>/dev/null

# ---------------------------------------------------------------------------
# 4. DISCO VACÍO EN MODO UPLOAD
# ---------------------------------------------------------------------------
# Al no pasar --security-type el disco se crea como Standard, o sea sin perfil de
# seguridad heredado: es justo lo que permite que Azure reconfigure Trusted Launch.
echo "Creando disco vacío en modo Upload..."

CREATE_ARGS=(
  --resource-group "$TARGET_RG"
  --name "$NEW_DISK_NAME"
  --location "$LOCATION"
  --sku "$SKU"
  --os-type "$OS_TYPE"
  --hyper-v-generation "$HYPERV_GEN"
  --upload-type Upload
  --upload-size-bytes "$UPLOAD_BYTES"
  --tags "origen=${SNAPSHOT_NAME}" "creado-por=recrear-disco-os-desde-snapshot"
)
[ -n "$ZONE" ] && CREATE_ARGS+=(--zone "$ZONE")

if ! az disk create "${CREATE_ARGS[@]}" --output none; then
  echo "[ERROR] No se pudo crear el disco '${NEW_DISK_NAME}'."
  echo "        Si la CLI no reconoce --upload-type, actualízala con 'az upgrade'."
  exit 1
fi
echo "  [OK] Disco creado en estado ReadyToUpload."

trap revocar_accesos EXIT INT TERM

# ---------------------------------------------------------------------------
# 5. SAS DE LECTURA DEL SNAPSHOT Y DE ESCRITURA DEL DISCO
# ---------------------------------------------------------------------------
# --access-level Read sobre el snapshot devuelve sólo el VHD; el VM guest state
# viaja en un SAS aparte, y es precisamente lo que no se quiere copiar.
echo "Generando SAS temporales (${SAS_DURATION}s)..."

SNAP_SAS=$(az snapshot grant-access -g "$SNAPSHOT_RG" -n "$SNAPSHOT_NAME" \
  --duration-in-seconds "$SAS_DURATION" --access-level Read \
  --query accessSas -o tsv 2>/dev/null)

DISK_SAS=$(az disk grant-access -g "$TARGET_RG" -n "$NEW_DISK_NAME" \
  --duration-in-seconds "$SAS_DURATION" --access-level Write \
  --query accessSas -o tsv 2>/dev/null)

if [ -z "$SNAP_SAS" ] || [ -z "$DISK_SAS" ]; then
  echo "[ERROR] No se pudieron generar los SAS. Revisa permisos y que no quede"
  echo "        otro export abierto sobre el snapshot."
  exit 1
fi
echo "  [OK] SAS emitidos (no se imprimen: son credenciales)."

# ---------------------------------------------------------------------------
# 6. COPIA DEL VHD (servidor a servidor, sin pasar por esta máquina)
# ---------------------------------------------------------------------------
echo "Copiando el VHD con azcopy..."
if ! azcopy copy "$SNAP_SAS" "$DISK_SAS" --blob-type PageBlob; then
  echo "[ERROR] La copia falló. El disco '${NEW_DISK_NAME}' queda a medias:"
  echo "        bórralo con 'az disk delete -g ${TARGET_RG} -n ${NEW_DISK_NAME}' y reintenta."
  exit 1
fi
echo "  [OK] VHD copiado."

# ---------------------------------------------------------------------------
# 7. REVOCAR ACCESOS (obligatorio para poder adjuntar el disco)
# ---------------------------------------------------------------------------
revocar_accesos
trap - EXIT INT TERM

# ---------------------------------------------------------------------------
# 8. VERIFICACIÓN DEL DISCO NUEVO
# ---------------------------------------------------------------------------
DISK_INFO=$(az disk show -g "$TARGET_RG" -n "$NEW_DISK_NAME" \
  --query "[diskState, securityProfile.securityType, hyperVGeneration, zones[0], sku.name, diskSizeGB]" \
  -o tsv 2>/dev/null)

echo "=================================================="
if [ -z "$DISK_INFO" ]; then
  echo "[!] El disco se creó pero no se pudo leer su estado. Revísalo en el portal."
  exit 1
fi

echo "Disco nuevo: ${NEW_DISK_NAME}"
echo "  Estado     : $(echo "$DISK_INFO" | cut -f1)  (Unattached = listo para usar)"
echo "  Seguridad  : $(echo "$DISK_INFO" | cut -f2)  (vacío o None = sin Trusted Launch heredado)"
echo "  Generación : $(echo "$DISK_INFO" | cut -f3)"
echo "  Zona       : $(echo "$DISK_INFO" | cut -f4)"
echo "  SKU        : $(echo "$DISK_INFO" | cut -f5)"
echo "  Tamaño     : $(echo "$DISK_INFO" | cut -f6) GB"
echo "=================================================="
echo "Siguiente paso: crear la VM nueva desde este disco con Trusted Launch y"
echo "recién entonces habilitar la replicación."
