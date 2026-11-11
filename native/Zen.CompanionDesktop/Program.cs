using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;

// Window identity and geometry, and an optional coordinate-free outside-click signal.
if(args is ["--verify-history"]){Console.WriteLine(JsonSerializer.Serialize(WindowHistory.Verify()));return;}
if(!OperatingSystem.IsWindows())return;
Native.SetProcessDpiAwarenessContext((nint)(-4));
if(args is ["--restore"]){
 try{
  var line=await Console.In.ReadLineAsync();if(line is null||line.Length>1000)throw new Exception();
  var id=JsonSerializer.Deserialize<WindowId>(line)!;var hwnd=(nint)long.Parse(id.handle);
  if(!Native.IsWindow(hwnd)||!Native.IsWindowVisible(hwnd)||Native.Identity(hwnd)!=id){Console.WriteLine("{\"ok\":false,\"error\":\"stale\"}");return;}
  if(Native.IsIconic(hwnd))Native.ShowWindowAsync(hwnd,9);
  Native.SetForegroundWindow(hwnd);await Task.Delay(120);
  Console.WriteLine(Native.GetForegroundWindow()==hwnd?"{\"ok\":true}":"{\"ok\":false,\"error\":\"denied\"}");
 }catch{Console.WriteLine("{\"ok\":false,\"error\":\"stale\"}");}
 return;
}
if(args.Length is <2 or >3||args[0]!="--watch"||!int.TryParse(args[1],out var owner))return;
uint thread=Native.GetCurrentThreadId();Native.PeekMessage(out _,0,0,0,0);
WindowId? previous=null;string? previousName=null,last=null;
void Publish(){
 try{
  var foreground=Native.GetForegroundWindow();var identity=Native.Identity(foreground);
  if(identity is not null&&Native.WorkWindowName(foreground,identity,owner) is string name){
   (previous,previousName)=WindowHistory.Observe((previous,previousName),identity,name);
  }
  if(previous is not null&&(!Native.IsWindow((nint)long.Parse(previous.handle))||Native.Identity((nint)long.Parse(previous.handle))!=previous)){previous=null;previousName=null;}
  var record=JsonSerializer.Serialize(new{previous,name=previousName,foreground=foreground.ToString(),fullscreen=Native.Fullscreen(foreground)});
  if(record!=last){last=record;Console.WriteLine(record);Console.Out.Flush();}
 }catch{/* An inaccessible window must not affect other applications. */}
}
Native.WinEvent callback=(_h,ev,hwnd,obj,_child,_thread,_time)=>{
 if(ev==3||ev==0x8001&&previous?.handle==hwnd.ToString()||ev==0x800B&&hwnd==Native.GetForegroundWindow()&&obj==0)Publish();
};
var hooks=new[]{Native.SetWinEventHook(3,3,0,callback,0,0,0),Native.SetWinEventHook(0x8001,0x8001,0,callback,0,0,0),Native.SetWinEventHook(0x800B,0x800B,0,callback,0,0,0)};
if(hooks.Any(h=>h==0)){foreach(var h in hooks)if(h!=0)Native.UnhookWinEvent(h);return;}
using var outsideClick=args.Length==3&&nint.TryParse(args[2],out var capsule)?new OutsideClickObserver(capsule,owner,thread):null;
_ = Task.Run(async()=>{while(await Console.In.ReadLineAsync() is not null){}Native.PostThreadMessage(thread,0x12,0,0);});
Publish();
if(outsideClick?.Installed==true)Console.WriteLine("{\"event\":\"outside-click-ready\"}");
while(Native.GetMessage(out var message,0,0,0)>0){
 if(message.hwnd==0&&message.message==OutsideClickObserver.Message){
  Console.WriteLine("{\"event\":\"outside-click\"}");
  Console.Out.Flush();
  continue;
 }
 Native.TranslateMessage(ref message);Native.DispatchMessage(ref message);
}
foreach(var h in hooks)Native.UnhookWinEvent(h);GC.KeepAlive(callback);

record WindowId(string handle,int pid,string started);
record Rectangle(int x,int y,int width,int height);
static class Native{
 static readonly HashSet<string> ExcludedProcesses = new(StringComparer.OrdinalIgnoreCase) {
  "ZEN", "Zen.CompanionDesktop", "electron", "StartMenuExperienceHost", "ShellExperienceHost", "SearchHost"
 };
 public delegate void WinEvent(nint hook,uint ev,nint hwnd,int obj,int child,uint thread,uint time);
 [StructLayout(LayoutKind.Sequential)]public struct RECT{public int left,top,right,bottom;}
 [StructLayout(LayoutKind.Sequential)]public struct MONITORINFO{public uint size;public RECT monitor,work;public uint flags;}
 [StructLayout(LayoutKind.Sequential)]public struct MSG{public nint hwnd;public uint message;public nuint wParam;public nint lParam;public uint time;public int x,y;public uint extra;}
 public static WindowId? Identity(nint hwnd){try{if(hwnd==0||!IsWindow(hwnd))return null;GetWindowThreadProcessId(hwnd,out var pid);using var p=Process.GetProcessById((int)pid);return new(hwnd.ToString(),(int)pid,p.StartTime.ToUniversalTime().Ticks.ToString());}catch{return null;}}
 static bool IsShellWindow(nint hwnd){
  var className=new System.Text.StringBuilder(100);GetClassNameW(hwnd,className,className.Capacity);
  return className.ToString() is "Progman" or "WorkerW" or "Shell_TrayWnd" or "Shell_SecondaryTrayWnd";
 }
 public static string? WorkWindowName(nint hwnd,WindowId id,int owner){
  if(id.pid==owner||!IsWindowVisible(hwnd)||GetAncestor(hwnd,2)!=hwnd||(GetWindowLongPtrW(hwnd,-20).ToInt64()&0x80)!=0||IsShellWindow(hwnd))return null;
  using var process=Process.GetProcessById(id.pid);
  var name=process.ProcessName;
  return ExcludedProcesses.Contains(name)?null:name;
 }
 public static Rectangle? Fullscreen(nint hwnd){
  if(hwnd==0||IsIconic(hwnd)||!IsWindowVisible(hwnd)||IsShellWindow(hwnd))return null;
  var info=new MONITORINFO{size=(uint)Marshal.SizeOf<MONITORINFO>()};if(!GetMonitorInfoW(MonitorFromWindow(hwnd,2),ref info))return null;
  if(DwmGetWindowAttribute(hwnd,9,out RECT r,Marshal.SizeOf<RECT>())!=0&&!GetWindowRect(hwnd,out r))return null;
  var m=info.monitor;if(Math.Abs(r.left-m.left)>2||Math.Abs(r.top-m.top)>2||Math.Abs(r.right-m.right)>2||Math.Abs(r.bottom-m.bottom)>2)return null;
  return new(m.left,m.top,m.right-m.left,m.bottom-m.top);
 }
 [DllImport("user32.dll")]public static extern nint SetWinEventHook(uint min,uint max,nint module,WinEvent callback,uint pid,uint thread,uint flags);
 [DllImport("user32.dll")]public static extern bool UnhookWinEvent(nint hook);
 [DllImport("user32.dll")]public static extern nint GetForegroundWindow();
 [DllImport("user32.dll")]public static extern bool SetProcessDpiAwarenessContext(nint context);
 [DllImport("user32.dll")]public static extern bool SetForegroundWindow(nint hwnd);
 [DllImport("user32.dll")]public static extern bool IsWindow(nint hwnd);
 [DllImport("user32.dll")]public static extern bool IsWindowVisible(nint hwnd);
 [DllImport("user32.dll")]public static extern bool IsIconic(nint hwnd);
 [DllImport("user32.dll")]public static extern bool ShowWindowAsync(nint hwnd,int command);
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(nint hwnd,out uint pid);
 [DllImport("user32.dll")]public static extern nint GetAncestor(nint hwnd,uint flags);
 [DllImport("user32.dll")]public static extern nint GetWindowLongPtrW(nint hwnd,int index);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetClassNameW(nint hwnd,System.Text.StringBuilder name,int count);
 [DllImport("user32.dll")]public static extern bool GetWindowRect(nint hwnd,out RECT rect);
 [DllImport("dwmapi.dll")]public static extern int DwmGetWindowAttribute(nint hwnd,int attribute,out RECT rect,int size);
 [DllImport("user32.dll")]public static extern nint MonitorFromWindow(nint hwnd,uint flags);
 [DllImport("user32.dll")]public static extern bool GetMonitorInfoW(nint monitor,ref MONITORINFO info);
 [DllImport("kernel32.dll")]public static extern uint GetCurrentThreadId();
 [DllImport("user32.dll")]public static extern int GetMessage(out MSG message,nint hwnd,uint min,uint max);
 [DllImport("user32.dll")]public static extern bool PeekMessage(out MSG message,nint hwnd,uint min,uint max,uint remove);
 [DllImport("user32.dll")]public static extern bool TranslateMessage(ref MSG message);
 [DllImport("user32.dll")]public static extern nint DispatchMessage(ref MSG message);
 [DllImport("user32.dll")]public static extern bool PostThreadMessage(uint thread,uint message,nuint wParam,nint lParam);
}
