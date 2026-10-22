import { usePreferences } from "@/components/Preferences";
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  EventFormFields,
  type EventFormState,
} from "@/components/EventFormFields";
import { IdentityDialog } from "@/components/IdentityDialog";
import { createEvent, createEventWithIdentity, getMe } from "@/lib/api";
import { eventSchema } from "@/lib/schemas";
import { errorMessage } from "@/lib/error-message";
export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "Create a carpool — Carpoolio" },
      {
        name: "description",
        content:
          "Name your event, pick a date, and get a link to share with everyone coming.",
      },
      { property: "og:title", content: "Create a carpool — Carpoolio" },
      {
        property: "og:description",
        content: "Name your event, pick a date, and get a link to share.",
      },
    ],
  }),
  loader: () => getMe(),
  component: NewEvent,
});
function NewEvent() {
  const { t } = usePreferences();
  const me = Route.useLoaderData();
  const navigate = useNavigate();
  const [form, setForm] = useState<EventFormState>({
    name: "",
    date: "",
    time: "",
    destination: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [askIdentity, setAskIdentity] = useState(false);
  async function create() {
    const parsed = eventSchema.safeParse(form);
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? t("Please check the details."),
      );
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await createEvent(parsed.data);
      await navigate({ to: "/s/$code", params: { code: result.share_code } });
    } catch (err) {
      const message = t(errorMessage(err));
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const parsed = eventSchema.safeParse(form);
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? t("Please check the details."),
      );
      return;
    }
    if (!me) {
      setAskIdentity(true);
      return;
    }
    await create();
  }
  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-md px-6 pt-6 pb-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("Back")}
      </Link>

      <h1 className="mt-6 font-display text-4xl">{t("Create a carpool")}</h1>
      <p className="mt-2 text-muted-foreground">
        {t("Add the basics \u2014 you can change them later.")}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <EventFormFields value={form} onChange={setForm} />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {t(error)}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={pending}
          className="h-14 w-full rounded-2xl text-base shadow-soft"
        >
          {pending ? t("Creating\u2026") : t("Create carpool")}
        </Button>
      </form>

      <IdentityDialog
        open={askIdentity}
        onOpenChange={setAskIdentity}
        title={t("Almost there")}
        submitIdentity={async (identity) => {
          const parsed = eventSchema.parse(form);
          const result = await createEventWithIdentity(identity, parsed);
          await navigate({
            to: "/s/$code",
            params: { code: result.share_code },
          });
        }}
        onIdentified={() => undefined}
      />
    </main>
  );
}
