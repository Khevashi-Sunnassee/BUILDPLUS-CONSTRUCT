using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace LTETimeTracking.Agent
{
    public class UploadService : BackgroundService
    {
        private readonly ILogger<UploadService> _logger;
        private readonly TimeBlockQueue _queue;
        private readonly ConfigManager _configManager;
        private readonly HttpClient _httpClient;

        public UploadService(
            ILogger<UploadService> logger, 
            TimeBlockQueue queue, 
            ConfigManager configManager)
        {
            _logger = logger;
            _queue = queue;
            _configManager = configManager;
            _httpClient = new HttpClient();
            _httpClient.Timeout = TimeSpan.FromSeconds(30);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Upload service starting...");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    if (!_configManager.IsConfigured)
                    {
                        _logger.LogWarning("Agent not configured. Please update config.json");
                        await Task.Delay(10000, stoppingToken);
                        continue;
                    }

                    if (!_queue.IsEmpty)
                    {
                        await UploadBatch(stoppingToken);
                    }

                    var delay = _configManager.Config.UploadIntervalSeconds * 1000;
                    await Task.Delay(delay, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in upload service");
                    await Task.Delay(5000, stoppingToken);
                }
            }

            // Final upload on shutdown
            if (!_queue.IsEmpty)
            {
                _logger.LogInformation("Uploading remaining blocks before shutdown...");
                await UploadBatch(CancellationToken.None);
            }

            _logger.LogInformation("Upload service stopped.");
        }

        private async Task UploadBatch(CancellationToken stoppingToken)
        {
            var blocks = _queue.DequeueAll(_configManager.Config.MaxBatchSize);
            if (blocks.Count == 0) return;

            _logger.LogInformation("Uploading {Count} time blocks...", blocks.Count);

            var payload = new IngestPayload
            {
                DeviceName = Environment.MachineName,
                Os = Environment.OSVersion.ToString(),
                AgentVersion = "1.0.0",
                Tz = _configManager.Config.Timezone,
                Blocks = blocks.ConvertAll(b => new IngestBlock
                {
                    SourceEventId = b.SourceEventId,
                    UserEmail = _configManager.Config.UserEmail,
                    LogDay = b.LogDay,
                    StartedAt = b.StartedAt,
                    EndedAt = b.EndedAt,
                    DurationMin = b.DurationMin,
                    IdleMin = b.IdleMin,
                    App = b.App,
                    FilePath = b.FilePath,
                    FileName = b.FileName,
                    Revit = b.Revit,
                    Acad = b.Acad,
                    RawPanelMark = b.RawPanelMark,
                    RawDrawingCode = b.RawDrawingCode,
                    Source = b.Source,
                    ProjectId = b.ProjectId
                })
            };

            try
            {
                var json = JsonConvert.SerializeObject(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var request = new HttpRequestMessage(HttpMethod.Post, 
                    $"{_configManager.Config.ServerUrl}/api/agent/ingest");
                request.Headers.Add("X-Device-Key", _configManager.Config.DeviceKey);
                request.Content = content;

                var response = await _httpClient.SendAsync(request, stoppingToken);

                if (response.IsSuccessStatusCode)
                {
                    var responseBody = await response.Content.ReadAsStringAsync(stoppingToken);
                    _logger.LogInformation("Upload successful: {Response}", responseBody);
                }
                else
                {
                    var errorBody = await response.Content.ReadAsStringAsync(stoppingToken);
                    _logger.LogWarning("Upload failed with status {StatusCode}: {Error}", 
                        (int)response.StatusCode, errorBody);

                    // Re-queue blocks on failure (except 4xx errors which won't succeed on retry)
                    if ((int)response.StatusCode >= 500)
                    {
                        foreach (var block in blocks)
                        {
                            _queue.Enqueue(block);
                        }
                    }
                }
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "Network error during upload. Blocks will be retried.");
                foreach (var block in blocks)
                {
                    _queue.Enqueue(block);
                }
            }
        }
    }

    public class IngestPayload
    {
        [JsonProperty("deviceName")]
        public string DeviceName { get; set; } = "";

        [JsonProperty("os")]
        public string Os { get; set; } = "";

        [JsonProperty("agentVersion")]
        public string? AgentVersion { get; set; }

        [JsonProperty("tz")]
        public string Tz { get; set; } = "Australia/Melbourne";

        [JsonProperty("blocks")]
        public List<IngestBlock> Blocks { get; set; } = new();
    }

    public class IngestBlock
    {
        [JsonProperty("sourceEventId")]
        public string SourceEventId { get; set; } = "";

        [JsonProperty("userEmail")]
        public string UserEmail { get; set; } = "";

        [JsonProperty("logDay")]
        public string LogDay { get; set; } = "";

        [JsonProperty("startedAt")]
        public string StartedAt { get; set; } = "";

        [JsonProperty("endedAt")]
        public string EndedAt { get; set; } = "";

        [JsonProperty("durationMin")]
        public int DurationMin { get; set; }

        [JsonProperty("idleMin")]
        public int IdleMin { get; set; }

        [JsonProperty("app")]
        public string App { get; set; } = "";

        [JsonProperty("filePath")]
        public string? FilePath { get; set; }

        [JsonProperty("fileName")]
        public string? FileName { get; set; }

        [JsonProperty("revit")]
        public RevitInfo? Revit { get; set; }

        [JsonProperty("acad")]
        public AcadInfo? Acad { get; set; }

        [JsonProperty("rawPanelMark")]
        public string? RawPanelMark { get; set; }

        [JsonProperty("rawDrawingCode")]
        public string? RawDrawingCode { get; set; }

        [JsonProperty("source")]
        public string? Source { get; set; }

        [JsonProperty("projectId")]
        public string? ProjectId { get; set; }
    }
}
