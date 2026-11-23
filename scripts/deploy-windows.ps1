[CmdletBinding()]
param(
  [switch]$Install,
  [switch]$UseValidatedPackage,
  [string]$ApprovedManifest
)

$ErrorActionPreference = 'Stop'
if (!$IsWindows) { throw 'Este despliegue requiere Windows y PowerShell 7.' }
$root = (Get-Item -LiteralPath (Join-Path $PSScriptRoot '..')).FullName
Set-Location -LiteralPath $root
$release = Join-Path $root 'release'
$source = Join-Path $release 'single-file/ZEN.exe'
$desktopDir = [Environment]::GetFolderPath('DesktopDirectory')
if (!$desktopDir) { throw 'Windows no ha identificado el escritorio de este usuario.' }
$desktop = Join-Path $desktopDir 'ZEN.exe'
$deploymentLock = [Threading.Mutex]::new($false, 'Local\ZEN.WindowsDeployment')
$hasLock = $false
try {
  $hasLock = $deploymentLock.WaitOne(0)
  if (!$hasLock) { throw 'Ya se está preparando o desplegando ZEN en esta sesión.' }

  function Invoke-Checked([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Falló $Program $($Arguments -join ' ') (código $LASTEXITCODE)." }
  }

  function Read-Receipt([string]$Name) {
    Get-Content -Raw -LiteralPath (Join-Path $root "docs/evidence/$Name.json") | ConvertFrom-Json
  }

  function Get-Sha([string]$File) {
    if (Test-Path -LiteralPath $File -PathType Leaf) { (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash }
  }

  function Get-ContainedPath([string]$Base, [string]$Relative) {
    $file = [IO.Path]::GetFullPath($Relative, $Base)
    if ([IO.Path]::IsPathRooted($Relative) -or !$file.StartsWith("$Base\", [StringComparison]::OrdinalIgnoreCase)) {
      throw 'El manifiesto incluye una ruta fuera del directorio previsto.'
    }
    return $file
  }

  if (!$UseValidatedPackage) {
    Invoke-Checked npm @('run', 'package:win')
    Invoke-Checked npm @('test', '--', '--maxWorkers=4')
    $built = Read-Receipt 'portable-shell'
    if (!$env:ELECTRON_BUILDER_COMPRESSION_LEVEL) { $env:ELECTRON_BUILDER_COMPRESSION_LEVEL = '2' }
    Invoke-Checked npm @('run', 'package:single', '--', $built.destination)
    Invoke-Checked node @('scripts/single-file-smoke.mjs', $source)
  }

  $built = Read-Receipt 'portable-shell'
  $smoke = Read-Receipt 'single-executable'
  $sha = Get-Sha $source
  if (!$built.smoke.passed -or !$smoke.packagedStartupVerified -or $smoke.exitCode -ne 0 -or
      !$sha -or $smoke.executable -ne $source -or $sha -ne $smoke.sha256) {
    throw 'El portable no coincide con el ejecutable validado.'
  }
  $appRoot = Join-Path $built.destination 'resources\app'
  $entries = @{}
  foreach ($entry in $smoke.packageFiles) {
    $key = $entry.path.Replace('\', '/')
    if ($entries.ContainsKey($key)) { throw 'El manifiesto del portable contiene rutas duplicadas.' }
    $entries[$key] = $entry.sha256
  }
  if ($entries.Count -ne @($built.files).Count -or !$entries['dist/main.cjs'] -or !$entries['dist/renderer/index.html']) {
    throw 'El portable extraído y el paquete de compilación tienen manifiestos distintos.'
  }
  foreach ($entry in $built.files) {
    $key = $entry.path.Replace('\', '/')
    if ($entry.sha256 -ne $entries[$key] -or $entry.sha256 -ne (Get-Sha (Get-ContainedPath $appRoot $key))) {
      throw "El contenido del portable no coincide con el paquete: $key"
    }
    if ($key.StartsWith('dist/') -and $entry.sha256 -ne (Get-Sha (Get-ContainedPath $root $key))) {
      throw "La compilación actual y el paquete son distintos: $key"
    }
  }
  if ($ApprovedManifest) {
    $approvedFiles = @(Get-Content -LiteralPath $ApprovedManifest | Where-Object { $_.Trim() })
    if (!$approvedFiles.Count) { throw 'El manifiesto aprobado está vacío.' }
    foreach ($line in $approvedFiles) {
      if ($line -notmatch '^([a-fA-F0-9]{64})\s{2}(.+)$') { throw 'El manifiesto aprobado debe usar el formato SHA-256 de dos columnas.' }
      if ((Get-Sha (Get-ContainedPath $root $Matches[2])) -ne $Matches[1]) {
        throw "La revisión actual no coincide con el manifiesto aprobado: $($Matches[2])"
      }
    }
  }

  $report = [ordered]@{
    at = [DateTime]::UtcNow.ToString('o'); source = $source; sha256 = $sha
    mainSha256 = $entries['dist/main.cjs']; packageFilesVerified = $entries.Count
    packagedStartupVerified = $true; installed = $false
  }
  if (!$Install) { $report | ConvertTo-Json -Compress; return }

  function Get-InstalledProcesses {
    Get-CimInstance Win32_Process -Filter "Name='ZEN.exe'" | Where-Object ExecutablePath -eq $desktop
  }

  function Request-ZenExit {
    $running = @(Get-InstalledProcesses)
    if (!$running.Count) { return }
    if ($running.Count -ne 1) { throw 'Se encontró más de un proceso lanzado desde el ejecutable del escritorio.' }
    $oldLauncherId = $running[0].ProcessId
    Write-Verbose "Solicitando a ZEN el cierre ordenado del proceso del escritorio $oldLauncherId."
    $request = Start-Process -FilePath $source -ArgumentList '--zen-deploy-quit' -WindowStyle Hidden -PassThru
    $wait = [Diagnostics.Stopwatch]::StartNew()
    while ($wait.Elapsed.TotalSeconds -lt 45) {
      $running = @(Get-InstalledProcesses)
      if (!$running.Count) { return $oldLauncherId }
      if ($running.Count -ne 1 -or $running[0].ProcessId -ne $oldLauncherId) {
        throw 'La instancia del escritorio cambió durante el cierre ordenado. El ejecutable aún no se ha sustituido en este paso.'
      }
      if ($request.HasExited -and $request.ExitCode -ne 0) {
        throw "Falló la solicitud de cierre de ZEN con código $($request.ExitCode)."
      }
      Start-Sleep -Milliseconds 350
    }
    throw "ZEN (PID $oldLauncherId) no confirmó el cierre ordenado en 45 segundos. Usa Salir de ZEN en la bandeja y repite con -Install -UseValidatedPackage."
  }

  function Start-Zen {
    Start-Process -FilePath $desktop -WorkingDirectory $desktopDir -WindowStyle Hidden -PassThru
  }

  function Replace-ZenExecutable([string]$Staged) {
    for ($attempt = 0; ; $attempt++) {
      try { [IO.File]::Move($Staged, $desktop, $true); return }
      catch [IO.IOException], [UnauthorizedAccessException] {
        if ($attempt -ge 12) { throw }
        Start-Sleep -Milliseconds 250
      }
    }
  }

  $previous = Get-Sha $desktop
  $wasRunning = [bool](Get-InstalledProcesses)
  $backup = $null
  $backups = Join-Path $release 'backups'
  $id = [Guid]::NewGuid().ToString('N')
  $incoming = "$desktop.$id.tmp"
  New-Item -ItemType Directory -Path $backups -Force | Out-Null
  if ($previous -and $previous -ne $sha) {
    $backup = Join-Path $backups "ZEN-antes-$id.exe"
    Copy-Item -LiteralPath $desktop -Destination $backup
    if ((Get-Sha $backup) -ne $previous) { throw 'El respaldo del ejecutable no coincide.' }
  }

  $replaced = $false
  $closedLauncherId = $null
  try {
    if ($previous -ne $sha) {
      Copy-Item -LiteralPath $source -Destination $incoming
      if ((Get-Sha $incoming) -ne $sha) { throw 'Cambió el portable preparado para instalar.' }
      $closedLauncherId = Request-ZenExit
      if ((Get-Sha $desktop) -ne $previous) { throw 'Cambió el ejecutable del escritorio durante el despliegue.' }
      Replace-ZenExecutable $incoming
      $replaced = $true
    }
    $running = @(Get-InstalledProcesses)
    if ($running.Count -gt 1) { throw 'No se puede identificar la instancia instalada.' }
    $launcherId = if ($running.Count) { $running[0].ProcessId } else { (Start-Zen).Id }
    $verified = $null
    for ($attempt = 0; $attempt -lt 70; $attempt++) {
      $candidate = Get-CimInstance Win32_Process -Filter "Name='ZEN.exe' AND ParentProcessId=$launcherId" |
        Where-Object { $_.ExecutablePath -and $_.CommandLine -notmatch ' --type=' } | Select-Object -First 1
      $window = if ($candidate) { Get-Process -Id $candidate.ProcessId -ErrorAction SilentlyContinue }
      if ($window -and $window.MainWindowHandle -ne [IntPtr]::Zero) {
        $runtime = Join-Path (Split-Path $candidate.ExecutablePath) 'resources\app'
        if ((Get-Sha (Join-Path $runtime 'dist/main.cjs')) -eq $entries['dist/main.cjs'] -and
            (Get-Sha (Join-Path $runtime 'dist/renderer/index.html')) -eq $entries['dist/renderer/index.html']) {
          $verified = $candidate
          break
        }
      }
      Start-Sleep -Milliseconds 400
    }
    if (!$verified -or (Get-Sha $desktop) -ne $sha) { throw 'No se pudo verificar el arranque del ejecutable instalado.' }
  } catch {
    if ($replaced -and (Get-Sha $desktop) -eq $sha) {
      Request-ZenExit | Out-Null
      if ($backup) {
        Copy-Item -LiteralPath $backup -Destination $incoming
        if ((Get-Sha $incoming) -ne $previous) { throw 'Falló la verificación del respaldo para revertir.' }
        Replace-ZenExecutable $incoming
        if ((Get-Sha $desktop) -ne $previous) { throw 'No se pudo verificar el ejecutable restaurado.' }
        Start-Zen | Out-Null
      } else {
        Move-Item -LiteralPath $desktop -Destination (Join-Path $backups "ZEN-fallo-$id.exe")
      }
    } elseif ($wasRunning -and !$replaced -and $previous -and (Get-Sha $desktop) -eq $previous -and !(Get-InstalledProcesses)) {
      Start-Zen | Out-Null
    }
    throw
  } finally {
    if (Test-Path -LiteralPath $incoming -PathType Leaf) { Remove-Item -LiteralPath $incoming }
  }

  $report.installed = $true
  $report.destination = $desktop
  $report.backup = $backup
  $report.restarted = $null -ne $closedLauncherId
  $report.previousLauncherId = $closedLauncherId
  $report.launcherId = $launcherId
  $report.processId = $verified.ProcessId
  $report | ConvertTo-Json -Compress | Set-Content -LiteralPath (Join-Path $release 'deployment-windows.json')
  $report | ConvertTo-Json -Compress
} finally {
  if ($hasLock) { $deploymentLock.ReleaseMutex() }
  $deploymentLock.Dispose()
}
