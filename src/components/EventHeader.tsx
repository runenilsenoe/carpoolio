import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Settings2, Share2 } from "lucide-react";
import type { EventView } from "@/lib/carpool-types";
import { formatEventDate, formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";

type Props = {
  event: EventView;
  isCreator: boolean;
  onManage: () => void;
  onShare: () => void;
};

export function EventHeader({ event, isCreator, onManage, onShare }: Props) {
  const eventTime = formatTime(event.time);

  return (
    <header className="flex items-start justify-between gap-3">
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
          onClick={onShare}
          className="size-10 rounded-full"
          aria-label="Share this carpool"
        >
          <Share2 className="size-5" />
        </Button>
        {isCreator ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onManage}
            className="size-10 rounded-full"
            aria-label="Manage this carpool"
          >
            <Settings2 className="size-5" />
          </Button>
        ) : null}
      </div>
    </header>
  );
}
