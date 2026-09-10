---
title: Verificar driver MANA en VMs Linux
description: Ejecuta de forma remota, vía el agente de Azure, la búsqueda del módulo mana en el kernel de cada VM Linux indicada.
category: Diagnóstico MANA
tags: [mana, linux, run-command, driver, kernel]
language: bash
usage: "bash mana-verificar-linux.sh"
requirements:
  - Azure CLI (`az`) con sesión iniciada
  - Agente de Azure (waagent) en ejecución dentro de cada VM
  - Permisos para `az vm run-command invoke`
parameters:
  - name: vmNames
    label: VMs Linux
    description: Nombres separados por coma.
    type: string
    required: true
    placeholder: ADS,appprd,HANADB1
  - name: csvPath
    label: Archivo de salida
    description: Déjalo vacío para no exportar.
    type: string
    required: false
    default: reporte-mana-linux.csv
---

Para cada VM resuelve su grupo de recursos automáticamente y ejecuta dentro del sistema:

```bash
grep /mana*.ko /lib/modules/$(uname -r)/modules.builtin || \
  find /lib/modules/$(uname -r)/kernel -name mana*.ko*
```

No requiere acceso SSH ni IP pública: todo pasa por el agente de Azure. Devuelve por
pantalla si el driver está presente y, opcionalmente, un CSV con el detalle.
