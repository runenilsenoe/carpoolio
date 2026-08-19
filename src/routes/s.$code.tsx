import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Check, Copy, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getEventPage } from "@/lib/carpool.functions";

export const Route = createFileRoute("/s/$code")({
  loader: async ({ params }) => {
    const data = await getEventPage({ data: { code: params.code } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Carpool not found — Carpoolio" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    return {
      meta: [
        { title: `Share ${loaderData.event.name} — Carpoolio` },
        { name: "robots", content: "noindex" },
        {
          name: "description",
          content: "Share this carpool link with everyone who's coming.",
        },
      ],
    };
  },
  component: SharePage,
});

function SharePage() {
  const { event } = Route.useLoaderData();
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const shareUrl = `${window.location.origin}/e/${event.share_code}`;
    setUrl(shareUrl);
    QRCode.toDataURL(shareUrl, {
      width: 640,
      margin: 1,
      color: { dark: "#2b2a26", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, [event.share_code]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — long-press the link instead.");
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.name,
          text: `Carpool to ${event.name}`,
          url,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      await copy();
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-6 pt-10 pb-12">
      <h1 className="font-display text-4xl text-balance">
        Your carpool is ready 🚗
      </h1>
      <p className="mt-2 text-muted-foreground">
        Share this with everyone who's coming.
      </p>

      <p className="mt-6 text-lg font-semibold">{event.name}</p>

      <div className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-2xl bg-white">
          {qr ? (
            <img
              src={qr}
              alt={`QR code linking to the ${event.name} carpool`}
              className="size-full"
            />
          ) : (
            <div className="size-full animate-pulse bg-muted" />
          )}
        </div>
        <p className="mt-5 rounded-xl bg-secondary px-4 py-3 text-center font-mono text-sm break-all">
          {url || `/e/${event.share_code}`}
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={copy}
            className="h-13 rounded-2xl py-3.5 text-base"
          >
            {copied ? (
              <Check className="size-5" aria-hidden />
            ) : (
              <Copy className="size-5" aria-hidden />
            )}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button
            variant="outline"
            onClick={share}
            className="h-13 rounded-2xl py-3.5 text-base"
          >
            <Share2 className="size-5" aria-hidden />
            Share
          </Button>
        </div>
        <Button
          asChild
          className="h-14 w-full rounded-2xl text-base shadow-soft"
        >
          <Link to="/e/$code" params={{ code: event.share_code }}>
            Open event
          </Link>
        </Button>
      </div>
    </main>
  );
}
