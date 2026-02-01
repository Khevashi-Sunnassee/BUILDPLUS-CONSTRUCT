using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Timers;
using Autodesk.Revit.UI;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI.Events;
using Newtonsoft.Json;

namespace LTETimeTracking.Revit
{
    public class App : IExternalApplication
    {
        private UIControlledApplication _uiApp;
        private Timer _captureTimer;
        private Document _activeDocument;
        private View _activeView;
        private DateTime _sessionStart;
        private DateTime _lastActivity;
        private int _captureIntervalMs = 60000; // 1 minute default
        
        public Result OnStartup(UIControlledApplication application)
        {
            _uiApp = application;
            _sessionStart = DateTime.Now;
            _lastActivity = DateTime.Now;
            
            // Subscribe to events
            application.ViewActivated += OnViewActivated;
            application.ApplicationClosing += OnApplicationClosing;
            
            // Start capture timer
            _captureTimer = new Timer(_captureIntervalMs);
            _captureTimer.Elapsed += OnCaptureInterval;
            _captureTimer.AutoReset = true;
            _captureTimer.Start();
            
            return Result.Succeeded;
        }

        public Result OnShutdown(UIControlledApplication application)
        {
            _captureTimer?.Stop();
            _captureTimer?.Dispose();
            
            // Send final capture
            SendTimeBlock(true);
            
            return Result.Succeeded;
        }

        private void OnViewActivated(object sender, ViewActivatedEventArgs e)
        {
            _activeDocument = e.Document;
            _activeView = e.CurrentActiveView;
            _lastActivity = DateTime.Now;
        }

        private void OnApplicationClosing(object sender, ApplicationClosingEventArgs e)
        {
            SendTimeBlock(true);
        }

        private void OnCaptureInterval(object sender, ElapsedEventArgs e)
        {
            SendTimeBlock(false);
        }

        private void SendTimeBlock(bool isFinal)
        {
            try
            {
                if (_activeDocument == null) return;

                var now = DateTime.Now;
                var block = new TimeBlock
                {
                    SourceEventId = $"revit-{Environment.MachineName}-{_sessionStart:yyyyMMddHHmmss}-{now:yyyyMMddHHmmss}",
                    App = "revit",
                    LogDay = now.ToString("yyyy-MM-dd"),
                    StartedAt = _sessionStart.ToString("o"),
                    EndedAt = now.ToString("o"),
                    DurationMin = (int)(now - _sessionStart).TotalMinutes,
                    IdleMin = CalculateIdleMinutes(),
                    FilePath = _activeDocument.PathName,
                    FileName = Path.GetFileName(_activeDocument.PathName),
                    Revit = new RevitInfo
                    {
                        ViewName = _activeView?.Name,
                        SheetNumber = GetSheetNumber(_activeView),
                        SheetName = GetSheetName(_activeView)
                    },
                    RawPanelMark = ExtractPanelMark(_activeView),
                    RawDrawingCode = ExtractDrawingCode(_activeDocument, _activeView)
                };

                // Send to Windows Agent via named pipe
                SendToAgent(block);

                // Reset session start for next interval
                _sessionStart = now;
            }
            catch (Exception ex)
            {
                // Log error but don't crash Revit
                System.Diagnostics.Debug.WriteLine($"LTE TimeTracking Error: {ex.Message}");
            }
        }

        private int CalculateIdleMinutes()
        {
            var idleTime = DateTime.Now - _lastActivity;
            return idleTime.TotalMinutes > 5 ? (int)idleTime.TotalMinutes : 0;
        }

        private string GetSheetNumber(View view)
        {
            if (view == null) return null;
            
            // Check if view is on a sheet
            var doc = view.Document;
            var sheets = new FilteredElementCollector(doc)
                .OfClass(typeof(ViewSheet))
                .Cast<ViewSheet>();

            foreach (var sheet in sheets)
            {
                var viewIds = sheet.GetAllPlacedViews();
                if (viewIds.Contains(view.Id))
                {
                    return sheet.SheetNumber;
                }
            }
            return null;
        }

        private string GetSheetName(View view)
        {
            if (view == null) return null;
            
            var doc = view.Document;
            var sheets = new FilteredElementCollector(doc)
                .OfClass(typeof(ViewSheet))
                .Cast<ViewSheet>();

            foreach (var sheet in sheets)
            {
                var viewIds = sheet.GetAllPlacedViews();
                if (viewIds.Contains(view.Id))
                {
                    return sheet.Name;
                }
            }
            return null;
        }

        private string ExtractPanelMark(View view)
        {
            // Try to extract panel mark from view name or sheet number
            // Common patterns: P-01, PANEL-A, PM-001, etc.
            if (view == null) return null;
            
            var viewName = view.Name ?? "";
            var sheetNum = GetSheetNumber(view) ?? "";
            
            // Look for panel mark patterns
            var patterns = new[] { @"P-\d+", @"PM-\d+", @"PANEL-[A-Z0-9]+", @"P\d+" };
            foreach (var pattern in patterns)
            {
                var match = System.Text.RegularExpressions.Regex.Match(
                    viewName + " " + sheetNum, pattern, 
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (match.Success) return match.Value.ToUpper();
            }
            return null;
        }

        private string ExtractDrawingCode(Document doc, View view)
        {
            // Try to extract drawing code from file path or view name
            if (doc == null) return null;
            
            var filePath = doc.PathName ?? "";
            var fileName = Path.GetFileNameWithoutExtension(filePath);
            
            // Look for drawing code patterns: DWG-001, GA-101, etc.
            var patterns = new[] { @"[A-Z]{2,3}-\d{2,4}", @"DWG\d+", @"GA\d+" };
            foreach (var pattern in patterns)
            {
                var match = System.Text.RegularExpressions.Regex.Match(
                    fileName, pattern, 
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (match.Success) return match.Value.ToUpper();
            }
            return null;
        }

        private void SendToAgent(TimeBlock block)
        {
            try
            {
                var json = JsonConvert.SerializeObject(block);
                
                using (var pipe = new NamedPipeClientStream(".", "LTETimeTrackingPipe", PipeDirection.Out))
                {
                    pipe.Connect(1000); // 1 second timeout
                    
                    var bytes = Encoding.UTF8.GetBytes(json + "\n");
                    pipe.Write(bytes, 0, bytes.Length);
                    pipe.Flush();
                }
            }
            catch (TimeoutException)
            {
                // Agent not running - silently ignore
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to send to agent: {ex.Message}");
            }
        }
    }

    public class TimeBlock
    {
        public string SourceEventId { get; set; }
        public string App { get; set; }
        public string LogDay { get; set; }
        public string StartedAt { get; set; }
        public string EndedAt { get; set; }
        public int DurationMin { get; set; }
        public int IdleMin { get; set; }
        public string FilePath { get; set; }
        public string FileName { get; set; }
        public RevitInfo Revit { get; set; }
        public string RawPanelMark { get; set; }
        public string RawDrawingCode { get; set; }
    }

    public class RevitInfo
    {
        public string ViewName { get; set; }
        public string SheetNumber { get; set; }
        public string SheetName { get; set; }
    }
}
