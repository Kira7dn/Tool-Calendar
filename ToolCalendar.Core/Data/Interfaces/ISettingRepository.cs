using System;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface ISettingRepository
    {
        Task<string> GetAppSettingAsync(string key, string defaultVal = "");
        Task SaveAppSettingAsync(string key, string val);
    }
}
