using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Timers;
using Autodesk.AutoCAD.Runtime;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Newtonsoft.Json;

[assembly: ExtensionApplication(typeof(LTETimeTracking.AutoCAD.App))]
[assembly: CommandClass(typeof(LTETimeTracking.AutoCAD.Commands))]

namespace LTETimeTracking.AutoCAD
{
    public class App : IExtensionApplication
    {
        private static Timer _captureTimer;
        private static DateTime _sessionStart;
        private static DateTime _lastActivity;
        private static string _currentDocPath;
        private static string _currentLayout;
        private static int _captureIntervalMs = 60000; // 1 minute

        public void Initialize()
        {
            _sessionStart = DateTime.Now;
            _lastActivity = DateTime.Now;

            // Subscribe to document events
            Application.DocumentManager.DocumentActivated += OnDocumentActivated;
            Application.DocumentManager.DocumentToBeDestroyed += OnDocumentClosing;

            // Start capture timer
            _captureTimer = new Timer(_captureIntervalMs);
            _captureTimer.Elapsed += OnCaptureInterval;
            _captureTimer.AutoReset = true;
            _captureTimer.Start();

            Application.DocumentManager.MdiActiveDocument?.Editor.WriteMessage(
                "\nLTE Time Tracking loaded. Type LTETRACK for status.\n");
        }

        public void Terminate()
        {
            _captureTimer?.Stop();
            _captureTimer?.Dispose();
            SendTimeBlock(true);
        }

        private static void OnDocumentActivated(object sender, DocumentCollectionEventArgs e)
        {
            if (e.Document != null)
            {
                _currentDocPath = e.Document.Name;
                _lastActivity = DateTime.Now;
                UpdateCurrentLayout(e.Document);
            }
        }

        private static void OnDocumentClosing(object sender, DocumentCollectionEventArgs e)
        {
            SendTimeBlock(true);
        }

        private static void UpdateCurrentLayout(Document doc)
        {
            try
            {
                using (var tr = doc.Database.TransactionManager.StartTransaction())
                {
                    var layoutMgr = LayoutManager.Current;
                    _currentLayout = layoutMgr.CurrentLayout;
                    tr.Commit();
                }
            }
            catch
            {
                _currentLayout = "Model";
            }
        }

        private static void OnCaptureInterval(object sender, ElapsedEventArgs e)
        {
            SendTimeBlock(false);
        }

        public static void SendTimeBlock(bool isFinal)
        {
            try
            {
                var doc = Application.DocumentManager.MdiActiveDocument;
                if (doc == null) return;

                _currentDocPath = doc.Name;
                UpdateCurrentLayout(doc);

                var now = DateTime.Now;
                var block = new TimeBlock
                {
                    SourceEventId = $"acad-{Environment.MachineName}-{_sessionStart:yyyyMMddHHmmss}-{now:yyyyMMddHHmmss}",
                    App = "acad",
                    LogDay = now.ToString("yyyy-MM-dd"),
                    StartedAt = _sessionStart.ToString("o"),
                    EndedAt = now.ToString("o"),
                    DurationMin = (int)(now - _sessionStart).TotalMinutes,
                    IdleMin = CalculateIdleMinutes(),
                    FilePath = _currentDocPath,
                    FileName = Path.GetFileName(_currentDocPath),
                    Acad = new AcadInfo
                    {
                        LayoutName = _currentLayout
                    },
                    RawPanelMark = ExtractPanelMark(_currentDocPath, _currentLayout),
                    RawDrawingCode = ExtractDrawingCode(_currentDocPath)
                };

                SendToAgent(block);
                _sessionStart = now;
            }
            catch (System.Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"LTE TimeTracking Error: {ex.Message}");
            }
        }

        private static int CalculateIdleMinutes()
        {
            var idleTime = DateTime.Now - _lastActivity;
            return idleTime.TotalMinutes > 5 ? (int)idleTime.TotalMinutes : 0;
        }

        private static string ExtractPanelMark(string filePath, string layout)
        {
            var fileName = Path.GetFileNameWithoutExtension(filePath ?? "");
            var combined = fileName + " " + layout;

            var patterns = new[] { @"P-\d+", @"PM-\d+", @"PANEL-[A-Z0-9]+", @"P\d+" };
            foreach (var pattern in patterns)
            {
                var match = System.Text.RegularExpressions.Regex.Match(
                    combined, pattern,
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (match.Success) return match.Value.ToUpper();
            }
            return null;
        }

        private static string ExtractDrawingCode(string filePath)
        {
            var fileName = Path.GetFileNameWithoutExtension(filePath ?? "");

            var patterns = new[] { @"[A-Z]{2,3}-\d{2,4}", @"DWG\d+", @"DET\d+" };
            foreach (var pattern in patterns)
            {
                var match = System.Text.RegularExpressions.Regex.Match(
                    fileName, pattern,
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (match.Success) return match.Value.ToUpper();
            }
            return null;
        }

        private static void SendToAgent(TimeBlock block)
        {
            try
            {
                var json = JsonConvert.SerializeObject(block);

                using (var pipe = new NamedPipeClientStream(".", "LTETimeTrackingPipe", PipeDirection.Out))
                {
                    pipe.Connect(1000);
                    var bytes = Encoding.UTF8.GetBytes(json + "\n");
                    pipe.Write(bytes, 0, bytes.Length);
                    pipe.Flush();
                }
            }
            catch (TimeoutException)
            {
                // Agent not running
            }
            catch (System.Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to send to agent: {ex.Message}");
            }
        }
    }

    public class Commands
    {
        [CommandMethod("LTETRACK")]
        public void ShowStatus()
        {
            var doc = Application.DocumentManager.MdiActiveDocument;
            var ed = doc?.Editor;
            if (ed == null) return;

            ed.WriteMessage("\n=== LTE Time Tracking Status ===\n");
            ed.WriteMessage($"Document: {doc.Name}\n");
            ed.WriteMessage($"Layout: {LayoutManager.Current.CurrentLayout}\n");
            ed.WriteMessage("Status: Active\n");
            ed.WriteMessage("================================\n");
        }

        [CommandMethod("LTESEND")]
        public void ForceSend()
        {
            App.SendTimeBlock(false);
            var doc = Application.DocumentManager.MdiActiveDocument;
            doc?.Editor.WriteMessage("\nTime block sent to agent.\n");
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
        public AcadInfo Acad { get; set; }
        public string RawPanelMark { get; set; }
        public string RawDrawingCode { get; set; }
    }

    public class AcadInfo
    {
        public string LayoutName { get; set; }
    }
}
