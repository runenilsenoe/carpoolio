using Microsoft.AspNetCore.WebUtilities;
using Npgsql;

namespace Carpoolio.Api.Persistence;

public static class PostgresConnectionString
{
    public static string Parse(string value)
    {
        value = value.Trim();
        // Coolify expects only the value, but a pasted .env assignment is common.
        const string assignment = "DATABASE_URL=";
        if (value.StartsWith(assignment, StringComparison.OrdinalIgnoreCase))
            value = value[assignment.Length..].Trim();
        if (value.Length >= 2 && (value[0] == '"' || value[0] == '\'') && value[^1] == value[0])
            value = value[1..^1];

        if (!value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            return new NpgsqlConnectionStringBuilder(value).ConnectionString;

        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            string.IsNullOrEmpty(uri.Host) || uri.AbsolutePath.Length <= 1 ||
            !string.IsNullOrEmpty(uri.Fragment))
            throw new ArgumentException("DATABASE_URL must specify a PostgreSQL host and database.");

        var credentials = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host.Trim('[', ']'),
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = Uri.UnescapeDataString(uri.AbsolutePath[1..]),
            Username = Uri.UnescapeDataString(credentials[0]),
        };
        if (credentials.Length == 2)
            builder.Password = Uri.UnescapeDataString(credentials[1]);

        foreach (var parameter in QueryHelpers.ParseQuery(uri.Query))
        {
            var keyword = parameter.Key.ToLowerInvariant() switch
            {
                "sslmode" => "SSL Mode",
                "sslrootcert" => "Root Certificate",
                "connect_timeout" => "Timeout",
                "application_name" => "Application Name",
                "search_path" => "Search Path",
                _ => throw new ArgumentException("DATABASE_URL contains an unsupported PostgreSQL URL option."),
            };
            builder[keyword] = parameter.Value.ToString();
        }

        return builder.ConnectionString;
    }
}
