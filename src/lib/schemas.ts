import { z } from "zod";
import { normalizePhoneOrNull } from "./phone";

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Please enter at least 2 characters")
  .max(40, "That name is a bit too long")
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}\s'’.-]*$/u, "Use letters only — no numbers or symbols");

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Please enter your phone number")
  .max(25, "That number is too long")
  .refine((value) => normalizePhoneOrNull(value) !== null, {
    message: "Enter an 8-digit Norwegian number, or include a country code",
  })
  .transform((value) => normalizePhoneOrNull(value)!);

export const identitySchema = z.object({
  username: nameSchema,
  phone: phoneSchema,
});
export type IdentityInput = z.infer<typeof identitySchema>;


export const eventSchema = z.object({
  name: z.string().trim().min(2, "Please give the carpool a name").max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a date"),
  time: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).optional(),
  destination: z.string().trim().max(80).optional(),
});
export type EventInput = z.infer<typeof eventSchema>;

export const carSchema = z.object({
  available_seats: z.coerce.number().int().min(1, "At least 1 seat").max(20),
  pickup_location: z.string().trim().min(1, "Where do you start from?").max(80),
  departure_time: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).optional(),
  note: z.string().trim().max(200).optional(),
});
export type CarInput = z.infer<typeof carSchema>;
