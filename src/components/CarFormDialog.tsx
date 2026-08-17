import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { carSchema, type CarInput } from "@/lib/schemas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverName: string;
  initial?: Partial<CarInput> | null;
  submitLabel: string;
  title: string;
  onSubmit: (values: CarInput) => Promise<void>;
};

export function CarFormDialog({
  open,
  onOpenChange,
  driverName,
  initial,
  submitLabel,
  title,
  onSubmit,
}: Props) {
  const [seats, setSeats] = useState("3");
  const [pickup, setPickup] = useState("");
  const [departure, setDeparture] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSeats(String(initial?.available_seats ?? 3));
    setPickup(initial?.pickup_location ?? "");
    setDeparture(initial?.departure_time ?? "");
    setNote(initial?.note ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const parsed = carSchema.safeParse({
      available_seats: seats,
      pickup_location: pickup,
      departure_time: departure,
      note,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the details.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit(parsed.data);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription>
            Driving as <span className="font-medium text-foreground">{driverName}</span>. Seats
            below are for passengers — you're not counted.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="car-seats">Passenger seats</Label>
            <Input
              id="car-seats"
              type="number"
              min={1}
              max={20}
              inputMode="numeric"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="car-pickup">Starting point</Label>
            <Input
              id="car-pickup"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              placeholder="Oslo"
              maxLength={80}
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="car-departure">
              Departure <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="car-departure"
              type="time"
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="car-note">
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="car-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Can pick people up near Oslo S."
              maxLength={200}
              rows={2}
              className="rounded-xl"
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl text-base">
            {pending ? "Saving…" : submitLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
