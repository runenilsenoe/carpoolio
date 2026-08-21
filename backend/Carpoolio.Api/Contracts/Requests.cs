namespace Carpoolio.Api.Contracts;

public record IdentityInput(string Username, string Phone);
public record EventInput(string Name, string Date, string? Time, string? Destination);
public record CreateEventWithIdentityInput(IdentityInput Identity, EventInput Event);
public record CarInput(int AvailableSeats, string PickupLocation, string? DepartureTime, string? Note);
