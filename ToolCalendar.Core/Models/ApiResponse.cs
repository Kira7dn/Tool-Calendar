using System.Text.Json.Serialization;

namespace ToolCalendar.Core.Models
{
    public class ApiResponse<T>
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public T? Data { get; set; }
        
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public List<string>? Errors { get; set; }

        public static ApiResponse<T> Ok(T data, string message = "Success")
        {
            return new ApiResponse<T> { Success = true, Message = message, Data = data };
        }

        public static ApiResponse<T> Fail(string message, List<string>? errors = null)
        {
            return new ApiResponse<T> { Success = false, Message = message, Errors = errors };
        }
    }

    public class ApiResponse : ApiResponse<object>
    {
        public static ApiResponse Ok(string message = "Success")
        {
            return new ApiResponse { Success = true, Message = message };
        }

        public static ApiResponse<T> Ok<T>(T data, string message = "Success")
        {
            return ApiResponse<T>.Ok(data, message);
        }

        public new static ApiResponse Fail(string message, List<string>? errors = null)
        {
            return new ApiResponse { Success = false, Message = message, Errors = errors };
        }
    }
}
