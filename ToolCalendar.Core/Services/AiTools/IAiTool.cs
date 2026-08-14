using System.Collections.Generic;
using System.Threading.Tasks;

namespace ToolCalendar.Core.Services.AiTools
{
    public interface IAiTool
    {
        string Name { get; }
        string Description { get; }
        object ParametersSchema { get; }

        Task<string> ExecuteAsync(Dictionary<string, object> arguments);
    }
}
