using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Core.Models;
using ToolCalendar.Core.Models.Integration;
using ToolCalendar.Core.Services.Integration;

namespace ToolCalendar.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class IntegrationController : ControllerBase
{
    private readonly ICqdtIntegrationService _cqdtService;

    public IntegrationController(ICqdtIntegrationService cqdtService)
    {
        _cqdtService = cqdtService;
    }

    [HttpPost("sync-cqdt")]
    public async Task<IActionResult> SyncCqdt([FromBody] CqdtLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(ApiResponse.Fail("Vui lòng cung cấp tài khoản và mật khẩu CQĐT."));
        }

        try
        {
            var documents = await _cqdtService.ScrapePendingDocumentsAsync(request.Username, request.Password, request.Limit);
            return Ok(ApiResponse<List<CqdtDocumentDto>>.Ok(documents));
        }
        catch (Exception ex)
        {
            // Trả về lỗi có ý nghĩa từ Service để frontend hiển thị (vd: Sai mật khẩu, Web lỗi)
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }
}
