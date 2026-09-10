---
title: Verificar driver MANA en VMs Linux
description: Ejecuta de forma remota, vía el agente de Azure, la búsqueda del módulo mana en el kernel de cada VM Linux indicada.
category: Diagnóstico MANA
tags: [mana, linux, run-command, driver, kernel]
language: powershell
usage: "./manalinux.ps1"
requirements:
  - Azure CLI (`az`) con sesión iniciada
  - Agente de Azure (waagent) en ejecución dentro de cada VM
  - Permisos para `az vm run-command invoke`
---

Edita el array `$vms` al inicio del script con los nombres de tus VMs Linux. Para cada
una resuelve el grupo de recursos automáticamente y ejecuta:

```bash
grep /mana*.ko /lib/modules/$(uname -r)/modules.builtin || \
  find /lib/modules/$(uname -r)/kernel -name mana*.ko*
```

Devuelve una tabla con `HasManaDriver` por VM. No requiere acceso SSH: todo pasa por el
agente de Azure.
