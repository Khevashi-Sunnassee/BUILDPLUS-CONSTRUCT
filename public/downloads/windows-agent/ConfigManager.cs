using System;
using System.IO;
using Newtonsoft.Json;

namespace LTETimeTracking.Agent
{
    public class AgentConfig
    {
        public string ServerUrl { get; set; } = "https://your-portal-url.replit.app";
        public string DeviceKey { get; set; } = "";
        public string UserEmail { get; set; } = "";
        public string Timezone { get; set; } = "Australia/Melbourne";
        public int UploadIntervalSeconds { get; set; } = 60;
        public int MaxBatchSize { get; set; } = 50;
    }

    public class ConfigManager
    {
        private readonly string _configPath;
        public AgentConfig Config { get; private set; } = new AgentConfig();

        public ConfigManager()
        {
            var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
            var appFolder = Path.Combine(programData, "LTETimeTracking");
            Directory.CreateDirectory(appFolder);
            _configPath = Path.Combine(appFolder, "config.json");
        }

        public void Load()
        {
            try
            {
                if (File.Exists(_configPath))
                {
                    var json = File.ReadAllText(_configPath);
                    Config = JsonConvert.DeserializeObject<AgentConfig>(json) ?? new AgentConfig();
                }
                else
                {
                    // Create default config file
                    Save();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error loading config: {ex.Message}");
                Config = new AgentConfig();
            }
        }

        public void Save()
        {
            try
            {
                var json = JsonConvert.SerializeObject(Config, Formatting.Indented);
                File.WriteAllText(_configPath, json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error saving config: {ex.Message}");
            }
        }

        public bool IsConfigured => 
            !string.IsNullOrEmpty(Config.DeviceKey) && 
            !string.IsNullOrEmpty(Config.ServerUrl) &&
            !string.IsNullOrEmpty(Config.UserEmail);

        public string GetLogPath()
        {
            var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
            var logFolder = Path.Combine(programData, "LTETimeTracking", "logs");
            Directory.CreateDirectory(logFolder);
            return logFolder;
        }
    }
}
