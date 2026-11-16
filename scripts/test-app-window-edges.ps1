param([Parameter(Mandatory=$true)][long]$WindowHandle,[Parameter(Mandatory=$true)][uint32]$Owner,[switch]$Capsule,[switch]$Resize,[switch]$Snap,[switch]$Order,[switch]$Taskbar,[switch]$Island,[switch]$Edge,[switch]$Right,[switch]$Top,[switch]$Close,[switch]$Restore,[int]$DragX,[int]$DragY,[string]$ControlPoints)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ZenWindowEdgeProbe {
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; }
 [StructLayout(LayoutKind.Sequential)] struct PropertyKey { public Guid Format; public uint Id; }
 [StructLayout(LayoutKind.Explicit, Size=24)] struct PropertyValue {
  [FieldOffset(0)] public ushort Type;
  [FieldOffset(8)] public IntPtr String;
 }
 [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface PropertyStore {
  [PreserveSig] int GetCount(out uint count);
  [PreserveSig] int GetAt(uint index,out PropertyKey key);
  [PreserveSig] int GetValue(ref PropertyKey key,out PropertyValue value);
 }
 [DllImport("shell32.dll")] static extern int SHGetPropertyStoreForWindow(IntPtr window,ref Guid iid,out PropertyStore store);
 [DllImport("ole32.dll")] static extern int PropVariantClear(ref PropertyValue value);
 [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr window,int index);
 [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr window,uint command);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr window);
 [DllImport("dwmapi.dll",EntryPoint="DwmGetWindowAttribute")] static extern int FrameBounds(IntPtr window,uint attribute,out Rect value,uint size);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window,out Rect rect);
 [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point point);
 [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr window,uint flags);
 [DllImport("user32.dll")] static extern int GetWindowRgn(IntPtr window,IntPtr region);
 [DllImport("gdi32.dll")] static extern IntPtr CreateRectRgn(int left,int top,int right,int bottom);
 [DllImport("gdi32.dll")] static extern bool PtInRegion(IntPtr region,int x,int y);
 [DllImport("gdi32.dll")] static extern int GetRgnBox(IntPtr region,out Rect bounds);
 [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr region);
 [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr window);
 [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr window,ref Point point);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
 [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr window,uint attribute,out uint value,uint size);
 [DllImport("user32.dll")] static extern bool PostMessageW(IntPtr w,uint m,IntPtr a,IntPtr b);
 public static bool SystemCommand(long handle,uint owner,int command) {
  var window=new IntPtr(handle);uint pid;GetWindowThreadProcessId(window,out pid);
  if(pid!=owner)throw new Exception("Unexpected window owner");
  return PostMessageW(window,0x112,new IntPtr(command),IntPtr.Zero);
 }
 [DllImport("user32.dll",SetLastError=true)] static extern IntPtr SendMessageTimeout(IntPtr window,uint message,IntPtr wParam,IntPtr lParam,uint flags,uint timeout,out IntPtr result);
 static int Hit(IntPtr window,int x,int y) { IntPtr result; var point=new IntPtr(unchecked((x&65535)|((y&65535)<<16))); if(SendMessageTimeout(window,0x84,IntPtr.Zero,point,2,1500,out result)==IntPtr.Zero) throw new Exception("No hit-test response"); return result.ToInt32(); }
 public static int[] Controls(long handle,uint owner,string coordinates) {
  var window=new IntPtr(handle);uint pid;GetWindowThreadProcessId(window,out pid);
  if(pid!=owner)throw new Exception("Unexpected window owner");
  var dpi=(int)GetDpiForWindow(window);
  var origin=new Point();Rect bounds;
  if(!ClientToScreen(window,ref origin)||!GetWindowRect(window,out bounds))throw new Exception("Window unavailable");
  var region=CreateRectRgn(0,0,0,0);
  try {
   var hasRegion=GetWindowRgn(window,region)>1;
   var points=coordinates.Split(';');var results=new int[points.Length+1];results[0]=dpi;
   for(int i=0;i<points.Length;i++){
    var pair=points[i].Split(',');
    var x=origin.X+(int)Math.Round(int.Parse(pair[0])*dpi/96.0);
    var y=origin.Y+(int)Math.Round(int.Parse(pair[1])*dpi/96.0);
    results[i+1]=hasRegion&&!PtInRegion(region,x-bounds.Left,y-bounds.Top)?-1:Hit(window,x,y);
   }
   return results;
  } finally { DeleteObject(region); }
 }
 public static long[] Order(long handle,uint owner) {
  var window=new IntPtr(handle);uint pid;GetWindowThreadProcessId(window,out pid);
  if(pid!=owner)throw new Exception("Unexpected window owner");
  return new[]{GetWindowLongPtr(window,-20).ToInt64(),GetWindow(window,4).ToInt64(),GetForegroundWindow().ToInt64(),IsWindowVisible(window)?1L:0L,IsIconic(window)?1L:0L};
 }
 public static string[] Taskbar(long handle,uint owner) {
  var window=new IntPtr(handle);
  uint pid;GetWindowThreadProcessId(window,out pid);
  if(pid!=owner)throw new Exception("Unexpected window owner");
  var iid=typeof(PropertyStore).GUID;
  PropertyStore store;
  Marshal.ThrowExceptionForHR(SHGetPropertyStoreForWindow(window,ref iid,out store));
  try {
   var format=new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");
   uint[] ids={5,2,4,3}; // AppUserModel ID, relaunch command, display name, icon.
   var values=new string[ids.Length];
   for(var i=0;i<ids.Length;i++) {
    var key=new PropertyKey{Format=format,Id=ids[i]};
    PropertyValue value;
    Marshal.ThrowExceptionForHR(store.GetValue(ref key,out value));
    try { if(value.Type==31)values[i]=Marshal.PtrToStringUni(value.String); }
    finally { PropVariantClear(ref value); }
   }
   return values;
  } finally { Marshal.ReleaseComObject(store); }
 }
 public static int[] Read(long handle,uint owner) { var window=new IntPtr(handle);uint pid;GetWindowThreadProcessId(window,out pid);if(pid!=owner)throw new Exception("Unexpected window owner");Rect r;if(!GetWindowRect(window,out r))throw new Exception("Window unavailable");return new[]{Hit(window,r.Left+2,(r.Top+r.Bottom)/2),Hit(window,r.Right-2,(r.Top+r.Bottom)/2),Hit(window,(r.Left+r.Right)/2,r.Bottom-2)}; }
 public static int[] Island(long handle,uint owner) {
  var window=new IntPtr(handle);uint pid;GetWindowThreadProcessId(window,out pid);
  if(pid!=owner)throw new Exception("Unexpected window owner");
  Rect r;if(!GetWindowRect(window,out r))throw new Exception("Window unavailable");
  var width=r.Right-r.Left;var height=r.Bottom-r.Top;
  var region=CreateRectRgn(0,0,0,0);
  try {
   if(GetWindowRgn(window,region)<=1)throw new Exception("Window region unavailable");
   Rect box;if(GetRgnBox(region,out box)<=1)throw new Exception("Region bounds unavailable");
   var center=(box.Left+box.Right)/2;
   var shape=PtInRegion(region,center,(box.Top+box.Bottom)/2)&&PtInRegion(region,center,box.Top)&&
    !PtInRegion(region,box.Left,box.Top)&&!PtInRegion(region,box.Right-1,box.Top)&&
    !PtInRegion(region,box.Left,box.Bottom-1)&&!PtInRegion(region,box.Right-1,box.Bottom-1)&&!PtInRegion(region,center,box.Bottom);
   var y=r.Top+(box.Top+box.Bottom)/2;
   var reserveClear=box.Top>0&&GetAncestor(WindowFromPoint(new Point{X=r.Left+center,Y=r.Top+box.Top-2}),2)!=window;
   return new[]{box.Right-box.Left,box.Bottom-box.Top,(int)GetDpiForWindow(window),shape?1:0,Hit(window,r.Left+width/4,y),Hit(window,r.Right-width/9,y),reserveClear?1:0};
  } finally { DeleteObject(region); }
 }
 public static int[] Edge(long handle,uint owner,bool right,bool top) {
  var window=new IntPtr(handle);uint pid;GetWindowThreadProcessId(window,out pid);
  if(pid!=owner)throw new Exception("Unexpected window owner");
  Rect r;if(!GetWindowRect(window,out r))throw new Exception("Window unavailable");
  var region=CreateRectRgn(0,0,0,0);
  try {
   Rect box;if(GetWindowRgn(window,region)<=1||GetRgnBox(region,out box)<=1)throw new Exception("Region unavailable");
   var width=box.Right-box.Left;var height=box.Bottom-box.Top;
   var anchor=right?box.Right-1:box.Left;
   var interior=right?box.Left+width/4:box.Right-width/4-1;
   var y=box.Top+height/2;
   var inside=PtInRegion(region,interior,y);
   var shoulders=PtInRegion(region,anchor,box.Top)&&PtInRegion(region,anchor,box.Bottom-1)&&
    !PtInRegion(region,interior,box.Top+2)&&!PtInRegion(region,interior,box.Bottom-3);
   var reserve=!PtInRegion(region,box.Right+3,y);
   var outsidePoint=new Point{X=r.Left+interior,Y=r.Top+box.Top+2};
   if(top){
    interior=(box.Left+box.Right)/2;
    inside=PtInRegion(region,interior,y);
    shoulders=PtInRegion(region,box.Left,box.Top)&&PtInRegion(region,box.Right-1,box.Top)&&
      !PtInRegion(region,box.Left+2,y)&&!PtInRegion(region,box.Right-3,y);
    reserve=!PtInRegion(region,interior,box.Top-3);
    outsidePoint=new Point{X=r.Left+box.Left+2,Y=r.Top+y};
   }
   var passThrough=GetAncestor(WindowFromPoint(outsidePoint),2)!=window;
   var dpi=(int)GetDpiForWindow(window);
   Point client=new Point();ClientToScreen(window,ref client);
   return new[]{width,height,dpi,shoulders?1:0,reserve?1:0,passThrough?1:0,
    inside?Hit(window,r.Left+interior,r.Top+y):0,r.Left+box.Left,r.Left+box.Right,r.Top+box.Top,client.X,client.Y};
  } finally { DeleteObject(region); }
 }
 public static int[] Caption(long handle,uint owner,int dragX,int dragY) {
  var window=new IntPtr(handle);uint pid;GetWindowThreadProcessId(window,out pid);
  if(pid!=owner)throw new Exception("Unexpected window owner");
  Rect r;if(!GetWindowRect(window,out r))throw new Exception("Window unavailable");
  var scale=GetDpiForWindow(window)/96.0;
  var y=r.Top+(int)Math.Round(18*scale);
  var hits=new int[21];
  for(int i=0;i<20;i++)hits[i]=Hit(window,r.Right-(int)Math.Round((10+i*7)*scale),y);
  Point origin=new Point();ClientToScreen(window,ref origin);
  hits[20]=Hit(window,origin.X+(int)Math.Round(dragX*scale),origin.Y+(int)Math.Round(dragY*scale));
  return hits;
 }
 public static long[] Frame(long handle,uint owner) { var w=new IntPtr(handle);uint pid;GetWindowThreadProcessId(w,out pid);if(pid!=owner)throw new Exception("Unexpected window owner");Rect r,f;GetWindowRect(w,out r);FrameBounds(w,9,out f,16);uint nc;DwmGetWindowAttribute(w,1,out nc,4);return new[]{GetWindowLongPtr(w,-16).ToInt64(),(long)nc,(long)r.Left,r.Top,r.Right,r.Bottom,f.Left,f.Top,f.Right,f.Bottom}; }
 public static int[] SizeLoop(long handle,uint owner) {var w=new IntPtr(handle);uint pid;GetWindowThreadProcessId(w,out pid);if(pid!=owner)throw new Exception("Unexpected window owner");Rect a,b;GetWindowRect(w,out a);PostMessageW(w,0x112,new IntPtr(0xF002),IntPtr.Zero);System.Threading.Thread.Sleep(150);for(int i=0;i<5;i++){PostMessageW(w,0x100,new IntPtr(0x27),IntPtr.Zero);PostMessageW(w,0x101,new IntPtr(0x27),IntPtr.Zero);}PostMessageW(w,0x100,new IntPtr(0x0D),IntPtr.Zero);PostMessageW(w,0x101,new IntPtr(0x0D),IntPtr.Zero);System.Threading.Thread.Sleep(150);GetWindowRect(w,out b);return new[]{a.Right-a.Left,b.Right-b.Left,a.Bottom-a.Top,b.Bottom-b.Top}; }
 public static uint[] Decoration(long handle,uint owner) { var window=new IntPtr(handle);uint pid;GetWindowThreadProcessId(window,out pid);if(pid!=owner)throw new Exception("Unexpected window owner");uint material,border;var hr=DwmGetWindowAttribute(window,38,out material,4);if(hr!=0)throw new Exception("Backdrop attribute unavailable");DwmGetWindowAttribute(window,34,out border,4);return new[]{material,border}; }
}
'@
if($Resize){$r=[ZenWindowEdgeProbe]::SizeLoop($WindowHandle,$Owner);@{beforeWidth=$r[0];afterWidth=$r[1];beforeHeight=$r[2];afterHeight=$r[3];changed=($r[1] -gt $r[0])} | ConvertTo-Json -Compress}
elseif($Close -or $Restore){@{posted=[ZenWindowEdgeProbe]::SystemCommand($WindowHandle,$Owner,($(if($Close){0xF060}else{0xF120})))} | ConvertTo-Json -Compress}
elseif($Capsule){$frame=[ZenWindowEdgeProbe]::Frame($WindowHandle,$Owner);$values=[ZenWindowEdgeProbe]::Decoration($WindowHandle,$Owner);@{noBackdrop=($values[0] -eq 1);material=$values[0];border=$values[1];thickFrame=(($frame[0] -band 0x40000) -ne 0);ncEnabled=($frame[1] -ne 0);style=$frame[0];window=@($frame[2..5]);extendedFrame=@($frame[6..9])} | ConvertTo-Json -Compress}
elseif($Snap){$frame=[ZenWindowEdgeProbe]::Frame($WindowHandle,$Owner);$hits=[ZenWindowEdgeProbe]::Caption($WindowHandle,$Owner,$DragX,$DragY);@{resizable=(($frame[0] -band 0x40000) -ne 0);maximizable=(($frame[0] -band 0x10000) -ne 0);maximizeHit=($hits[0..19] -contains 9);captionHit=($hits[20] -eq 2);codes=$hits} | ConvertTo-Json -Compress}
elseif($Order){$r=[ZenWindowEdgeProbe]::Order($WindowHandle,$Owner);@{topmost=(($r[0] -band 8) -ne 0);toolWindow=(($r[0] -band 128) -ne 0);noActivate=(($r[0] -band 0x08000000) -ne 0);owner=$r[1];foreground=($r[2] -eq $WindowHandle);foregroundHandle=$r[2];visible=($r[3] -ne 0);minimized=($r[4] -ne 0)} | ConvertTo-Json -Compress}
elseif($Taskbar){$r=[ZenWindowEdgeProbe]::Taskbar($WindowHandle,$Owner);@{appId=$r[0];relaunch=$r[1];displayName=$r[2];icon=$r[3]} | ConvertTo-Json -Compress}
elseif($ControlPoints){$r=[ZenWindowEdgeProbe]::Controls($WindowHandle,$Owner,$ControlPoints);@{dpi=$r[0];hits=@($r[1..($r.Length-1)])} | ConvertTo-Json -Compress}
elseif($Island){$r=[ZenWindowEdgeProbe]::Island($WindowHandle,$Owner);@{width=$r[0];height=$r[1];dpi=$r[2];rounded=($r[3] -eq 1);contentHit=$r[4];rightHit=$r[5];reserveClear=($r[6] -eq 1)} | ConvertTo-Json -Compress}
elseif($Edge){$r=[ZenWindowEdgeProbe]::Edge($WindowHandle,$Owner,$Right.IsPresent,$Top.IsPresent);@{width=$r[0];height=$r[1];dpi=$r[2];shoulders=($r[3] -eq 1);reserveClear=($r[4] -eq 1);passThrough=($r[5] -eq 1);contentHit=$r[6];left=$r[7];right=$r[8];top=$r[9];clientX=$r[10];clientY=$r[11]} | ConvertTo-Json -Compress}
else{$hits=[ZenWindowEdgeProbe]::Read($WindowHandle,$Owner);@{left=($hits[0] -eq 10);right=($hits[1] -eq 11);bottom=($hits[2] -eq 15);codes=$hits} | ConvertTo-Json -Compress}
