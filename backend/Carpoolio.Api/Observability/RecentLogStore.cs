using System.Text.Json;

namespace Carpoolio.Api.Observability;

public sealed record RecentLogEntry(
    DateTimeOffset Timestamp,
    LogLevel Level,
    string Category,
    string Message,
    string? Exception);

/// <summary>Keeps the latest API logs in memory and, when configured, on a small rolling file.</summary>
public sealed class RecentLogStore
{
    private const int Capacity = 100;
    private const long MaxFileBytes = 5 * 1024 * 1024;
    private readonly object _gate = new();
    private readonly Queue<RecentLogEntry> _entries = new(Capacity);
    private readonly string? _filePath;

    public RecentLogStore(IConfiguration configuration)
    {
        _filePath = configuration["LOG_FILE_PATH"];
        LoadExistingEntries();
    }

    public IReadOnlyList<RecentLogEntry> GetRecent()
    {
        lock (_gate)
            return _entries.Reverse().ToArray();
    }

    internal void Add(LogLevel level, string category, string message, Exception? exception)
    {
        var entry = new RecentLogEntry(DateTimeOffset.UtcNow, level, category, message, exception?.ToString());
        lock (_gate)
        {
            AddToQueue(entry);
            Persist(entry);
        }
    }

    private void AddToQueue(RecentLogEntry entry)
    {
        _entries.Enqueue(entry);
        while (_entries.Count > Capacity)
            _entries.Dequeue();
    }

    private void LoadExistingEntries()
    {
        if (string.IsNullOrWhiteSpace(_filePath)) return;

        try
        {
            var paths = new[] { _filePath + ".1", _filePath }.Where(File.Exists);
            foreach (var line in paths.SelectMany(File.ReadLines).TakeLast(Capacity))
            {
                var entry = JsonSerializer.Deserialize<RecentLogEntry>(line);
                if (entry is not null) AddToQueue(entry);
            }
        }
        catch
        {
            // Logging must never prevent the API from starting.
        }
    }

    private void Persist(RecentLogEntry entry)
    {
        if (string.IsNullOrWhiteSpace(_filePath)) return;

        try
        {
            var directory = Path.GetDirectoryName(_filePath);
            if (!string.IsNullOrWhiteSpace(directory)) Directory.CreateDirectory(directory);
            if (File.Exists(_filePath) && new FileInfo(_filePath).Length >= MaxFileBytes)
                File.Move(_filePath, _filePath + ".1", true);
            File.AppendAllText(_filePath, JsonSerializer.Serialize(entry) + Environment.NewLine);
        }
        catch
        {
            // Keep serving and retain the in-memory copy if disk logging fails.
        }
    }
}
