---
title: Verificar driver MANA en VMs Windows
description: Consulta remotamente los drivers "Microsoft Azure Network Adapter" de cada VM Windows mediante az vm run-command.
category: Diagnóstico MANA
tags: [mana, windows, run-command, driver]
language: powershell
usage: "./manawindows.ps1"
requirements:
  - Azure CLI (`az`) con sesión iniciada
  - Agente de Azure en ejecución dentro de cada VM
  - Permisos para `az vm run-command invoke`
---

Edita el array `$vms` con los nombres de tus VMs Windows. El script resuelve el grupo de
recursos de cada una y ejecuta remotamente un `Get-WmiObject Win32_PnPSignedDriver`
filtrando por *Microsoft Azure Network Adapter* / *MANA*, devolviendo nombre y versión
del driver encontrado.
