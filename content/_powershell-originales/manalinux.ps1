<#
.SYNOPSIS
    Validación remota de controladores MANA en VMs Linux desde máquina local usando Azure CLI.
#>

# Lista de nombres de tus VMs Linux
$vms = @("ADS", "appprd", "HANADB1", "HANADB2", "vm-controlit")

# Comando Bash que se enviará y ejecutará dentro de cada VM Linux
$bashCommand = 'grep /mana*.ko /lib/modules/$(uname -r)/modules.builtin || find /lib/modules/$(uname -r)/kernel -name mana*.ko*'

Write-Host "Iniciando validación remota mediante Azure CLI..." -ForegroundColor Cyan

$results = foreach ($vmName in $vms) {
    Write-Host "`n[+] Procesando VM: $vmName" -ForegroundColor Yellow

    # 1. Obtener el Resource Group de la VM automáticamente usando Azure CLI
    $rg = az vm list --query "[?name=='$vmName'].resourceGroup" -o tsv

    if (-not $rg) {
        Write-Host "   [-] No se encontró la VM '$vmName' en la suscripción activa de Azure." -ForegroundColor Red
        [PSCustomObject]@{
            VMName        = $vmName
            ResourceGroup = "NOT_FOUND"
            HasManaDriver = $false
            OutputMessage = "VM no encontrada"
        }
        continue
    }

    Write-Host "   -> Resource Group encontrado: $rg" -ForegroundColor Gray
    Write-Host "   -> Ejecutando comando en el agente de la VM..." -ForegroundColor Gray

    # 2. Invocar el comando en la VM a través del Agente de Azure
    $outputJson = az vm run-command invoke `
        --resource-group $rg `
        --name $vmName `
        --command-id RunShellScript `
        --scripts $bashCommand `
        --output json | ConvertFrom-Json

    # 3. Extraer el resultado retornado por la consola Linux
    $rawMessage = $outputJson.value[0].message
    $hasMana = $rawMessage -match 'mana\.ko'
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
Write-Host "       RESUMEN DE COMPATIBILIDAD MANA LINUX        " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

$results | Format-Table -AutoSize

# Opcional: Exportar a CSV en la carpeta actual
$csvPath = Join-Path -Path $PSScriptRoot -ChildPath "Reporte_MANA_Linux.csv"
$results | Export-Csv -Path $csvPath -NoTypeInformation -Encoding utf8 -Delimiter ";"
Write-Host "Reporte consolidado guardado en: $csvPath" -ForegroundColor Green