---
title: Recrear disco de SO limpio desde un snapshot
description: Crea un disco de sistema operativo nuevo copiando sólo el VHD de un snapshot, sin heredar el perfil de seguridad, para poder recrear VMs con Trusted Launch y habilitar replicación.
category: Respaldo y snapshots
tags: [disco, os-disk, snapshot, trusted-launch, azcopy, asr, replicacion]
operation: create
language: bash
usage: "bash recrear-disco-os-desde-snapshot.sh"
requirements:
  - Azure CLI (`az`) con sesión iniciada (`az login`) y versión reciente (`--upload-type` existe desde 2.52)
  - "`azcopy` en el PATH — Cloud Shell ya lo trae"
  - Permisos de *Contributor* sobre el snapshot y el grupo de recursos destino
  - El snapshot debe ser de un disco de SO, con `osType` y `hyperVGeneration` definidos
parameters:
  - name: subscriptionId
    label: Suscripción
    description: ID o nombre de la suscripción donde viven el snapshot y el disco nuevo.
    type: string
    required: true
    placeholder: 00000000-0000-0000-0000-000000000000
  - name: snapshotResourceGroup
    label: Grupo del snapshot
    description: Grupo de recursos donde está el snapshot de origen.
    type: string
    required: true
    placeholder: ms-eastus-spoke-prod-vms-rg
  - name: snapshotName
    label: Snapshot de origen
    description: Snapshot del disco de SO que se va a clonar.
    type: string
    required: true
    placeholder: HL7-FHIR-OsDisk_sn-DM-20261104
  - name: resourceGroup
    label: Grupo destino
    description: Grupo donde quedará el disco nuevo. Vacío = el mismo del snapshot.
    type: string
    required: false
    placeholder: ms-eastus-spoke-prod-vms-rg
  - name: newDiskName
    label: Disco nuevo
    description: Nombre del disco a crear. Si ya existe uno con ese nombre, el script se detiene.
    type: string
    required: true
    placeholder: hl7fhir-osdisk-std
  - name: sku
    label: Tipo de almacenamiento
    description: Usa el mismo SKU del disco original para no cambiar el rendimiento de la VM.
    type: enum
    required: true
    default: Premium_LRS
    options: [Premium_LRS, Premium_ZRS, StandardSSD_LRS, StandardSSD_ZRS, Standard_LRS]
  - name: zone
    label: Zona de disponibilidad
    description: Debe coincidir con la zona de la VM que usará el disco. Vacío = disco regional.
    type: enum
    required: false
    options: ["1", "2", "3"]
  - name: sasDuration
    label: Validez de los SAS (segundos)
    description: Tiempo que tiene azcopy para terminar la copia. Vacío = 7200 (2 horas).
    type: number
    required: false
    placeholder: "7200"
---

## Por qué hace falta

Azure no permite habilitar replicación (Azure Site Recovery) en VMs creadas antes de 2024 que
después se migraron a Trusted Launch: el disco de SO arrastra un `securityProfile` incompleto y
la plataforma lo rechaza. La salida es recrear la VM desde un disco **nuevo** que nazca sin ese
perfil, para que Azure lo configure como exige hoy al crear la VM con Trusted Launch.

El camino corto —`az disk create --source` apuntando al snapshot— no sirve: copia el perfil de
seguridad y el *VM guest state* del snapshot, o sea el problema que se quería dejar atrás.

## Qué hace

1. Lee del snapshot el tamaño, `osType`, `hyperVGeneration` y región, así que no hay que
   teclearlos ni arriesgarse a equivocarlos.
2. Revoca cualquier *Disk Export* abierto desde el portal, que si no bloquea el `grant-access`.
3. Crea un disco vacío en modo `Upload` de `diskSizeBytes + 512` bytes (los 512 del footer del
   VHD, que el snapshot no cuenta). Sin `--security-type`, es decir Standard.
4. Emite un SAS de lectura del snapshot y uno de escritura del disco, y copia **sólo el VHD**
   con `azcopy --blob-type PageBlob`, servidor a servidor. El *VM guest state* viaja en un SAS
   aparte y aquí nunca se pide.
5. Revoca los dos accesos —obligatorio, si no el disco se queda en `ActiveUpload` y no se puede
   adjuntar— y muestra el estado final.

El snapshot y la VM original no se tocan: lo único que se crea es el disco nuevo.

## Detalles que importan

- **Se detiene si el disco destino ya existe.** Nunca sobrescribe.
- **Los SAS no se imprimen**: son credenciales. Si el script muere a medias, un `trap` revoca
  los accesos de todas formas.
- Si `azcopy` falla, el disco queda a medias y hay que borrarlo antes de reintentar; el propio
  mensaje de error trae el comando.
- La zona y el SKU tienen que coincidir con lo que va a usar la VM nueva: un disco zonal no se
  adjunta a una VM en otra zona.
- Al terminar, `securityProfile.securityType` debe salir vacío o `None`. Si sale
  `TrustedLaunch`, el disco heredó el perfil y no sirve para este caso.

## Después de ejecutarlo

Crear la VM nueva desde este disco con Trusted Launch habilitado, verificar que arranca, y
**recién entonces** habilitar la replicación.
