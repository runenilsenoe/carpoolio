using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;

namespace Carpoolio.Api.Security;

public sealed class DashboardCredentials
{
    private readonly string _username;
    private readonly string _password;

    public DashboardCredentials(IConfiguration configuration)
    {
        _username = configuration["DASHBOARD_USERNAME"]
            ?? throw new InvalidOperationException("DASHBOARD_USERNAME is required.");
        _password = configuration["DASHBOARD_PASSWORD"]
            ?? throw new InvalidOperationException("DASHBOARD_PASSWORD is required.");
        if (string.IsNullOrWhiteSpace(_username) || string.IsNullOrWhiteSpace(_password))
            throw new InvalidOperationException("Dashboard credentials cannot be empty.");
    }

    public bool Authorizes(HttpRequest request)
    {
        if (!AuthenticationHeaderValue.TryParse(request.Headers.Authorization, out var header) ||
            !string.Equals(header.Scheme, "Basic", StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrWhiteSpace(header.Parameter)) return false;

        try
        {
            var value = Encoding.UTF8.GetString(Convert.FromBase64String(header.Parameter));
            var separator = value.IndexOf(':');
            if (separator < 0) return false;
            return SecureEquals(value[..separator], _username) && SecureEquals(value[(separator + 1)..], _password);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static bool SecureEquals(string actual, string expected)
    {
        var actualHash = SHA256.HashData(Encoding.UTF8.GetBytes(actual));
        var expectedHash = SHA256.HashData(Encoding.UTF8.GetBytes(expected));
        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }
}
