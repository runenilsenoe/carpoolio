using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace Carpoolio.Api.Tests;

public sealed class ApiFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _database = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("carpoolio")
        .WithUsername("carpoolio")
        .WithPassword("test-password")
        .Build();

    public WebApplicationFactory<Program> Factory { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await _database.StartAsync();
        await using var connection = await NpgsqlDataSource.Create(_database.GetConnectionString()).OpenConnectionAsync();
        var schema = await File.ReadAllTextAsync(Path.Combine(Directory.GetCurrentDirectory(), "backend", "db", "init.sql"));
        await using var command = new NpgsqlCommand(schema, connection);
        await command.ExecuteNonQueryAsync();
        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => builder.UseEnvironment("Testing").ConfigureAppConfiguration(config =>
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["DATABASE_URL"] = _database.GetConnectionString(),
                ["PHONE_ENCRYPTION_KEY"] = Convert.ToBase64String(new byte[32]),
                ["PHONE_HASH_KEY"] = Convert.ToBase64String(Enumerable.Repeat((byte)1, 32).ToArray()),
                ["DASHBOARD_USERNAME"] = "dashboard-user",
                ["DASHBOARD_PASSWORD"] = "dashboard-password",
            })));
    }

    public async Task DisposeAsync()
    {
        Factory?.Dispose();
        await _database.DisposeAsync();
    }
}

[CollectionDefinition("api")]
public sealed class ApiCollection : ICollectionFixture<ApiFixture> { }
