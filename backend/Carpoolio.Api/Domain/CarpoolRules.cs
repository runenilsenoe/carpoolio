using System.Security.Cryptography;
using System.Text;
using Carpoolio.Api.Contracts;

namespace Carpoolio.Api.Domain;

public static class CarpoolRules
{
    private const string ShareAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public static string? Validate(IdentityInput input) =>
        string.IsNullOrWhiteSpace(input.Username) || input.Username.Trim().Length is < 2 or > 40
            ? "Name must be between 2 and 40 characters."
            : NormalizePhone(input.Phone) is null ? "Please enter a valid phone number." : null;

    public static string? Validate(EventInput input) =>
        string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length is < 2 or > 80
            ? "Please give the carpool a name."
            : !DateOnly.TryParseExact(input.Date, "yyyy-MM-dd", out _) ? "Please pick a date."
                : !ValidTime(input.Time) ? "Please pick a valid time."
                    : input.Destination?.Trim().Length > 80 ? "Destination is too long." : null;

    public static string? Validate(CarInput input) =>
        input.AvailableSeats is < 1 or > 20 ? "At least 1 seat is required."
        : string.IsNullOrWhiteSpace(input.PickupLocation) || input.PickupLocation.Trim().Length > 80 ? "Where do you start from?"
        : !ValidTime(input.DepartureTime) ? "Please pick a valid time."
        : input.Note?.Trim().Length > 200 ? "Note is too long." : null;

    public static string? NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        var value = new string(phone.Where(char.IsDigit).ToArray());
        if (phone.TrimStart().StartsWith("+") || phone.TrimStart().StartsWith("00")) value = value.TrimStart('0');
        if (value.Length == 8) value = "47" + value;
        return value.Length is >= 8 and <= 15 ? "+" + value : null;
    }

    public static string NewSessionToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    public static string NewShareCode() => string.Concat(RandomNumberGenerator.GetBytes(6).Select(b => ShareAlphabet[b % ShareAlphabet.Length]));
    public static string? NullIfEmpty(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static bool ValidTime(string? value) => string.IsNullOrWhiteSpace(value) || TimeOnly.TryParseExact(value, "HH:mm", out _);
}