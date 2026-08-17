import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
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
      { property: "og:title", content: "Carpoolio — Going somewhere together?" },
      {
        property: "og:description",
        content: "Create a carpool, share the link, and let everyone find a seat.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-8 pb-10">
      <p className="text-lg font-semibold tracking-tight text-primary">Carpoolio</p>

      <div className="flex flex-1 flex-col justify-center py-16">
        <h1 className="font-display text-5xl leading-[1.05] text-balance">
          Going somewhere together?
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground text-pretty">
          Create a carpool, share the link, and let everyone find a seat.
        </p>

        <Button asChild className="mt-10 h-14 w-full rounded-2xl text-base shadow-soft">
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
