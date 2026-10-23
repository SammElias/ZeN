using System.Runtime.InteropServices;
using System.Text.Json;

internal static partial class Program {
  private delegate void MoveEvent(IntPtr hook,uint kind,IntPtr window,int obj,int child,uint thread,uint time);
  [DllImport("user32.dll")] private static extern IntPtr SetWinEventHook(uint min,uint max,IntPtr module,MoveEvent callback,uint pid,uint thread,uint flags);
  [DllImport("user32.dll")] private static extern bool UnhookWinEvent(IntPtr hook);
  [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr window);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr window,System.Text.StringBuilder name,int count);
  [DllImport("gdi32.dll")] private static extern IntPtr CreateRectRgn(int left,int top,int right,int bottom);
  [DllImport("gdi32.dll")] private static extern bool PtInRegion(IntPtr region,int x,int y);
  [DllImport("gdi32.dll")] private static extern bool DeleteObject(IntPtr handle);
  [DllImport("user32.dll")] private static extern int GetWindowRgn(IntPtr window,IntPtr region);
  [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
  // Observe only native window move gestures. Never inject input or scan content.
  private static object WatchWindowDrops(JsonElement input){
    CheckDesktop();var target=new IntPtr(long.Parse(input.GetProperty("id").GetString()!));var parent=input.GetProperty("pid").GetInt32();
    GetWindowThreadProcessId(target,out var owner);if(owner!=parent||!IsWindow(target))throw new InvalidOperationException("Cápsula no verificable.");
    var targets=input.TryGetProperty("targets",out var list)?list.EnumerateArray().Select(v=>new IntPtr(long.Parse(v.GetString()!))).Distinct().Take(8).ToArray():new[]{target};
    foreach(var h in targets){GetWindowThreadProcessId(h,out var targetPid);if(targetPid!=parent||!IsWindow(h))throw new InvalidOperationException("Destino no verificable.");}
    IntPtr moving=IntPtr.Zero;bool hovering=false,pendingRelease=false;long started=0,releaseStarted=0;uint sourcePid=0;
    void Moving(bool active){Console.WriteLine(JsonSerializer.Serialize(new{state="moving",active}));Console.Out.Flush();}
    void Send(string state,IntPtr source){var text=new System.Text.StringBuilder(256);if(source!=IntPtr.Zero)GetWindowText(source,text,text.Capacity);Console.WriteLine(JsonSerializer.Serialize(new{state,id=source.ToInt64().ToString(),pid=sourcePid,name=text.ToString()}));Console.Out.Flush();}
    bool Over(){
      if(!GetCursorPos(out var p))return false;
      foreach(var destination in targets){
        if(!IsWindow(destination)||!IsWindowVisible(destination)||IsIconic(destination)||!GetWindowRect(destination,out var r)||p.X<r.Left||p.X>=r.Right||p.Y<r.Top||p.Y>=r.Bottom)continue;
        var region=CreateRectRgn(0,0,0,0);if(region==IntPtr.Zero)continue;
        try{if(GetWindowRgn(destination,region)==0||PtInRegion(region,p.X-r.Left,p.Y-r.Top))return true;}finally{DeleteObject(region);}
      }
      return false;
    }
    bool? lastFullscreen=null;
    void Foreground(){
      var front=GetForegroundWindow();GetWindowThreadProcessId(front,out var pid);
      if(pid==parent)return; // Clicking ZEN must not cancel attenuation above the other app.
      bool fullscreen=false;var className=new System.Text.StringBuilder(64);GetClassName(front,className,className.Capacity);bool desktop=className.ToString() is "Progman" or "WorkerW" or "Shell_TrayWnd";
      if(!desktop&&front!=IntPtr.Zero&&IsWindowVisible(front)&&!IsIconic(front)&&GetWindowRect(front,out var rect)){
        var monitor=MonitorRect(front);var targetMonitor=MonitorRect(target);fullscreen=monitor.Left==targetMonitor.Left&&monitor.Top==targetMonitor.Top&&rect.Left<=monitor.Left&&rect.Top<=monitor.Top&&rect.Right>=monitor.Right&&rect.Bottom>=monitor.Bottom;
      }
      if(lastFullscreen==fullscreen)return;lastFullscreen=fullscreen;
      Console.WriteLine(JsonSerializer.Serialize(new{state="foreground",fullscreen}));Console.Out.Flush();
    }
    MoveEvent foregroundCallback=(_,kind,source,obj,child,thread,time)=>{try{if(kind==3||source==GetForegroundWindow()&&obj==0)Foreground();}catch{}};

    using var poll=new System.Windows.Forms.Timer{Interval=1000};
    void Reset(){if(hovering)Send("leave",moving);if(moving!=IntPtr.Zero)Moving(false);hovering=false;pendingRelease=false;moving=IntPtr.Zero;poll.Interval=1000;}
    void Released(){CheckDesktop();Moving(false);if(Over()&&GetCursorPos(out var p)&&GetWindowRect(moving,out var r)&&p.X>=r.Left&&p.X<r.Right&&p.Y>=r.Top&&p.Y<=r.Top+72)Send("drop",moving);Reset();}
    poll.Tick+=(_,_)=>{if(!IsWindow(target)){System.Windows.Forms.Application.ExitThread();return;}if(moving==IntPtr.Zero)return;if(Environment.TickCount64-started>30000||!IsWindow(moving)){Reset();return;}if(pendingRelease){if((GetAsyncKeyState(1)&0x8000)==0)Released();else if(Environment.TickCount64-releaseStarted>250)Reset();return;}bool next=Over();if(next!=hovering){hovering=next;Send(next?"hover":"leave",moving);}};
    MoveEvent callback=(_,kind,source,obj,child,thread,time)=>{
      try{
        if(obj!=0||source==IntPtr.Zero||source==target)return;
        if(kind==0x000A){
          Reset();GetWindowThreadProcessId(source,out sourcePid);if(sourcePid==parent||!IsWindowVisible(source))return;
          // Native move/size notifications include resizes. Only begin from the title area.
          if(!GetCursorPos(out var p)||!GetWindowRect(source,out var r)||p.Y<r.Top||p.Y>r.Top+72)return;
          CheckDesktop();moving=source;started=Environment.TickCount64;poll.Interval=60;Moving(true);
        }else if(kind==0x000B&&source==moving){
          CheckDesktop();if((GetAsyncKeyState(0x1B)&0x8000)!=0){Reset();return;}pendingRelease=true;releaseStarted=Environment.TickCount64;if((GetAsyncKeyState(1)&0x8000)==0)Released();
        }
      }catch{Reset();}
    };
    var pinned=GCHandle.Alloc(callback);var hook=SetWinEventHook(0x000A,0x000B,IntPtr.Zero,callback,0,0,2);
    if(hook==IntPtr.Zero){pinned.Free();throw new InvalidOperationException("No se pudo observar el arrastre de ventanas.");}
    var foregroundPinned=GCHandle.Alloc(foregroundCallback);
    var foregroundHook=SetWinEventHook(3,3,IntPtr.Zero,foregroundCallback,0,0,2);
    var sizeHook=SetWinEventHook(0x800B,0x800B,IntPtr.Zero,foregroundCallback,0,0,2);
    try{Foreground();poll.Start();System.Windows.Forms.Application.Run();}finally{poll.Stop();UnhookWinEvent(hook);UnhookWinEvent(foregroundHook);UnhookWinEvent(sizeHook);foregroundPinned.Free();pinned.Free();}
    return new{stopped=true};
  }
}
