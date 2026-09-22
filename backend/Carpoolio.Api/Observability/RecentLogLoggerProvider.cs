namespace Carpoolio.Api.Observability;

public sealed class RecentLogLoggerProvider(RecentLogStore store) : ILoggerProvider
{
    public ILogger CreateLogger(string categoryName) => new RecentLogLogger(categoryName, store);
    public void Dispose() { }

    private sealed class RecentLogLogger(string category, RecentLogStore store) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (IsEnabled(logLevel))
                store.Add(logLevel, category, formatter(state, exception), exception);
        }
    }
}
