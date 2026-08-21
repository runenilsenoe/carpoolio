import { useState } from "react";
import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router";
import { CalendarDays, MapPin, Plus, Settings2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CarCard } from "@/components/CarCard";
import { CarFormDialog } from "@/components/CarFormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  EventFormFields,
  type EventFormState,
} from "@/components/EventFormFields";
import { IdentityDialog } from "@/components/IdentityDialog";
import {
  addCar,
  deleteCar,
  deleteEvent,
  getEventPage,
  joinCar,
  leaveCar,
  removePassenger,
  updateCar,
  updateEvent,
} from "@/lib/api";
import type { CarView } from "@/lib/carpool-types";
import type { CarInput } from "@/lib/schemas";
import { eventSchema } from "@/lib/schemas";
import { formatEventDate, formatTime, seatsLabel } from "@/lib/format";
import { errorMessage } from "@/lib/error-message";

export const Route = createFileRoute("/e/$code")({
  loader: async ({ params }) => {
    const data = await getEventPage(params.code);
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Carpool not found — Carpoolio" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { event } = loaderData;
    const where = event.destination ? ` to ${event.destination}` : "";
    const title = `${event.name} — Carpoolio`;
    const description = `See who's driving${where} on ${formatEventDate(event.date)} and grab a seat.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  notFoundComponent: EventNotFound,
  component: EventPage,
});

function EventNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-4xl">Carpool not found</h1>
      <p className="mt-3 text-muted-foreground">
        This link may have expired or the carpool was deleted.
      </p>
      <Button asChild className="mt-8 h-12 rounded-2xl">
        <Link to="/">Go to Carpoolio</Link>
      </Button>
    </main>
  );
}

type PendingAction = (() => Promise<void>) | null;

function EventPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const { event, cars, me, isCreator } = data;

  const [busy, setBusy] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [afterIdentity, setAfterIdentity] = useState<PendingAction>(null);
  const [carFormOpen, setCarFormOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<CarView | null>(null);
  const [joinTarget, setJoinTarget] = useState<CarView | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [deleteEventOpen, setDeleteEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState<EventFormState>({
    name: event.name,
    date: event.date,
    time: formatTime(event.time) ?? "",
    destination: event.destination ?? "",
  });
  const [eventError, setEventError] = useState<string | null>(null);

  const myCar = me ? cars.find((c) => c.driverUserId === me.id) : undefined;
  const eventTime = formatTime(event.time);

  async function refresh() {
    await router.invalidate();
  }

  /** Runs an action, asking for identity first when the visitor has none. */
  function withIdentity(action: () => Promise<void>) {
    if (!me) {
      setAfterIdentity(() => action);
      setIdentityOpen(true);
      return;
    }
    void action();
  }

  async function guarded(fn: () => Promise<void>, success?: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await refresh();
      if (success) toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function handleAddCarClick() {
    withIdentity(async () => {
      setEditingCar(null);
      setCarFormOpen(true);
    });
  }

  async function submitCar(values: CarInput) {
    if (editingCar) {
      await updateCar(editingCar.id, values);
      toast.success("Car updated");
    } else {
      await addCar(event.share_code, values);
      toast.success("Your car is on the list");
    }
    await refresh();
  }

  function handleJoin(car: CarView) {
    withIdentity(async () => setJoinTarget(car));
  }

  async function confirmJoin() {
    const car = joinTarget;
    if (!car) return;
    setJoinTarget(null);
    await guarded(
      () => joinCar(car.id).then(() => undefined),
      `You're riding with ${car.driverName}`,
    );
  }

  async function saveEvent() {
    const parsed = eventSchema.safeParse(eventForm);
    if (!parsed.success) {
      setEventError(
        parsed.error.issues[0]?.message ?? "Please check the details.",
      );
      return;
    }
    setEventError(null);
    await guarded(
      () => updateEvent(event.share_code, parsed.data).then(() => undefined),
      "Carpool updated",
    );
    setManageOpen(false);
  }

  async function shareEvent() {
    const url = `${window.location.origin}/e/${event.share_code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.name, url });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pt-8 pb-28">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/"
            className="text-sm font-semibold tracking-tight text-primary"
          >
            Carpoolio
          </Link>
          <h1 className="mt-3 font-display text-4xl leading-tight text-balance">
            {event.name}
          </h1>
          <p className="mt-3 flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="size-4 shrink-0" aria-hidden />
            <span>
              {formatEventDate(event.date)}
              {eventTime ? ` · ${eventTime}` : ""}
            </span>
          </p>
          {event.destination ? (
            <p className="mt-1.5 flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {event.destination}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={shareEvent}
            className="size-10 rounded-full"
            aria-label="Share this carpool"
          >
            <Share2 className="size-5" />
          </Button>
          {isCreator ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setManageOpen(true)}
              className="size-10 rounded-full"
              aria-label="Manage this carpool"
            >
              <Settings2 className="size-5" />
            </Button>
          ) : null}
        </div>
      </div>

      <section aria-label="Cars" className="mt-8 space-y-4">
        {cars.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
            <p className="font-display text-2xl">No cars yet</p>
            <p className="mt-2 text-muted-foreground">Be the first to drive!</p>
            <Button
              onClick={handleAddCarClick}
              className="mt-6 h-12 rounded-2xl px-6 text-base"
            >
              <Plus className="size-5" aria-hidden />
              Add a car
            </Button>
          </div>
        ) : (
          cars.map((car) => (
            <CarCard
              key={car.id}
              car={car}
              meId={me?.id ?? null}
              isEventCreator={isCreator}
              destination={event.destination}
              busy={busy}
              onJoin={handleJoin}
              onLeave={(c) =>
                guarded(
                  () => leaveCar(c.id).then(() => undefined),
                  "You left the car",
                )
              }
              onEdit={(c) => {
                setEditingCar(c);
                setCarFormOpen(true);
              }}
              onDelete={(c) =>
                guarded(
                  () => deleteCar(c.id).then(() => undefined),
                  "Car removed",
                )
              }
              onRemovePassenger={(memberId, name) =>
                guarded(
                  () => removePassenger(memberId).then(() => undefined),
                  `${name} was removed`,
                )
              }
            />
          ))
        )}
      </section>

      {cars.length > 0 && !myCar ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-md">
            <Button
              onClick={handleAddCarClick}
              variant="outline"
              className="h-13 w-full rounded-2xl bg-card py-3.5 text-base"
            >
              <Plus className="size-5" aria-hidden />
              Add a car
            </Button>
          </div>
        </div>
      ) : null}

      <IdentityDialog
        open={identityOpen}
        onOpenChange={(open) => {
          setIdentityOpen(open);
          if (!open) setAfterIdentity(null);
        }}
        onIdentified={async () => {
          await refresh();
          const action = afterIdentity;
          setAfterIdentity(null);
          if (action) await action();
        }}
      />

      <CarFormDialog
        open={carFormOpen}
        onOpenChange={setCarFormOpen}
        driverName={me?.username ?? "you"}
        title={editingCar ? "Edit your car" : "Add your car"}
        submitLabel={editingCar ? "Save changes" : "Add car"}
        initial={
          editingCar
            ? {
                available_seats: editingCar.availableSeats,
                pickup_location: editingCar.pickupLocation,
                departure_time: formatTime(editingCar.departureTime) ?? "",
                note: editingCar.note ?? "",
              }
            : null
        }
        onSubmit={submitCar}
      />

      <Dialog
        open={!!joinTarget}
        onOpenChange={(o) => !o && setJoinTarget(null)}
      >
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Join {joinTarget?.driverName}'s car?
            </DialogTitle>
            <DialogDescription>
              {joinTarget?.pickupLocation}
              {event.destination ? ` → ${event.destination}` : ""}
              {joinTarget?.departureTime
                ? ` · Leaving ${formatTime(joinTarget.departureTime)}`
                : ""}
              <br />1 seat will be reserved for you.
              {joinTarget
                ? ` (${seatsLabel(joinTarget.passengers.length, joinTarget.availableSeats)})`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={confirmJoin}
            disabled={busy}
            className="h-12 w-full rounded-xl text-base"
          >
            {busy ? "Joining…" : "Join car"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Manage carpool
            </DialogTitle>
            <DialogDescription>
              Only you, as the organiser, can see this.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <EventFormFields value={eventForm} onChange={setEventForm} />
            {eventError ? (
              <p role="alert" className="text-sm text-destructive">
                {eventError}
              </p>
            ) : null}
            <Button
              onClick={saveEvent}
              disabled={busy}
              className="h-12 w-full rounded-xl text-base"
            >
              Save changes
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDeleteEventOpen(true)}
              className="h-11 w-full rounded-xl text-destructive hover:text-destructive"
            >
              Delete carpool
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteEventOpen}
        onOpenChange={setDeleteEventOpen}
        title="Delete this carpool?"
        description="All cars and passengers will be removed and the link will stop working."
        confirmLabel="Delete carpool"
        onConfirm={() => {
          void (async () => {
            try {
              await deleteEvent(event.share_code);
              toast.success("Carpool deleted");
              await router.navigate({ to: "/" });
            } catch (err) {
              toast.error(errorMessage(err));
            }
          })();
        }}
      />
    </main>
  );
}
