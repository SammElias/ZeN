using System.Runtime.InteropServices;

sealed class OutsideClickObserver : IDisposable
{
    public const uint Message = 0x8001; // WM_APP + 1
    private const int LowLevelMouseHook = 14;
    private const uint RootOwner = 3;
    private readonly MouseHook callback;
    private readonly nint hook;

    public OutsideClickObserver(nint capsule, int owner, uint thread)
    {
        callback = (code, button, data) =>
        {
            if (code == 0 && button is 0x0201 or 0x0204 or 0x0207 or 0x020B &&
                Native.IsWindowVisible(capsule) && !Native.IsIconic(capsule))
            {
                // The first member of MSLLHOOKSTRUCT is a POINT in screen coordinates.
                var hit = WindowFromPoint(Marshal.PtrToStructure<Point>(data));
                var root = Native.GetAncestor(hit, RootOwner);
                Native.GetWindowThreadProcessId(root != 0 ? root : hit, out var hitOwner);
                if (hitOwner != owner)
                    Native.PostThreadMessage(thread, Message, 0, 0);
            }
            return CallNextHookEx(0, code, button, data);
        };
        Native.GetWindowThreadProcessId(capsule, out var capsuleOwner);
        if (capsuleOwner == owner)
            hook = SetWindowsHookExW(LowLevelMouseHook, callback, GetModuleHandleW(0), 0);
    }

    public bool Installed => hook != 0;

    public void Dispose()
    {
        if (Installed) UnhookWindowsHookEx(hook);
        GC.KeepAlive(callback);
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Point { public int X, Y; }

    private delegate nint MouseHook(int code, nuint button, nint data);
    [DllImport("user32.dll")] private static extern nint WindowFromPoint(Point point);
    [DllImport("user32.dll")] private static extern nint SetWindowsHookExW(int id, MouseHook callback, nint module, uint thread);
    [DllImport("user32.dll")] private static extern nint CallNextHookEx(nint hook, int code, nuint button, nint data);
    [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(nint hook);
    [DllImport("kernel32.dll")] private static extern nint GetModuleHandleW(nint moduleName);
}
