using System;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface ISettingRepository
    {
        string GetAppSetting(string key, string defaultVal = "");
        void SaveAppSetting(string key, string val);
    }
}
