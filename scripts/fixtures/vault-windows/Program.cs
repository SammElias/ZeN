using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows.Forms;
using WinClipboard=Windows.ApplicationModel.DataTransfer.Clipboard;
using Windows.ApplicationModel.DataTransfer;

internal static class Program {
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern uint RegisterClipboardFormat(string value);
 [DllImport("user32.dll")] static extern bool OpenClipboard(IntPtr owner);
 [DllImport("user32.dll")] static extern bool CloseClipboard();
 [DllImport("user32.dll")] static extern bool IsClipboardFormatAvailable(uint format);
 [DllImport("user32.dll")] static extern IntPtr GetClipboardData(uint format);
 [DllImport("kernel32.dll")] static extern IntPtr GlobalLock(IntPtr value);
 [DllImport("kernel32.dll")] static extern bool GlobalUnlock(IntPtr value);
 static bool Flag(string name) {
  var id=RegisterClipboardFormat(name);if(!IsClipboardFormatAvailable(id))return false;
  var memory=GetClipboardData(id);var value=GlobalLock(memory);if(value==IntPtr.Zero)return false;
  try{return Marshal.ReadInt32(value)==0;}finally{GlobalUnlock(memory);}
 }
 [STAThread] static void Main(){
  ApplicationConfiguration.Initialize();
  using var form=new Form {Text="ZEN · Prueba de pegado ficticio",Width=500,Height=230};
  using var editor=new TextBox {Multiline=true,Dock=DockStyle.Fill,AccessibleName="Editor de aceptación ficticio"};
  form.Controls.Add(editor);
  form.Shown+=(_,_)=>{
   Console.WriteLine("{\"ready\":true}");Console.Out.Flush();
   _=Task.Run(()=>{
    string? line;while((line=Console.ReadLine())!=null){
     var command=line;
     form.BeginInvoke(async ()=>{
      try {
       using var request=JsonDocument.Parse(command);var type=request.RootElement.GetProperty("type").GetString();
       if(type=="quit"){form.Close();return;}
       var expected=request.RootElement.TryGetProperty("expected",out var property)?property.GetString()??"":"";
       object result;
       if(type=="paste"){
        form.Activate();editor.Focus();editor.Clear();editor.Paste();
        result=new {pasted=editor.Text==expected};
       }else if(type=="copyOther"){
        // Private fixture text also stays out of the user's history.
        var data=new DataPackage();data.SetText(expected);
        WinClipboard.SetContentWithOptions(data,new ClipboardContentOptions {IsAllowedInHistory=false,IsRoamable=false});WinClipboard.Flush();
        result=new {copied=true};
       }else if(type=="history"){
        var history=await WinClipboard.GetHistoryItemsAsync();bool found=false;
        foreach(var item in history.Items)if(item.Content.Contains(StandardDataFormats.Text)&&await item.Content.GetTextAsync()==expected)found=true;
        result=new {status=history.Status.ToString(),enabled=WinClipboard.IsHistoryEnabled(),found};
       }else if(type=="flags"){
        if(!OpenClipboard(form.Handle))throw new InvalidOperationException();
        try{result=new {excluded=IsClipboardFormatAvailable(RegisterClipboardFormat("ExcludeClipboardContentFromMonitorProcessing")),history=Flag("CanIncludeInClipboardHistory"),cloud=Flag("CanUploadToCloudClipboard")};}
        finally{CloseClipboard();}
       }else result=new {matches=System.Windows.Forms.Clipboard.GetText()==expected};
       Console.WriteLine(JsonSerializer.Serialize(result));Console.Out.Flush();
      }catch{Console.WriteLine("{\"error\":true}");Console.Out.Flush();}
     });
    }
   });
  };
  Application.Run(form);
 }
}
