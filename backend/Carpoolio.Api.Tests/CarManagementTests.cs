using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Carpoolio.Api.Contracts;
using Carpoolio.Api.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;
using Xunit;

namespace Carpoolio.Api.Tests;

[Collection("api")]
public class CarManagementTests(ApiFixture fixture)
{
    [Fact]
    public async Task Organiser_can_add_several_cars_while_guests_are_limited_to_one()
    {
        var organiser = Client();
        var code = await CreateEvent(organiser, "Olga");
        (await AddCar(organiser, code, "Oslo")).EnsureSuccessStatusCode();
        (await AddCar(organiser, code, "Drammen")).EnsureSuccessStatusCode();

        var guest = Client();
        await Identify(guest, "Gunnar");
        (await AddCar(guest, code, "Asker")).EnsureSuccessStatusCode();
        var second = await AddCar(guest, code, "Sandvika");

        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        Assert.Contains("already added a car", await second.Content.ReadAsStringAsync());
        Assert.Equal(3, (await Page(organiser, code)).cars.Count);
    }

    [Fact]
    public async Task Driver_and_organiser_can_add_passengers_with_a_note()
    {
        var organiser = Client();
        var code = await CreateEvent(organiser, "Olga");
        var driver = Client();
        await Identify(driver, "Dina");
        (await AddCar(driver, code, "Oslo", seats: 2)).EnsureSuccessStatusCode();
        var carId = (await Page(driver, code)).cars.Single().id;

        (await AddPassenger(driver, carId, "Per", "Needs a child seat")).EnsureSuccessStatusCode();
        (await AddPassenger(organiser, carId, "Pia", null)).EnsureSuccessStatusCode();
        var full = await AddPassenger(driver, carId, "Pål", null);

        Assert.Equal(HttpStatusCode.BadRequest, full.StatusCode);
        var passengers = (await Page(driver, code)).cars.Single().passengers;
        Assert.Equal(["Per", "Pia"], passengers.Select(p => p.username));
        Assert.Equal("Needs a child seat", passengers[0].note);
        Assert.Null(passengers[1].note);
    }

    [Fact]
    public async Task Other_guests_cannot_add_passengers()
    {
        var driver = Client();
        var code = await CreateEvent(driver, "Dina");
        (await AddCar(driver, code, "Oslo")).EnsureSuccessStatusCode();
        var carId = (await Page(driver, code)).cars.Single().id;
        var guest = Client();
        await Identify(guest, "Gunnar");

        var response = await AddPassenger(guest, carId, "Per", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Active_sessions_are_renewed_for_400_days()
    {
        var client = fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        var identify = await client.PostAsJsonAsync("/api/identity", new IdentityInput("Ada", "900 00 000"));
        identify.EnsureSuccessStatusCode();
        var cookie = identify.Headers.GetValues("Set-Cookie").Single().Split(';')[0];

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/me");
        request.Headers.Add("Cookie", cookie);
        var me = await client.SendAsync(request);

        me.EnsureSuccessStatusCode();
        Assert.Contains("max-age=34560000", me.Headers.GetValues("Set-Cookie").Single());
        await using var connection = await NpgsqlDataSource.Create(fixture.ConnectionString).OpenConnectionAsync();
        await using var command = new NpgsqlCommand("SELECT max(expires_at) > now() + interval '399 days' FROM sessions", connection);
        Assert.True((bool)(await command.ExecuteScalarAsync())!);
    }

    [Fact]
    public async Task Schema_upgrade_migrates_a_database_created_from_the_previous_schema()
    {
        await using (var admin = NpgsqlDataSource.Create(fixture.ConnectionString))
        await using (var drop = admin.CreateCommand("DROP DATABASE IF EXISTS legacy; "))
            await drop.ExecuteNonQueryAsync();
        await using (var admin = NpgsqlDataSource.Create(fixture.ConnectionString))
        await using (var create = admin.CreateCommand("CREATE DATABASE legacy"))
            await create.ExecuteNonQueryAsync();

        var legacy = new NpgsqlConnectionStringBuilder(fixture.ConnectionString) { Database = "legacy" }.ConnectionString;
        await using var db = NpgsqlDataSource.Create(legacy);
        var schema = await File.ReadAllTextAsync(ApiFixture.SchemaPath);
        await using (var setup = db.CreateCommand(schema + """

            ALTER TABLE cars ADD CONSTRAINT cars_event_id_driver_user_id_key UNIQUE (event_id, driver_user_id);
            ALTER TABLE car_members DROP COLUMN note;
            """))
            await setup.ExecuteNonQueryAsync();

        await SchemaUpgrade.ApplyAsync(db);
        await SchemaUpgrade.ApplyAsync(db);

        await using var check = db.CreateCommand("""
            SELECT
              NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cars_event_id_driver_user_id_key'),
              EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'car_members' AND column_name = 'note')
            """);
        await using var reader = await check.ExecuteReaderAsync();
        await reader.ReadAsync();
        Assert.True(reader.GetBoolean(0));
        Assert.True(reader.GetBoolean(1));
    }

    private HttpClient Client() => fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });

    private static async Task Identify(HttpClient client, string name) =>
        (await client.PostAsJsonAsync("/api/identity", new IdentityInput(name, "900 00 000"))).EnsureSuccessStatusCode();

    private static async Task<string> CreateEvent(HttpClient client, string organiser)
    {
        var response = await client.PostAsJsonAsync("/api/events/with-identity", new CreateEventWithIdentityInput(
            new IdentityInput(organiser, "900 00 000"), new EventInput("Cabin trip", "2026-10-10", "09:00", "Hemsedal")));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ShareCodeResponse>())!.share_code;
    }

    private static Task<HttpResponseMessage> AddCar(HttpClient client, string code, string pickup, int seats = 3) =>
        client.PostAsJsonAsync($"/api/events/{code}/cars", new { availableSeats = seats, pickupLocation = pickup });

    private static Task<HttpResponseMessage> AddPassenger(HttpClient client, System.Guid carId, string name, string? note) =>
        client.PostAsJsonAsync($"/api/cars/{carId}/passengers", new PassengerInput(name, "911 11 111", note));

    private static async Task<EventPageResponse> Page(HttpClient client, string code) =>
        (await client.GetFromJsonAsync<EventPageResponse>($"/api/events/{code}"))!;

    private sealed record ShareCodeResponse(string share_code);
    private sealed record EventPageResponse(List<CarResponse> cars);
    private sealed record CarResponse(System.Guid id, List<PassengerResponse> passengers);
    private sealed record PassengerResponse(string username, string? note);
}
