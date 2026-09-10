---
title: Snapshot manual del disco de SO
description: Crea un snapshot del disco de sistema operativo de una o varias VMs, resolviendo grupo de recursos y ubicación automáticamente.
category: Respaldo y snapshots
tags: [snapshot, disco, os-disk, vm]
language: powershell
usage: './snapmanualOSdisk.ps1 -VMNames "vm-app01","vm-sql01"'
requirements:
  - Azure CLI (`az`) con sesión iniciada y la suscripción correcta activa
  - Permisos de *Contributor* sobre los discos y el grupo de recursos
---

Busca cada VM en toda la suscripción (`az vm list`), toma el `managedDisk.id` del disco
de SO y crea el snapshot en el mismo grupo de recursos y región.

El nombre generado sigue el patrón `<VM>-OsDisk_snapMB-<yyyyMMdd>`. Cambia las variables
`$identificador` y `$fecha` al inicio si necesitas otra convención. Las VMs con discos no
administrados se omiten con una advertencia.
