using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

internal static class SystemVolume
{
    private const uint AllClassContexts = 23;
    public static object Read() => Apply(null, null);

    public static object Set(int level, string endpoint)
    {
        if (level is < 0 or > 100) throw new InvalidOperationException("invalid");
        return Apply(level, endpoint);
    }

    private static object Apply(int? level, string? requestedEndpoint)
    {
        var enumerator = (IDeviceEnumerator)new DeviceEnumerator();
        try
        {
            enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia, out var device);
            try
            {
                device.GetId(out var id);
                var endpoint = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(id)));
                if (level.HasValue && endpoint != requestedEndpoint) throw new InvalidOperationException("outputChanged");

                var iid = typeof(IEndpointVolume).GUID;
                device.Activate(in iid, AllClassContexts, IntPtr.Zero, out var control);
                try
                {
                    var volume = (IEndpointVolume)control;
                    if (level is int target) volume.SetMasterVolumeLevelScalar(target / 100f, IntPtr.Zero);
                    volume.GetMasterVolumeLevelScalar(out var current);
                    volume.GetMute(out var muted);
                    return new { endpoint, level = (int)Math.Round(current * 100), muted };
                }
                finally { Marshal.ReleaseComObject(control); }
            }
            finally { Marshal.ReleaseComObject(device); }
        }
        finally { Marshal.ReleaseComObject(enumerator); }
    }

    private enum DataFlow { Render = 0 }
    private enum Role { Multimedia = 1 }

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    private class DeviceEnumerator { }

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IDeviceEnumerator
    {
        void EnumAudioEndpoints(DataFlow flow, uint mask, out IntPtr devices);
        void GetDefaultAudioEndpoint(DataFlow flow, Role role, out IDevice device);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IDevice
    {
        void Activate(in Guid iid, uint classContext, IntPtr activationParameters, [MarshalAs(UnmanagedType.IUnknown)] out object control);
        void OpenPropertyStore(uint access, out IntPtr properties);
        void GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    }

    // COM uses the native vtable order. Include the slots before the methods ZEN calls.
    [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IEndpointVolume
    {
        void RegisterControlChangeNotify(IntPtr callback);
        void UnregisterControlChangeNotify(IntPtr callback);
        void GetChannelCount(out uint channels);
        void SetMasterVolumeLevel(float level, IntPtr eventContext);
        void SetMasterVolumeLevelScalar(float level, IntPtr eventContext);
        void GetMasterVolumeLevel(out float level);
        void GetMasterVolumeLevelScalar(out float level);
        void SetChannelVolumeLevel(uint channel, float level, IntPtr eventContext);
        void SetChannelVolumeLevelScalar(uint channel, float level, IntPtr eventContext);
        void GetChannelVolumeLevel(uint channel, out float level);
        void GetChannelVolumeLevelScalar(uint channel, out float level);
        void SetMute([MarshalAs(UnmanagedType.Bool)] bool muted, IntPtr eventContext);
        void GetMute([MarshalAs(UnmanagedType.Bool)] out bool muted);
    }
}
