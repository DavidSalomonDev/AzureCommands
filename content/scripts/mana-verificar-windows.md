---
title: Verificar driver MANA en VMs Windows
description: Consulta remotamente los drivers "Microsoft Azure Network Adapter" de cada VM Windows mediante az vm run-command.
category: Diagnóstico MANA
tags: [mana, windows, run-command, driver]
language: bash
usage: "bash mana-verificar-windows.sh"
requirements:
  - Azure CLI (`az`) con sesión iniciada
  - Agente de Azure en ejecución dentro de cada VM
  - Permisos para `az vm run-command invoke`
parameters:
  - name: vmNames
    label: VMs Windows
    description: Nombres separados por coma.
    type: string
    required: true
    placeholder: srvrds1,srvad
  - name: csvPath
    label: Archivo de salida
    description: Déjalo vacío para no exportar.
    type: string
    required: false
    default: reporte-mana-windows.csv
---

El script es Bash (Azure CLI), pero lo que se ejecuta **dentro** de la VM es PowerShell:
un `Get-CimInstance Win32_PnPSignedDriver` filtrado por *Microsoft Azure Network Adapter*
/ *MANA*, enviado con `--command-id RunPowerShellScript`.

Devuelve el nombre y la versión del driver encontrado por VM, sin necesidad de RDP.
