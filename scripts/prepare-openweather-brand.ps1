$ErrorActionPreference = 'Stop'
$icons = Join-Path $PSScriptRoot '../public/icons'
$logos = [ordered]@{
    'openweather-dark.png' = 'Logo files/Negative logo/RGB (for screen)/OpenWeather-Negative-Logo RGB.png'
    'openweather-light.png' = 'Logo files/Master logo/RGB (for screen)/OpenWeather-Master-Logo RGB.png'
}

$missing = @($logos.Keys | Where-Object { !(Test-Path -LiteralPath (Join-Path $icons $_) -PathType Leaf) })
if (!$missing.Count) { return }

$download = [IO.Path]::GetTempFileName()
try {
    Invoke-WebRequest -Uri 'https://openweathermap.org/payload/api/files/file/logo_files.zip' -TimeoutSec 30 -OutFile $download
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($download)
    try {
        foreach ($name in $missing) {
            $entry = $archive.GetEntry($logos[$name])
            if (!$entry) { throw "El paquete oficial de OpenWeather no contiene $name." }
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,(Join-Path $icons $name),$false)
        }
    } finally {
        $archive.Dispose()
    }
} finally {
    Remove-Item -LiteralPath $download
}
