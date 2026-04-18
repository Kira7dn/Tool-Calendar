namespace ToolCalender.Models
{
    public class OcrExtractionResult
    {
        public string FullText { get; set; } = "";
        public List<OcrPageResult> Pages { get; set; } = new();
        public int TotalPages { get; set; }
        public long ElapsedMs { get; set; }
    }

    public class OcrPageResult
    {
        public int PageNumber { get; set; }
        public string Text { get; set; } = "";
        public string OcrHeader { get; set; } = "";
        public string OrientationDecision { get; set; } = "";
        public bool DeskewApplied { get; set; }
        public float? DeskewAngle { get; set; }
        public long ElapsedMs { get; set; }
        public OcrDebugArtifacts Artifacts { get; set; } = new();
        public string? Error { get; set; }
    }

    public class OcrDebugArtifacts
    {
        public string? RawImagePath { get; set; }
        public string? PreprocessedImagePath { get; set; }
        public string? OsdResultImagePath { get; set; }
        public string? FinalOcrImagePath { get; set; }
    }

    public class OcrRunOptions
    {
        public bool? EnableDebug { get; set; }
        public string? DebugPath { get; set; }
        public int? RenderDpi { get; set; }
        public bool? EnableOsd { get; set; }
        public bool? EnableDeskew { get; set; }
        public float? DeskewMinAbsAngle { get; set; }
        public float? OsdMinConfidence { get; set; }
    }
}
