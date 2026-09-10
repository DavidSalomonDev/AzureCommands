<#
.SYNOPSIS
    Validación remota de controladores MANA en VMs Windows desde máquina local usando Azure CLI.
#>

# Lista de nombres de tus VMs Windows
$vms = @("srvrds1", "srvad")

# Comando PowerShell que se ejecutará DENTRO de cada VM Windows
$psCommand = 'Get-WmiObject Win32_PnPSignedDriver | Where-Object { $_.DeviceName -like "*Microsoft Azure Network Adapter*" -or $_.DeviceName -like "*MANA*" } | Select-Object DeviceName, DriverVersion'

Write-Host "Iniciando validación remota en VMs Windows mediante Azure CLI..." -ForegroundColor Cyan

$results = foreach ($vmName in $vms) {
    Write-Host "`n[+] Procesando VM: $vmName" -ForegroundColor Yellow

    # 1. Obtener el Resource Group automáticamente
    $rg = az vm list --query "[?name=='$vmName'].resourceGroup" -o tsv

    if (-not $rg) {
        Write-Host "   [-] No se encontró la VM '$vmName' en la suscripción activa." -ForegroundColor Red
        [PSCustomObject]@{
            VMName        = $vmName
            ResourceGroup = "NOT_FOUND"
            HasManaDriver = $false
            DriverVersion = "N/A"
            OutputMessage = "VM no encontrada"
        }
        continue
    }

    Write-Host "   -> Resource Group: $rg" -ForegroundColor Gray
    Write-Host "   -> Consultando drivers mediante Agente de Azure..." -ForegroundColor Gray

    # 2. Invocar comando PowerShell remoto
    $outputJson = az vm run-command invoke `
        --resource-group $rg `
        --name $vmName `
        --command-id RunPowerShellScript `
        --scripts $psCommand `
        --output json | ConvertFrom-Json

    # 3. Procesar salida
    $rawMessage = $outputJson.value[0].message
    
    # Evaluar si se detectó el driver MANA
    $hasMana = $rawMessage -match 'Microsoft Azure Network Adapter' -or $rawMessage -match 'MANA'
    $cleanMsg = ($rawMessage -replace '\s+', ' ').Trim()

    [PSCustomObject]@{
        VMName        = $vmName
        ResourceGroup = $rg
        HasManaDriver = $hasMana
        OutputMessage = $cleanMsg
    }
}

# --- SALIDA DE RESULTADOS ---

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "      RESUMEN DE COMPATIBILIDAD MANA WINDOWS       " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

$results | Format-Table -AutoSize

# Exportar a CSV
$csvPath = Join-Path -Path $PSScriptRoot -ChildPath "Reporte_MANA_Windows.csv"
$results | Export-Csv -Path $csvPath -NoTypeInformation -Encoding utf8 -Delimiter ";"
Write-Host "Reporte guardado en: $csvPath" -ForegroundColor Green