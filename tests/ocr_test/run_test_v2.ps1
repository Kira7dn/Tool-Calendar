# Script chay test OCR tu dong (v2 - Fixed)
$testFile = "d:\Business Analyze\ToolCalendar\tests\test_results\Full_Professional_Noisy_Doc.pdf"
$expectedFile = "d:\Business Analyze\ToolCalendar\tests\ocr_test\expected.json"

Write-Host "--- DANG KIEM TRA OCR ---" -ForegroundColor Cyan

if (Test-Path $testFile) {
    dotnet test "d:\Business Analyze\ToolCalendar\ToolCalender.Tests\ToolCalender.Tests.csproj" --logger "console;verbosity=normal"
} else {
    Write-Host "Loi: Khong tim thay file PDF test. Hay chay dotnet test truoc!" -ForegroundColor Red
}
