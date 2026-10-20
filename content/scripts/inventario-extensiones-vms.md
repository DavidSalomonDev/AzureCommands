---
title: Inventario de extensiones instaladas en VMs
description: Lista las extensiones de todas las VMs de una suscripción (o de las que indiques), con publicador, versión y estado de aprovisionamiento, y exporta el detalle a CSV.
category: Monitoreo y extensiones
tags: [extension, vm, inventario, auditoria, csv]
operation: read
language: bash
usage: "bash inventario-extensiones-vms.sh"
requirements:
  - Azure CLI (`az`) con sesión iniciada (`az login`)
  - Permisos de lectura (*Reader*) sobre las VMs a inspeccionar
parameters:
  - name: subscriptionId
    label: Suscripción
    description: ID o nombre de la suscripción donde se ejecuta el script.
    type: string
    required: true
    placeholder: 00000000-0000-0000-0000-000000000000
  - name: vmNames
    label: VMs
    description: Nombres separados por coma. Déjalo vacío para recorrer todas.
    type: string
    required: false
    placeholder: APPROUTER,HANADB1
  - name: resourceGroup
    label: Grupo de recursos
    description: Limita el barrido a un grupo. Vacío = toda la suscripción.
    type: string
    required: false
    placeholder: RG_VELAS-HISPANIOLA
  - name: filtro
    label: Filtro de texto
    description: Muestra sólo las extensiones cuyo nombre o publicador contenga este texto.
    type: string
    required: false
    placeholder: monitor
  - name: resumenConsola
    label: Tabla consolidada al terminar
    description: Imprime todas las VMs y sus extensiones juntas al final, sin necesidad de CSV.
    type: enum
    required: true
    default: "true"
    options: ["true", "false"]
  - name: csvPath
    label: Archivo de salida
    description: Déjalo vacío para no exportar.
    type: string
    required: false
    placeholder: inventario-extensiones.csv
---

Resuelve primero la lista de VMs a inspeccionar (las indicadas, las de un grupo, o todas
las de la suscripción) y luego consulta `az vm extension list` en cada una. No existe una
llamada masiva equivalente: `$expand=instanceView` sobre el listado de VMs sólo está
soportado para Virtual Machine Scale Sets, así que el recorrido es por VM.

Por cada extensión muestra nombre, versión del handler, estado de aprovisionamiento y
publicador. El CSV añade el `type` real de la extensión (`properties.type`, que la CLI
expone como `typePropertiesType` y no siempre coincide con el nombre del recurso) y si
tiene activada la actualización automática de versiones menores.

El filtro de texto es útil para auditorías puntuales: con `monitor` ves qué VMs tienen
agentes de monitoreo y en qué versión; con el nombre de un publicador, qué VMs arrastran
una extensión concreta.

Con la tabla consolidada activada imprime al final todas las VMs y sus extensiones
juntas, que es lo cómodo cuando no quieres un CSV: el recorrido VM por VM queda arriba y
abajo tienes la vista completa para comparar versiones de un vistazo. El CSV es opcional y
viene vacío por defecto.

Al cerrar informa cuántas VMs se revisaron, cuántas extensiones se encontraron, qué VMs no
tienen ninguna y cuáles fallaron al consultarse (por ejemplo, por falta de permisos).

Nota: en Windows `az` devuelve CRLF, por lo que el script limpia los `\r` antes de usar los
valores; sin eso el grupo de recursos arrastra un retorno de carro y las consultas fallan
con *Bad Request*.
