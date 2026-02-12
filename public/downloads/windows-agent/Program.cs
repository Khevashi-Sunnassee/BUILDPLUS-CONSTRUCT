using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using BuildPlusTimeTracking.Agent;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddHostedService<PipeListenerService>();
builder.Services.AddHostedService<UploadService>();
builder.Services.AddSingleton<TimeBlockQueue>();
builder.Services.AddSingleton<ConfigManager>();

builder.Logging.AddEventLog(settings =>
{
    settings.SourceName = "BuildPlusTimeTracking";
});

var host = builder.Build();

// Initialize config on startup
var config = host.Services.GetRequiredService<ConfigManager>();
config.Load();

host.Run();
