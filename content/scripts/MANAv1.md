---
title: Inventario MANA de VMs (Az PowerShell)
description: Misma evaluación MANA que la versión CLI, pero con el módulo Az; filtra estrictamente las familias de la tabla oficial de Microsoft.
category: Diagnóstico MANA
tags: [mana, vm, accelerated-networking, az-powershell, inventario]
language: powershell
usage: "./MANAv1.ps1"
requirements:
  - Módulo `Az` instalado y sesión iniciada (`Connect-AzAccount`)
  - Contexto apuntando a la suscripción a evaluar (`Set-AzContext`)
---

Usa `Get-AzVM` y `Get-AzNetworkInterface` en lugar de Azure CLI. Excluye explícitamente
las variantes AMD (`Standard_[ED]<n>a[d]s_v<n>`) e incluye las series Dpsv6, Epsv6 y
Ebsv5 que la versión CLI no contempla.

Úsalo cuando trabajes desde una consola con el módulo `Az` ya cargado; si prefieres
Azure CLI, usa el inventario equivalente con `az`.
