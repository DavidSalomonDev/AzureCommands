---
title: Inventario de VMs afectadas por MANA
description: Recorre las VMs de la suscripción y marca las que requieren revisión por tamaño afectado, Accelerated Networking y SO no compatible, exportando el resultado a CSV.
category: Diagnóstico MANA
tags: [mana, vm, accelerated-networking, inventario, reporte]
operation: read
language: bash
usage: "bash mana-inventario-vms.sh"
requirements:
  - Azure CLI (`az`) con sesión iniciada
  - Permisos de lectura sobre las VMs y sus interfaces de red
parameters:
  - name: subscription
    label: Suscripción
    description: ID o nombre. Déjalo vacío para usar la activa.
    type: string
    required: false
    placeholder: 00000000-0000-0000-0000-000000000000
  - name: csvPath
    label: Archivo de salida
    type: string
    required: true
    default: reporte-mana-vms.csv
  - name: onlyAffected
    label: Exportar solo las que requieren revisión
    type: enum
    required: true
    default: "false"
    options: ["false", "true"]
---

Unifica en un solo script las dos versiones previas (Azure CLI y módulo `Az`). Para cada
VM evalúa tres condiciones y marca `RequiereRevision` cuando se cumplen todas:

1. El tamaño pertenece a una familia afectada —Av2, Bsv2, Dv1–v5, Dpsv6, Ev3–v5, Epsv6,
   Ebsv5, F, G, L— excluyendo las variantes AMD (`Standard_D4as_v5` y similares).
2. Alguna NIC tiene *Accelerated Networking* habilitado.
3. La imagen del SO no es compatible con MANA de fábrica.

El reporte se imprime en pantalla y se guarda como CSV separado por `;`, listo para abrir
en Excel.
