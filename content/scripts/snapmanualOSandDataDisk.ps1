[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0, ValueFromPipeline = $true)]
    [string[]]$VMNames
)

# ==========================================
# CONFIGURACIÓN GENERAL
# ==========================================
$identificador = "snapMB"
$fecha = Get-Date -Format "yyyyMMdd"

# ==========================================
# EJECUCIÓN DEL SCRIPT
# ==========================================
foreach ($vmName in $VMNames) {
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "Procesando VM: $vmName..." -ForegroundColor Yellow

    try {
        # 1. Consultar la VM globalmente obteniendo el disco de SO y la lista de discos de datos (con su LUN)
        $query = "[?name=='$vmName'].{rg:resourceGroup, location:location, osDiskId:storageProfile.osDisk.managedDisk.id, dataDisks:storageProfile.dataDisks}"
        $vmInfoJson = az vm list --query $query -o json | ConvertFrom-Json

        if (-not $vmInfoJson -or $vmInfoJson.Count -eq 0) {
            Write-Warning "No se encontró la VM '$vmName' en la suscripción activa."
            continue
        }

        $vm = $vmInfoJson[0]
        $rgName = $vm.rg
        $location = $vm.location

        # ------------------------------------------
        # A. SNAPSHOT DEL DISCO DE SISTEMA OPERATIVO
        # ------------------------------------------
        if ($vm.osDiskId) {
            $osSnapshotName = "$vmName-OsDisk_${identificador}-$fecha"
            
            Write-Host "Creando Snapshot para OS Disk: '$osSnapshotName'..." -ForegroundColor Green
            az snapshot create `
                --resource-group $rgName `
                --name $osSnapshotName `
                --source $vm.osDiskId `
                --location $location `
                --output table
        } else {
            Write-Warning "La VM '$vmName' no cuenta con un disco de SO Managed Disk."
        }

        # ------------------------------------------
        # B. SNAPSHOTS DE DISCOS DE DATOS
        # ------------------------------------------
        if ($vm.dataDisks -and $vm.dataDisks.Count -gt 0) {
            Write-Host "Detectados $($vm.dataDisks.Count) disco(s) de datos. Procesando..." -ForegroundColor Cyan

            foreach ($dataDisk in $vm.dataDisks) {
                # Validar que sea un Managed Disk
                if ($dataDisk.managedDisk -and $dataDisk.managedDisk.id) {
                    $lun = $dataDisk.lun
                    $dataDiskId = $dataDisk.managedDisk.id
                    
                    # Nomenclatura requerida: nomserver-DataDisk_LUN<num>-snapMB-fecha
                    $dataSnapshotName = "$vmName-DataDisk_LUN${lun}_${identificador}-$fecha"

                    Write-Host "Creando Snapshot para Data Disk (LUN $lun): '$dataSnapshotName'..." -ForegroundColor Green
                    
                    az snapshot create `
                        --resource-group $rgName `
                        --name $dataSnapshotName `
                        --source $dataDiskId `
                        --location $location `
                        --output table
                } else {
                    Write-Warning "Un disco de datos en LUN $($dataDisk.lun) no es un Managed Disk y será omitido."
                }
            }
        } else {
            Write-Host "La VM '$vmName' no tiene discos de datos adjuntos." -ForegroundColor Gray
        }

    }
    catch {
        Write-Error "Error al procesar la VM ${vmName}: $_"
    }
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Proceso de snapshots finalizado." -ForegroundColor Cyan