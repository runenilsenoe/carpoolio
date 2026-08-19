import type { CarView, EventPage } from "./carpool-types";
import type { CarInput, EventInput, IdentityInput } from "./schemas";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

type ApiEventPage = {
  event: {
    id: string;
    name: string;
    date: string;
    time: string | null;
    destination: string | null;
    shareCode: string;
  };
  isCreator: boolean;
  me: { id: string; username: string } | null;
  cars: Array<{
    id: string;
    driverUserId: string;
    driverName: string;
    availableSeats: number;
    pickupLocation: string;
    departureTime: string | null;
    note: string | null;
    passengers: Array<{ id: string; userId: string; username: string }>;
  }>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const getIncomingRequest = createIsomorphicFn()
  .client(() => null)
  .server(() => getRequest());

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isServer = typeof window === "undefined";
  let url = `/api${path}`;
  const headers = new Headers(init?.headers);

  if (isServer) {
    const incoming = getIncomingRequest();
    if (!incoming)
      throw new Error("No request is available during server rendering.");
    const internalBase = process.env.CARPOOL_API_URL;
    url = internalBase
      ? `${internalBase}${path}`
      : new URL(`/api${path}`, incoming.url).toString();
    const cookie = incoming.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);
  }

  if (init?.body) headers.set("content-type", "application/json");
  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new ApiError(
      payload?.message ?? "Something went wrong. Please try again.",
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

function eventPage(data: ApiEventPage): EventPage {
  return {
    event: { ...data.event, share_code: data.event.shareCode },
    isCreator: data.isCreator,
    me: data.me,
    cars: data.cars.map((car): CarView => ({
      ...car,
      driverUserId: car.driverUserId,
      availableSeats: car.availableSeats,
      pickupLocation: car.pickupLocation,
      departureTime: car.departureTime,
    })),
  };
}

export const getMe = () =>
  request<{ id: string; username: string } | null>("/me");
export const createIdentity = (identity: IdentityInput) =>
  request<{ id: string; username: string }>("/identity", {
    method: "POST",
    body: JSON.stringify(identity),
  });
export const createEvent = (event: EventInput) =>
  request<{ share_code: string }>("/events", {
    method: "POST",
    body: JSON.stringify(event),
  });
export const createEventWithIdentity = (
  identity: IdentityInput,
  event: EventInput,
) =>
  request<{ share_code: string }>("/events/with-identity", {
    method: "POST",
    body: JSON.stringify({ identity, event }),
  });
export async function getEventPage(code: string): Promise<EventPage | null> {
  try {
    return eventPage(
      await request<ApiEventPage>(`/events/${encodeURIComponent(code)}`),
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
export const addCar = (code: string, car: CarInput) =>
  request("/events/" + encodeURIComponent(code) + "/cars", {
    method: "POST",
    body: JSON.stringify(carToApi(car)),
  });
export const updateCar = (carId: string, car: CarInput) =>
  request(`/cars/${carId}`, {
    method: "PATCH",
    body: JSON.stringify(carToApi(car)),
  });
export const joinCar = (carId: string) =>
  request(`/cars/${carId}/join`, { method: "POST" });
export const leaveCar = (carId: string) =>
  request(`/cars/${carId}/membership`, { method: "DELETE" });
export const removePassenger = (memberId: string) =>
  request(`/members/${memberId}`, { method: "DELETE" });
export const deleteCar = (carId: string) =>
  request(`/cars/${carId}`, { method: "DELETE" });
export const updateEvent = (code: string, event: EventInput) =>
  request(`/events/${encodeURIComponent(code)}`, {
    method: "PATCH",
    body: JSON.stringify(event),
  });
export const deleteEvent = (code: string) =>
  request(`/events/${encodeURIComponent(code)}`, { method: "DELETE" });

function carToApi(car: CarInput) {
  return {
    availableSeats: car.available_seats,
    pickupLocation: car.pickup_location,
    departureTime: car.departure_time,
    note: car.note,
  };
}
