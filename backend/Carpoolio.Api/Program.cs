using Carpoolio.Api.Contracts;
using Carpoolio.Api.Domain;
using Carpoolio.Api.Persistence;
using Carpoolio.Api.Endpoints;
using Carpoolio.Api.Observability;
using Carpoolio.Api.Repositories;
using Carpoolio.Api.Security;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.AddJsonConsole();
var connectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? builder.Configuration["DATABASE_URL"]
    ?? throw new InvalidOperationException("DATABASE_URL is required.");
var dataSource = NpgsqlDataSource.Create(connectionString);
builder.Services.AddSingleton(dataSource);
builder.Services.AddDbContext<CarpoolDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddScoped<CarpoolRepository>();
builder.Services.AddScoped<DashboardRepository>();
builder.Services.AddSingleton<PhoneProtector>();
builder.Services.AddSingleton<DashboardCredentials>();
builder.Services.AddSingleton<RecentLogStore>();
builder.Services.AddSingleton<ILoggerProvider, RecentLogLoggerProvider>();
builder.Services.AddHealthChecks().AddCheck<PostgresHealthCheck>("postgres");
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("writes", limiter =>
    {
        limiter.PermitLimit = 30;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });
    options.AddFixedWindowLimiter("dashboard", limiter =>
    {
        limiter.PermitLimit = 30;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });
});

var app = builder.Build();
app.UseForwardedHeaders();
app.UseRateLimiter();
app.Use(async (context, next) =>
{
    if (HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method) || HttpMethods.IsOptions(context.Request.Method))
    {
        await next();
        return;
    }
    var origin = context.Request.Headers.Origin.FirstOrDefault();
    if (origin is not null && (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) || uri.Host != context.Request.Host.Host))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new { message = "Cross-site requests are not allowed." });
        return;
    }
    await next();
});
app.MapHealthChecks("/health");
app.UseExceptionHandler(error => error.Run(async context =>
{
    var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
    var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("Carpoolio.Api.UnhandledException");
    if (exception is not null)
        logger.LogError(exception, "Unhandled exception for {Method} {Path}. Trace ID: {TraceId}", context.Request.Method, context.Request.Path, context.TraceIdentifier);

    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    context.Response.Headers["X-Trace-Id"] = context.TraceIdentifier;
    await context.Response.WriteAsJsonAsync(new { message = "Something went wrong. Please try again.", traceId = context.TraceIdentifier });
}));
app.MapDashboardEndpoints();

var api = app.MapGroup("/api");
api.MapIdentityEndpoints();
var eventsApi = api.MapGroup("/events").WithTags("Events");
var carsApi = api.MapGroup("/cars").WithTags("Cars");

eventsApi.MapPost("", async (EventInput input, HttpContext context, NpgsqlDataSource db) =>
{
    var validation = CarpoolRules.Validate(input);
    if (validation is not null) return Bad(validation);
    var user = await CurrentUser(context, db);
    return user is null ? Unauthorized() : Results.Ok(new { share_code = await CreateEvent(input, user.Id, db) });
}).RequireRateLimiting("writes");

eventsApi.MapPost("/with-identity", async (CreateEventWithIdentityInput input, HttpContext context, NpgsqlDataSource db, PhoneProtector phones) =>
{
    var validation = CarpoolRules.Validate(input.Identity) ?? CarpoolRules.Validate(input.Event);
    if (validation is not null) return Bad(validation);
    var user = await CreateIdentity(input.Identity, context, db, phones);
    return Results.Ok(new { share_code = await CreateEvent(input.Event, user.Id, db) });
});

eventsApi.MapGet("/{code}", async (string code, HttpContext context, NpgsqlDataSource db) =>
{
    var user = await CurrentUser(context, db);
    var page = await GetEventPage(code, user, db);
    return page is null ? Results.NotFound() : Results.Ok(page);
});

eventsApi.MapPost("/{code}/cars", async (string code, CarInput input, HttpContext context, NpgsqlDataSource db) =>
{
    var validation = CarpoolRules.Validate(input);
    if (validation is not null) return Bad(validation);
    var user = await CurrentUser(context, db);
    if (user is null) return Unauthorized();
    await using var connection = await db.OpenConnectionAsync();
    var eventId = await Scalar<Guid?>(connection, "SELECT id FROM events WHERE share_code = @code", ("code", code.ToUpperInvariant()));
    if (eventId is null) return Bad("This carpool no longer exists.");
    try
    {
        await Execute(connection, """
            INSERT INTO cars (event_id, driver_user_id, available_seats, pickup_location, departure_time, note)
            VALUES (@eventId, @userId, @seats, @pickup, @departure::time, @note)
            """, ("eventId", eventId), ("userId", user.Id), ("seats", input.AvailableSeats),
            ("pickup", input.PickupLocation.Trim()), ("departure", CarpoolRules.NullIfEmpty(input.DepartureTime)), ("note", CarpoolRules.NullIfEmpty(input.Note)));
        return Results.Ok(new { ok = true });
    }
    catch (PostgresException ex) when (ex.SqlState == "23505") { return Bad("You already added a car to this carpool."); }
});

carsApi.MapPatch("/{carId:guid}", async (Guid carId, CarInput input, HttpContext context, NpgsqlDataSource db) =>
{
    var validation = CarpoolRules.Validate(input);
    if (validation is not null) return Bad(validation);
    var user = await CurrentUser(context, db);
    if (user is null) return Unauthorized();
    await using var connection = await db.OpenConnectionAsync();
    await using var transaction = await connection.BeginTransactionAsync();
    var car = await QueryOne<CarOwner>(connection, "SELECT id, driver_user_id FROM cars WHERE id = @id FOR UPDATE", ("id", carId));
    if (car is null) return Bad("This car no longer exists.");
    if (car.DriverUserId != user.Id) return Forbidden();
    var passengers = await Scalar<long>(connection, "SELECT count(*) FROM car_members WHERE car_id = @id", ("id", carId));
    if (passengers > input.AvailableSeats) return Bad($"You already have {passengers} passengers. Remove someone before lowering the seat count.");
    await Execute(connection, """
        UPDATE cars SET available_seats = @seats, pickup_location = @pickup, departure_time = @departure::time,
          note = @note, updated_at = now() WHERE id = @id
        """, ("id", carId), ("seats", input.AvailableSeats), ("pickup", input.PickupLocation.Trim()),
        ("departure", CarpoolRules.NullIfEmpty(input.DepartureTime)), ("note", CarpoolRules.NullIfEmpty(input.Note)));
    await transaction.CommitAsync();
    return Results.Ok(new { ok = true });
});

carsApi.MapPost("/{carId:guid}/join", async (Guid carId, HttpContext context, NpgsqlDataSource db) =>
{
    var user = await CurrentUser(context, db);
    if (user is null) return Unauthorized();
    await using var connection = await db.OpenConnectionAsync();
    await using var transaction = await connection.BeginTransactionAsync();
    var car = await QueryOne<CarForJoin>(connection, "SELECT id, event_id, driver_user_id, available_seats FROM cars WHERE id = @id FOR UPDATE", ("id", carId));
    if (car is null) return Bad("This car no longer exists.");
    if (car.DriverUserId == user.Id) return Bad("You're the driver of this car.");
    // Serializes simultaneous switches by the same person in the same event.
    await Execute(connection, "SELECT pg_advisory_xact_lock(hashtextextended(@key, 0))", ("key", $"{user.Id}:{car.EventId}"));
    var seatsTaken = await Scalar<long>(connection, "SELECT count(*) FROM car_members WHERE car_id = @id", ("id", car.Id));
    if (seatsTaken >= car.AvailableSeats) return Bad("Sorry — that was the last seat and it just went.");
    await Execute(connection, "DELETE FROM car_members WHERE event_id = @eventId AND user_id = @userId", ("eventId", car.EventId), ("userId", user.Id));
    await Execute(connection, "INSERT INTO car_members (car_id, event_id, user_id) VALUES (@carId, @eventId, @userId)", ("carId", car.Id), ("eventId", car.EventId), ("userId", user.Id));
    await transaction.CommitAsync();
    return Results.Ok(new { ok = true });
});

carsApi.MapDelete("/{carId:guid}/membership", async (Guid carId, HttpContext context, NpgsqlDataSource db) =>
{
    var user = await CurrentUser(context, db);
    if (user is null) return Unauthorized();
    await using var connection = await db.OpenConnectionAsync();
    await Execute(connection, "DELETE FROM car_members WHERE car_id = @carId AND user_id = @userId", ("carId", carId), ("userId", user.Id));
    return Results.Ok(new { ok = true });
});

api.MapGroup("/members").WithTags("Cars").MapDelete("/{memberId:guid}", async (Guid memberId, HttpContext context, NpgsqlDataSource db) =>
{
    var user = await CurrentUser(context, db);
    if (user is null) return Unauthorized();
    await using var connection = await db.OpenConnectionAsync();
    var member = await QueryOne<MemberOwner>(connection, """
        SELECT cm.id, c.driver_user_id, e.created_by_user_id
        FROM car_members cm JOIN cars c ON c.id = cm.car_id JOIN events e ON e.id = c.event_id WHERE cm.id = @id
        """, ("id", memberId));
    if (member is null) return Bad("That passenger is already gone.");
    if (member.DriverUserId != user.Id && member.CreatorUserId != user.Id) return Forbidden();
    await Execute(connection, "DELETE FROM car_members WHERE id = @id", ("id", memberId));
    return Results.Ok(new { ok = true });
});

carsApi.MapDelete("/{carId:guid}", async (Guid carId, HttpContext context, NpgsqlDataSource db) =>
{
    var user = await CurrentUser(context, db);
    if (user is null) return Unauthorized();
    await using var connection = await db.OpenConnectionAsync();
    var car = await QueryOne<CarOwnerWithCreator>(connection, "SELECT c.id, c.driver_user_id, e.created_by_user_id FROM cars c JOIN events e ON e.id = c.event_id WHERE c.id = @id", ("id", carId));
    if (car is null) return Results.Ok(new { ok = true });
    if (car.DriverUserId != user.Id && car.CreatorUserId != user.Id) return Forbidden();
    await Execute(connection, "DELETE FROM cars WHERE id = @id", ("id", carId));
    return Results.Ok(new { ok = true });
});

eventsApi.MapPatch("/{code}", async (string code, EventInput input, HttpContext context, NpgsqlDataSource db) =>
{
    var validation = CarpoolRules.Validate(input);
    if (validation is not null) return Bad(validation);
    var user = await CurrentUser(context, db);
    if (user is null) return Unauthorized();
    await using var connection = await db.OpenConnectionAsync();
    var eventOwner = await QueryOne<EventOwner>(connection, "SELECT id, created_by_user_id FROM events WHERE share_code = @code", ("code", code.ToUpperInvariant()));
    if (eventOwner is null) return Bad("This carpool no longer exists.");
    if (eventOwner.CreatorUserId != user.Id) return Forbidden();
    await UpdateEvent(connection, eventOwner.Id, input);
    return Results.Ok(new { ok = true });
});

eventsApi.MapDelete("/{code}", async (string code, HttpContext context, NpgsqlDataSource db) =>
{
    var user = await CurrentUser(context, db);
    if (user is null) return Unauthorized();
    await using var connection = await db.OpenConnectionAsync();
    var eventOwner = await QueryOne<EventOwner>(connection, "SELECT id, created_by_user_id FROM events WHERE share_code = @code", ("code", code.ToUpperInvariant()));
    if (eventOwner is null) return Results.Ok(new { ok = true });
    if (eventOwner.CreatorUserId != user.Id) return Forbidden();
    await Execute(connection, "DELETE FROM events WHERE id = @id", ("id", eventOwner.Id));
    return Results.Ok(new { ok = true });
});

app.Run();

static async Task<UserDto?> CurrentUser(HttpContext context, NpgsqlDataSource db)
{
    if (!context.Request.Cookies.TryGetValue("carpoolio_sid", out var token) || string.IsNullOrWhiteSpace(token)) return null;
    return await new CarpoolRepository(db).GetCurrentUser(CarpoolRules.Hash(token));
}

static async Task<UserDto> CreateIdentity(IdentityInput input, HttpContext context, NpgsqlDataSource db, PhoneProtector phones)
{
    var phone = CarpoolRules.NormalizePhone(input.Phone)!;
    var token = CarpoolRules.NewSessionToken();
    var user = await new CarpoolRepository(db).CreateUserWithSession(input.Username.Trim(), phones.Hash(phone), phones.Encrypt(phone), CarpoolRules.Hash(token));
    context.Response.Cookies.Append("carpoolio_sid", token, new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Lax, Secure = context.Request.IsHttps, Path = "/", MaxAge = TimeSpan.FromDays(365) });
    return user;
}

static async Task<string> CreateEvent(EventInput input, Guid userId, NpgsqlDataSource db)
{
    return await new CarpoolRepository(db).CreateEvent(input, userId, CarpoolRules.NewShareCode);
}

static async Task UpdateEvent(NpgsqlConnection connection, Guid id, EventInput input) => await Execute(connection, """
    UPDATE events SET name = @name, date = @date::date, time = @time::time, destination = @destination, updated_at = now() WHERE id = @id
    """, ("id", id), ("name", input.Name.Trim()), ("date", input.Date), ("time", CarpoolRules.NullIfEmpty(input.Time)), ("destination", CarpoolRules.NullIfEmpty(input.Destination)));

static async Task<EventPageDto?> GetEventPage(string code, UserDto? me, NpgsqlDataSource db)
{
    return await new CarpoolRepository(db).GetEventPage(code, me);
}

static IResult Bad(string message) => Results.BadRequest(new { message });
static IResult Unauthorized() => Results.Json(new { message = "We need your name and phone number first." }, statusCode: StatusCodes.Status401Unauthorized);
static IResult Forbidden() => Results.Json(new { message = "You're not allowed to do that." }, statusCode: StatusCodes.Status403Forbidden);

static async Task Execute(NpgsqlConnection connection, string sql, params (string Name, object? Value)[] parameters)
{
    await using var command = new NpgsqlCommand(sql, connection);
    foreach (var (name, value) in parameters) command.Parameters.AddWithValue(name, value ?? DBNull.Value);
    await command.ExecuteNonQueryAsync();
}
static async Task<T?> Scalar<T>(NpgsqlConnection connection, string sql, params (string Name, object? Value)[] parameters)
{
    await using var command = new NpgsqlCommand(sql, connection);
    foreach (var (name, value) in parameters) command.Parameters.AddWithValue(name, value ?? DBNull.Value);
    var result = await command.ExecuteScalarAsync();
    return result is null or DBNull ? default : (T)result;
}
static async Task<T?> QueryOne<T>(NpgsqlConnection connection, string sql, params (string Name, object? Value)[] parameters) where T : class
{
    await using var command = new NpgsqlCommand(sql, connection);
    foreach (var (name, value) in parameters) command.Parameters.AddWithValue(name, value ?? DBNull.Value);
    await using var reader = await command.ExecuteReaderAsync();
    if (!await reader.ReadAsync()) return null;
    return typeof(T).Name switch
    {
        nameof(UserDto) => new UserDto(reader.GetGuid(0), reader.GetString(1)) as T,
        nameof(CarOwner) => new CarOwner(reader.GetGuid(0), reader.GetGuid(1)) as T,
        nameof(CarForJoin) => new CarForJoin(reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetInt32(3)) as T,
        nameof(MemberOwner) => new MemberOwner(reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2)) as T,
        nameof(CarOwnerWithCreator) => new CarOwnerWithCreator(reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2)) as T,
        nameof(EventOwner) => new EventOwner(reader.GetGuid(0), reader.GetGuid(1)) as T,
        _ => throw new NotSupportedException(typeof(T).Name),
    };
}

namespace Carpoolio.Api
{
    public partial class Program;
}
