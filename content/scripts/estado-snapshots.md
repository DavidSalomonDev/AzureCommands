---
title: Estado de snapshots de respaldo de VMs
description: Consulta los respaldos de VM ya disparados y muestra si la fase de snapshot terminó, sin esperar a que el respaldo suba al vault.
category: Respaldo y snapshots
tags: [backup, recovery-services, vm, snapshot, monitoreo]
operation: read
language: bash
usage: "bash estado-snapshots.sh"
requirements:
  - Azure CLI (`az`) con sesión iniciada (`az login`)
  - Permisos de lectura sobre los Recovery Services Vault
parameters:
  - name: subscriptionId
    label: Suscripción
    description: Déjalo vacío para usar la suscripción activa.
    type: string
    required: false
    placeholder: 00000000-0000-0000-0000-000000000000
  - name: vmNames
    label: VMs a filtrar
    description: Nombres separados por coma. Vacío muestra todas.
    type: string
    required: false
    placeholder: vm-app01,vm-sql01
  - name: sinceDays
    label: Días hacia atrás
    description: Antigüedad máxima de los trabajos que se revisan.
    type: number
    required: true
    default: "1"
---

Complementa al script de respaldo masivo: sirve para consultar el estado cuando ya
cerraste la terminal desde la que disparaste los respaldos. El trabajo vive en Azure,
no en la sesión, así que cerrar la shell no cancela nada, sólo pierdes el monitoreo.

Recorre los Recovery Services Vault de la suscripción, lista los trabajos de respaldo
de VM y, por cada uno, muestra el estado de la subtarea **Take Snapshot** y el de
**Transfer data to vault**. Con el snapshot en `Completed` ya puedes intervenir el
servidor aunque la transferencia siga corriendo.

El filtro `operation=='Backup'` deja fuera los trabajos `Backup (Full)` de las bases
SQL que corren dentro de una VM: son otro tipo de trabajo y no tienen subtarea de
snapshot, así que sólo llenarían la tabla de ruido.

## Detalles de la API que el script resuelve

La subtarea se lee en `properties.extendedInfo.tasksList` y se identifica por su
`taskId` (`Take Snapshot`). La API no expone ningún `subTasks` ni ningún `taskName`:
un `--query` hacia esos nombres devuelve `null` sin error. Como `az backup job list`
no incluye `extendedInfo`, hace falta un `az backup job show` por cada trabajo.

La proyección del `--query` es una lista, no un diccionario. Con `-o tsv`, Azure CLI
imprime las claves de un diccionario **ordenadas alfabéticamente**, así que
`{status:…,snapshot:…}` sale con los valores intercambiados. Una lista respeta el
orden escrito, un valor por línea, y los nulos salen como el literal `None`.

`--start-date` exige el formato `dd-MM-yyyy` (o `dd-MM-yyyy-HH:mm:ss`); un ISO 8601
se rechaza con `Input is not valid`.

La duración llega en dos formas según la versión de Azure CLI: ISO 8601
(`PT7M36.5940899S`, en Cloud Shell) o `timedelta` (`0:07:37.825563`, en Windows). El
script normaliza ambas a `HH:MM:SS`.
