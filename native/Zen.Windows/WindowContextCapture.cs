using System.Runtime.InteropServices;
using System.Text.Json;
using System.Drawing;
using System.IO;
using Windows.Graphics.Capture;
using Windows.Graphics.DirectX;
using Windows.Graphics.DirectX.Direct3D11;
using Windows.Graphics.Imaging;
using Windows.Storage.Streams;
using WinRT;

internal static partial class Program {
  [DllImport("user32.dll")] private static extern bool GetWindowDisplayAffinity(IntPtr window,out uint affinity);
  [DllImport("d3d11.dll")] private static extern int D3D11CreateDevice(IntPtr adapter,uint driver,IntPtr software,uint flags,IntPtr levels,uint count,uint sdk,out IntPtr device,out uint level,out IntPtr context);
  [DllImport("d3d11.dll")] private static extern int CreateDirect3D11DeviceFromDXGIDevice(IntPtr dxgi,out IntPtr device);
  [ComImport,Guid("3628E81B-3CAC-4C60-B7F4-23CE0E0C3356"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface ICaptureItemInterop {
    IntPtr CreateForWindow(IntPtr window,in Guid iid);
    IntPtr CreateForMonitor(IntPtr monitor,in Guid iid);
  }
  private static IDirect3DDevice CaptureDevice(){
    Marshal.ThrowExceptionForHR(D3D11CreateDevice(IntPtr.Zero,1,IntPtr.Zero,0x20,IntPtr.Zero,0,7,out var device,out _,out var context));
    IntPtr dxgi=IntPtr.Zero,wrapped=IntPtr.Zero;
    try{var iid=new Guid("54ec77fa-1377-44e6-8c32-88fd5f44c84c");Marshal.ThrowExceptionForHR(Marshal.QueryInterface(device,in iid,out dxgi));Marshal.ThrowExceptionForHR(CreateDirect3D11DeviceFromDXGIDevice(dxgi,out wrapped));return MarshalInterface<IDirect3DDevice>.FromAbi(wrapped);}
    finally{if(wrapped!=IntPtr.Zero)Marshal.Release(wrapped);if(dxgi!=IntPtr.Zero)Marshal.Release(dxgi);if(context!=IntPtr.Zero)Marshal.Release(context);if(device!=IntPtr.Zero)Marshal.Release(device);}
  }
  // A bounded, one-frame capture of exactly the HWND chosen by the drag gesture.
  // GPU-backed windows need WGC; PrintWindow can succeed with an all-black image.
  // No activation, input injection, stream persistence or permission suppression.
  private static async Task<object> CaptureWindowContext(JsonElement input){
    CheckDesktop();stage="window-context-identity";
    var handle=new IntPtr(long.Parse(input.GetProperty("id").GetString()!));
    var expectedPid=input.GetProperty("pid").GetUInt32();var ownerPid=input.GetProperty("ownerPid").GetUInt32();
    GetWindowThreadProcessId(handle,out var pid);
    if(pid!=expectedPid||pid==ownerPid||!IsWindowVisible(handle)||IsIconic(handle)||!GetWindowRect(handle,out var rect))throw new InvalidOperationException("Ventana no disponible.");
    stage="window-context-protected";
    if(GetWindowDisplayAffinity(handle,out var affinity)&&affinity!=0)throw new InvalidOperationException("Ventana protegida.");
    using var bitmap=await CaptureGraphicsItem(handle,false);
      GetWindowThreadProcessId(handle,out var afterPid);
      stage="window-context-changed";
      if(afterPid!=expectedPid||!IsWindowVisible(handle)||IsIconic(handle)||!GetWindowRect(handle,out var after)||after.Left!=rect.Left||after.Top!=rect.Top||after.Right!=rect.Right||after.Bottom!=rect.Bottom)throw new InvalidOperationException("Ventana cambió durante la captura.");
      int nonBlack=0,total=0;
      for(int y=40;y<bitmap.Height-8;y+=Math.Max(1,bitmap.Height/80))for(int x=8;x<bitmap.Width-8;x+=Math.Max(1,bitmap.Width/80)){var c=bitmap.GetPixel(x,y);total++;if(Math.Max(c.R,Math.Max(c.G,c.B))>12)nonBlack++;}
      stage="window-context-blank";if(total==0||nonBlack<Math.Max(4,total/200))throw new InvalidOperationException("No hay imagen disponible.");
      var ratio=Math.Min(1.0,1920.0/Math.Max(bitmap.Width,bitmap.Height));using var scaled=new Bitmap(bitmap,(int)(bitmap.Width*ratio),(int)(bitmap.Height*ratio));
      using var output=new MemoryStream();scaled.Save(output,System.Drawing.Imaging.ImageFormat.Png);
      return new{image="data:image/png;base64,"+Convert.ToBase64String(output.ToArray()),width=scaled.Width,height=scaled.Height,scope="window",bounds=Bounds(rect)};
  }
  private static async Task<Bitmap> CaptureGraphicsItem(IntPtr handle,bool monitor){
    stage="graphics-capture-support";if(!GraphicsCaptureSession.IsSupported())throw new InvalidOperationException("Captura no disponible.");
    var interop=GraphicsCaptureItem.As<ICaptureItemInterop>();var iid=new Guid("79C3F95B-31F7-4EC2-A464-632EF5D30760");
    var pointer=monitor?interop.CreateForMonitor(handle,iid):interop.CreateForWindow(handle,iid);GraphicsCaptureItem item;
    try{item=GraphicsCaptureItem.FromAbi(pointer);}finally{Marshal.Release(pointer);}
    var size=item.Size;
    stage="window-context-size";if(size.Width<16||size.Height<16||size.Width>8000||size.Height>8000||(long)size.Width*size.Height>20000000)throw new InvalidOperationException("Dimensiones fuera de límites.");
    using var device=CaptureDevice();
    using var pool=Direct3D11CaptureFramePool.CreateFreeThreaded(device,DirectXPixelFormat.B8G8R8A8UIntNormalized,1,size);
    using var session=pool.CreateCaptureSession(item);session.IsCursorCaptureEnabled=false;
    var ready=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    void Arrived(Direct3D11CaptureFramePool sender,object args)=>ready.TrySetResult();
    pool.FrameArrived+=Arrived;
    try{
      stage="window-context-frame";session.StartCapture();await ready.Task.WaitAsync(TimeSpan.FromSeconds(3));
      using var frame=pool.TryGetNextFrame();if(frame==null||frame.ContentSize.Width!=size.Width||frame.ContentSize.Height!=size.Height)throw new InvalidOperationException("Ventana cambió durante la captura.");
      using var software=await SoftwareBitmap.CreateCopyFromSurfaceAsync(frame.Surface,BitmapAlphaMode.Premultiplied);
      session.Dispose(); // Stop the OS capture as soon as the single frame is copied.
      using var stream=new InMemoryRandomAccessStream();var encoder=await BitmapEncoder.CreateAsync(BitmapEncoder.PngEncoderId,stream);encoder.SetSoftwareBitmap(software);await encoder.FlushAsync();
      using var reader=new DataReader(stream.GetInputStreamAt(0));var bytes=new byte[checked((int)stream.Size)];await reader.LoadAsync((uint)bytes.Length);reader.ReadBytes(bytes);
      using var sourceStream=new MemoryStream(bytes);using var decoded=new Bitmap(sourceStream);return new Bitmap(decoded);

    }finally{pool.FrameArrived-=Arrived;}
  }
}
