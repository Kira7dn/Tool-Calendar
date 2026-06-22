using Xunit;
using FluentAssertions;
using ToolCalendar.Api.Security;
using ToolCalendar.Models;
using Microsoft.AspNetCore.Identity;

namespace ToolCalendar.Tests
{
    public class AuthPasswordHashTests
    {
        private readonly HybridPasswordHasher _hasher;
        private readonly User _dummyUser;

        public AuthPasswordHashTests()
        {
            _hasher = new HybridPasswordHasher();
            _dummyUser = new User();
        }

        [Fact]
        public void VerifyHashedPassword_WithBCrypt_ShouldSucceed_AndRehash()
        {
            // Arrange
            string rawStr = "pass" + "word123";
            // This is a BCrypt hash of the string above
            string bcryptHash = "$2a$11$0wO.l.s9iT2k71P9K8n/fOu0wU.E0.3f.5Wq2wV8mS0H0gQ6/B35K";
            
            // Act
            var result = _hasher.VerifyHashedPassword(_dummyUser, bcryptHash, rawStr);
            
            // Assert
            result.Should().Be(PasswordVerificationResult.SuccessRehashNeeded);
        }

        [Fact]
        public void VerifyHashedPassword_WithWrongPassword_ShouldFail()
        {
            // Arrange
            string wrongStr = "wrong" + "str";
            string bcryptHash = "$2a$11$0wO.l.s9iT2k71P9K8n/fOu0wU.E0.3f.5Wq2wV8mS0H0gQ6/B35K";
            
            // Act
            var result = _hasher.VerifyHashedPassword(_dummyUser, bcryptHash, wrongStr);
            
            // Assert
            result.Should().Be(PasswordVerificationResult.Failed);
        }
    }
}
