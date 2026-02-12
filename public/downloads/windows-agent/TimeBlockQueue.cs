using System;
using System.Collections.Concurrent;
using System.Collections.Generic;

namespace BuildPlusTimeTracking.Agent
{
    public class TimeBlock
    {
        public string SourceEventId { get; set; } = "";
        public string App { get; set; } = "";
        public string LogDay { get; set; } = "";
        public string StartedAt { get; set; } = "";
        public string EndedAt { get; set; } = "";
        public int DurationMin { get; set; }
        public int IdleMin { get; set; }
        public string? FilePath { get; set; }
        public string? FileName { get; set; }
        public RevitInfo? Revit { get; set; }
        public AcadInfo? Acad { get; set; }
        public string? RawPanelMark { get; set; }
        public string? RawDrawingCode { get; set; }
        public string? ProjectId { get; set; }
        public string? Source { get; set; }
    }

    public class RevitInfo
    {
        public string? ViewName { get; set; }
        public string? SheetNumber { get; set; }
        public string? SheetName { get; set; }
    }

    public class AcadInfo
    {
        public string? LayoutName { get; set; }
    }

    public class TimeBlockQueue
    {
        private readonly ConcurrentQueue<TimeBlock> _queue = new();
        private readonly object _lock = new();

        public void Enqueue(TimeBlock block)
        {
            _queue.Enqueue(block);
        }

        public List<TimeBlock> DequeueAll(int maxCount = 100)
        {
            var result = new List<TimeBlock>();
            lock (_lock)
            {
                while (result.Count < maxCount && _queue.TryDequeue(out var block))
                {
                    result.Add(block);
                }
            }
            return result;
        }

        public int Count => _queue.Count;

        public bool IsEmpty => _queue.IsEmpty;
    }
}
