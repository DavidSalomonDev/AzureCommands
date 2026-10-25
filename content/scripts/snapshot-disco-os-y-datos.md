---
title: Snapshot manual de disco de SO y discos de datos
description: Igual que el snapshot de disco de SO, pero además recorre los discos de datos de cada VM y crea un snapshot por LUN.
category: Respaldo y snapshots
tags: [snapshot, disco, data-disk, os-disk, vm]
operation: create
language: bash
usage: "bash snapshot-disco-os-y-datos.sh"
requirements:
  - Azure CLI (`az`) con sesión iniciada (`az login`)
  - Permisos de *Contributor* sobre los discos y el grupo de recursos
parameters:
  - name: subscriptionId
    label: Suscripción
    description: ID o nombre de la suscripción donde se ejecuta el script.
    type: string
    required: true
    placeholder: 00000000-0000-0000-0000-000000000000
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

El nombre de la VM no distingue mayúsculas de minúsculas: puedes escribir `srvsap` aunque
en Azure esté como `SRVSAP`. JMESPath sí las distingue y no trae una función para
normalizarlas, así que la coincidencia se resuelve en bash sobre la lista completa, lo que
no cuesta una llamada extra porque `--query` se aplica del lado del cliente. Los snapshots
se nombran con la forma que tiene la VM en Azure, no con la que se escribió al invocar.

Las proyecciones del `--query` son listas, no diccionarios. Con `-o tsv`, Azure CLI imprime
las claves de un diccionario **ordenadas alfabéticamente**, así que un
`{rg:…,location:…,osDiskId:…}` sale con los valores intercambiados; una lista respeta el
orden escrito. Los nulos salen como el literal `None`, que es lo que se comprueba antes de
dar por buena la ruta del disco de SO.
