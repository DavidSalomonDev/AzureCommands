[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0, ValueFromPipeline = $true)]
    [string[]]$VMNames
)

$identificador = "snapMB"
$fecha = Get-Date -Format "yyyyMMdd"

foreach ($vmName in $VMNames) {
    Write-Host "--------------------------------------------------" -ForegroundColor Cyan
    Write-Host "Procesando VM con Azure CLI: $vmName..." -ForegroundColor Yellow

    try {
        # 1. Buscar la VM globalmente en la suscripción activa
        $vmInfoJson = az vm list --query "[?name=='$vmName'].{rg:resourceGroup, osDiskId:storageProfile.osDisk.managedDisk.id, location:location}" -o json | ConvertFrom-Json

        # Verificar si la consulta devolvió datos
        if (-not $vmInfoJson -or $vmInfoJson.Count -eq 0) {
            Write-Warning "No se encontró la VM '$vmName' en la suscripción activa."
            continue
        }

        # Si hay más de una VM con el mismo nombre en distintos RGs, tomamos la primera
        $vm = $vmInfoJson[0]

        if (-not $vm.osDiskId) {
            Write-Warning "La VM '$vmName' existe, pero no utiliza Managed Disks."
            continue
        }

        $rgName = $vm.rg
        $osDiskId = $vm.osDiskId
        $location = $vm.location
        $snapshotName = "$vmName-OsDisk_${identificador}-$fecha"

        # 2. Crear el Snapshot usando el Resource Group encontrado
        Write-Host "Creando Snapshot '$snapshotName' en el RG '$rgName'..." -ForegroundColor Green
        
        az snapshot create `
            --resource-group $rgName `
            --name $snapshotName `
            --source $osDiskId `
            --location $location `
            --output table

        Write-Host "¡Snapshot $snapshotName creado exitosamente en $rgName!" -ForegroundColor Green

    }
    catch {
        Write-Error "Error al procesar la VM ${vmName}: $_"
    }
}

Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host "Proceso finalizado." -ForegroundColor Cyan