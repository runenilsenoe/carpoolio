import { normalizePhoneOrNull } from "./phone";

export function smsRecipients(phones: string[]): string[] {
  return [
    ...new Set(
      phones
        .map(normalizePhoneOrNull)
        .filter((phone): phone is string => phone !== null),
    ),
  ];
}

export function smsLink(
  phones: string[],
  message: string,
  isApple: boolean,
): string {
  const recipients = smsRecipients(phones);
  if (!recipients.length)
    throw new Error("No valid driver numbers are available.");
  const body = encodeURIComponent(message);
  // Apple's composer uses addresses for groups; Android SMS apps use semicolons.
  return isApple
    ? `sms:/open?addresses=${recipients.join(",")}&body=${body}`
    : `sms:${recipients.join(";")}?body=${body}`;
}
