using Carpoolio.Api.Contracts;
using Carpoolio.Api.Domain;
using Carpoolio.Api.Repositories;

namespace Carpoolio.Api.Security;

public static class SessionCookie
{
    public const string Name = "carpoolio_sid";
    // Browsers cap cookie lifetimes at 400 days; the session slides forward while it is in use.
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(400);

    public static void Append(HttpContext context, string token) =>
        context.Response.Cookies.Append(Name, token, new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Lax, Secure = context.Request.IsHttps, Path = "/", MaxAge = Lifetime });

    public static async Task<UserDto?> CurrentUser(HttpContext context, CarpoolRepository repository)
    {
        if (!context.Request.Cookies.TryGetValue(Name, out var token) || string.IsNullOrWhiteSpace(token)) return null;
        var tokenHash = CarpoolRules.Hash(token);
        var user = await repository.GetCurrentUser(tokenHash);
        if (user is null)
        {
            context.Response.Cookies.Delete(Name, new CookieOptions { Path = "/" });
            return null;
        }
        await repository.RenewSession(tokenHash, Lifetime);
        Append(context, token);
        return user;
    }
}
