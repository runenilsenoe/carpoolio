import { useEffect, useState } from "react";
import { Copy, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDriverContacts, type DriverContact } from "@/lib/api";
import { errorMessage } from "@/lib/error-message";
import { formatPhone } from "@/lib/phone";
import { smsLink, smsRecipients } from "@/lib/sms";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  eventName: string;
};

export function DriverSmsDialog({
  open,
  onOpenChange,
  code,
  eventName,
}: Props) {
  const [contacts, setContacts] = useState<DriverContact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isApple, setIsApple] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setContacts(null);
    setError(null);
    setMessage(
      `Hi drivers! Regarding ${eventName}:\n${window.location.origin}/e/${code}`,
    );
    setIsApple(/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent));
    getDriverContacts(code).then(
      (result) => {
        if (active) setContacts(result);
      },
      (err: unknown) => {
        if (active) setError(errorMessage(err));
      },
    );
    return () => {
      active = false;
    };
  }, [open, code, eventName]);

  const phones = smsRecipients(contacts?.map((contact) => contact.phone) ?? []);
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy. You can select the text manually instead.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            SMS to drivers
          </DialogTitle>
          <DialogDescription>
            Opens your messaging app. Review the recipients and send it
            yourself. In a group message, drivers may see each other's numbers.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : contacts === null ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading drivers…
          </p>
        ) : phones.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No drivers yet. Add a car first.
          </p>
        ) : (
          <div className="space-y-4">
            <ul aria-label="Recipients" className="space-y-2 text-sm">
              {contacts.map((contact, index) => (
                <li
                  key={index}
                  className="flex flex-wrap justify-between gap-x-3"
                >
                  <span>{contact.name}</span>
                  <span className="select-all text-muted-foreground">
                    {formatPhone(contact.phone)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="space-y-2">
              <Label htmlFor="driver-sms-message">Message</Label>
              <Textarea
                id="driver-sms-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1000}
                className="min-h-28 rounded-xl"
              />
            </div>
            <Button asChild className="h-12 w-full rounded-xl">
              <a href={smsLink(phones, message, isApple)}>
                <MessageSquare className="size-4" aria-hidden />
                Open messaging app
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Works with iPhone and Android messaging apps. If recipients or
              text don't transfer, copy them below. Your normal mobile charges
              may apply.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(phones.join("; "))}
              >
                <Copy className="size-3.5" aria-hidden /> Copy numbers
              </Button>
              <Button variant="ghost" size="sm" onClick={() => copy(message)}>
                <Copy className="size-3.5" aria-hidden /> Copy message
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
