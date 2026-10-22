import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Car, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Carpoolio — Going somewhere together?" },
      {
        name: "description",
        content:
          "Create a carpool, share the link, and let everyone find a seat. No signup, no passwords.",
      },
      {
        property: "og:title",
        content: "Carpoolio — Going somewhere together?",
      },
      {
        property: "og:description",
        content:
          "Create a carpool, share the link, and let everyone find a seat.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-8 pb-10">
      <p className="text-lg font-semibold tracking-tight text-primary">
        Carpoolio
      </p>

      <div className="flex flex-1 flex-col justify-center py-16">
        <h1 className="font-display text-5xl leading-[1.05] text-balance">
          Going somewhere together?
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground text-pretty">
          Create a carpool, share the link, and let everyone find a seat.
        </p>

        <figure className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-soft">
          <figcaption className="mb-4 text-xs font-medium tracking-wide text-muted-foreground">
            A little example
          </figcaption>
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Car className="size-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Alex is driving</p>
              <p className="mt-1 text-xs text-muted-foreground">
                City centre → Summer party
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {["Sam", "Jo"].map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-2 rounded-full bg-secondary py-1.5 pr-3 pl-1.5 text-xs"
              >
                <span
                  className="flex size-6 items-center justify-center rounded-full bg-primary/10 font-medium text-primary"
                  aria-hidden
                >
                  {name[0]}
                </span>
                {name}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/40 px-3 py-2 text-xs font-medium text-primary">
              <Plus className="size-3.5" aria-hidden />1 seat free
            </span>
          </div>
        </figure>

        <Button
          asChild
          className="mt-8 h-14 w-full rounded-2xl text-base shadow-soft"
        >
          <Link to="/new">
            Create a carpool
            <ArrowRight className="size-5" aria-hidden />
          </Link>
        </Button>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          No account, no password. Takes 20 seconds.
        </p>
      </div>
    </main>
  );
}
