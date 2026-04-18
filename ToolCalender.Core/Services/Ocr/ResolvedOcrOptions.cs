namespace ToolCalender.Services
{
    internal sealed class ResolvedOcrOptions
    {
        public bool EnableDebug { get; set; }
        public string DebugPath { get; set; } = "";
        public int RenderDpi { get; set; }
        public bool EnableOsd { get; set; }
        public bool EnableDeskew { get; set; }
        public float DeskewMinAbsAngle { get; set; }
        public float OsdMinConfidence { get; set; }
    }
}
