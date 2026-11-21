using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Windows.Forms;

internal static class Program {
 [DllImport("user32.dll")] static extern bool OpenClipboard(IntPtr owner);
 [DllImport("user32.dll")] static extern bool CloseClipboard();
 [DllImport("user32.dll")] static extern bool EmptyClipboard();
 [DllImport("user32.dll")] static extern uint GetClipboardSequenceNumber();
 [DllImport("user32.dll")] static extern IntPtr GetClipboardOwner();
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern uint RegisterClipboardFormat(string format);
 [DllImport("user32.dll")] static extern IntPtr SetClipboardData(uint format,IntPtr data);
 [DllImport("user32.dll")] static extern IntPtr GetClipboardData(uint format);
 [DllImport("kernel32.dll")] static extern IntPtr GlobalAlloc(uint flags,nuint bytes);
 [DllImport("kernel32.dll")] static extern IntPtr GlobalLock(IntPtr memory);
 [DllImport("kernel32.dll")] static extern bool GlobalUnlock(IntPtr memory);
 [DllImport("kernel32.dll")] static extern IntPtr GlobalFree(IntPtr memory);
 static void Open(IntPtr owner) {
  for(int i=0;i<40;i++){if(OpenClipboard(owner))return;Thread.Sleep(25);}
  throw new InvalidOperationException();
 }
 static void Put(uint format,byte[] bytes) {
  if(format==0)throw new InvalidOperationException();
  var handle=GlobalAlloc(0x42,(nuint)bytes.Length);
  if(handle==IntPtr.Zero)throw new InvalidOperationException();
  var data=GlobalLock(handle);
  if(data==IntPtr.Zero){GlobalFree(handle);throw new InvalidOperationException();}
  try {Marshal.Copy(bytes,0,data,bytes.Length);}finally{GlobalUnlock(handle);Array.Clear(bytes);}
  if(SetClipboardData(format,handle)==IntPtr.Zero){GlobalFree(handle);throw new InvalidOperationException();}
 }
 [STAThread] static int Main() {
  try {
   // Sensitive text only arrives over stdin, never command-line arguments, disk or diagnostics.
   var input=Console.ReadLine()??throw new InvalidOperationException();
   using var request=JsonDocument.Parse(input);
   var text=request.RootElement.GetProperty("text").GetString()??throw new InvalidOperationException();
   using var owner=new Form();var hwnd=owner.Handle;
   uint sequence;
   Open(hwnd);
   try {
    if(!EmptyClipboard())throw new InvalidOperationException();
    try {
     Put(RegisterClipboardFormat("ExcludeClipboardContentFromMonitorProcessing"),new byte[]{0});
     Put(RegisterClipboardFormat("CanIncludeInClipboardHistory"),new byte[4]);
     Put(RegisterClipboardFormat("CanUploadToCloudClipboard"),new byte[4]);
     Put(13,Encoding.Unicode.GetBytes(text+"\0"));
    }catch{EmptyClipboard();throw;}
   }finally{CloseClipboard();}
   // CloseClipboard materializes synthesized formats and can advance the sequence.
   // Capture afterwards; the owner HWND also protects a new copy in this small interval.
   sequence=GetClipboardSequenceNumber();
   text="";input="";
   Console.WriteLine("{\"ok\":true}");Console.Out.Flush();
   // Independent of the ZEN window and its lifetime. Never erase a later clipboard write,
   // even if the user happened to copy exactly the same text again.
   Thread.Sleep(30_000);
   Open(hwnd);
   try {if(GetClipboardOwner()==hwnd&&GetClipboardSequenceNumber()==sequence)EmptyClipboard();}finally{CloseClipboard();}
   return 0;
  }catch {Console.WriteLine("{\"ok\":false}");return 1;}
 }
}
