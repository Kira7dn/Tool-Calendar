using Microsoft.Extensions.Logging;

namespace ToolCalender.Services
{
    public interface IEmailService
    {
        Task SendEmailAsync(string to, string subject, string body);
    }

    public class EmailService : IEmailService
    {
        private readonly ILogger<EmailService> _logger;

        public EmailService(ILogger<EmailService> logger)
        {
            _logger = logger;
        }

        public Task SendEmailAsync(string to, string subject, string body)
        {
            // Giai đoạn 1: Chỉ log ra console/file log
            _logger.LogInformation($"[EmailService Stub] ĐANG GỬI EMAIL:");
            _logger.LogInformation($"To: {to}");
            _logger.LogInformation($"Subject: {subject}");
            _logger.LogInformation($"Body: {body}");
            
            return Task.CompletedTask;
        }
    }
}
