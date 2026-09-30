param([switch]$ProbeOnly)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class ZenWindows {
  public delegate bool Callback(IntPtr hwnd, IntPtr data);
  [DllImport("user32.dll")] public static extern bool EnumWindows(Callback callback, IntPtr data);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
}
'@
function Find-NotepadWindow {
  $script:found = $null
  $callback = [ZenWindows+Callback]{ param($hwnd, $data)
    if ([ZenWindows]::IsWindowVisible($hwnd)) {
      [uint32]$windowPid = 0
      [void][ZenWindows]::GetWindowThreadProcessId($hwnd, [ref]$windowPid)
      $process = Get-Process -Id $windowPid -ErrorAction SilentlyContinue
      $trustedPath = $false
      if ($process -and $process.Path) {
        $systemNotepad = Join-Path $env:WINDIR 'System32\notepad.exe'
        $trustedPath = ($process.Path -eq $systemNotepad) -or ($process.Path -match '^C:\\Program Files\\WindowsApps\\Microsoft\.WindowsNotepad_[^\\]+\\Notepad\\Notepad\.exe$')
      }
      if ($process -and $process.ProcessName -eq 'notepad' -and $trustedPath) {
        $script:found = @{ application='notepad'; pid=[int]$windowPid; windowHandle=$hwnd.ToInt64().ToString(); verifiedAt=[DateTime]::UtcNow.ToString('o') }
        return $false
      }
    }
    return $true
  }
  [void][ZenWindows]::EnumWindows($callback, [IntPtr]::Zero)
  return $script:found
}
$existing = Find-NotepadWindow
if ($ProbeOnly) { if ($existing) { $existing.alreadyOpen=$true; $existing | ConvertTo-Json -Compress }; exit 0 }
if ($existing) { $existing.alreadyOpen=$true; $existing | ConvertTo-Json -Compress; exit 0 }
# Absolute allowlisted executable; no arguments from user or model.
Start-Process -FilePath (Join-Path $env:WINDIR 'System32\notepad.exe') -WindowStyle Normal
$deadline = [DateTime]::UtcNow.AddSeconds(12)
do {
  Start-Sleep -Milliseconds 150
  $window = Find-NotepadWindow
  if ($window) { $window.alreadyOpen=$false; $window | ConvertTo-Json -Compress; exit 0 }
} while ([DateTime]::UtcNow -lt $deadline)
throw 'Notepad launched, but no visible associated window was verified. Do not retry automatically.'
