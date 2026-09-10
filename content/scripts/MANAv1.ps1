<#
.SYNOPSIS
    Evaluación de VMs en Azure afectadas por el despliegue de MANA.
.DESCRIPTION
    Filtra STRICTAMENTE las familias y series de la tabla oficial de Microsoft:
    Av2, Bsv2, Dv1-v5 (con d/s/l, SIN a), Dpsv6, Ev3-v5 (con d/s, SIN a), Epsv6, Ebsv5, F/Fs/Fsv2, G/Gs, Ls.
#>

# Expresión regular para validar versiones de SO compatibles OUT-OF-THE-BOX
$compatibleOsPattern = '(?i)(2022|2025|20[\._]04|22[\._]04|24[\._]04|8[\._][6-9]|9[\._][0-9]|15-sp[3-7]|11|12|azure-linux|al2022)'

function Test-IsAffectedSize {
    param ([string]$VmSize)

    # 1. Si el tamaño contiene 'a' en los modificadores de serie (ej: E2ads_v5, E8as_v5), NO es afectado
    # Excepción: la familia Ls que sí puede ser AMD en algunas tablas, pero para E/D las variantes AMD llevan 'a' después del número/letra de familia.
    if ($VmSize -match 'Standard_[ED][0-9]+a(d)?s?_v[0-9]+') {
        return $false
    }

    # 2. Evaluación de comodines estrictos para las series soportadas por MANA
    switch -Wildcard ($VmSize) {
        'Standard_A*v2'           { return $true } # Av2
        'Standard_B*sv2'          { return $true } # Bsv2
        'Standard_D*_v1'          { return $true } # Dv1 a Dv5 / Dsv1 a Dsv5 / Ddsv5 (Intel)
        'Standard_D*_v2'          { return $true }
        'Standard_D*_v3'          { return $true }
        'Standard_D*_v4'          { return $true }
        'Standard_D*_v5'          { return $true }
        'Standard_Dp*_v6'         { return $true } # Dpsv6, Dpdsv6
        'Standard_E*_v3'          { return $true } # Ev3 a Ev5 / Esv3 a Esv5 / Edsv5 (Intel)
        'Standard_E*_v4'          { return $true }
        'Standard_E*_v5'          { return $true }
        'Standard_Ep*_v6'         { return $true } # Epsv6, Epdsv6
        'Standard_Eb*_v5'         { return $true } # Ebsv5, Ebdsv5
        'Standard_F*'             { return $true } # F, Fs, Fsv2
        'Standard_G*'             { return $true } # G, Gs
        'Standard_L*'             { return $true } # Ls, Lsv2, Lsv3
        default                   { return $false }
    }
}

Write-Host "Analizando VMs de la suscripción según la tabla de familias oficial..." -ForegroundColor Cyan

$vms = Get-AzVM

$results = foreach ($vm in $vms) {
    $size = $vm.HardwareProfile.VmSize
    
    # Evaluación del tamaño
    $isAffectedSize = Test-IsAffectedSize -VmSize $size

    # Revisa si la interfaz de red tiene Accelerated Networking habilitado
    $hasAcceleratedNet = $false

    foreach ($nicRef in $vm.NetworkProfile.NetworkInterfaces) {
        $nicName = $nicRef.Id.Split('/')[-1]
        $nicRg   = $nicRef.Id.Split('/')[4]
        
        $nic = Get-AzNetworkInterface -ResourceGroupName $nicRg -Name $nicName -ErrorAction SilentlyContinue
        if ($nic -and $nic.EnableAcceleratedNetworking -eq $true) {
            $hasAcceleratedNet = $true
            break
        }
    }

    # Evalúa la imagen/SO de la VM
    $osPublisher = $vm.StorageProfile.ImageReference.Publisher
    $osOffer     = $vm.StorageProfile.ImageReference.Offer
    $osSku       = $vm.StorageProfile.ImageReference.Sku
    $osVersion   = $vm.StorageProfile.ImageReference.ExactVersion
    
    if (-not $osSku) {
        $osDetails = "Custom Image / Unmanaged ($($vm.StorageProfile.OsDisk.OsType))"
        $isOsKnownCompatible = $false
    } else {
        $osDetails = "$osPublisher | $osOffer | $osSku ($osVersion)"
        $isOsKnownCompatible = ($osSku -match $compatibleOsPattern) -or ($osDetails -match $compatibleOsPattern)
    }

    # Criterio de revisión: Tamaño afectado + AccNet habilitado + SO NO compatible Out-of-the-Box
    $requiresReview = $isAffectedSize -and $hasAcceleratedNet -and (-not $isOsKnownCompatible)

    [PSCustomObject]@{
        VMName                = $vm.Name
        ResourceGroup         = $vm.ResourceGroupName
        VMSize                = $size
        IsAffectedSize        = $isAffectedSize
        AcceleratedNetEnabled = $hasAcceleratedNet
        OSType                = $vm.StorageProfile.OsDisk.OsType
        OSImageDetails        = $osDetails
        IsOSCompatible        = $isOsKnownCompatible
        RequiereRevision      = $requiresReview
    }
}

if ($results) {
    $results | Format-Table -AutoSize
} else {
    Write-Host "No se encontraron máquinas virtuales." -ForegroundColor Yellow
}