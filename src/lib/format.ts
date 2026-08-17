import { format, parseISO } from "date-fns";

/** "Friday, 21 August" (adds year when it isn't the current one). */
export function formatEventDate(date: string): string {
  try {
    const d = parseISO(date);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return format(d, sameYear ? "EEEE, d MMMM" : "EEEE, d MMMM yyyy");
  } catch {
    return date;
  }
}

/** "18:00" from "18:00:00" */
export function formatTime(time: string | null | undefined): string | null {
  if (!time) return null;
  return time.slice(0, 5);
}

export function seatsLabel(taken: number, total: number): string {
  return `${taken} of ${total} passenger seat${total === 1 ? "" : "s"} taken`;
}
