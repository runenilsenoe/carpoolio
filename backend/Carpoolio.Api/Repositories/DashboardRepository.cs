using Npgsql;

namespace Carpoolio.Api.Repositories;

public sealed record DailyDashboardMetric(DateOnly Day, long Users, long Carpools);
public sealed record DashboardSnapshot(long TotalUsers, long TotalCarpools, IReadOnlyList<DailyDashboardMetric> Daily);

public sealed class DashboardRepository(NpgsqlDataSource dataSource)
{
    public async Task<DashboardSnapshot> GetSnapshot(CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""
            SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM events);

            WITH days AS (
              SELECT generate_series(
                (now() AT TIME ZONE 'Europe/Oslo')::date - 29,
                (now() AT TIME ZONE 'Europe/Oslo')::date,
                interval '1 day'
              )::date AS day
            )
            SELECT d.day,
              (SELECT count(*) FROM users WHERE (created_at AT TIME ZONE 'Europe/Oslo')::date = d.day) AS users,
              (SELECT count(*) FROM events WHERE (created_at AT TIME ZONE 'Europe/Oslo')::date = d.day) AS carpools
            FROM days d
            ORDER BY d.day DESC;
            """, connection);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
            throw new InvalidOperationException("Dashboard totals query returned no row.");
        var totalUsers = reader.GetInt64(0);
        var totalCarpools = reader.GetInt64(1);

        var daily = new List<DailyDashboardMetric>(30);
        await reader.NextResultAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
            daily.Add(new DailyDashboardMetric(reader.GetFieldValue<DateOnly>(0), reader.GetInt64(1), reader.GetInt64(2)));

        return new DashboardSnapshot(totalUsers, totalCarpools, daily);
    }
}
