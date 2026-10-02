using System.Runtime.InteropServices;
using System.Text.Json;

internal static partial class Program {
  private delegate void MoveEvent(IntPtr hook,uint kind,IntPtr window,int obj,int child,uint thread,uint time);
  [DllImport("user32.dll")] private static extern IntPtr SetWinEventHook(uint min,uint max,IntPtr module,MoveEvent callback,uint pid,uint thread,uint flags);
  [DllImport("user32.dll")] private static extern bool UnhookWinEvent(IntPtr hook);
  [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr window);
  // Observe only native window move gestures. Never inject input or scan content.
  private static object WatchWindowDrops(JsonElement input){
    CheckDesktop();var target=new IntPtr(long.Parse(input.GetProperty("id").GetString()!));var parent=input.GetProperty("pid").GetInt32();
    GetWindowThreadProcessId(target,out var owner);if(owner!=parent||!IsWindow(target))throw new InvalidOperationException("Cápsula no verificable.");
    IntPtr moving=IntPtr.Zero;bool hovering=false;long started=0;uint sourcePid=0;
    void Send(string state,IntPtr source){var text=new System.Text.StringBuilder(256);if(source!=IntPtr.Zero)GetWindowText(source,text,text.Capacity);Console.WriteLine(JsonSerializer.Serialize(new{state,id=source.ToInt64().ToString(),pid=sourcePid,name=text.ToString()}));Console.Out.Flush();}
    bool Over()=>IsWindowVisible(target)&&!IsIconic(target)&&GetCursorPos(out var p)&&GetWindowRect(target,out var r)&&p.X>=r.Left&&p.X<r.Right&&p.Y>=r.Top&&p.Y<r.Bottom;
    using var poll=new System.Windows.Forms.Timer{Interval=1000};
    void Reset(){if(hovering)Send("leave",moving);hovering=false;moving=IntPtr.Zero;poll.Interval=1000;}
    poll.Tick+=(_,_)=>{if(!IsWindow(target)){System.Windows.Forms.Application.ExitThread();return;}if(moving==IntPtr.Zero)return;if(Environment.TickCount64-started>30000||!IsWindow(moving)){Reset();return;}bool next=Over();if(next!=hovering){hovering=next;Send(next?"hover":"leave",moving);}};
    MoveEvent callback=(_,kind,source,obj,child,thread,time)=>{
      try{
        if(obj!=0||source==IntPtr.Zero||source==target)return;
        if(kind==0x000A){
          Reset();GetWindowThreadProcessId(source,out sourcePid);if(sourcePid==parent||!IsWindowVisible(source))return;
          // Native move/size notifications include resizes. Only begin from the title area.
          if(!GetCursorPos(out var p)||!GetWindowRect(source,out var r)||p.Y<r.Top||p.Y>r.Top+72)return;
          CheckDesktop();moving=source;started=Environment.TickCount64;poll.Interval=60;
        }else if(kind==0x000B&&source==moving){
          CheckDesktop();if(Over()&&GetCursorPos(out var p)&&GetWindowRect(source,out var r)&&p.X>=r.Left&&p.X<r.Right&&p.Y>=r.Top&&p.Y<=r.Top+72)Send("drop",moving);Reset();
        }
      }catch{Reset();}
    };
    var pinned=GCHandle.Alloc(callback);var hook=SetWinEventHook(0x000A,0x000B,IntPtr.Zero,callback,0,0,2);
    if(hook==IntPtr.Zero){pinned.Free();throw new InvalidOperationException("No se pudo observar el arrastre de ventanas.");}
    try{poll.Start();System.Windows.Forms.Application.Run();}finally{poll.Stop();UnhookWinEvent(hook);pinned.Free();}
    return new{stopped=true};
  }
}
