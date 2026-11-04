param([Parameter(Mandatory=$true)][long]$WindowHandle,[Parameter(Mandatory=$true)][uint32]$Owner,[switch]$Capsule,[switch]$Resize)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ZenWindowEdgeProbe {
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr window,int index);
 [DllImport("dwmapi.dll",EntryPoint="DwmGetWindowAttribute")] static extern int FrameBounds(IntPtr window,uint attribute,out Rect value,uint size);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window,out Rect rect);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
 [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr window,uint attribute,out uint value,uint size);
 [DllImport("user32.dll")] static extern bool PostMessageW(IntPtr w,uint m,IntPtr a,IntPtr b);
 [DllImport("user32.dll",SetLastError=true)] static extern IntPtr SendMessageTimeout(IntPtr window,uint message,IntPtr wParam,IntPtr lParam,uint flags,uint timeout,out IntPtr result);
 static int Hit(IntPtr window,int x,int y) { IntPtr result; var point=new IntPtr(unchecked((x&65535)|((y&65535)<<16))); if(SendMessageTimeout(window,0x84,IntPtr.Zero,point,2,1500,out result)==IntPtr.Zero) throw new Exception("No hit-test response"); return result.ToInt32(); }
 public static int[] Read(long handle,uint owner) { var window=new IntPtr(handle);uint pid;GetWindowThreadProcessId(window,out pid);if(pid!=owner)throw new Exception("Unexpected window owner");Rect r;if(!GetWindowRect(window,out r))throw new Exception("Window unavailable");return new[]{Hit(window,r.Left+2,(r.Top+r.Bottom)/2),Hit(window,r.Right-2,(r.Top+r.Bottom)/2),Hit(window,(r.Left+r.Right)/2,r.Bottom-2)}; }
 public static long[] Frame(long handle,uint owner) { var w=new IntPtr(handle);uint pid;GetWindowThreadProcessId(w,out pid);if(pid!=owner)throw new Exception("Unexpected window owner");Rect r,f;GetWindowRect(w,out r);FrameBounds(w,9,out f,16);uint nc;DwmGetWindowAttribute(w,1,out nc,4);return new[]{GetWindowLongPtr(w,-16).ToInt64(),(long)nc,(long)r.Left,r.Top,r.Right,r.Bottom,f.Left,f.Top,f.Right,f.Bottom}; }
 public static int[] SizeLoop(long handle,uint owner) {var w=new IntPtr(handle);uint pid;GetWindowThreadProcessId(w,out pid);if(pid!=owner)throw new Exception("Unexpected window owner");Rect a,b;GetWindowRect(w,out a);PostMessageW(w,0x112,new IntPtr(0xF002),IntPtr.Zero);System.Threading.Thread.Sleep(150);for(int i=0;i<5;i++){PostMessageW(w,0x100,new IntPtr(0x27),IntPtr.Zero);PostMessageW(w,0x101,new IntPtr(0x27),IntPtr.Zero);}PostMessageW(w,0x100,new IntPtr(0x0D),IntPtr.Zero);PostMessageW(w,0x101,new IntPtr(0x0D),IntPtr.Zero);System.Threading.Thread.Sleep(150);GetWindowRect(w,out b);return new[]{a.Right-a.Left,b.Right-b.Left,a.Bottom-a.Top,b.Bottom-b.Top}; }
 public static uint[] Decoration(long handle,uint owner) { var window=new IntPtr(handle);uint pid;GetWindowThreadProcessId(window,out pid);if(pid!=owner)throw new Exception("Unexpected window owner");uint material,border;var hr=DwmGetWindowAttribute(window,38,out material,4);if(hr!=0)throw new Exception("Backdrop attribute unavailable");DwmGetWindowAttribute(window,34,out border,4);return new[]{material,border}; }
}
'@
if($Resize){$r=[ZenWindowEdgeProbe]::SizeLoop($WindowHandle,$Owner);@{beforeWidth=$r[0];afterWidth=$r[1];beforeHeight=$r[2];afterHeight=$r[3];changed=($r[1] -gt $r[0])} | ConvertTo-Json -Compress}
elseif($Capsule){$frame=[ZenWindowEdgeProbe]::Frame($WindowHandle,$Owner);$values=[ZenWindowEdgeProbe]::Decoration($WindowHandle,$Owner);@{noBackdrop=($values[0] -eq 1);material=$values[0];border=$values[1];thickFrame=(($frame[0] -band 0x40000) -ne 0);ncEnabled=($frame[1] -ne 0);style=$frame[0];window=@($frame[2..5]);extendedFrame=@($frame[6..9])} | ConvertTo-Json -Compress}
else{$hits=[ZenWindowEdgeProbe]::Read($WindowHandle,$Owner);@{left=($hits[0] -eq 10);right=($hits[1] -eq 11);bottom=($hits[2] -eq 15);codes=$hits} | ConvertTo-Json -Compress}
