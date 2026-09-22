using System;
using System.Collections.Generic;
using System.Net.Http.Headers;
using System.Text;
using Carpoolio.Api.Observability;
using Carpoolio.Api.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Xunit;

namespace Carpoolio.Api.Tests;

public class DashboardTests
{
    [Fact]
    public void Dashboard_credentials_accept_only_the_configured_basic_login()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["DASHBOARD_USERNAME"] = "operator",
            ["DASHBOARD_PASSWORD"] = "correct horse battery staple",
        }).Build();
        var credentials = new DashboardCredentials(configuration);
        var request = new DefaultHttpContext().Request;
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes("operator:correct horse battery staple"))).ToString();

        Assert.True(credentials.Authorizes(request));

        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes("operator:wrong"))).ToString();
        Assert.False(credentials.Authorizes(request));
    }

    [Fact]
    public void Recent_log_store_keeps_the_latest_100_entries_and_full_exceptions()
    {
        var store = new RecentLogStore(new ConfigurationBuilder().Build());
        using var provider = new RecentLogLoggerProvider(store);
        var logger = provider.CreateLogger("Carpoolio.Tests");

        for (var index = 0; index < 104; index++)
            logger.LogInformation("Entry {Index}", index);
        logger.LogError(new InvalidOperationException("database exploded"), "Request failed");

        var entries = store.GetRecent();
        Assert.Equal(100, entries.Count);
        Assert.Equal("Request failed", entries[0].Message);
        Assert.Contains("InvalidOperationException", entries[0].Exception);
        Assert.Contains("database exploded", entries[0].Exception);
        Assert.DoesNotContain(entries, entry => entry.Message == "Entry 0");
    }
}
