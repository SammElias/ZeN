using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using Microsoft.Win32.SafeHandles;

// The Passport KSP protects the private operation with a Windows Hello gesture.
internal static class PassportVaultKey
{
    private const int NameBytes = 16, RsaBytes = 256, SecretBytes = 32;
    private const int Silent = 0x40, Pkcs1 = 0x02, AllowKeyImport = 0x08;
    private const int AuthenticationMandatory = 1;
    private const string CachePolicy = "NgcCacheType";
    private const string LegacyCachePolicy = "NgcCacheTypeProperty";
    private const string GesturePolicy = "PinCacheIsGestureRequired";
    private static readonly CngProvider Provider = new("Microsoft Passport Key Storage Provider");

    internal static bool IsAvailable()
    {
        int result = NCryptOpenStorageProvider(out var handle, Provider.Provider, 0);
        using (handle) return result == 0 && !handle.IsInvalid;
    }

    internal static bool ProbePolicy()
    {
        try
        {
            using var provider = OpenProvider();
            using var key = Prepare(provider, KeyName(Guid.NewGuid().ToByteArray()), IntPtr.Zero);
            VerifyPolicy(key);
            return true;
        }
        catch (CryptographicException) { return false; }
        catch (PlatformNotSupportedException) { return false; }
    }

    internal static byte[] Create(IntPtr window)
    {
        byte[] id = Guid.NewGuid().ToByteArray();
        string name = KeyName(id);
        byte[] wrappingKey = RandomNumberGenerator.GetBytes(SecretBytes);
        try
        {
            using var provider = OpenProvider();
            using var key = Prepare(provider, name, window);
            Check(NCryptFinalizeKey(key, 0));
            VerifyPolicy(key);
            // Wrap only a random symmetric key. The password component is encrypted with
            // authenticated encryption in main and never enters this process.
            byte[] encrypted = new byte[RsaBytes];
            Check(NCryptEncrypt(key, wrappingKey, wrappingKey.Length, IntPtr.Zero, encrypted, encrypted.Length, out int length, Pkcs1));
            if (length != RsaBytes) throw new PlatformNotSupportedException();
            return [..id, ..encrypted];
        }
        catch
        {
            try { Remove(id); } catch (CryptographicException) { }
            throw;
        }
        finally { CryptographicOperations.ZeroMemory(wrappingKey); }
    }

    internal static byte[] Unlock(IntPtr window, ReadOnlySpan<byte> record)
    {
        if (record.Length != NameBytes + RsaBytes) throw new ArgumentException();
        using var key = CngKey.Open(KeyName(record[..NameBytes]), Provider);
        using var handle = key.Handle;
        VerifyPolicy(handle);
        SetWindowContext(handle, window, "Desbloquear Contraseñas de ZEN");
        Set(handle, GesturePolicy, BitConverter.GetBytes(1));
        byte[] encrypted = record[NameBytes..].ToArray();
        var plaintext = new byte[RsaBytes];
        try
        {
            // A provider that allows a silent private operation must not unlock ZEN.
            int silentStatus = NCryptDecrypt(handle, encrypted, encrypted.Length, IntPtr.Zero,
                plaintext, plaintext.Length, out _, Pkcs1 | Silent);
            if (silentStatus == 0) throw new PlatformNotSupportedException();
            CryptographicOperations.ZeroMemory(plaintext);
            Set(handle, GesturePolicy, BitConverter.GetBytes(1));
            Check(NCryptDecrypt(handle, encrypted, encrypted.Length, IntPtr.Zero,
                plaintext, plaintext.Length, out int length, Pkcs1));
            if (length != SecretBytes) throw new CryptographicException();
            return plaintext[..length];
        }
        finally { CryptographicOperations.ZeroMemory(plaintext); }
    }

    internal static void Remove(ReadOnlySpan<byte> record)
    {
        if (record.Length != NameBytes + RsaBytes && record.Length != NameBytes) throw new ArgumentException();
        try
        {
            using var key = CngKey.Open(KeyName(record[..NameBytes]), Provider, CngKeyOpenOptions.Silent);
            key.Delete();
        }
        catch (CryptographicException error) when (error.HResult is unchecked((int)0x8009000D)
            or unchecked((int)0x80090011) or unchecked((int)0x80090016))
        {
            // A Hello reset or a previous deletion already revoked the key.
        }
    }

    private static SafeNCryptProviderHandle OpenProvider()
    {
        int status = NCryptOpenStorageProvider(out var provider, Provider.Provider, 0);
        if (status == 0) return provider;
        provider?.Dispose();
        throw new CryptographicException(status);
    }

    private static SafeNCryptKeyHandle Prepare(SafeNCryptProviderHandle provider, string name, IntPtr window)
    {
        int status = NCryptCreatePersistedKey(provider, out var key, "RSA", name, 0, 0);
        try
        {
            Check(status);
            Set(key, "Length", BitConverter.GetBytes(RsaBytes * 8));
            // CngKeyCreationParameters.KeyUsage adds NCRYPT_PERSIST_FLAG, which Passport rejects.
            Set(key, "Key Usage", BitConverter.GetBytes((int)(CngKeyUsages.Decryption | CngKeyUsages.Signing)));
            var mandatory = BitConverter.GetBytes(AuthenticationMandatory);
            status = NCryptSetProperty(key, CachePolicy, mandatory, mandatory.Length, 0);
            if (status == unchecked((int)0x80090029)) Set(key, LegacyCachePolicy, mandatory);
            else Check(status);
            if (window != IntPtr.Zero) SetWindowContext(key, window, "Configurar Windows Hello para Contraseñas de ZEN");
            return key;
        }
        catch
        {
            key?.Dispose();
            throw;
        }
    }

    private static void VerifyPolicy(SafeNCryptKeyHandle key)
    {
        int policy;
        try { policy = ReadInt(key, CachePolicy); }
        catch (CryptographicException) { policy = ReadInt(key, LegacyCachePolicy); }
        int usage = ReadInt(key, "Key Usage");
        if (policy != AuthenticationMandatory || ReadInt(key, "Length") != RsaBytes * 8 ||
            (usage & (int)CngKeyUsages.Decryption) == 0 || (usage & AllowKeyImport) != 0 ||
            ReadInt(key, "Export Policy") != (int)CngExportPolicies.None) throw new PlatformNotSupportedException();
    }

    private static int ReadInt(SafeNCryptKeyHandle key, string property)
    {
        Check(NCryptGetProperty(key, property, out int value, sizeof(int), out int length, 0));
        if (length != sizeof(int)) throw new PlatformNotSupportedException();
        return value;
    }

    private static void Set(SafeNCryptKeyHandle key, string property, byte[] value)
        => Check(NCryptSetProperty(key, property, value, value.Length, 0));

    private static void SetWindowContext(SafeNCryptKeyHandle key, IntPtr window, string message)
    {
        var owner = IntPtr.Size == 8 ? BitConverter.GetBytes(window.ToInt64()) : BitConverter.GetBytes(window.ToInt32());
        Set(key, "HWND Handle", owner);
        Set(key, "Use Context", Encoding.Unicode.GetBytes(message + '\0'));
    }

    private static void Check(int status)
    {
        if (status != 0) throw new CryptographicException(status);
    }

    private static string KeyName(ReadOnlySpan<byte> id)
    {
        using var identity = WindowsIdentity.GetCurrent();
        return $"{identity.User}//ZEN//PasswordVault-{new Guid(id):N}";
    }

    [DllImport("ncrypt.dll", ExactSpelling = true, CharSet = CharSet.Unicode)]
    private static extern int NCryptOpenStorageProvider(out SafeNCryptProviderHandle provider, string name, int flags);

    [DllImport("ncrypt.dll", ExactSpelling = true, CharSet = CharSet.Unicode)]
    private static extern int NCryptCreatePersistedKey(SafeNCryptProviderHandle provider, out SafeNCryptKeyHandle key,
        string algorithm, string name, int legacyKeyType, int flags);

    [DllImport("ncrypt.dll", ExactSpelling = true, CharSet = CharSet.Unicode)]
    private static extern int NCryptSetProperty(SafeNCryptKeyHandle key, string property, byte[] value, int length, int flags);

    [DllImport("ncrypt.dll", ExactSpelling = true, CharSet = CharSet.Unicode)]
    private static extern int NCryptGetProperty(SafeNCryptKeyHandle key, string property, out int value, int size, out int length, int flags);

    [DllImport("ncrypt.dll", ExactSpelling = true)]
    private static extern int NCryptFinalizeKey(SafeNCryptKeyHandle key, int flags);

    [DllImport("ncrypt.dll", ExactSpelling = true)]
    private static extern int NCryptEncrypt(SafeNCryptKeyHandle key, byte[] input, int inputSize, IntPtr paddingInfo,
        [Out] byte[] output, int outputSize, out int resultSize, int flags);

    [DllImport("ncrypt.dll", ExactSpelling = true)]
    private static extern int NCryptDecrypt(SafeNCryptKeyHandle key, byte[] input, int inputSize, IntPtr paddingInfo,
        [Out] byte[] output, int outputSize, out int resultSize, int flags);
}
