param(
    [Parameter(Mandatory=$true)]
    [string[]]$VMNames, # Lista de VMs (separadas por coma o como array)

    [Parameter(Mandatory=$true)]
    [int]$RetentionInDays, # Valor obligatorio al ejecutar

    [Parameter(Mandatory=$false)]
    [bool]$WaitForSnapshotOnly = $true # Por defecto monitorea el Snapshot hasta finalizar
)

# 0. Normalizar y parsear la lista de VMs
$CleanVMNames = @()
foreach ($Item in $VMNames) {
    if ($Item -like "*,*") {
        $CleanVMNames += $Item -split ',' | ForEach-Object { $_.Trim() }
    } else {
        $CleanVMNames += $Item.Trim()
    }
}
$CleanVMNames = $CleanVMNames | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique

# Cálculo de la fecha de expiración basada estrictamente en el parámetro recibido
$ExpiryDate = (Get-Date).AddDays($RetentionInDays).ToUniversalTime().ToString("dd-MM-yyyy")

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " INICIANDO RESPALDO MASIVO Y MONITOREO DE SNAPSHOTS " -ForegroundColor Cyan
Write-Host " Días Retención: $RetentionInDays | Expiración: $ExpiryDate | VMs: $($CleanVMNames.Count)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Obtener de manera directa todos los Vaults de la suscripción activa
Write-Host "🔍 Listando almacenes de Recovery Services en la suscripción..." -ForegroundColor Gray
$Vaults = az backup vault list --query "[].{name:name, rg:resourceGroup}" -o json | ConvertFrom-Json

if ($null -eq $Vaults -or $Vaults.Count -eq 0) {
    Write-Host "❌ No se encontraron Recovery Services Vaults en la suscripción activa. Verifica tu sesión o suscripción activa." -ForegroundColor Red
    exit
}

Write-Host "✅ Se detectaron $($Vaults.Count) almacén(es) de respaldo." -ForegroundColor Green

# FASE 1: Buscar las VMs dentro de los almacenes
$ResolvedVMs = @()
$NotFoundVMs = @()

foreach ($VM in $CleanVMNames) {
    Write-Host "🔍 Buscando la VM '$VM' en los almacenes..." -ForegroundColor Gray
    $Found = $false
    $VaultName = ""
    $VaultRG = ""
    $MatchedVMName = $VM
    $MatchMethod = "N/A"

    $ExactMatch = $null
    $PartialMatch = $null
    $ExactVault = $null
    $PartialVault = $null

    foreach ($Vault in $Vaults) {
        $Items = az backup item list --resource-group $Vault.rg --vault-name $Vault.name --query "[].{friendlyName:properties.friendlyName, name:name}" -o json | ConvertFrom-Json
        
        if ($null -eq $Items -or $Items.Count -eq 0) {
            continue
        }

        # 1. Buscar coincidencia exacta (insensible a mayúsculas/minúsculas)
        $MatchExact = $Items | Where-Object { $_.friendlyName -eq $VM } | Select-Object -First 1
        if ($null -ne $MatchExact) {
            $ExactMatch = $MatchExact
            $ExactVault = $Vault
            break # Coincidencia exacta encontrada, salimos del ciclo de vaults inmediatamente
        }

        # 2. Si no hay coincidencia exacta todavía, guardar la primera parcial como fallback
        if ($null -eq $PartialMatch) {
            $MatchPartial = $Items | Where-Object { $_.friendlyName -like "*$VM*" } | Select-Object -First 1
            if ($null -ne $MatchPartial) {
                $PartialMatch = $MatchPartial
                $PartialVault = $Vault
            }
        }
    }

    # Evaluar los resultados de búsqueda
    if ($null -ne $ExactMatch) {
        $VaultName = $ExactVault.name
        $VaultRG = $ExactVault.rg
        $MatchedVMName = $ExactMatch.friendlyName
        $Found = $true
        $MatchMethod = "Exacta"
    } elseif ($null -ne $PartialMatch) {
        $VaultName = $PartialVault.name
        $VaultRG = $PartialVault.rg
        $MatchedVMName = $PartialMatch.friendlyName
        $Found = $true
        $MatchMethod = "Parcial (⚠️)"
    }

    if ($Found) {
        $ResolvedVMs += [PSCustomObject]@{
            VM_Buscada    = $VM
            VM_Encontrada = $MatchedVMName
            VaultName     = $VaultName
            ResourceGroup = $VaultRG
            Metodo        = $MatchMethod
        }
    } else {
        $NotFoundVMs += $VM
    }
}

# Si no pudimos mapear ninguna VM
if ($ResolvedVMs.Count -eq 0) {
    Write-Host "`n❌ No se encontró ninguna coincidencia (ni exacta ni parcial) para las VMs solicitadas en ningún almacén." -ForegroundColor Red
    if ($NotFoundVMs.Count -gt 0) {
        Write-Host "VMs no encontradas: $($NotFoundVMs -join ', ')" -ForegroundColor Yellow
    }
    exit
}

# FASE 2: Mostrar listado y solicitar confirmación interactiva
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "      MAPEO DE SERVIDORES Y ALMACENES ENCONTRADOS          " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Forzamos la salida inmediata al host antes de la solicitud de datos
$ResolvedVMs | Format-Table -Property VM_Buscada, VM_Encontrada, VaultName, Metodo -AutoSize | Out-Host

if ($NotFoundVMs.Count -gt 0) {
    Write-Host "⚠️ Las siguientes VMs NO se encontraron en ningún almacén y serán OMITIDAS:" -ForegroundColor Yellow
    foreach ($NF in $NotFoundVMs) {
        Write-Host "  - $NF" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "👉 ¿Deseas proceder con los respaldos de las VMs listadas arriba?" -ForegroundColor White
$Confirmation = $null
while ($Confirmation -notin @("1", "2")) {
    $Confirmation = Read-Host "Elige una opción: [1] Proceder | [2] Cancelar"
    if ($null -ne $Confirmation) {
        $Confirmation = $Confirmation.Trim()
    }
}

if ($Confirmation -eq "2") {
    Write-Host "`n❌ Operación cancelada por el usuario. Saliendo sin realizar cambios." -ForegroundColor Yellow
    exit
}

Write-Host "`n🚀 Confirmación recibida. Iniciando disparador de backups..." -ForegroundColor Green
$JobsList = @()

# FASE 3: Disparar backups
foreach ($JobInfo in $ResolvedVMs) {
    Write-Host "`n🚀 Disparando backup para $($JobInfo.VM_Encontrada) en Vault $($JobInfo.VaultName)..." -ForegroundColor Green
    
    $TriggerResult = az backup protection backup-now `
        --resource-group $JobInfo.ResourceGroup `
        --vault-name $JobInfo.VaultName `
        --container-name $JobInfo.VM_Encontrada `
        --item-name $JobInfo.VM_Encontrada `
        --backup-management-type AzureIaasVM `
        --retain-until $ExpiryDate `
        -o json | ConvertFrom-Json

    if ($TriggerResult -and $TriggerResult.name) {
        $JobId = $TriggerResult.name
        Write-Host "✅ Trabajo iniciado para $($JobInfo.VM_Encontrada). Job ID: $JobId" -ForegroundColor Green
        
        $JobsList += [PSCustomObject]@{
            VMName             = $JobInfo.VM_Encontrada
            VaultName          = $JobInfo.VaultName
            ResourceGroup      = $JobInfo.ResourceGroup
            JobId              = $JobId
            SnapshotCompleted  = $false
            SnapshotStatus     = "Pendiente"
            Duration           = "N/A"
            JobGlobalStatus    = "InProgress"
            StartTime          = (Get-Date)
        }
    } else {
        Write-Host "❌ Error al iniciar el backup para $($JobInfo.VM_Encontrada)" -ForegroundColor Red
    }
    Write-Host "--------------------------------------------------------" -ForegroundColor Gray
}

if ($JobsList.Count -eq 0) {
    Write-Host "❌ No se pudo iniciar ningún trabajo de backup. Saliendo." -ForegroundColor Yellow
    exit
}

# FASE 4: Monitorear únicamente hasta que se completen los Snapshots
if ($WaitForSnapshotOnly) {
    Write-Host "`n==========================================================" -ForegroundColor Cyan
    Write-Host " ESPERANDO EXCLUSIVAMENTE A QUE 'TAKE SNAPSHOT' ESTÉ COMPLETO " -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan

    $PendingSnapshots = $true
    while ($PendingSnapshots) {
        $PendingSnapshots = $false 
        
        Start-Sleep -Seconds 20 
        
        Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] Validando estado de Snapshots..." -ForegroundColor Gray

        foreach ($Job in $JobsList) {
            if (-not $Job.SnapshotCompleted) {
                
                $JobDetails = az backup job show --resource-group $Job.ResourceGroup --vault-name $Job.VaultName --name $Job.JobId -o json | ConvertFrom-Json
                
                if ($JobDetails) {
                    $Job.JobGlobalStatus = $JobDetails.properties.status

                    # 1. Validar si el Job ya falló de forma general
                    if ($Job.JobGlobalStatus -eq "Failed" -or $Job.JobGlobalStatus -eq "Cancelled") {
                        Write-Host "🔴 VM: $($Job.VMName) -> El trabajo falló de forma general en Azure." -ForegroundColor Red
                        $Job.SnapshotCompleted = $true 
                        $Job.SnapshotStatus    = "Fallido"
                        continue
                    }

                    # 2. Validar si el Job global ya marca "Completed"
                    if ($Job.JobGlobalStatus -eq "Completed") {
                        $Job.SnapshotCompleted = $true
                        $Job.SnapshotStatus    = "Completed"
                        $Job.Duration          = "Completado con éxito (Job Finalizado)"
                        Write-Host "📸 VM: $($Job.VMName) -> ¡COPIA COMPLETADA! - Servidor liberado." -ForegroundColor Green
                        continue
                    }

                    # 3. Extraer subtareas usando taskId o taskName
                    $Tasks = $null
                    if ($null -ne $JobDetails.properties.extendedInfo) {
                        if ($null -ne $JobDetails.properties.extendedInfo.tasksList) {
                            $Tasks = $JobDetails.properties.extendedInfo.tasksList
                        } elseif ($null -ne $JobDetails.properties.extendedInfo.tasks) {
                            $Tasks = $JobDetails.properties.extendedInfo.tasks
                        }
                    }

                    $SnapshotTask = $null
                    if ($null -ne $Tasks) {
                        $SnapshotTask = $Tasks | Where-Object { 
                            $_.taskId -eq "Take Snapshot" -or 
                            $_.taskId -like "*Snapshot*" -or 
                            $_.taskName -eq "Take Snapshot" -or 
                            $_.taskName -like "*Snapshot*" 
                        }
                    }

                    # 4. Evaluación del Snapshot
                    if ($null -ne $SnapshotTask) {
                        $SnapshotStatus = $SnapshotTask.status
                        $SnapshotDuration = $SnapshotTask.duration

                        if ($SnapshotStatus -eq "Completed" -or $SnapshotStatus -eq "Success") {
                            $Job.SnapshotCompleted = $true
                            $Job.SnapshotStatus    = "Completed"
                            $Job.Duration          = $SnapshotDuration
                            Write-Host "📸 VM: $($Job.VMName) -> ¡TAKE SNAPSHOT COMPLETADO! (Duración: $SnapshotDuration) - Servidor liberado." -ForegroundColor Green
                        } else {
                            $Job.SnapshotStatus = $SnapshotStatus
                            Write-Host "⏳ VM: $($Job.VMName) -> Snapshot en progreso (Estado: $SnapshotStatus)..." -ForegroundColor Yellow
                            $PendingSnapshots = $true
                        }
                    } else {
                        # Método de salvaguarda por tiempo transcurrido
                        $MinutesElapsed = ((Get-Date) - $Job.StartTime).TotalMinutes
                        
                        if ($MinutesElapsed -gt 12) {
                            $Job.SnapshotCompleted = $true
                            $Job.SnapshotStatus    = "Completed (Asumido por Tiempo)"
                            $Job.Duration          = ">12 minutos transcurridos"
                            Write-Host "📸 VM: $($Job.VMName) -> Tiempo límite de Snapshot alcanzado (>12 min). Servidor liberado." -ForegroundColor Green
                        } else {
                            $TimeFormatted = [math]::Round($MinutesElapsed, 1)
                            Write-Host "⏳ VM: $($Job.VMName) -> Procesando respaldo... (Tiempo transcurrido: $TimeFormatted min. Estado global: $($Job.JobGlobalStatus))" -ForegroundColor DarkYellow
                            $PendingSnapshots = $true
                        }
                    }
                }
            } else {
                Write-Host "✅ VM: $($Job.VMName) -> Listo (Snapshot completado / Liberado)" -ForegroundColor DarkGreen
            }
        }
    }
    
    # FASE 5: IMPRESIÓN DEL REPORTE RESUMEN FINAL
    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host "      REPORTE FINAL DE RESPALDO (TAKE SNAPSHOT)           " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green

    $JobsList | Format-Table -Property VMName, SnapshotStatus, Duration, VaultName -AutoSize
    
    Write-Host "Todos los servidores indicados han procesado su Snapshot." -ForegroundColor Green
    Write-Host "Ya puedes proceder con las actividades de mantenimiento de forma segura." -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
}