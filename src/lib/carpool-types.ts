export type Passenger = {
  id: string;
  userId: string;
  username: string;
  note: string | null;
};

export type CarView = {
  id: string;
  driverUserId: string;
  driverName: string;
  availableSeats: number;
  pickupLocation: string;
  departureTime: string | null;
  note: string | null;
  passengers: Passenger[];
};

export type EventView = {
  id: string;
  name: string;
  date: string;
  time: string | null;
  destination: string | null;
  share_code: string;
};

export type EventPage = {
  event: EventView;
  isCreator: boolean;
  me: { id: string; username: string } | null;
  cars: CarView[];
};
