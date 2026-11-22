#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ServerAddress,
    [Parameter(Mandatory)]
    [ValidatePattern('^(?:[A-Z2-7]{7}-){7}[A-Z2-7]{7}$')]
    [string]$ServerDeviceId
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ip = [Net.IPAddress]::None
if (-not [Net.IPAddress]::TryParse($ServerAddress, [ref]$ip) -or
    $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) {
    throw 'Indica la IPv4 de Tailscale de la Raspberry.'
}
$octets = $ip.GetAddressBytes()
if ($octets[0] -ne 100 -or $octets[1] -lt 64 -or $octets[1] -gt 127) {
    throw 'La direccion debe pertenecer a 100.64.0.0/10 (Tailscale).'
}
$ServerAddress = $ip.ToString()
$installPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'release\local-tools\Syncthing'
$exePath = Join-Path $installPath 'syncthing.exe'
$statePath = Join-Path $env:LOCALAPPDATA 'Syncthing'
$configPath = Join-Path $statePath 'config.xml'
$credentialPath = Join-Path $statePath 'zen-personal-sync-gui.clixml'
$notesPath = Join-Path $env:USERPROFILE 'Servidor-personal\Notas'
$rulesPath = Join-Path $notesPath '.stignore'
$templatePath = Join-Path $PSScriptRoot 'personal-sync.stignore'

function Get-ReleaseAsset($repository, $namePattern, $downloadPath) {
    $release = Invoke-RestMethod "https://api.github.com/repos/$repository/releases/latest" -UserAgent 'ZEN-Personal-Sync-Setup'
    $matching = @($release.assets | Where-Object { $_.name -like $namePattern })
    if ($matching.Count -ne 1) { throw "Publicacion inesperada en $repository." }
    $asset = $matching[0]
    if (-not $asset.browser_download_url.StartsWith("https://github.com/$repository/releases/download/") -or
        $asset.digest -notmatch '^sha256:[0-9a-f]{64}$') {
        throw "Origen o huella no verificables en $repository."
    }
    $file = Join-Path $downloadPath $asset.name
    Invoke-WebRequest $asset.browser_download_url -OutFile $file -UseBasicParsing
    if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ine $asset.digest.Substring(7) -or
        (Get-Item -LiteralPath $file).Length -ne $asset.size) {
        throw "La descarga no coincide con la publicacion de $repository."
    }
    return $file
}

if (-not (Test-Path -LiteralPath $exePath)) {
    if ((Test-Path -LiteralPath $configPath) -or (Get-Process -Name syncthing -ErrorAction SilentlyContinue)) {
        throw 'Hay una instalacion o perfil de Syncthing existente. Conserva ese perfil y empareja desde su panel.'
    }
    $architecture = $env:PROCESSOR_ARCHITECTURE
    if ($env:PROCESSOR_ARCHITEW6432) { $architecture = $env:PROCESSOR_ARCHITEW6432 }
    switch ($architecture) {
        'AMD64' { $releaseArchitecture = 'amd64' }
        'ARM64' { $releaseArchitecture = 'arm64' }
        default { throw "Arquitectura de Windows no soportada: $architecture." }
    }
    $downloadPath = Join-Path $env:TEMP ('zen-personal-sync-' + [Guid]::NewGuid().ToString('N'))
    $null = New-Item -ItemType Directory -Path $downloadPath
    $setup = Get-ReleaseAsset 'Bill-Stewart/SyncthingWindowsSetup' 'syncthing-windows-setup-v*.exe' $downloadPath
    $zip = Get-ReleaseAsset 'syncthing/syncthing' "syncthing-windows-$releaseArchitecture-v*.zip" $downloadPath
    $log = Join-Path $downloadPath 'setup.log'
    $setupArgs = @(
        '/currentuser', '/verysilent', '/suppressmsgboxes', '/norestart', '/sp-',
        '/noconfigpage', '/tasks=startatlogon', '/relaysenabled=false', '/autoupgradeinterval=0',
        ('/dir="' + $installPath + '"'), ('/zipfilepath="' + $zip + '"'), ('/log="' + $log + '"')
    )
    $process = Start-Process -FilePath $setup -ArgumentList $setupArgs -WindowStyle Hidden -Wait -PassThru
    if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $exePath)) {
        throw "Setup devolvio $($process.ExitCode). Registro en $log."
    }
}

$tasks = @(Get-ScheduledTask | Where-Object {
    $_.TaskName -like 'Start Syncthing at logon*' -and
    @($_.Actions | Where-Object {
        [string]$_.Execute -like "*$installPath*" -or [string]$_.Arguments -like "*$installPath*"
    }).Count -gt 0
})
if ($tasks.Count -ne 1) { throw 'No se encontro la tarea de inicio de esta instalacion.' }

$config = [xml][IO.File]::ReadAllText($configPath)
$local = $config.SelectSingleNode('/configuration/device')
if (-not $local) { throw 'Falta la identidad de Syncthing en Windows.' }
$localId = $local.GetAttribute('id')
if ($localId -eq $ServerDeviceId) { throw 'El ID de la Raspberry coincide con el local.' }
$currentFolder = $config.SelectSingleNode('/configuration/folder[@id="personal-notas"]')
$currentAddress = $config.SelectSingleNode("/configuration/device[@id='$ServerDeviceId']/address")
$alreadyConfigured = (Test-Path -LiteralPath $credentialPath) -and $currentFolder -and
    ($currentFolder.GetAttribute('path') -eq $notesPath) -and
    $currentAddress -and ($currentAddress.InnerText -eq "tcp://$($ServerAddress):22000")

if (-not $alreadyConfigured) {
    if ((Get-Process -Name syncthing -ErrorAction SilentlyContinue) -or
        $config.SelectNodes('/configuration/device').Count -ne 1 -or
        $config.SelectNodes('/configuration/folder').Count -ne 0) {
        throw 'El perfil contiene carpetas o dispositivos, o esta en uso. Conserva su configuracion.'
    }
    if (Test-Path -LiteralPath $notesPath) {
        if (Get-ChildItem -LiteralPath $notesPath -Force | Where-Object Name -ne '.stignore') {
            throw 'La carpeta Notas contiene archivos. Revisalos antes de activar la sincronizacion.'
        }
    }
    $null = New-Item -ItemType Directory -Path $notesPath -Force
    if (Test-Path -LiteralPath $rulesPath) {
        if (Compare-Object (Get-Content -LiteralPath $rulesPath) (Get-Content -LiteralPath $templatePath) -SyncWindow 0) {
            throw 'Notas tiene otras reglas de exclusion. Revisalas antes de continuar.'
        }
    } else {
        Copy-Item -LiteralPath $templatePath -Destination $rulesPath
    }

    if (Test-Path -LiteralPath $credentialPath) {
        $credential = Import-Clixml -LiteralPath $credentialPath
    } else {
        $bytes = New-Object byte[] 24
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        $password = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
        $credential = [pscredential]::new('administrador', (ConvertTo-SecureString $password -AsPlainText -Force))
        $credential | Export-Clixml -LiteralPath $credentialPath
    }
    $credential.GetNetworkCredential().Password | & $exePath generate "--home=$statePath" '--gui-user=administrador' '--gui-password=-' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Syncthing no pudo configurar la contrasena del panel.' }

    $config = [xml][IO.File]::ReadAllText($configPath)
    function Set-ElementText($parent, $tag, $value) {
        foreach ($child in @($parent.SelectNodes($tag))) { $null = $parent.RemoveChild($child) }
        $element = $config.CreateElement($tag)
        $element.InnerText = $value
        $null = $parent.AppendChild($element)
    }
    $gui = $config.SelectSingleNode('/configuration/gui')
    $gui.SetAttribute('tls', 'false')
    Set-ElementText $gui 'address' '127.0.0.1:8384'
    $options = $config.SelectSingleNode('/configuration/options')
    foreach ($key in 'globalAnnounceEnabled','localAnnounceEnabled','relaysEnabled','natEnabled','startBrowser','crashReportingEnabled') {
        Set-ElementText $options $key 'false'
    }
    Set-ElementText $options 'listenAddress' 'tcp://127.0.0.1:22000'
    Set-ElementText $options 'urAccepted' '-1'
    Set-ElementText $options 'autoUpgradeIntervalH' '0'

    $device = $config.SelectSingleNode('/configuration/defaults/device').CloneNode($true)
    $device.SetAttribute('id', $ServerDeviceId)
    $device.SetAttribute('name', 'Raspberry Pi')
    $device.SetAttribute('introducer', 'false')
    Set-ElementText $device 'address' "tcp://$($ServerAddress):22000"
    Set-ElementText $device 'allowedNetwork' "$ServerAddress/32"
    Set-ElementText $device 'autoAcceptFolders' 'false'
    $null = $config.DocumentElement.AppendChild($device)

    $folder = $config.SelectSingleNode('/configuration/defaults/folder').CloneNode($true)
    $folder.SetAttribute('id', 'personal-notas')
    $folder.SetAttribute('label', 'Notas')
    $folder.SetAttribute('path', $notesPath)
    $folder.SetAttribute('type', 'sendreceive')
    $folder.SetAttribute('ignorePerms', 'true')
    Set-ElementText $folder 'maxConflicts' '-1'
    foreach ($previous in @($folder.SelectNodes('device'))) { $null = $folder.RemoveChild($previous) }
    foreach ($id in $localId,$ServerDeviceId) {
        $member = $config.CreateElement('device')
        $member.SetAttribute('id', $id)
        $null = $folder.AppendChild($member)
    }
    $null = $config.DocumentElement.AppendChild($folder)
    $newPath = "$configPath.zen-new"
    $config.Save($newPath)
    [IO.File]::Replace($newPath, $configPath, "$configPath.zen-before")
}
if (-not (Get-Process -Name syncthing -ErrorAction SilentlyContinue | Where-Object Path -eq $exePath)) {
    $tasks[0] | Start-ScheduledTask
}
"Instalacion: $installPath"
"Panel: http://127.0.0.1:8384/"
"Notas: $notesPath"
"ID de este Windows: $localId"
