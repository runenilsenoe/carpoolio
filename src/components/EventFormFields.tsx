import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EventFormState = {
  name: string;
  date: string;
  time: string;
  destination: string;
};

type Props = {
  value: EventFormState;
  onChange: (next: EventFormState) => void;
};

export function EventFormFields({ value, onChange }: Props) {
  const set = (patch: Partial<EventFormState>) =>
    onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="event-name">Event name</Label>
        <Input
          id="event-name"
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Egde Summer Party"
          maxLength={80}
          className="h-12 rounded-xl"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="event-date">Date</Label>
          <Input
            id="event-date"
            type="date"
            value={value.date}
            onChange={(e) => set({ date: e.target.value })}
            className="h-12 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-time">
            Time <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="event-time"
            type="time"
            value={value.time}
            onChange={(e) => set({ time: e.target.value })}
            className="h-12 rounded-xl"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="event-destination">
          Destination <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="event-destination"
          value={value.destination}
          onChange={(e) => set({ destination: e.target.value })}
          placeholder="Kristiansand"
          maxLength={80}
          className="h-12 rounded-xl"
        />
      </div>
    </div>
  );
}
