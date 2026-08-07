using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

var key = "u2vtyhAz6TUnju6yQrDcKTAXRab4A4sRFi/w4hTzI1bqVZiZ6/AKRQSka4eCkWDJbIRCvNLynoDIkaTR14iueA==";
var securityKey = new SymmetricSecurityKey(Encoding.ASCII.GetBytes(key));
var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256Signature);

var claims = new[]
{
    new Claim(ClaimTypes.NameIdentifier, "1"),
    new Claim(ClaimTypes.Name, "admin"),
    new Claim(ClaimTypes.Role, "Admin")
};

var tokenDescriptor = new SecurityTokenDescriptor
{
    Subject = new ClaimsIdentity(claims),
    Expires = DateTime.UtcNow.AddDays(1),
    SigningCredentials = credentials
};

var handler = new JwtSecurityTokenHandler();
var token = handler.CreateToken(tokenDescriptor);
Console.WriteLine(handler.WriteToken(token));
