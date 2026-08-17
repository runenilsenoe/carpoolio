import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EventFormFields, type EventFormState } from "@/components/EventFormFields";
import { IdentityDialog } from "@/components/IdentityDialog";
import { createEvent, getMe } from "@/lib/carpool.functions";
import { eventSchema } from "@/lib/schemas";
import { errorMessage } from "@/lib/error-message";

export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "Create a carpool — Carpoolio" },
      {
        name: "description",
        content: "Name your event, pick a date, and get a link to share with everyone coming.",
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
  const me = Route.useLoaderData();
  const navigate = useNavigate();
  const submit = useServerFn(createEvent);
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
      setError(parsed.error.issues[0]?.message ?? "Please check the details.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await submit({ data: parsed.data });
      await navigate({ to: "/s/$code", params: { code: result.share_code } });
    } catch (err) {
      const message = errorMessage(err);
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
      setError(parsed.error.issues[0]?.message ?? "Please check the details.");
      return;
    }
    if (!me) {
      setAskIdentity(true);
      return;
    }
    await create();
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-6 pt-6 pb-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back
      </Link>

      <h1 className="mt-6 font-display text-4xl">Create a carpool</h1>
      <p className="mt-2 text-muted-foreground">
        Add the basics — you can change them later.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <EventFormFields value={form} onChange={setForm} />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={pending}
          className="h-14 w-full rounded-2xl text-base shadow-soft"
        >
          {pending ? "Creating…" : "Create carpool"}
        </Button>
      </form>

      <IdentityDialog
        open={askIdentity}
        onOpenChange={setAskIdentity}
        title="Almost there"
        onIdentified={create}
      />
    </main>
  );
}
