---
title: Respaldo masivo de VMs con monitoreo de snapshot
description: Lanza un backup on-demand en Recovery Services Vault para varias VMs y monitorea la fase de snapshot hasta liberarlas para mantenimiento.
category: Respaldo y snapshots
tags: [backup, recovery-services, vm, snapshot, mantenimiento]
operation: create
language: bash
usage: "bash backup-vms.sh"
requirements:
  - Azure CLI (`az`) con sesión iniciada (`az login`)
  - Permisos de *Backup Operator* sobre los Recovery Services Vault
  - Las VMs ya deben estar protegidas en algún vault
parameters:
  - name: subscriptionId
    label: Suscripción
    description: ID o nombre de la suscripción donde se ejecuta el script.
    type: string
    required: true
    placeholder: 00000000-0000-0000-0000-000000000000
  - name: vmNames
    label: VMs a respaldar
    description: Nombres separados por coma.
    type: string
    required: true
    placeholder: vm-app01,vm-sql01
  - name: retentionDays
    label: Días de retención
    type: number
    required: true
    default: "30"
  - name: waitForSnapshot
    label: Liberar al terminar el snapshot
    description: Con "true" no espera la transferencia completa al vault.
    type: enum
    required: true
    default: "true"
    options: ["true", "false"]
  - name: pollSeconds
    label: Intervalo de monitoreo (segundos)
    type: number
    required: true
    default: "60"
---

Recorre todos los Recovery Services Vault de la suscripción activa, localiza el elemento
protegido de cada VM y dispara `az backup protection backup-now` con la fecha de
expiración calculada a partir de los días de retención.

El nombre del contenedor se toma de `az backup container list`, que lo devuelve
completo (`IaasVMContainer;iaasvmcontainerv2;<rg>;<vm>`). El campo
`properties.containerName` del elemento protegido no sirve: llega sin el prefijo
`IaasVMContainer;` y la API rechaza el respaldo con
`BMSUserErrorContainerNameIncorrectFormat`.

Después consulta el job con `az backup job show` y revisa la subtarea **Take Snapshot**:
en cuanto termina, la VM se marca como liberada y puedes continuar con el mantenimiento
sin esperar a que suba todo el respaldo (la subtarea *Transfer data to vault* sigue
corriendo por su cuenta). Si Azure todavía no reporta esa subtarea, se asume completada
tras 12 minutos.

La subtarea se lee en `properties.extendedInfo.tasksList` y se identifica por su
`taskId` (`Take Snapshot`). La API no expone ningún `subTasks` ni ningún `taskName`:
un `--query` hacia esos nombres devuelve `null` sin error y la fase nunca se detecta.

La proyección del `--query` es una lista, no un diccionario. Con `-o tsv`, Azure CLI
imprime las claves de un diccionario **ordenadas alfabéticamente**, así que
`{status:…,snapshot:…}` sale con los valores intercambiados. Una lista respeta el orden
escrito, un valor por línea, y los nulos salen como el literal `None`.

Ejecuta el script con `bash backup-vms.sh` (en Windows, desde WSL, Git Bash o Cloud
Shell).
