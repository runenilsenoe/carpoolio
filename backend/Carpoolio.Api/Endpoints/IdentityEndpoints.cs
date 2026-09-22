using Carpoolio.Api.Contracts;
using Carpoolio.Api.Domain;
using Carpoolio.Api.Repositories;
using Carpoolio.Api.Security;

namespace Carpoolio.Api.Endpoints;

public static class IdentityEndpoints
{
    public static RouteGroupBuilder MapIdentityEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("").WithTags("Identity");
        group.MapGet("/me", async (HttpContext context, CarpoolRepository repository) =>
        {
            var user = await SessionCookie.CurrentUser(context, repository);
            return user is null
                ? Results.Text("null", "application/json")
                : Results.Json(user);
        });
        group.MapPost("/identity", async (IdentityInput input, HttpContext context, CarpoolRepository repository, PhoneProtector phones) =>
        {
            var error = CarpoolRules.Validate(input);
            if (error is not null) return Results.BadRequest(new { message = error });
            var phone = CarpoolRules.NormalizePhone(input.Phone)!;
            var token = CarpoolRules.NewSessionToken();
            var user = await repository.CreateUserWithSession(input.Username.Trim(), phones.Hash(phone), phones.Encrypt(phone), CarpoolRules.Hash(token));
            SessionCookie.Append(context, token);
            return Results.Ok(user);
        }).RequireRateLimiting("writes");
        return group;
    }
}
