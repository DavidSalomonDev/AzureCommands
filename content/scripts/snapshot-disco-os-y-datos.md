---
title: Snapshot manual de disco de SO y discos de datos
description: Igual que el snapshot de disco de SO, pero además recorre los discos de datos de cada VM y crea un snapshot por LUN.
category: Respaldo y snapshots
tags: [snapshot, disco, data-disk, os-disk, vm]
language: bash
usage: "bash snapshot-disco-os-y-datos.sh"
requirements:
  - Azure CLI (`az`) con sesión iniciada y la suscripción correcta activa
  - Permisos de *Contributor* sobre los discos y el grupo de recursos
parameters:
  - name: vmNames
    label: VMs
    description: Nombres separados por coma.
    type: string
    required: true
    placeholder: vm-app01,vm-sql01
  - name: identificador
    label: Identificador del snapshot
    description: Se añade al nombre, antes de la fecha.
    type: string
    required: true
    default: snapMB
  - name: sku
    label: Tipo de almacenamiento
    type: enum
    required: true
    default: Standard_LRS
    options: [Standard_LRS, Standard_ZRS, Premium_LRS]
---

Versión completa del snapshot manual: además del disco de sistema operativo consulta
`storageProfile.dataDisks` y crea un snapshot por cada disco de datos, nombrándolo con su
LUN (`<VM>-DataDisk-<lun>_<identificador>-<yyyyMMdd>`).

Úsalo antes de mantenimientos en servidores con datos en discos adicionales; para VMs que
solo tienen disco de SO basta con la versión reducida.
