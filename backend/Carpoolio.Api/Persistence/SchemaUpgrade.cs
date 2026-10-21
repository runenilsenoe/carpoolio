using Npgsql;

namespace Carpoolio.Api.Persistence;

/// <summary>
/// Initializes external databases and brings existing installations up to date.
/// Every statement must be idempotent and mirrored in backend/db/init.sql.
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
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        // Serialize initialization when more than one API starts at the same time.
        await using var schemaLock = new NpgsqlCommand("SELECT pg_advisory_xact_lock(782341905)", connection, transaction);
        await schemaLock.ExecuteNonQueryAsync();
        using var schema = typeof(SchemaUpgrade).Assembly.GetManifestResourceStream("Carpoolio.Schema.sql")
            ?? throw new InvalidOperationException("The embedded database schema is missing.");
        using var reader = new StreamReader(schema);
        await using var command = new NpgsqlCommand(await reader.ReadToEndAsync() + "\n" + Sql, connection, transaction);
        await command.ExecuteNonQueryAsync();
        await transaction.CommitAsync();
    }
}
