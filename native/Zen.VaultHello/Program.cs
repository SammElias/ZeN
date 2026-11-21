using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

// Native WebAuthn API, with versioned layouts from Microsoft's webauthn.h.
internal static class Program
{
    private const string RpId = "vault.zen.localhost";
    private const string CredentialType = "public-key";
    private const uint Platform = 1, UserVerificationRequired = 1, InternalTransport = 0x10;
    private const uint TimeoutMs = 60_000;
    private const int Unsupported = 2, Cancelled = 3, Failed = 4;

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            if (args is ["probe"]) return HasPlatformAuthenticator() && PassportVaultKey.ProbePolicy() ? 0 : Unsupported;
            if (args.Length != 2 || !long.TryParse(args[1], out long hwnd) || hwnd == 0) return Failed;
            var request = JsonSerializer.Deserialize<Request>(Console.ReadLine() ?? "");
            if (request is null) return Failed;
            byte[] id = Convert.FromBase64String(request.Id ?? "");
            if (args[0] == "passport-remove")
            {
                PassportVaultKey.Remove(id);
                return 0;
            }
            if (args[0] is "passport-create" or "passport-derive")
            {
                if (!HasPlatformAuthenticator() || !PassportVaultKey.IsAvailable()) return Unsupported;
                WriteResult(args[0] == "passport-create" ? PassportVaultKey.Create((IntPtr)hwnd) : PassportVaultKey.Unlock((IntPtr)hwnd, id));
                return 0;
            }
            if (args[0] == "remove")
            {
                if (id.Length is < 1 or > 1024) return Failed;
                Delete(id);
                return 0;
            }
            if (!Available()) return Unsupported;
            Check(WebAuthNGetCancellationId(out Guid cancellation));
            // Main keeps stdin open for the duration of the operation. EOF also cancels if ZEN exits.
            var cancellationWatcher = new Thread(() =>
            {
                Console.Read();
                WebAuthNCancelCurrentOperation(ref cancellation);
            }) { IsBackground = true };
            cancellationWatcher.Start();
            using var native = new NativeInputs();
            IntPtr token = native.Struct(cancellation);
            byte[] result = args[0] switch
            {
                "create" => Create((IntPtr)hwnd, native, token),
                "derive" => Derive((IntPtr)hwnd, native, token, id, Convert.FromBase64String(request.Salt ?? "")),
                _ => throw new ArgumentException()
            };
            WriteResult(result);
            return 0;
        }
        catch (PlatformNotSupportedException) { return Unsupported; }
        catch (EntryPointNotFoundException) { return Unsupported; }
        catch (DllNotFoundException) { return Unsupported; }
        catch (OperationCanceledException) { return Cancelled; }
        catch (CryptographicException error) when (error.HResult is unchecked((int)0x800704c7) or unchecked((int)0x80090036))
        { return Cancelled; }
        catch (CryptographicException error)
        {
            Console.Error.WriteLine($"0x{unchecked((uint)error.HResult):X8}");
            return Failed;
        }
        catch { return Failed; }
    }

    private static bool HasPlatformAuthenticator() =>
        WebAuthNIsUserVerifyingPlatformAuthenticatorAvailable(out int available) == 0 && available != 0;

    private static bool Available() => WebAuthNGetApiVersionNumber() >= 6 && HasPlatformAuthenticator();

    private static void WriteResult(byte[] result)
    {
        try
        {
            using var output = Console.OpenStandardOutput();
            output.Write(result);
            output.Flush();
        }
        finally { CryptographicOperations.ZeroMemory(result); }
    }

    private static byte[] Create(IntPtr window, NativeInputs native, IntPtr cancellation)
    {
        var rp = new Rp(1, native.Text(RpId), native.Text("ZEN Contraseñas"), IntPtr.Zero);
        var user = new User(1, 32, native.Bytes(RandomNumberGenerator.GetBytes(32)),
            native.Text("Bóveda local"), IntPtr.Zero, native.Text("Bóveda local de ZEN"));
        IntPtr credentialType = native.Text(CredentialType);
        var algorithms = new ListOf(2, native.Array(new Algorithm(1, credentialType, -7), new Algorithm(1, credentialType, -257)));
        var data = Client(native, "webauthn.create");
        var options = new MakeOptions
        {
            Version = 6, Timeout = TimeoutMs, Attachment = Platform, ResidentKey = 1,
            Verification = UserVerificationRequired, Attestation = 1, Cancellation = cancellation, EnablePrf = 1
        };
        Check(WebAuthNAuthenticatorMakeCredential(window, ref rp, ref user, ref algorithms, ref data, ref options, out IntPtr output));
        try
        {
            var attestation = Marshal.PtrToStructure<Attestation>(output);
            byte[] id = ReadBytes(attestation.Id, attestation.IdLength, 1, 1024);
            if (attestation.Version >= 5 && attestation.PrfEnabled != 0 &&
                attestation.Transport == InternalTransport && IsVerifiedLocal(attestation.AuthData, attestation.AuthDataLength)) return id;
            try { Delete(id); } catch { /* The rejected credential cannot unlock a vault. */ }
            throw new PlatformNotSupportedException();
        }
        finally { WebAuthNFreeCredentialAttestation(output); }
    }

    private static byte[] Derive(IntPtr window, NativeInputs native, IntPtr cancellation, byte[] id, byte[] salt)
    {
        if (id.Length is < 1 or > 1024 || salt.Length != 32) throw new ArgumentException();
        var data = Client(native, "webauthn.get");
        var credential = new Credential(1, (uint)id.Length, native.Bytes(id), native.Text(CredentialType));
        var saltInput = native.Struct(new Salt(32, native.Bytes(salt), 0, IntPtr.Zero));
        var options = new GetOptions
        {
            Version = 6, Timeout = TimeoutMs, Credentials = new ListOf(1, native.Struct(credential)),
            Attachment = Platform, Verification = UserVerificationRequired, Cancellation = cancellation,
            PrfSalts = native.Struct(new SaltValues(saltInput, 0, IntPtr.Zero))
        };
        Check(WebAuthNAuthenticatorGetAssertion(window, RpId, ref data, ref options, out IntPtr output));
        try
        {
            var assertion = Marshal.PtrToStructure<Assertion>(output);
            var returnedId = ReadBytes(assertion.Credential.Id, assertion.Credential.IdLength, 1, 1024);
            if (assertion.Version < 3 || assertion.PrfSecret == IntPtr.Zero ||
                !CryptographicOperations.FixedTimeEquals(id, returnedId) ||
                !IsVerifiedLocal(assertion.AuthData, assertion.AuthDataLength)) throw new PlatformNotSupportedException();
            var secret = Marshal.PtrToStructure<Salt>(assertion.PrfSecret);
            byte[] key = ReadBytes(secret.First, secret.FirstLength, 32, 32);
            Marshal.Copy(new byte[32], 0, secret.First, 32);
            return key;
        }
        finally { WebAuthNFreeAssertion(output); }
    }

    private static ClientData Client(NativeInputs native, string type)
    {
        string challenge = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        byte[] json = JsonSerializer.SerializeToUtf8Bytes(new { type, challenge, origin = "https://" + RpId, crossOrigin = false });
        return new ClientData(1, (uint)json.Length, native.Bytes(json), native.Text("SHA-256"));
    }

    private static bool IsVerifiedLocal(IntPtr data, uint length)
    {
        if (data == IntPtr.Zero || length < 37) return false;
        // The RP ID hash is followed by UP, UV and backup eligibility/state flags.
        byte[] prefix = ReadBytes(data, 33, 33, 33);
        return CryptographicOperations.FixedTimeEquals(prefix.AsSpan(0, 32), SHA256.HashData(Encoding.UTF8.GetBytes(RpId))) &&
            (prefix[32] & 0x1d) == 0x05;
    }

    private static byte[] ReadBytes(IntPtr address, uint length, int minimum, int maximum)
    {
        if (address == IntPtr.Zero || length < minimum || length > maximum) throw new ArgumentException();
        var result = new byte[length];
        Marshal.Copy(address, result, 0, result.Length);
        return result;
    }

    private static void Delete(byte[] id)
    {
        int status = WebAuthNDeletePlatformCredential((uint)id.Length, id);
        if (status != unchecked((int)0x80070490) && status != unchecked((int)0x80090011)) Check(status);
    }

    private static void Check(int status)
    {
        if (status == 0) return;
        if (status == unchecked((int)0x800704c7) || status == unchecked((int)0x80090036))
            throw new OperationCanceledException();
        Marshal.ThrowExceptionForHR(status);
    }

    private sealed record Request(string? Id, string? Salt);

    private sealed class NativeInputs : IDisposable
    {
        private readonly List<IntPtr> pointers = [];
        private IntPtr Own(IntPtr pointer) { pointers.Add(pointer); return pointer; }
        internal IntPtr Text(string text) => Own(Marshal.StringToHGlobalUni(text));
        internal IntPtr Bytes(byte[] bytes)
        {
            IntPtr pointer = Own(Marshal.AllocHGlobal(bytes.Length));
            Marshal.Copy(bytes, 0, pointer, bytes.Length);
            return pointer;
        }
        internal IntPtr Struct<T>(T value) where T : struct
            => Array(value);
        internal IntPtr Array<T>(params T[] values) where T : struct
        {
            int size = Marshal.SizeOf<T>();
            IntPtr pointer = Own(Marshal.AllocHGlobal(size * values.Length));
            for (var i = 0; i < values.Length; i++) Marshal.StructureToPtr(values[i], pointer + i * size, false);
            return pointer;
        }
        public void Dispose() { foreach (IntPtr pointer in pointers) Marshal.FreeHGlobal(pointer); }
    }

    [StructLayout(LayoutKind.Sequential)] private readonly record struct Rp(uint Version, IntPtr Id, IntPtr Name, IntPtr Icon);
    [StructLayout(LayoutKind.Sequential)] private readonly record struct User(uint Version, uint IdLength, IntPtr Id, IntPtr Name, IntPtr Icon, IntPtr DisplayName);
    [StructLayout(LayoutKind.Sequential)] private readonly record struct ClientData(uint Version, uint Length, IntPtr Bytes, IntPtr HashAlgorithm);
    [StructLayout(LayoutKind.Sequential)] private readonly record struct Algorithm(uint Version, IntPtr Type, int CoseAlgorithm);
    [StructLayout(LayoutKind.Sequential)] private readonly record struct ListOf(uint Count, IntPtr Items);
    [StructLayout(LayoutKind.Sequential)] private readonly record struct Credential(uint Version, uint IdLength, IntPtr Id, IntPtr Type);
    [StructLayout(LayoutKind.Sequential)] private readonly record struct Salt(uint FirstLength, IntPtr First, uint SecondLength, IntPtr Second);
    [StructLayout(LayoutKind.Sequential)] private readonly record struct SaltValues(IntPtr Global, uint Count, IntPtr CredentialSalts);

    [StructLayout(LayoutKind.Sequential)]
    private struct MakeOptions
    {
        public uint Version, Timeout;
        public ListOf Credentials, Extensions;
        public uint Attachment, ResidentKey, Verification, Attestation, Flags;
        public IntPtr Cancellation, Excluded;
        public uint EnterpriseAttestation, LargeBlobSupport, PreferResident, PrivateMode, EnablePrf;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct GetOptions
    {
        public uint Version, Timeout;
        public ListOf Credentials, Extensions;
        public uint Attachment, Verification, Flags;
        public IntPtr U2fAppId, UsedU2fAppId, Cancellation, Allowed;
        public uint LargeBlobOperation, LargeBlobLength;
        public IntPtr LargeBlob, PrfSalts;
        public uint PrivateMode;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Attestation
    {
        public uint Version;
        public IntPtr Format;
        public uint AuthDataLength;
        public IntPtr AuthData;
        public uint AttestationLength;
        public IntPtr AttestationBytes;
        public uint DecodeType;
        public IntPtr Decoded;
        public uint ObjectLength;
        public IntPtr Object;
        public uint IdLength;
        public IntPtr Id;
        public ListOf Extensions;
        public uint Transport, EnterpriseAttestation, LargeBlobSupported, Resident, PrfEnabled;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Assertion
    {
        public uint Version, AuthDataLength;
        public IntPtr AuthData;
        public uint SignatureLength;
        public IntPtr Signature;
        public Credential Credential;
        public uint UserIdLength;
        public IntPtr UserId;
        public ListOf Extensions;
        public uint LargeBlobLength;
        public IntPtr LargeBlob;
        public uint LargeBlobStatus;
        public IntPtr PrfSecret;
    }

    [DllImport("webauthn.dll")] private static extern uint WebAuthNGetApiVersionNumber();
    [DllImport("webauthn.dll")] private static extern int WebAuthNIsUserVerifyingPlatformAuthenticatorAvailable(out int available);
    [DllImport("webauthn.dll")] private static extern int WebAuthNGetCancellationId(out Guid cancellation);
    [DllImport("webauthn.dll")] private static extern int WebAuthNCancelCurrentOperation(ref Guid cancellation);
    [DllImport("webauthn.dll")] private static extern int WebAuthNDeletePlatformCredential(uint idLength, byte[] id);
    [DllImport("webauthn.dll")] private static extern int WebAuthNAuthenticatorMakeCredential(IntPtr window, ref Rp rp, ref User user,
        ref ListOf algorithms, ref ClientData client, ref MakeOptions options, out IntPtr result);
    [DllImport("webauthn.dll", ExactSpelling = true, CharSet = CharSet.Unicode)] private static extern int WebAuthNAuthenticatorGetAssertion(
        IntPtr window, string rpId, ref ClientData client, ref GetOptions options, out IntPtr result);
    [DllImport("webauthn.dll")] private static extern void WebAuthNFreeCredentialAttestation(IntPtr result);
    [DllImport("webauthn.dll")] private static extern void WebAuthNFreeAssertion(IntPtr result);
}
