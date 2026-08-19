import { useState } from "react";
import { Car, Clock, MoreHorizontal, Users } from "lucide-react";
import type { CarView } from "@/lib/carpool-types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatTime, seatsLabel } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Props = {
  car: CarView;
  meId: string | null;
  isEventCreator: boolean;
  destination: string | null;
  busy: boolean;
  onJoin: (car: CarView) => void;
  onAddPassenger: (car: CarView) => void;
  onLeave: (car: CarView) => void;
  onEdit: (car: CarView) => void;
  onDelete: (car: CarView) => void;
  onRemovePassenger: (memberId: string, name: string) => void;
};

export function CarCard({
  car,
  meId,
  isEventCreator,
  destination,
  busy,
  onJoin,
  onAddPassenger,
  onLeave,
  onEdit,
  onDelete,
  onRemovePassenger,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const isDriver = !!meId && meId === car.driverUserId;
  const isPassenger = !!meId && car.passengers.some((p) => p.userId === meId);
  const taken = car.passengers.length;
  const full = taken >= car.availableSeats;
  const canManage = isDriver || isEventCreator;
  const departure = formatTime(car.departureTime);

  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold">{car.driverName}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Car className="size-4" aria-hidden />
              {car.pickupLocation}
              {destination ? ` → ${destination}` : ""}
            </span>
            {departure ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden />
                Leaving {departure}
              </span>
            ) : null}
          </p>
        </div>
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 rounded-full"
                aria-label={`Manage ${car.driverName}'s car`}
              >
                <MoreHorizontal className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              <DropdownMenuItem
                disabled={full}
                onSelect={() => onAddPassenger(car)}
              >
                Add passenger
              </DropdownMenuItem>
              {isDriver ? (
                <DropdownMenuItem onSelect={() => onEdit(car)}>
                  Edit car
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onSelect={() => setConfirmDelete(true)}
                className="text-destructive focus:text-destructive"
              >
                {isDriver ? "Delete my car" : "Remove this car"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {car.note ? (
        <p className="mt-3 rounded-2xl bg-accent/60 px-3.5 py-2.5 text-sm text-accent-foreground">
          {car.note}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-2 text-sm font-medium">
        <Users className="size-4 text-muted-foreground" aria-hidden />
        <span className={full ? "text-muted-foreground" : ""}>
          {seatsLabel(taken, car.availableSeats)}
        </span>
      </div>

      {car.passengers.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {car.passengers.map((p) => (
            <li
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground"
            >
              {p.username}
              {p.userId === meId ? (
                <span className="text-muted-foreground">(you)</span>
              ) : null}
              {p.note ? (
                <span className="text-muted-foreground">· {p.note}</span>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  onClick={() =>
                    setRemoveTarget({ id: p.id, name: p.username })
                  }
                  className="ml-0.5 rounded-full px-1 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  aria-label={`Remove ${p.username}`}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5">
        {isDriver ? (
          <p className="text-sm font-medium text-primary">
            You're driving this car
          </p>
        ) : isPassenger ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-primary">
              You're riding with {car.driverName}
            </p>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirmLeave(true)}
              className="h-10 rounded-xl"
            >
              Leave car
            </Button>
          </div>
        ) : (
          <Button
            className="h-12 w-full rounded-xl text-base"
            disabled={full || busy}
            onClick={() => onJoin(car)}
          >
            {full ? "Car is full" : "Join this car"}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={
          isDriver ? "Delete your car?" : `Remove ${car.driverName}'s car?`
        }
        description="Everyone riding along will lose their seat. This can't be undone."
        confirmLabel="Delete car"
        onConfirm={() => onDelete(car)}
      />
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={`Leave ${car.driverName}'s car?`}
        description="Your seat will be freed up for someone else."
        confirmLabel="Leave car"
        onConfirm={() => onLeave(car)}
      />
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title={`Remove ${removeTarget?.name ?? ""}?`}
        description="They'll lose their seat in this car."
        confirmLabel="Remove"
        onConfirm={() => {
          if (removeTarget)
            onRemovePassenger(removeTarget.id, removeTarget.name);
        }}
      />
    </article>
  );
}
