namespace Carpoolio.Api.Contracts;

public record UserDto(Guid Id, string Username);
public record EventDto(Guid Id, string Name, string Date, string? Time, string? Destination, string ShareCode);
public record PassengerDto(Guid Id, Guid UserId, string Username);
public record CarDto(Guid Id, Guid DriverUserId, string DriverName, int AvailableSeats, string PickupLocation, string? DepartureTime, string? Note, List<PassengerDto> Passengers);
public record EventPageDto(EventDto Event, bool IsCreator, UserDto? Me, List<CarDto> Cars);

internal record CarOwner(Guid Id, Guid DriverUserId);
internal record CarForJoin(Guid Id, Guid EventId, Guid DriverUserId, int AvailableSeats);
internal record MemberOwner(Guid Id, Guid DriverUserId, Guid CreatorUserId);
internal record CarOwnerWithCreator(Guid Id, Guid DriverUserId, Guid CreatorUserId);
internal record EventOwner(Guid Id, Guid CreatorUserId);