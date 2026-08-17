#!/usr/bin/env node
/**
 * Generates every secret the self-hosted Carpoolio stack needs and prints them
 * as .env lines. Nothing is written to disk and nothing is committed.
 *
 *   node scripts/generate-secrets.mjs            # print
 *   node scripts/generate-secrets.mjs >> .env    # append to your .env
 */
import { createHmac, randomBytes } from "node:crypto";

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function signJwt(payload, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

const jwtSecret = randomBytes(32).toString("hex");
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 60 * 60 * 24 * 365 * 10; // 10 years

const key = (role) => signJwt({ role, iss: "supabase", iat, exp }, jwtSecret);

const lines = [
  `POSTGRES_PASSWORD=${randomBytes(24).toString("hex")}`,
  `JWT_SECRET=${jwtSecret}`,
  `ANON_KEY=${key("anon")}`,
  `SERVICE_ROLE_KEY=${key("service_role")}`,
  `REALTIME_ENC_KEY=${randomBytes(8).toString("hex")}`, // exactly 16 chars
  `REALTIME_SECRET_KEY_BASE=${randomBytes(32).toString("hex")}`,
];

console.log(lines.join("\n"));
