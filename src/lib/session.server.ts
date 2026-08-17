import { getCookie, setCookie, deleteCookie, getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizePhoneOrNull } from "./phone";


const COOKIE_NAME = "carpoolio_sid";
const ONE_YEAR = 60 * 60 * 24 * 365;

export type CurrentUser = {
  id: string;
  username: string;
};

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Normalizes a phone number to E.164 form. Defaults to Norway (+47). */
export function normalizePhone(input: string): string {
  const normalized = normalizePhoneOrNull(input);
  if (!normalized) {
    throw new Error("Please enter a valid phone number.");
  }
  return normalized;
}


export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = getCookie(COOKIE_NAME);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const { data } = await supabaseAdmin
    .from("sessions")
    .select("user_id, users!inner(id, username)")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return null;
  const user = data.users as unknown as { id: string; username: string };
  return { id: user.id, username: user.username };
}

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("We need your name and phone number first.");
  return user;
}

export async function createIdentitySession(
  username: string,
  phoneNumber: string,
): Promise<CurrentUser> {
  const name = username.trim();
  if (name.length < 2 || name.length > 40) {
    throw new Error("Name must be between 2 and 40 characters.");
  }
  const phone = normalizePhone(phoneNumber);

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .insert({ username: name, phone_number: phone })
    .select("id, username")
    .single();
  if (error || !user) throw new Error("Could not create your profile. Please try again.");

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const { error: sErr } = await supabaseAdmin
    .from("sessions")
    .insert({ token_hash: tokenHash, user_id: user.id });
  if (sErr) throw new Error("Could not start your session. Please try again.");

  // `secure` cookies are dropped by the browser over plain http (local preview),
  // which would silently lose the session right after sign-up.
  const isSecure = (() => {
    try {
      return new URL(getRequest().url).protocol === "https:";
    } catch {
      return true;
    }
  })();

  setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: ONE_YEAR,
  });

  return { id: user.id, username: user.username };
}

export function clearIdentitySession() {
  deleteCookie(COOKIE_NAME, { path: "/" });
}

const SHARE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateShareCode(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += SHARE_ALPHABET[b % SHARE_ALPHABET.length];
  return out;
}
