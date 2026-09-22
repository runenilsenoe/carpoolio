using Npgsql;

namespace Carpoolio.Api.Persistence;

/// <summary>
/// Brings databases created from an older backend/db/init.sql up to date. Docker only runs init.sql on an
/// empty volume, so every statement here must be idempotent and mirrored in init.sql.
/// </summary>
public static class SchemaUpgrade
{
    private const string Sql = """
        ALTER TABLE cars DROP CONSTRAINT IF EXISTS cars_event_id_driver_user_id_key;
        CREATE INDEX IF NOT EXISTS cars_event_driver_idx ON cars(event_id, driver_user_id);
        ALTER TABLE car_members ADD COLUMN IF NOT EXISTS note TEXT CHECK (char_length(note) <= 200);
        """;

    public static async Task ApplyAsync(NpgsqlDataSource dataSource)
    {
        await using var command = dataSource.CreateCommand(Sql);
        await command.ExecuteNonQueryAsync();
    }
}
