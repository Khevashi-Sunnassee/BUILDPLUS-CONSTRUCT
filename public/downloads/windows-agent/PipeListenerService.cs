using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace BuildPlusTimeTracking.Agent
{
    public class PipeListenerService : BackgroundService
    {
        private readonly ILogger<PipeListenerService> _logger;
        private readonly TimeBlockQueue _queue;
        private const string PipeName = "BuildPlusTimeTrackingPipe";

        public PipeListenerService(ILogger<PipeListenerService> logger, TimeBlockQueue queue)
        {
            _logger = logger;
            _queue = queue;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Pipe listener service starting...");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ListenForConnection(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in pipe listener");
                    await Task.Delay(1000, stoppingToken);
                }
            }

            _logger.LogInformation("Pipe listener service stopped.");
        }

        private async Task ListenForConnection(CancellationToken stoppingToken)
        {
            using var pipeServer = new NamedPipeServerStream(
                PipeName,
                PipeDirection.In,
                NamedPipeServerStream.MaxAllowedServerInstances,
                PipeTransmissionMode.Byte,
                PipeOptions.Asynchronous);

            _logger.LogDebug("Waiting for pipe connection...");
            await pipeServer.WaitForConnectionAsync(stoppingToken);

            _logger.LogDebug("Client connected to pipe.");

            using var reader = new StreamReader(pipeServer, Encoding.UTF8);
            
            while (pipeServer.IsConnected && !stoppingToken.IsCancellationRequested)
            {
                var line = await reader.ReadLineAsync();
                if (string.IsNullOrEmpty(line)) break;

                try
                {
                    var block = JsonConvert.DeserializeObject<TimeBlock>(line);
                    if (block != null && !string.IsNullOrEmpty(block.SourceEventId))
                    {
                        block.Source = "agent+addins";
                        _queue.Enqueue(block);
                        _logger.LogDebug("Queued time block: {SourceEventId}", block.SourceEventId);
                    }
                }
                catch (JsonException ex)
                {
                    _logger.LogWarning(ex, "Failed to parse time block JSON");
                }
            }
        }
    }
}
