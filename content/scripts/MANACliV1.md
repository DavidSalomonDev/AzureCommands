---
title: Inventario MANA de VMs (Azure CLI)
description: Analiza todas las VMs de la suscripción con Azure CLI y reporta cuáles requieren revisión por el despliegue de MANA, exportando el resultado a Excel o CSV.
category: Diagnóstico MANA
tags: [mana, vm, accelerated-networking, inventario, reporte]
language: powershell
usage: "./MANACliV1.ps1"
requirements:
  - Azure CLI (`az`) con sesión iniciada y la suscripción correcta activa
  - Módulo `ImportExcel` (opcional; si falta, exporta a CSV)
---

Para cada VM revisa tres condiciones y marca `RequiereRevision` cuando se cumplen todas:

1. El tamaño pertenece a una familia afectada (Av2, Bsv2, Dv1–v5, Ev3–v5, F, G, L…).
2. Alguna NIC tiene *Accelerated Networking* habilitado.
3. La imagen del SO no es compatible con MANA out-of-the-box.

El reporte se muestra en pantalla y se guarda junto al script como
`Reporte_MANA_VMs.xlsx` (o `.csv` si no está `ImportExcel`).
