---
title: Instalar Azure Enhanced Monitoring en VMs Linux
description: Instala o actualiza la extensión de monitoreo Enhanced (requisito de soporte SAP) en una o varias VMs Linux, resolviendo grupo de recursos, región y versión del handler.
category: Monitoreo y extensiones
tags: [sap, monitoreo, extension, linux, vm, az-rest]
operation: create
language: bash
usage: "bash monitoreo-enhanced-linux.sh"
requirements:
  - Azure CLI (`az`) con sesión iniciada (`az login`)
  - Permisos de *Virtual Machine Contributor* sobre las VMs
  - Agente de Azure (waagent) en ejecución dentro de cada VM
parameters:
  - name: subscriptionId
    label: Suscripción
    description: ID o nombre de la suscripción donde se ejecuta el script.
    type: string
    required: true
    placeholder: 00000000-0000-0000-0000-000000000000
  - name: vmNames
    label: VMs Linux
    description: Nombres separados por coma.
    type: string
    required: true
    placeholder: APPROUTER,HANADB1
  - name: resourceGroup
    label: Grupo de recursos
    description: Déjalo vacío para resolverlo automáticamente por nombre de VM.
    type: string
    required: false
    placeholder: RG_VELAS-HISPANIOLA
  - name: publisher
    label: Publicador de la extensión
    type: string
    required: true
    default: Microsoft.AzureCAT.AzureEnhancedMonitoring
  - name: extension
    label: Tipo de extensión
    description: MonitorX64Linux para Linux; MonitorX64Windows para Windows.
    type: enum
    required: true
    default: MonitorX64Linux
    options: [MonitorX64Linux, MonitorX64Windows]
  - name: handlerVersion
    label: Versión del handler
    description: Usa "latest" para tomar la última publicada en la región.
    type: string
    required: true
    default: latest
    placeholder: "1.113"
  - name: autoUpgradeMinor
    label: Actualizar versiones menores automáticamente
    type: enum
    required: true
    default: "true"
    options: ["true", "false"]
  - name: apiVersion
    label: Versión de API
    type: string
    required: true
    default: "2025-04-01"
---

Aplica la extensión mediante el plano de control de Azure (`az rest`), no con
`az vm extension set`, porque así se puede fijar la versión exacta del handler y enviar el
bloque `settings.cfg` vacío que espera el agente de Azure Enhanced Monitoring.

Para cada VM de la lista:

1. Resuelve grupo de recursos y región con `az vm list` (o usa el grupo indicado).
2. Si la versión es `latest`, consulta las versiones publicadas del publicador en esa
   región y toma la más alta, recortada a `major.minor` (lo único que acepta
   `typeHandlerVersion`).
3. Arma el cuerpo JSON en un archivo temporal y hace `PUT` sobre
   `.../extensions/<extension>`.
4. Consulta el estado y lo muestra en tabla (`provisioningState`, versión instalada).

Al final imprime cuántas VMs quedaron aplicadas y cuántas fallaron. Es idempotente: volver
a ejecutarlo sobre una VM que ya la tiene actualiza la configuración en lugar de duplicarla.
