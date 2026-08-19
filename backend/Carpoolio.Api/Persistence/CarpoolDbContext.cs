using Microsoft.EntityFrameworkCore;

namespace Carpoolio.Api.Persistence;

public sealed class CarpoolDbContext(DbContextOptions<CarpoolDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<Car> Cars => Set<Car>();
    public DbSet<CarMember> CarMembers => Set<CarMember>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<User>(entity => { entity.ToTable("users"); entity.HasKey(x => x.Id); entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()"); entity.Property(x => x.Username).HasColumnName("username"); entity.Property(x => x.PhoneHash).HasColumnName("phone_hash"); entity.Property(x => x.PhoneEncrypted).HasColumnName("phone_encrypted"); });
        model.Entity<Session>(entity => { entity.ToTable("sessions"); entity.HasKey(x => x.TokenHash); entity.Property(x => x.TokenHash).HasColumnName("token_hash"); entity.Property(x => x.UserId).HasColumnName("user_id"); entity.Property(x => x.ExpiresAt).HasColumnName("expires_at"); entity.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId); });
        model.Entity<Event>(entity => { entity.ToTable("events"); entity.HasKey(x => x.Id); entity.Property(x => x.Id).HasColumnName("id"); entity.Property(x => x.Name).HasColumnName("name"); entity.Property(x => x.Date).HasColumnName("date"); entity.Property(x => x.Time).HasColumnName("time"); entity.Property(x => x.Destination).HasColumnName("destination"); entity.Property(x => x.ShareCode).HasColumnName("share_code"); entity.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id"); entity.HasIndex(x => x.ShareCode).IsUnique(); });
        model.Entity<Car>(entity => { entity.ToTable("cars"); entity.HasKey(x => x.Id); entity.Property(x => x.Id).HasColumnName("id"); entity.Property(x => x.EventId).HasColumnName("event_id"); entity.Property(x => x.DriverUserId).HasColumnName("driver_user_id"); entity.Property(x => x.AvailableSeats).HasColumnName("available_seats"); entity.Property(x => x.PickupLocation).HasColumnName("pickup_location"); entity.Property(x => x.DepartureTime).HasColumnName("departure_time"); entity.Property(x => x.Note).HasColumnName("note"); entity.HasIndex(x => new { x.EventId, x.DriverUserId }).IsUnique(); });
        model.Entity<CarMember>(entity => { entity.ToTable("car_members"); entity.HasKey(x => x.Id); entity.Property(x => x.Id).HasColumnName("id"); entity.Property(x => x.CarId).HasColumnName("car_id"); entity.Property(x => x.EventId).HasColumnName("event_id"); entity.Property(x => x.UserId).HasColumnName("user_id"); entity.HasIndex(x => new { x.EventId, x.UserId }).IsUnique(); });
    }
}

public sealed class User { public Guid Id { get; set; } public required string Username { get; set; } public required string PhoneHash { get; set; } public required string PhoneEncrypted { get; set; } }
public sealed class Session { public required string TokenHash { get; set; } public Guid UserId { get; set; } public DateTimeOffset ExpiresAt { get; set; } public User? User { get; set; } }
public sealed class Event { public Guid Id { get; set; } public required string Name { get; set; } public DateOnly Date { get; set; } public TimeOnly? Time { get; set; } public string? Destination { get; set; } public required string ShareCode { get; set; } public Guid CreatedByUserId { get; set; } }
public sealed class Car { public Guid Id { get; set; } public Guid EventId { get; set; } public Guid DriverUserId { get; set; } public int AvailableSeats { get; set; } public required string PickupLocation { get; set; } public TimeOnly? DepartureTime { get; set; } public string? Note { get; set; } }
public sealed class CarMember { public Guid Id { get; set; } public Guid CarId { get; set; } public Guid EventId { get; set; } public Guid UserId { get; set; } }
