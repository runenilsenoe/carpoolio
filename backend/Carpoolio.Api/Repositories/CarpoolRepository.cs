using Carpoolio.Api.Contracts;
using Carpoolio.Api.Domain;
using Carpoolio.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Carpoolio.Api.Repositories;

/// <summary>PostgreSQL persistence for the carpool domain. HTTP concerns stay out of this class.</summary>
public sealed class CarpoolRepository(CarpoolDbContext context, NpgsqlDataSource dataSource)
{
    // Used by the legacy static endpoint helpers during the transition; normal DI uses the scoped constructor above.
    public CarpoolRepository(NpgsqlDataSource dataSource) : this(
        new CarpoolDbContext(new DbContextOptionsBuilder<CarpoolDbContext>().UseNpgsql(dataSource.ConnectionString).Options),
        dataSource) { }
    public async Task<UserDto?> GetCurrentUser(string tokenHash)
    {
        return await context.Sessions.AsNoTracking()
            .Where(session => session.TokenHash == tokenHash && session.ExpiresAt > DateTimeOffset.UtcNow)
            .Select(session => new UserDto(session.UserId, session.User!.Username))
            .SingleOrDefaultAsync();
    }

    public async Task<UserDto> CreateUserWithSession(string username, string phoneHash, string encryptedPhone, string tokenHash)
    {
        var user = new User { Username = username, PhoneHash = phoneHash, PhoneEncrypted = encryptedPhone };
        context.Users.Add(user);
        context.Sessions.Add(new Session { TokenHash = tokenHash, User = user, ExpiresAt = DateTimeOffset.UtcNow.AddYears(1) });
        await context.SaveChangesAsync();
        return new UserDto(user.Id, user.Username);
    }

    public async Task<string> CreateEvent(EventInput input, Guid userId, Func<string> newCode)
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var code = newCode();
            try
            {
                context.Events.Add(new Event { Name = input.Name.Trim(), Date = DateOnly.Parse(input.Date), Time = string.IsNullOrWhiteSpace(input.Time) ? null : TimeOnly.Parse(input.Time), Destination = CarpoolRules.NullIfEmpty(input.Destination), ShareCode = code, CreatedByUserId = userId });
                await context.SaveChangesAsync();
                return code;
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" }) { context.ChangeTracker.Clear(); }
        }
        throw new InvalidOperationException("Could not create carpool.");
    }

    public async Task<EventPageDto?> GetEventPage(string code, UserDto? me)
    {
        await using var connection = await dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand("""
            SELECT e.id, e.name, e.date, e.time, e.destination, e.share_code, e.created_by_user_id,
              c.id, c.driver_user_id, driver.username, c.available_seats, c.pickup_location, c.departure_time, c.note,
              cm.id, cm.user_id, passenger.username
            FROM events e LEFT JOIN cars c ON c.event_id = e.id
            LEFT JOIN users driver ON driver.id = c.driver_user_id
            LEFT JOIN car_members cm ON cm.car_id = c.id
            LEFT JOIN users passenger ON passenger.id = cm.user_id
            WHERE e.share_code = @code ORDER BY c.created_at, cm.created_at
            """, connection);
        command.Parameters.AddWithValue("code", code.ToUpperInvariant());
        await using var reader = await command.ExecuteReaderAsync();
        EventDto? eventDto = null;
        var creatorId = Guid.Empty;
        var cars = new Dictionary<Guid, CarDto>();
        while (await reader.ReadAsync())
        {
            eventDto ??= new EventDto(reader.GetGuid(0), reader.GetString(1), reader.GetFieldValue<DateOnly>(2).ToString("yyyy-MM-dd"), reader.IsDBNull(3) ? null : reader.GetFieldValue<TimeOnly>(3).ToString("HH:mm"), reader.IsDBNull(4) ? null : reader.GetString(4), reader.GetString(5));
            creatorId = reader.GetGuid(6);
            if (reader.IsDBNull(7)) continue;
            var carId = reader.GetGuid(7);
            if (!cars.TryGetValue(carId, out var car))
                cars[carId] = car = new CarDto(carId, reader.GetGuid(8), reader.GetString(9), reader.GetInt32(10), reader.GetString(11), reader.IsDBNull(12) ? null : reader.GetFieldValue<TimeOnly>(12).ToString("HH:mm"), reader.IsDBNull(13) ? null : reader.GetString(13), []);
            if (!reader.IsDBNull(14)) car.Passengers.Add(new PassengerDto(reader.GetGuid(14), reader.GetGuid(15), reader.GetString(16)));
        }
        return eventDto is null ? null : new EventPageDto(eventDto, me?.Id == creatorId, me, cars.Values.ToList());
    }

    private static async Task Execute(NpgsqlConnection connection, string sql, params (string Name, object? Value)[] parameters)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var (name, value) in parameters) command.Parameters.AddWithValue(name, value ?? DBNull.Value);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<T?> QueryOne<T>(NpgsqlConnection connection, string sql, params (string Name, object? Value)[] parameters) where T : class
    {
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var (name, value) in parameters) command.Parameters.AddWithValue(name, value ?? DBNull.Value);
        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) return null;
        return typeof(T) == typeof(UserDto) ? new UserDto(reader.GetGuid(0), reader.GetString(1)) as T : throw new NotSupportedException(typeof(T).Name);
    }
}
