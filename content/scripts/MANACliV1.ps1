Write-Host "Analizando VMs con Azure CLI..." -ForegroundColor Cyan

$vmsJson = az vm list --show-details --output json | ConvertFrom-Json

$compatibleOsPattern = '(?i)(2022|2025|20[\._]04|22[\._]04|24[\._]04|8[\._][6-9]|9[\._][0-9]|15-sp[3-7]|11|12|azure-linux|al2022)'

$results = foreach ($vm in $vmsJson) {
    $size = $vm.hardwareProfile.vmSize
    
    # Validar si el tamaño es afectado
    $isAffected = $false
    if ($size -notmatch 'Standard_[ED][0-9]+a(d)?s?_v[0-9]+') {
        switch -Wildcard ($size) {
            'Standard_A*v2'   { $isAffected = $true }
            'Standard_B*sv2'  { $isAffected = $true }
            'Standard_D*_v1'  { $isAffected = $true }
            'Standard_D*_v2'  { $isAffected = $true }
            'Standard_D*_v3'  { $isAffected = $true }
            'Standard_D*_v4'  { $isAffected = $true }
            'Standard_D*_v5'  { $isAffected = $true }
            'Standard_E*_v3'  { $isAffected = $true }
            'Standard_E*_v4'  { $isAffected = $true }
            'Standard_E*_v5'  { $isAffected = $true }
            'Standard_F*'     { $isAffected = $true }
            'Standard_G*'     { $isAffected = $true }
            'Standard_L*'     { $isAffected = $true }
        }
    }

    # Obtener IP Privada y verificar si alguna NIC tiene Accelerated Networking
    $hasAccNet = $false
    $privateIps = @()

    foreach ($nicRef in $vm.networkProfile.networkInterfaces) {
        $nicDetails = az network nic show --ids $nicRef.id --output json | ConvertFrom-Json
        
        # Verificar Accelerated Networking
        if ($nicDetails.enableAcceleratedNetworking -eq $true) {
            $hasAccNet = $true
        }

        # Extraer IPs privadas de las configuraciones de la NIC
        foreach ($ipConfig in $nicDetails.ipConfigurations) {
            if ($ipConfig.privateIPAddress) {
                $privateIps += $ipConfig.privateIPAddress
            }
        }
    }

    # Si por alguna razón la consulta de NIC no devolvió la IP, usar la que provee az vm list --show-details
    if ($privateIps.Count -eq 0 -and $vm.privateIps) {
        $privateIps = $vm.privateIps -split ','
    }

    # Revisar compatibilidad de SO
    $osOffer = $vm.storageProfile.imageReference.offer
    $osSku   = $vm.storageProfile.imageReference.sku
    $osInfo  = "$osOffer $osSku"
    
    $isOsCompatible = $osInfo -match $compatibleOsPattern

    [PSCustomObject]@{
        VMName                = $vm.name
        ResourceGroup         = $vm.resourceGroup
        PrivateIP             = ($privateIps -join ', ')
        VMSize                = $size
        IsAffectedSize        = $isAffected
        AcceleratedNetEnabled = $hasAccNet
        OSOfferSku            = $osInfo
        IsOSCompatible        = $isOsCompatible
        RequiereRevision      = ($isAffected -and $hasAccNet -and (-not $isOsCompatible))
    }
}

# --- EXPORTACIÓN Y SALIDA ---

if ($results) {
    # Muestra en pantalla
    $results | Format-Table -AutoSize

    # Define la ruta del archivo Excel en la misma carpeta del script
    $excelPath = Join-Path -Path $PSScriptRoot -ChildPath "Reporte_MANA_VMs.xlsx"

    # Verificar si el módulo ImportExcel está disponible
    if (Get-Module -ListAvailable -Name ImportExcel) {
        $results | Export-Excel -Path $excelPath -WorksheetName "Revision_MANA" -TableName "VMs_MANA" -AutoSize -BoldTopRow -Show
        Write-Host "Reporte exportado exitosamente a: $excelPath" -ForegroundColor Green
    } else {
        # Fallback a CSV si no se tiene instalado ImportExcel
        $csvPath = Join-Path -Path $PSScriptRoot -ChildPath "Reporte_MANA_VMs.csv"
        $results | Export-Csv -Path $csvPath -NoTypeInformation -Encoding utf8 -Delimiter ";"
        Write-Host "Módulo ImportExcel no detectado. Reporte exportado a CSV en: $csvPath" -ForegroundColor Yellow
    }
} else {
    Write-Host "No se encontraron máquinas virtuales." -ForegroundColor Yellow
}