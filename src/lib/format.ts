import { format, parseISO } from "date-fns";
import { enGB, nb } from "date-fns/locale";
import type { Language } from "./translations";

export function formatEventDate(
  date: string,
  language: Language = "en",
): string {
  try {
    const d = parseISO(date);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return format(
      d,
      language === "nb"
        ? sameYear
          ? "EEEE d. MMMM"
          : "EEEE d. MMMM yyyy"
        : sameYear
          ? "EEEE, d MMMM"
          : "EEEE, d MMMM yyyy",
      { locale: language === "nb" ? nb : enGB },
    );
  } catch {
    return date;
  }
}

export function formatTime(time: string | null | undefined): string | null {
  if (!time) return null;
  return time.slice(0, 5);
}

export function seatsLabel(
  taken: number,
  total: number,
  language: Language = "en",
): string {
  if (language === "nb") return `${taken} av ${total} passasjerseter opptatt`;
  return `${taken} of ${total} passenger seat${total === 1 ? "" : "s"} taken`;
}
