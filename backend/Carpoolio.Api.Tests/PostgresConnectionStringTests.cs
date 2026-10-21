using System;
using Carpoolio.Api.Persistence;
using Npgsql;
using Xunit;

namespace Carpoolio.Api.Tests;

public class PostgresConnectionStringTests
{
    [Theory]
    [InlineData("DATABASE_URL=Host=db;Database=carpoolio;Username=app;Password=secret")]
    [InlineData(" DATABASE_URL=\"Host=db;Database=carpoolio;Username=app;Password=secret\" ")]
    [InlineData("DATABASE_URL='postgres://app:secret@db/carpoolio'")]
    [InlineData("database_url=postgresql://app:secret@db/carpoolio")]
    public void Accepts_pasted_environment_assignments(string value)
    {
        var parsed = new NpgsqlConnectionStringBuilder(PostgresConnectionString.Parse(value));

        Assert.Equal("db", parsed.Host);
        Assert.Equal("carpoolio", parsed.Database);
        Assert.Equal("app", parsed.Username);
        Assert.Equal("secret", parsed.Password);
    }

    [Theory]
    [InlineData("postgres")]
    [InlineData("postgresql")]
    public void Accepts_Coolify_database_URLs(string scheme)
    {
        var parsed = new NpgsqlConnectionStringBuilder(PostgresConnectionString.Parse(
            $"{scheme}://carpool:p%40ss%3Aword%3B%2B@postgres.internal:5433/carpool%20db?sslmode=require&connect_timeout=15"));

        Assert.Equal("postgres.internal", parsed.Host);
        Assert.Equal(5433, parsed.Port);
        Assert.Equal("carpool db", parsed.Database);
        Assert.Equal("carpool", parsed.Username);
        Assert.Equal("p@ss:word;+", parsed.Password);
        Assert.Equal(SslMode.Require, parsed.SslMode);
        Assert.Equal(15, parsed.Timeout);
    }

    [Fact]
    public void Preserves_existing_Npgsql_configuration()
    {
        var parsed = new NpgsqlConnectionStringBuilder(PostgresConnectionString.Parse(
            "Host=db;Database=carpoolio;Username=app;Password=secret;Pooling=false"));

        Assert.Equal("db", parsed.Host);
        Assert.Equal("secret", parsed.Password);
        Assert.False(parsed.Pooling);
    }

    [Fact]
    public void Uses_default_port_and_supports_IPv6()
    {
        var parsed = new NpgsqlConnectionStringBuilder(PostgresConnectionString.Parse(
            "postgres://app:secret@[::1]/carpoolio"));

        Assert.Equal("::1", parsed.Host);
        Assert.Equal(5432, parsed.Port);
    }

    [Theory]
    [InlineData("postgres://app:secret@db/")]
    [InlineData("postgres://app:secret@db/carpoolio#fragment")]
    [InlineData("postgres://app:secret@db/carpoolio?unknown=value")]
    public void Rejects_invalid_URLs_without_exposing_credentials(string url)
    {
        var error = Assert.Throws<ArgumentException>(() => PostgresConnectionString.Parse(url));
        Assert.DoesNotContain("secret", error.Message);
    }
}
