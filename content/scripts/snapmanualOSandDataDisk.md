---
title: Snapshot manual de disco de SO y discos de datos
description: Igual que el snapshot de disco de SO, pero además recorre los discos de datos de cada VM y crea un snapshot por LUN.
category: Respaldo y snapshots
tags: [snapshot, disco, data-disk, os-disk, vm]
language: powershell
usage: './snapmanualOSandDataDisk.ps1 -VMNames "vm-app01","vm-sql01"'
requirements:
  - Azure CLI (`az`) con sesión iniciada y la suscripción correcta activa
  - Permisos de *Contributor* sobre los discos y el grupo de recursos
---

Versión completa del snapshot manual: consulta `storageProfile.dataDisks` y crea un
snapshot por cada disco de datos además del de sistema operativo, nombrándolos con el
LUN correspondiente (`<VM>-DataDisk-<lun>_snapMB-<yyyyMMdd>`).

Úsalo antes de mantenimientos en servidores con datos en discos adicionales; para VMs
que solo tienen disco de SO basta con la versión reducida.
