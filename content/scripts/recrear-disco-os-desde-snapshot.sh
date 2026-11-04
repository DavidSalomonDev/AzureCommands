#!/usr/bin/env bash
# Recrea un disco de sistema operativo "limpio" a partir de un snapshot (Azure CLI + azcopy).
#
# Azure no habilita replicacion en VMs anteriores a 2024 migradas despues a Trusted Launch: el
# disco arrastra un securityProfile que ya no cumple. Un disco creado en modo Upload nace sin el,
# asi que al crear la VM nueva Azure lo configura como corresponde hoy.
#
# "az disk create --source" apuntando al snapshot no sirve: copia el perfil de seguridad y el
# VM guest state. Aqui se crea un disco vacio y se copia unicamente el VHD.
#
# Todo corre dentro de un subshell, para que un error termine el script y no tu sesion de
# Cloud Shell. No se toca ni el snapshot ni la VM original.

# ---------------------------------------------------------------------------
# PARÁMETROS
# ---------------------------------------------------------------------------
SUBSCRIPTION_ID="<subscriptionId>"       # ID o nombre de la suscripción de trabajo
SNAPSHOT_RG="<snapshotResourceGroup>"    # Grupo de recursos del snapshot de origen
SNAPSHOT_NAME="<snapshotName>"           # Snapshot del disco de SO que se va a clonar
TARGET_RG="<resourceGroup>"              # Grupo del disco nuevo. Vacío = el del snapshot
NEW_DISK_NAME="<newDiskName>"            # Nombre libre: un disco no se puede renombrar después
SKU="<sku>"                              # Tipo de almacenamiento del disco nuevo
ZONE="<zone>"                            # Zona de disponibilidad. Vacío = disco regional
SAS_DURATION="<sasDuration>"             # Segundos de validez de los SAS. Vacío = 7200

# Mientras haya un SAS concedido el disco se queda en ActiveUpload y no se puede
# adjuntar, así que se revoca pase lo que pase.
revocar() {
  az disk revoke-access -g "$TARGET_RG" -n "$NEW_DISK_NAME" -o none 2>/dev/null
  az snapshot revoke-access -g "$SNAPSHOT_RG" -n "$SNAPSHOT_NAME" -o none 2>/dev/null
}

recrear_disco_os() {
  [ -z "$TARGET_RG" ] && TARGET_RG="$SNAPSHOT_RG"
  [ -z "$SAS_DURATION" ] && SAS_DURATION=7200

  command -v azcopy >/dev/null || { echo "[ERROR] Falta azcopy en el PATH."; return 1; }
  az account set --subscription "$SUBSCRIPTION_ID" || return 1

  # 1. Datos del snapshot ----------------------------------------------------
  # La proyección es una lista y no un diccionario porque en TSV la CLI ordena las
  # claves de un diccionario alfabéticamente. Sobre un objeto único imprime un
  # valor por línea, de ahí el `read` encadenado en vez de `cut`.
  SNAP=$(az snapshot show -g "$SNAPSHOT_RG" -n "$SNAPSHOT_NAME" \
    --query "[diskSizeBytes, diskSizeGB, osType || 'None', hyperVGeneration || 'None', location, sku.name]" \
    -o tsv) || return 1

  { read -r SIZE_BYTES
    read -r SIZE_GB
    read -r OS_TYPE
    read -r HYPERV_GEN
    read -r LOCATION
    read -r SNAP_SKU
  } <<< "$SNAP"

  if [ "$OS_TYPE" = None ] || [ "$HYPERV_GEN" = None ]; then
    echo "[ERROR] El snapshot no es de un disco de SO: le falta osType o hyperVGeneration."
    return 1
  fi

  UPLOAD_BYTES=$((SIZE_BYTES + 512))   # el VHD lleva 512 bytes de footer que no cuentan

  echo "Snapshot : ${SNAPSHOT_NAME} (${SIZE_GB} GB, ${OS_TYPE}, ${HYPERV_GEN}, ${LOCATION}, ${SNAP_SKU})"
  echo "Disco    : ${NEW_DISK_NAME} (RG ${TARGET_RG}, ${SKU}${ZONE:+, zona ${ZONE}})"

  # 2. El nombre del disco nuevo tiene que estar libre ------------------------
  if az disk show -g "$TARGET_RG" -n "$NEW_DISK_NAME" -o none 2>/dev/null; then
    echo "[ERROR] Ya existe el disco '${NEW_DISK_NAME}' en '${TARGET_RG}'. Usa otro nombre."
    return 1
  fi

  # 3. Un Disk Export abierto desde el portal bloquea el grant-access de abajo.
  az snapshot revoke-access -g "$SNAPSHOT_RG" -n "$SNAPSHOT_NAME" -o none 2>/dev/null

  # 4. Disco vacío en modo Upload --------------------------------------------
  # Sin --security-type nace como Standard, o sea sin perfil heredado: ese es el punto.
  CREAR=(-g "$TARGET_RG" -n "$NEW_DISK_NAME" -l "$LOCATION" --sku "$SKU"
         --os-type "$OS_TYPE" --hyper-v-generation "$HYPERV_GEN"
         --upload-type Upload --upload-size-bytes "$UPLOAD_BYTES"
         --tags "origen=${SNAPSHOT_NAME}")
  [ -n "$ZONE" ] && CREAR+=(--zone "$ZONE")

  echo "Creando disco vacío en modo Upload..."
  az disk create "${CREAR[@]}" -o none || return 1
  trap revocar EXIT INT TERM

  # 5. SAS temporales --------------------------------------------------------
  # --access-level Read sobre el snapshot devuelve sólo el VHD; el VM guest state
  # viaja en otro SAS, y es justo lo que no se quiere copiar.
  # La propiedad de la API es `accessSAS`; las versiones viejas de la CLI la
  # exponían como `accessSas`. Se piden las dos, si no el SAS llega vacío.
  echo "Generando SAS (${SAS_DURATION}s)..."
  SNAP_SAS=$(az snapshot grant-access -g "$SNAPSHOT_RG" -n "$SNAPSHOT_NAME" \
    --duration-in-seconds "$SAS_DURATION" --access-level Read \
    --query "accessSAS || accessSas" -o tsv) || return 1
  DISK_SAS=$(az disk grant-access -g "$TARGET_RG" -n "$NEW_DISK_NAME" \
    --duration-in-seconds "$SAS_DURATION" --access-level Write \
    --query "accessSAS || accessSas" -o tsv) || return 1

  if [ -z "$SNAP_SAS" ] || [ -z "$DISK_SAS" ]; then
    echo "[ERROR] La CLI no devolvió el SAS. Mira cómo se llama la propiedad con:"
    echo "        az disk grant-access -g ${TARGET_RG} -n ${NEW_DISK_NAME} --duration-in-seconds 60 --access-level Write"
    return 1
  fi

  # 6. Copia del VHD, servidor a servidor ------------------------------------
  azcopy copy "$SNAP_SAS" "$DISK_SAS" --blob-type PageBlob || {
    echo "[ERROR] Falló la copia. Borra el disco a medias y reintenta:"
    echo "        az disk delete -g ${TARGET_RG} -n ${NEW_DISK_NAME}"
    return 1
  }

  # 7. Revocar antes de consultar: si no, el disco figura todavía en ActiveUpload.
  revocar
  trap - EXIT INT TERM

  # 8. Verificación. Seguridad None = no heredó Trusted Launch ---------------
  echo "Resultado (estado / seguridad / generación / zona / SKU / GB):"
  az disk show -g "$TARGET_RG" -n "$NEW_DISK_NAME" \
    --query "[diskState, securityProfile.securityType || 'None', hyperVGeneration, zones[0] || '-', sku.name, diskSizeGB]" \
    -o tsv | tr '\n' ' '
  echo
}

( set -uo pipefail; recrear_disco_os )
