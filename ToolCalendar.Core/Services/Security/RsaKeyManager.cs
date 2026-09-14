using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;

namespace ToolCalendar.Core.Services.Security;

public class RsaKeyManager
{
    private readonly RSA _rsa;
    private readonly RsaSecurityKey _key;

    public RsaKeyManager()
    {
        // Khởi tạo cặp khóa RSA 2048-bit 
        // Lưu ý: Trong môi trường production thực tế, key này nên được đọc từ file (.pem) hoặc vault
        // để khi restart server, các token cũ không bị invalid. 
        // Tuy nhiên với dự án này ta tạm thời sinh mới mỗi lần khởi động.
        _rsa = RSA.Create(2048);
        _key = new RsaSecurityKey(_rsa)
        {
            KeyId = Guid.NewGuid().ToString() // Gắn ID cho key (hữu ích cho JWKS)
        };
    }

    public RsaSecurityKey GetKey() => _key;

    public RSA GetRsa() => _rsa;

    // Xuất ra định dạng JWKS (JSON Web Key Set)
    public object GetJwks()
    {
        var parameters = _rsa.ExportParameters(false); // Chỉ lấy public key
        
        return new
        {
            keys = new[]
            {
                new
                {
                    kty = "RSA",
                    use = "sig",
                    alg = "RS256",
                    kid = _key.KeyId,
                    n = Base64UrlEncoder.Encode(parameters.Modulus),
                    e = Base64UrlEncoder.Encode(parameters.Exponent)
                }
            }
        };
    }
}
