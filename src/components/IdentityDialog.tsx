import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createIdentity } from "@/lib/carpool.functions";
import { nameSchema, phoneSchema } from "@/lib/schemas";
import { formatPhone, normalizePhoneOrNull } from "@/lib/phone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/error-message";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIdentified: () => void | Promise<void>;
  submitIdentity?: (identity: {
    username: string;
    phone: string;
    note?: string;
  }) => Promise<void>;
  title?: string;
  description?: string;
  submitLabel?: string;
  showNote?: boolean;
};

function firstIssue(result: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  return result.success
    ? null
    : (result.error?.issues[0]?.message ?? "Please check this field.");
}

export function IdentityDialog({
  open,
  onOpenChange,
  onIdentified,
  submitIdentity,
  title,
  description,
  submitLabel,
  showNote = false,
}: Props) {
  const submit = useServerFn(createIdentity);
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState({ username: false, phone: false });
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched({ username: false, phone: false });
    setFormError(null);
    setNote("");
  }, [open]);

  const nameResult = nameSchema.safeParse(username);
  const phoneResult = phoneSchema.safeParse(phone);
  const nameError = touched.username ? firstIssue(nameResult) : null;
  const phoneError = touched.phone ? firstIssue(phoneResult) : null;
  const normalized = normalizePhoneOrNull(phone);
  const isValid = nameResult.success && phoneResult.success;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setTouched({ username: true, phone: true });
    if (!nameResult.success || !phoneResult.success) return;
    setPending(true);
    setFormError(null);
    try {
      const identity = {
        username: nameResult.data,
        phone: phoneResult.data,
        ...(showNote && note.trim() ? { note: note.trim() } : {}),
      };
      if (submitIdentity) {
        await submitIdentity(identity);
      } else {
        await submit({ data: identity });
      }
      await onIdentified();
      onOpenChange(false);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {title ?? "Who are you?"}
          </DialogTitle>
          <DialogDescription>
            {description ??
              "Just a name and a phone number — no account needed. Your number stays private and is never shown to others."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identity-username">Name</Label>
            <Input
              id="identity-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, username: true }))}
              placeholder="Anders"
              autoComplete="name"
              maxLength={40}
              aria-invalid={!!nameError}
              aria-describedby={
                nameError ? "identity-username-error" : undefined
              }
              className="h-12 rounded-xl"
            />
            {nameError ? (
              <p
                id="identity-username-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {nameError}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="identity-phone">Phone number</Label>
            <Input
              id="identity-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              placeholder="900 00 000"
              inputMode="tel"
              autoComplete="tel"
              maxLength={25}
              aria-invalid={!!phoneError}
              aria-describedby="identity-phone-hint"
              className="h-12 rounded-xl"
            />
            <p
              id="identity-phone-hint"
              role={phoneError ? "alert" : undefined}
              className={`text-sm ${phoneError ? "text-destructive" : "text-muted-foreground"}`}
            >
              {phoneError ??
                (normalized
                  ? `Saved as ${formatPhone(normalized)}`
                  : "8 digits is enough — we'll add +47 for you.")}
            </p>
          </div>
          {showNote ? (
            <div className="space-y-2">
              <Label htmlFor="identity-note">
                Passenger note{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="identity-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Needs a child seat"
                maxLength={200}
                rows={2}
                className="rounded-xl"
              />
            </div>
          ) : null}
          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={pending || !isValid}
            className="h-12 w-full rounded-xl text-base"
          >
            {pending ? "Saving…" : (submitLabel ?? "Continue")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
