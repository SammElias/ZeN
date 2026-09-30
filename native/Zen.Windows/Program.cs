using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows.Automation;
using Windows.Media.Control;

internal static class Program {
  private static string stage = "input";
  private delegate bool WindowCallback(IntPtr hwnd, IntPtr data);
  [DllImport("user32.dll")] private static extern bool EnumWindows(WindowCallback callback, IntPtr data);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr hwnd, System.Text.StringBuilder text, int length);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] private static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
  [DllImport("user32.dll")] private static extern bool CloseDesktop(IntPtr desktop);
  [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
  [DllImport("user32.dll")] private static extern bool PrintWindow(IntPtr hwnd, IntPtr dc, uint flags);
  [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
  private static void CheckDesktop() {
    stage = "desktop";
    var desktop = OpenInputDesktop(0, false, 0x0100);
    if (desktop == IntPtr.Zero) throw new InvalidOperationException("Escritorio bloqueado o privilegiado: acceso detenido.");
    CloseDesktop(desktop);
  }
  private static List<object> Windows() {
    CheckDesktop(); var result = new List<object>(); var foreground = GetForegroundWindow();
    EnumWindows((handle, _) => {
      if (!IsWindowVisible(handle)) return true;
      var text = new System.Text.StringBuilder(1024); GetWindowText(handle, text, text.Capacity);
      if (text.Length == 0) return true;
      GetWindowThreadProcessId(handle, out var pid);
      result.Add(new { id = handle.ToInt64().ToString(), title = text.ToString(), pid, foreground = handle == foreground }); return true;
    }, IntPtr.Zero); return result;
  }
  private static Dictionary<string, string> Applications() {
    var apps = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    foreach (var hive in new[] { Microsoft.Win32.Registry.LocalMachine, Microsoft.Win32.Registry.CurrentUser }) {
      using var paths = hive.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths");
      if (paths == null) continue;
      foreach (var name in paths.GetSubKeyNames()) {
        using var entry = paths.OpenSubKey(name); var path = (entry?.GetValue("") as string)?.Trim('"');
        if (path != null && System.IO.Path.IsPathFullyQualified(path) && path.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) && System.IO.File.Exists(path)) apps[name] = path;
      }
    }
    return apps;
  }
  private static async Task<object> OpenApplication(string id) {
    CheckDesktop(); var apps = Applications();
    if (!apps.TryGetValue(id, out var path)) throw new InvalidOperationException("Aplicación no instalada en App Paths.");
    var existing = FindApplicationWindow(path, id); if (existing != null) return existing;
    // No shell, command line from the model, elevation, or user-provided executable.
    using var launched = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(path) { UseShellExecute = false, WorkingDirectory = System.IO.Path.GetDirectoryName(path) });
    for (var attempt = 0; attempt < 60; attempt++) {
      var verified = FindApplicationWindow(path, id);
      if (verified != null) return verified;
      await Task.Delay(150);
    }
    throw new InvalidOperationException("Aplicación lanzada sin ventana verificada. No repetir automáticamente.");
  }
  private static object? FindApplicationWindow(string path, string id) {
    object? verified = null;
    EnumWindows((handle, _) => {
      if (!IsWindowVisible(handle)) return true;
      GetWindowThreadProcessId(handle, out var pid);
      try {
        using var process = System.Diagnostics.Process.GetProcessById((int)pid);
        if (string.Equals(process.MainModule?.FileName, path, StringComparison.OrdinalIgnoreCase)) { verified = new { id, pid, windowHandle = handle.ToInt64().ToString(), verified = true }; return false; }
      } catch { }
      return true;
    }, IntPtr.Zero); return verified;
  }
  private static string ReadWindow(string id) {
    CheckDesktop(); var handle = new IntPtr(long.Parse(id));
    stage = "visible-window";
    if (!IsWindowVisible(handle)) throw new InvalidOperationException("La ventana ya no está visible. Vuelve a seleccionar.");
    stage = "automation-root"; var root = AutomationElement.FromHandle(handle);
    // Text-only UI Automation. Never read password fields or invoke controls.
    var text = new List<string>();
    stage = "automation-descendants"; var nodes = root.FindAll(TreeScope.Descendants, new PropertyCondition(AutomationElement.IsOffscreenProperty, false));
    for (var index = 0; index < Math.Min(nodes.Count, 1000); index++) {
      stage = "automation-node"; var node = nodes[index]; if (node.Current.IsPassword) continue;
      if (node.TryGetCurrentPattern(TextPattern.Pattern, out var pattern)) {
        var value = ((TextPattern)pattern).DocumentRange.GetText(4000); if (!string.IsNullOrWhiteSpace(value)) text.Add(value);
      } else if (node.Current.ControlType == ControlType.Text && !string.IsNullOrWhiteSpace(node.Current.Name)) text.Add(node.Current.Name);
      if (text.Sum(value => value.Length) >= 12000) break;
    }
    return string.Join("\n", text.Distinct()).Substring(0, Math.Min(12000, string.Join("\n", text.Distinct()).Length));
  }
  private static object CaptureWindow(string id) {
    CheckDesktop(); var handle = new IntPtr(long.Parse(id));
    if (!IsWindowVisible(handle) || !GetWindowRect(handle, out var rect)) throw new InvalidOperationException("Ventana no disponible.");
    var width = rect.Right - rect.Left; var height = rect.Bottom - rect.Top;
    if (width <= 0 || height <= 0 || width > 8000 || height > 8000 || (long)width * height > 20000000) throw new InvalidOperationException("Dimensiones fuera de límites.");
    using var bitmap = new System.Drawing.Bitmap(width, height);
    using (var graphics = System.Drawing.Graphics.FromImage(bitmap)) {
      var dc = graphics.GetHdc(); bool captured;
      try { captured = PrintWindow(handle, dc, 2); } finally { graphics.ReleaseHdc(dc); }
      if (!captured) throw new InvalidOperationException("La ventana no permite captura.");
    }
    var ratio = Math.Min(1.0, 1400.0 / Math.Max(width, height));
    using var scaled = new System.Drawing.Bitmap(bitmap, (int)(width * ratio), (int)(height * ratio));
    using var output = new System.IO.MemoryStream(); scaled.Save(output, System.Drawing.Imaging.ImageFormat.Png);
    return new { image = "data:image/png;base64," + Convert.ToBase64String(output.ToArray()), width = scaled.Width, height = scaled.Height };
  }
  private static async Task<object> Media(string? id, bool pause) {
    CheckDesktop(); var manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
    var sessions = manager.GetSessions();
    if (!pause) {
      var result = new List<object>();
      foreach (var session in sessions) {
        var properties = await session.TryGetMediaPropertiesAsync();
        result.Add(new { id = session.SourceAppUserModelId, title = properties.Title, state = session.GetPlaybackInfo().PlaybackStatus.ToString(), canPause = session.GetPlaybackInfo().Controls.IsPauseEnabled });
      }
      return result;
    }
    var matches = sessions.Where(session => session.SourceAppUserModelId == id).ToArray();
    if (matches.Length != 1) throw new InvalidOperationException("Sesión multimedia ambigua o no disponible. Vuelve a elegir.");
    var selected = matches[0]; var before = selected.GetPlaybackInfo().PlaybackStatus;
    if (before == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Paused) return new { id, verified = true, alreadyPaused = true };
    if (!selected.GetPlaybackInfo().Controls.IsPauseEnabled) throw new InvalidOperationException("El reproductor no permite pausa explícita.");
    if (!await selected.TryPauseAsync()) throw new InvalidOperationException("El reproductor rechazó la pausa.");
    for (var attempt = 0; attempt < 20; attempt++) {
      if (selected.GetPlaybackInfo().PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Paused) return new { id, verified = true, alreadyPaused = false };
      await Task.Delay(100);
    }
    throw new InvalidOperationException("Pausa enviada, pero sin estado confirmado. No se repite ni se usa un toggle.");
  }
  public static async Task<int> Main(string[] args) {
    try {
      SetProcessDpiAwarenessContext(new IntPtr(-4));
      using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(12));
      var input = await Console.In.ReadLineAsync(deadline.Token);
      if (input == null || input.Length > 8192) throw new InvalidOperationException("Entrada inválida.");
      using var json = JsonDocument.Parse(input); var command = json.RootElement.GetProperty("command").GetString();
      var id = json.RootElement.TryGetProperty("id", out var value) ? value.GetString() : null;
      object result = command switch {
        "windows" => Windows(),
        "apps" => Applications().Keys.Order().Select(id => new { id }).ToArray(),
        "open-app" => await OpenApplication(id ?? throw new InvalidOperationException("Falta aplicación.")),
        "read" => new { text = ReadWindow(id ?? throw new InvalidOperationException("Falta ventana.")) },
        "capture" => CaptureWindow(id ?? throw new InvalidOperationException("Falta ventana.")),
        "media" => await Media(null, false),
        "pause" => await Media(id, true),
        _ => throw new InvalidOperationException("Operación desconocida; no hay shell ni teclado arbitrario.")
      };
      Console.WriteLine(JsonSerializer.Serialize(new { ok = true, value = result })); return 0;
    } catch (Exception error) { Console.WriteLine(JsonSerializer.Serialize(new { ok = false, code = error.GetType().Name, stage, hresult = error.HResult, error = "Operación Windows no verificada. Revisa sesión, selección, permisos y escritorio desbloqueado." })); return 1; }
  }
}
