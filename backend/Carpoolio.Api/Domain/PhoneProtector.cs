using System.Security.Cryptography;
using System.Text;

namespace Carpoolio.Api.Domain;

public sealed class PhoneProtector(IConfiguration configuration)
{
    private readonly byte[] _encryptionKey = ReadKey(configuration, "PHONE_ENCRYPTION_KEY");
    private readonly byte[] _hashKey = ReadKey(configuration, "PHONE_HASH_KEY");

    public string Hash(string phone) => Convert.ToHexString(HMACSHA256.HashData(_hashKey, Encoding.UTF8.GetBytes(phone)));

    public string Encrypt(string phone)
    {
        var nonce = RandomNumberGenerator.GetBytes(12);
        var plaintext = Encoding.UTF8.GetBytes(phone);
        var cipher = new byte[plaintext.Length];
        var tag = new byte[16];
        using var aes = new AesGcm(_encryptionKey, 16);
        aes.Encrypt(nonce, plaintext, cipher, tag);
        return Convert.ToBase64String(nonce.Concat(tag).Concat(cipher).ToArray());
    }

    private static byte[] ReadKey(IConfiguration configuration, string name)
    {
        var value = configuration[name] ?? throw new InvalidOperationException($"{name} is required.");
        var key = Convert.FromBase64String(value);
        if (key.Length != 32) throw new InvalidOperationException($"{name} must be a base64-encoded 32-byte key.");
        return key;
    }
}