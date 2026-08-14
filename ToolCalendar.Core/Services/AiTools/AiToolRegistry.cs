using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ToolCalendar.Core.Services.AiTools
{
    public class AiToolRegistry
    {
        private readonly Dictionary<string, IAiTool> _tools = new Dictionary<string, IAiTool>(StringComparer.OrdinalIgnoreCase);

        public AiToolRegistry(IEnumerable<IAiTool> tools)
        {
            foreach (var tool in tools)
            {
                _tools[tool.Name] = tool;
            }
        }

        public IEnumerable<object> GetToolsSchema()
        {
            return _tools.Values.Select(t => new
            {
                type = "function",
                function = new
                {
                    name = t.Name,
                    description = t.Description,
                    parameters = t.ParametersSchema
                }
            });
        }

        public bool HasTool(string name)
        {
            return _tools.ContainsKey(name);
        }

        public async Task<string> ExecuteToolAsync(string name, Dictionary<string, object> arguments)
        {
            if (_tools.TryGetValue(name, out var tool))
            {
                return await tool.ExecuteAsync(arguments);
            }
            return $"Tool '{name}' không tồn tại trong hệ thống.";
        }
    }
}
