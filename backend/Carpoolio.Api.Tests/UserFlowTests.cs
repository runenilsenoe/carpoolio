using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Threading.Tasks;
using Carpoolio.Api.Contracts;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Carpoolio.Api.Tests;

[Collection("api")]
public class UserFlowTests(ApiFixture fixture)
{
    [Fact]
    public async Task Dashboard_requires_basic_authentication()
    {
        var response = await fixture.Factory.CreateClient().GetAsync("/dashboard");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Contains(response.Headers.WwwAuthenticate, value => value.Scheme == "Basic");
    }

    [Fact]
    public async Task Dashboard_shows_metrics_and_recent_logs_to_an_authenticated_operator()
    {
        var client = fixture.Factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/dashboard");
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes("dashboard-user:dashboard-password")));

        var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        var html = await response.Content.ReadAsStringAsync();

        Assert.Contains("Brukere totalt", html);
        Assert.Contains("Samkjøringer totalt", html);
        Assert.Contains("Siste 100 loggoppføringer", html);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task Anonymous_me_is_returned_as_json_null()
    {
        var response = await fixture.Factory.CreateClient().GetAsync("/api/me");

        response.EnsureSuccessStatusCode();
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("null", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Visitor_can_create_event_add_car_and_view_it()
    {
        var client = fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });
        var create = await client.PostAsJsonAsync("/api/events/with-identity", new CreateEventWithIdentityInput(
            new IdentityInput("Ada", "900 00 000"), new EventInput("Cabin trip", "2026-10-10", "09:00", "Hemsedal")));
        create.EnsureSuccessStatusCode();
        var created = await create.Content.ReadFromJsonAsync<ShareCodeResponse>();
        Assert.NotNull(created);

        var addCar = await client.PostAsJsonAsync($"/api/events/{created!.share_code}/cars", new { availableSeats = 3, pickupLocation = "Oslo", departureTime = "08:00" });
        addCar.EnsureSuccessStatusCode();

        var page = await client.GetFromJsonAsync<EventPageResponse>($"/api/events/{created.share_code}");
        Assert.NotNull(page);
        Assert.True(page!.isCreator);
        Assert.Single(page.cars);
        Assert.Equal("Ada", page.cars[0].driverName);
    }

    [Fact]
    public async Task Anonymous_visitor_cannot_create_event()
    {
        var response = await fixture.Factory.CreateClient().PostAsJsonAsync("/api/events", new EventInput("Trip", "2026-10-10", null, null));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private sealed record ShareCodeResponse(string share_code);
    private sealed record EventPageResponse(bool isCreator, List<CarResponse> cars);
    private sealed record CarResponse(string driverName);
}
