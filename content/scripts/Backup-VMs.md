---
title: Respaldo masivo de VMs con monitoreo de snapshot
description: Lanza un backup on-demand en Recovery Services Vault para varias VMs y monitorea la fase de snapshot hasta liberarlas para mantenimiento.
category: Respaldo y snapshots
tags: [backup, recovery-services, vm, snapshot, mantenimiento]
language: powershell
usage: './Backup-VMs.ps1 -VMNames "vm-app01,vm-sql01" -RetentionInDays 30'
requirements:
  - Azure CLI (`az`) con sesión iniciada (`az login`) y la suscripción correcta activa
  - Extensión `az backup` disponible
  - Permisos de *Backup Operator* sobre los Recovery Services Vault
---

Recorre todos los Recovery Services Vault de la suscripción activa, localiza los
elementos protegidos que coinciden con las VMs indicadas y dispara un respaldo con la
fecha de expiración calculada a partir de `-RetentionInDays`.

**Parámetros**

- `-VMNames` *(obligatorio)*: lista de VMs, como array o separadas por coma.
- `-RetentionInDays` *(obligatorio)*: días de retención del punto de recuperación.
- `-WaitForSnapshotOnly` *(opcional, por defecto `$true`)*: espera solo a que termine la
  fase *take snapshot* en lugar de la transferencia completa al vault.

Cuando el snapshot de una VM finaliza, el script la marca como liberada: ya puedes
continuar con el mantenimiento sin esperar a que suba todo el respaldo. Si el job no
reporta la subtarea de snapshot, asume que terminó tras 12 minutos.
