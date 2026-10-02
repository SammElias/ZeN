using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows.Automation;
internal static partial class Program {
  [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("user32.dll")] private static extern bool GetClientRect(IntPtr hwnd, out Rect rect);
  [DllImport("user32.dll")] private static extern bool ClientToScreen(IntPtr hwnd, ref Point point);
  [DllImport("user32.dll")] private static extern bool GetCursorPos(out Point point);
  [DllImport("user32.dll",SetLastError=true)] private static extern bool SetThreadDesktop(IntPtr desktop);
  [DllImport("user32.dll")] private static extern IntPtr WindowFromPoint(Point point);
  [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
  [DllImport("user32.dll")] private static extern uint SendInput(uint count, Input[] input, int size);
  [DllImport("user32.dll")] private static extern int GetSystemMetrics(int index);
  [StructLayout(LayoutKind.Sequential)] private struct Point { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] private struct Input { public uint Type; public InputUnion Data; }
  [StructLayout(LayoutKind.Explicit)] private struct InputUnion { [FieldOffset(0)] public MouseInput Mouse; [FieldOffset(0)] public KeyInput Key; }
  [StructLayout(LayoutKind.Sequential)] private struct MouseInput { public int X,Y; public uint Data,Flags,Time; public UIntPtr Extra; }
  [StructLayout(LayoutKind.Sequential)] private struct KeyInput { public ushort Vk,Scan; public uint Flags,Time; public UIntPtr Extra; }
  private static IntPtr ComputerTarget(JsonElement root) {
    CheckDesktop();stage="computer-target";
    var handle=new IntPtr(long.Parse(root.GetProperty("id").GetString()!));
    stage="computer-visible";if(!IsWindowVisible(handle)||IsIconic(handle))throw new InvalidOperationException("Ventana no visible.");
    stage="computer-identity";
    GetWindowThreadProcessId(handle,out var pid);if(pid!=root.GetProperty("pid").GetInt32()||pid==root.GetProperty("ownerPid").GetInt32())throw new InvalidOperationException("Identidad de ventana cambió.");
    var processName=System.Diagnostics.Process.GetProcessById((int)pid).ProcessName.ToLowerInvariant();
    stage="computer-process";
    if(new[]{"cmd","powershell","pwsh","windowsterminal","conhost","wsl","bash","mintty","regedit","taskmgr","mmc","credentialuibroker","consent","chatgpt","zen","electron"}.Contains(processName))throw new InvalidOperationException("Aplicación excluida del control.");
    var foreground=GetForegroundWindow();GetWindowThreadProcessId(foreground,out var foregroundPid);
    stage="computer-user-focus";
    if(!root.TryGetProperty("initial",out var initial)||!initial.GetBoolean()) {
      if(foreground!=handle&&foregroundPid!=root.GetProperty("ownerPid").GetInt32())throw new InvalidOperationException("El usuario cambió la aplicación activa.");
    }
    stage="computer-set-focus";if(foreground!=handle){SetForegroundWindow(handle);System.Threading.Thread.Sleep(100);}
    // Observation and an explicitly reviewed click can target a visible inactive
    // window. Keyboard input always requires verified foreground focus below.
    return handle;
  }
  private static Rect ComputerRect(IntPtr handle) {
    if(!GetClientRect(handle,out var client))throw new InvalidOperationException("Área no verificable.");
    var origin=new Point();if(!ClientToScreen(handle,ref origin))throw new InvalidOperationException("Coordenadas no verificables.");
    var rect=new Rect{Left=origin.X,Top=origin.Y,Right=origin.X+client.Right,Bottom=origin.Y+client.Bottom};var monitor=MonitorRect(handle);
    if(client.Right<1||client.Bottom<1||client.Right>6000||client.Bottom>6000||(long)client.Right*client.Bottom>16000000||rect.Left<monitor.Left||rect.Top<monitor.Top||rect.Right>monitor.Right||rect.Bottom>monitor.Bottom)throw new InvalidOperationException("Mantén toda la ventana en un monitor.");
    return rect;
  }
  private static object ComputerFrame(JsonElement root) {
    var handle=ComputerTarget(root);stage="computer-frame";var rect=ComputerRect(handle);if(DwmFlush()!=0)throw new InvalidOperationException("Composición no verificada.");
    using var bitmap=new System.Drawing.Bitmap(rect.Right-rect.Left,rect.Bottom-rect.Top);
    using(var graphics=System.Drawing.Graphics.FromImage(bitmap))graphics.CopyFromScreen(rect.Left,rect.Top,0,0,bitmap.Size,System.Drawing.CopyPixelOperation.SourceCopy);
    using var output=new System.IO.MemoryStream();bitmap.Save(output,System.Drawing.Imaging.ImageFormat.Png);
    return new{image="data:image/png;base64,"+Convert.ToBase64String(output.ToArray()),width=bitmap.Width,height=bitmap.Height,bounds=Bounds(rect)};
  }
  private static void Mouse(uint flags,uint data=0){var input=new Input{Type=0,Data=new InputUnion{Mouse=new MouseInput{Flags=flags,Data=data}}};Inject(input);}
  private static void Key(ushort vk,bool up=false){Inject(new Input{Type=1,Data=new InputUnion{Key=new KeyInput{Vk=vk,Flags=up?2u:0u}}});}
  private static void Inject(params Input[] input){stage="computer-inject";if(SendInput((uint)input.Length,input,Marshal.SizeOf<Input>())!=input.Length)throw new InvalidOperationException("Entrada no confirmada; no repetir.");}
  private static Input KeyEvent(ushort vk,bool up=false)=>new Input{Type=1,Data=new InputUnion{Key=new KeyInput{Vk=vk,Flags=up?2u:0u}}};
  private static Input MouseEvent(uint flags,uint data=0)=>new Input{Type=0,Data=new InputUnion{Mouse=new MouseInput{Flags=flags,Data=data}}};
  private static Input PointerEvent(int x,int y)=>new Input{Type=0,Data=new InputUnion{Mouse=new MouseInput{X=(int)((long)(x-GetSystemMetrics(76))*65535/(GetSystemMetrics(78)-1)),Y=(int)((long)(y-GetSystemMetrics(77))*65535/(GetSystemMetrics(79)-1)),Flags=0xC001}}};
  private static ushort VirtualKey(string key) {
    if(key.Length==1&&char.IsAsciiLetterOrDigit(key[0]))return (ushort)char.ToUpperInvariant(key[0]);
    return key switch {"CTRL"=>0x11,"ALT"=>0x12,"SHIFT"=>0x10,"ENTER"=>0x0D,"TAB"=>9,"ESC"=>0x1B,"BACKSPACE"=>8,"DELETE"=>0x2E,"SPACE"=>0x20,"UP"=>0x26,"DOWN"=>0x28,"LEFT"=>0x25,"RIGHT"=>0x27,"HOME"=>0x24,"END"=>0x23,"PAGEUP"=>0x21,"PAGEDOWN"=>0x22,"F1"=>0x70,"F2"=>0x71,"F3"=>0x72,"F4"=>0x73,"F5"=>0x74,"F6"=>0x75,"F7"=>0x76,"F8"=>0x77,"F9"=>0x78,"F10"=>0x79,"F11"=>0x7A,_=>throw new InvalidOperationException("Tecla excluida.")};
  }
  private static void SafeFocus(IntPtr target){stage="computer-keyboard-focus";if(GetForegroundWindow()!=target)throw new InvalidOperationException("Cambio de foco; entrada detenida.");stage="computer-protected-field";var focused=AutomationElement.FocusedElement;if(focused!=null&&(focused.Current.IsPassword||focused.Current.ClassName.Contains("Terminal",StringComparison.OrdinalIgnoreCase)))throw new InvalidOperationException("Campo protegido o terminal.");}
  private static object ComputerAct(JsonElement root) {
    // A worker thread must be attached to the current writable input desktop.
    // Names alone are insufficient evidence; never switch a secure desktop.
    stage="computer-input-desktop";var inputDesktop=OpenInputDesktop(0,false,0x0081);
    if(inputDesktop==IntPtr.Zero)throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try{if(!string.Equals(DesktopName(inputDesktop),"Default",StringComparison.OrdinalIgnoreCase)||!SetThreadDesktop(inputDesktop))throw new InvalidOperationException("Escritorio de entrada no autorizado.");}finally{CloseDesktop(inputDesktop);}
    var target=ComputerTarget(root);stage="computer-action";var rect=ComputerRect(target);var expected=root.GetProperty("bounds");
    if(rect.Left!=expected.GetProperty("x").GetInt32()||rect.Top!=expected.GetProperty("y").GetInt32()||rect.Right-rect.Left!=expected.GetProperty("width").GetInt32()||rect.Bottom-rect.Top!=expected.GetProperty("height").GetInt32())throw new InvalidOperationException("La ventana se movió.");
    var action=root.GetProperty("action");var type=action.GetProperty("type").GetString();
    void Move(JsonElement point){stage="computer-coordinate";var x=point.GetProperty("x").GetInt32();var y=point.GetProperty("y").GetInt32();if(x<0||y<0||x>=rect.Right-rect.Left||y>=rect.Bottom-rect.Top)throw new InvalidOperationException("Fuera de ventana.");var screenPoint=new Point{X=rect.Left+x,Y=rect.Top+y};stage="computer-hit-target";if(GetAncestor(WindowFromPoint(screenPoint),2)!=target)throw new InvalidOperationException("Otra ventana cubre el destino.");Inject(PointerEvent(screenPoint.X,screenPoint.Y));System.Threading.Thread.Sleep(20);stage="computer-cursor-result";if(!GetCursorPos(out var actual)||Math.Abs(actual.X-screenPoint.X)>1||Math.Abs(actual.Y-screenPoint.Y)>1)throw new InvalidOperationException("Cursor no verificado.");}
    var held=new List<ushort>();
    try {
      if(action.TryGetProperty("keys",out var keys)&&keys.ValueKind==JsonValueKind.Array){foreach(var key in keys.EnumerateArray()){var name=key.GetString()!;if(type!="keypress"&&!new[]{"CTRL","ALT","SHIFT"}.Contains(name))throw new InvalidOperationException("Modificador inválido.");held.Add(VirtualKey(name));}}
      if(type=="keypress"&&(held.Count<1||held.Count>4||held.Contains(0x12)&&(held.Contains(9)||held.Contains(0x73)||held.Contains(0x20)||held.Contains(0x1B))||held.Contains(0x11)&&held.Contains(0x10)&&(held.Contains(0x49)||held.Contains(0x4A)||held.Contains(0x43)||held.Contains(0x1B))))throw new InvalidOperationException("Atajo excluido.");
      void Atomic(params Input[] events){SafeFocus(target);Inject(held.Select(v=>KeyEvent(v)).Concat(events).Concat(held.AsEnumerable().Reverse().Select(v=>KeyEvent(v,true))).ToArray());}
      if(type!="click"&&type!="double_click"&&type!="move")SafeFocus(target);
      switch(type){
        case "move":Move(action);break;
        case "click":case "double_click":
          Move(action);var button=type=="double_click"?"left":action.GetProperty("button").GetString();var down=button switch{"left"=>2u,"right"=>8u,"wheel"=>0x20u,"back"=>0x80u,"forward"=>0x80u,_=>throw new InvalidOperationException("Botón excluido.")};var up=down*2;var data=button=="back"?1u:button=="forward"?2u:0u;
          for(var i=0;i<(type=="double_click"?2:1);i++){Move(action);if(held.Count>0)SafeFocus(target);Inject(held.Select(v=>KeyEvent(v)).Concat(new[]{MouseEvent(down,data),MouseEvent(up,data)}).Concat(held.AsEnumerable().Reverse().Select(v=>KeyEvent(v,true))).ToArray());System.Threading.Thread.Sleep(30);}break;
        case "drag":var path=action.GetProperty("path");if(path.GetArrayLength()<2||path.GetArrayLength()>40)throw new InvalidOperationException("Arrastre inválido.");foreach(var p in path.EnumerateArray())Move(p);Move(path[0]);var events=new List<Input>{MouseEvent(2)};foreach(var p in path.EnumerateArray()){var x=rect.Left+p.GetProperty("x").GetInt32();var y=rect.Top+p.GetProperty("y").GetInt32();events.Add(new Input{Type=0,Data=new InputUnion{Mouse=new MouseInput{X=(int)((long)(x-GetSystemMetrics(76))*65535/(GetSystemMetrics(78)-1)),Y=(int)((long)(y-GetSystemMetrics(77))*65535/(GetSystemMetrics(79)-1)),Flags=0xC001}}});}events.Add(MouseEvent(4));Atomic(events.ToArray());break;
        case "scroll":Move(action);var sy=action.GetProperty("scroll_y").GetInt32();var sx=action.GetProperty("scroll_x").GetInt32();if(Math.Abs(sx)>2000||Math.Abs(sy)>2000)throw new InvalidOperationException("Scroll inválido.");if(sy!=0)Mouse(0x800,unchecked((uint)(-sy)));if(sx!=0)Mouse(0x1000,unchecked((uint)sx));break;
        case "keypress":Atomic();break;
        case "type":var text=action.GetProperty("text").GetString()!;if(text.Length<1||text.Length>2000)throw new InvalidOperationException("Texto inválido.");foreach(var character in text){SafeFocus(target);Inject(new Input{Type=1,Data=new InputUnion{Key=new KeyInput{Scan=character,Flags=4}}},new Input{Type=1,Data=new InputUnion{Key=new KeyInput{Scan=character,Flags=6}}});}break;
        default:throw new InvalidOperationException("Acción excluida.");
      }
    }finally{foreach(var key in held.AsEnumerable().Reverse())Key(key,true);}
    System.Threading.Thread.Sleep(100);return new{verified=true};
  }
}
