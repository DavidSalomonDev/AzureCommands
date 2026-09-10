---
title: Snapshot manual del disco de SO
description: Crea un snapshot del disco de sistema operativo de una o varias VMs, resolviendo grupo de recursos y ubicación automáticamente.
category: Respaldo y snapshots
tags: [snapshot, disco, os-disk, vm]
language: bash
usage: "bash snapshot-disco-os.sh"
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

Busca cada VM en toda la suscripción (`az vm list`), toma el `managedDisk.id` del disco
de SO y crea el snapshot en el mismo grupo de recursos y región.

El nombre generado sigue el patrón `<VM>-OsDisk_<identificador>-<yyyyMMdd>`. Las VMs con
discos no administrados se omiten con una advertencia. Para incluir también los discos de
datos, usa la versión completa.
