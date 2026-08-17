import { createServerFn } from "@tanstack/react-start";
import { identitySchema, eventSchema, carSchema } from "./schemas";
import type { EventPage } from "./carpool-types";

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const { getCurrentUser } = await import("./session.server");
  return await getCurrentUser();
});

export const createIdentity = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => identitySchema.parse(data))
  .handler(async ({ data }) => {
    const { createIdentitySession } = await import("./session.server");
    return await createIdentitySession(data.username, data.phone);
  });

export const createEvent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => eventSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireCurrentUser, generateShareCode } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await requireCurrentUser();

    for (let attempt = 0; attempt < 5; attempt++) {
      const share_code = generateShareCode();
      const { data: event, error } = await supabaseAdmin
        .from("events")
        .insert({
          name: data.name,
          date: data.date,
          time: data.time ? data.time : null,
          destination: data.destination ? data.destination : null,
          share_code,
          created_by_user_id: user.id,
        })
        .select("share_code")
        .single();
      if (!error && event) return { share_code: event.share_code };
      if (error && error.code !== "23505") throw new Error("Could not create the carpool.");
    }
    throw new Error("Could not create the carpool. Please try again.");
  });

export const createEventWithIdentity = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const raw = data as { identity?: unknown; event?: unknown };
    return {
      identity: identitySchema.parse(raw.identity),
      event: eventSchema.parse(raw.event),
    };
  })
  .handler(async ({ data }) => {
    const { createIdentitySession, generateShareCode } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await createIdentitySession(data.identity.username, data.identity.phone);

    for (let attempt = 0; attempt < 5; attempt++) {
      const share_code = generateShareCode();
      const { data: event, error } = await supabaseAdmin
        .from("events")
        .insert({
          name: data.event.name,
          date: data.event.date,
          time: data.event.time ? data.event.time : null,
          destination: data.event.destination ? data.event.destination : null,
          share_code,
          created_by_user_id: user.id,
        })
        .select("share_code")
        .single();
      if (!error && event) return { share_code: event.share_code };
      if (error && error.code !== "23505") throw new Error("Could not create the carpool.");
    }
    throw new Error("Could not create the carpool. Please try again.");
  });

export const getEventPage = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => ({ code: String((data as { code: string }).code) }))
  .handler(async ({ data }): Promise<EventPage | null> => {
    const { getCurrentUser } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id, name, date, time, destination, share_code, created_by_user_id")
      .eq("share_code", data.code.toUpperCase())
      .maybeSingle();
    if (!event) return null;

    const me = await getCurrentUser();

    const { data: cars } = await supabaseAdmin
      .from("cars")
      .select(
        "id, driver_user_id, available_seats, pickup_location, departure_time, note, created_at, users!cars_driver_user_id_fkey(username), car_members(id, user_id, created_at, users(username))",
      )
      .eq("event_id", event.id)
      .order("created_at", { ascending: true });

    type RawCar = {
      id: string;
      driver_user_id: string;
      available_seats: number;
      pickup_location: string;
      departure_time: string | null;
      note: string | null;
      users: { username: string } | null;
      car_members: Array<{
        id: string;
        user_id: string;
        created_at: string;
        users: { username: string } | null;
      }>;
    };

    return {
      event: {
        id: event.id,
        name: event.name,
        date: event.date,
        time: event.time,
        destination: event.destination,
        share_code: event.share_code,
      },
      isCreator: !!me && me.id === event.created_by_user_id,
      me,
      cars: ((cars ?? []) as unknown as RawCar[]).map((car) => ({
        id: car.id,
        driverUserId: car.driver_user_id,
        driverName: car.users?.username ?? "Driver",
        availableSeats: car.available_seats,
        pickupLocation: car.pickup_location,
        departureTime: car.departure_time,
        note: car.note,
        passengers: [...car.car_members]
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((m) => ({
            id: m.id,
            userId: m.user_id,
            username: m.users?.username ?? "Passenger",
          })),
      })),
    };
  });

export const addCar = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const raw = data as { code: string } & Record<string, unknown>;
    return { code: String(raw.code), car: carSchema.parse(raw) };
  })
  .handler(async ({ data }) => {
    const { requireCurrentUser } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await requireCurrentUser();

    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("share_code", data.code.toUpperCase())
      .maybeSingle();
    if (!event) throw new Error("This carpool no longer exists.");

    const { error } = await supabaseAdmin.from("cars").insert({
      event_id: event.id,
      driver_user_id: user.id,
      available_seats: data.car.available_seats,
      pickup_location: data.car.pickup_location,
      departure_time: data.car.departure_time ? data.car.departure_time : null,
      note: data.car.note ? data.car.note : null,
    });
    if (error) {
      if (error.code === "23505") throw new Error("You already added a car to this carpool.");
      throw new Error("Could not add your car.");
    }
    return { ok: true };
  });

export const updateCar = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const raw = data as { carId: string } & Record<string, unknown>;
    return { carId: String(raw.carId), car: carSchema.parse(raw) };
  })
  .handler(async ({ data }) => {
    const { requireCurrentUser } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await requireCurrentUser();

    const { data: car } = await supabaseAdmin
      .from("cars")
      .select("id, driver_user_id")
      .eq("id", data.carId)
      .maybeSingle();
    if (!car) throw new Error("This car no longer exists.");
    if (car.driver_user_id !== user.id) throw new Error("Only the driver can edit this car.");

    const { count } = await supabaseAdmin
      .from("car_members")
      .select("id", { count: "exact", head: true })
      .eq("car_id", car.id);
    if ((count ?? 0) > data.car.available_seats) {
      throw new Error(
        `You already have ${count} passengers. Remove someone before lowering the seat count.`,
      );
    }

    const { error } = await supabaseAdmin
      .from("cars")
      .update({
        available_seats: data.car.available_seats,
        pickup_location: data.car.pickup_location,
        departure_time: data.car.departure_time ? data.car.departure_time : null,
        note: data.car.note ? data.car.note : null,
      })
      .eq("id", car.id);
    if (error) throw new Error("Could not save your changes.");
    return { ok: true };
  });

export const joinCar = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ({ carId: String((data as { carId: string }).carId) }))
  .handler(async ({ data }) => {
    const { requireCurrentUser } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await requireCurrentUser();

    const { data: result, error } = await supabaseAdmin.rpc("join_car", {
      _car_id: data.carId,
      _user_id: user.id,
    });
    if (error) throw new Error("Could not join this car. Please try again.");
    if (result === "full") throw new Error("Sorry — that was the last seat and it just went.");
    if (result === "is_driver") throw new Error("You're the driver of this car.");
    if (result === "not_found") throw new Error("This car no longer exists.");
    return { ok: true };
  });

export const leaveCar = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ({ carId: String((data as { carId: string }).carId) }))
  .handler(async ({ data }) => {
    const { requireCurrentUser } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await requireCurrentUser();
    const { error } = await supabaseAdmin
      .from("car_members")
      .delete()
      .eq("car_id", data.carId)
      .eq("user_id", user.id);
    if (error) throw new Error("Could not leave the car.");
    return { ok: true };
  });

export const removePassenger = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const raw = data as { memberId: string };
    return { memberId: String(raw.memberId) };
  })
  .handler(async ({ data }) => {
    const { requireCurrentUser } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await requireCurrentUser();

    const { data: member } = await supabaseAdmin
      .from("car_members")
      .select("id, cars!inner(driver_user_id, events!inner(created_by_user_id))")
      .eq("id", data.memberId)
      .maybeSingle();
    if (!member) throw new Error("That passenger is already gone.");
    const car = member.cars as unknown as {
      driver_user_id: string;
      events: { created_by_user_id: string };
    };
    if (car.driver_user_id !== user.id && car.events.created_by_user_id !== user.id) {
      throw new Error("You're not allowed to do that.");
    }
    await supabaseAdmin.from("car_members").delete().eq("id", data.memberId);
    return { ok: true };
  });

export const deleteCar = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ({ carId: String((data as { carId: string }).carId) }))
  .handler(async ({ data }) => {
    const { requireCurrentUser } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await requireCurrentUser();

    const { data: car } = await supabaseAdmin
      .from("cars")
      .select("id, driver_user_id, events!inner(created_by_user_id)")
      .eq("id", data.carId)
      .maybeSingle();
    if (!car) return { ok: true };
    const event = car.events as unknown as { created_by_user_id: string };
    if (car.driver_user_id !== user.id && event.created_by_user_id !== user.id) {
      throw new Error("You're not allowed to do that.");
    }
    await supabaseAdmin.from("cars").delete().eq("id", car.id);
    return { ok: true };
  });

export const updateEvent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const raw = data as { code: string } & Record<string, unknown>;
    return { code: String(raw.code), event: eventSchema.parse(raw) };
  })
  .handler(async ({ data }) => {
    const { requireCurrentUser } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await requireCurrentUser();

    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id, created_by_user_id")
      .eq("share_code", data.code.toUpperCase())
      .maybeSingle();
    if (!event) throw new Error("This carpool no longer exists.");
    if (event.created_by_user_id !== user.id) throw new Error("You're not allowed to do that.");

    const { error } = await supabaseAdmin
      .from("events")
      .update({
        name: data.event.name,
        date: data.event.date,
        time: data.event.time ? data.event.time : null,
        destination: data.event.destination ? data.event.destination : null,
      })
      .eq("id", event.id);
    if (error) throw new Error("Could not save your changes.");
    return { ok: true };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ({ code: String((data as { code: string }).code) }))
  .handler(async ({ data }) => {
    const { requireCurrentUser } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await requireCurrentUser();

    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id, created_by_user_id")
      .eq("share_code", data.code.toUpperCase())
      .maybeSingle();
    if (!event) return { ok: true };
    if (event.created_by_user_id !== user.id) throw new Error("You're not allowed to do that.");
    await supabaseAdmin.from("events").delete().eq("id", event.id);
    return { ok: true };
  });
