export const DEFAULT_COUNTRY_CODE = "+47";

const NORWEGIAN_LENGTH = 8;

export function normalizePhoneOrNull(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/[^\d+\s()./-]/.test(raw)) return null;

  let value = raw.replace(/[^\d+]/g, "");
  if (value.startsWith("00")) value = "+" + value.slice(2);

  if (!value.startsWith("+")) {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== NORWEGIAN_LENGTH) return null;
    value = DEFAULT_COUNTRY_CODE + digits;
  } else {
    value = "+" + value.slice(1).replace(/\D/g, "");
  }

  const numeric = value.slice(1);
  if (value.startsWith(DEFAULT_COUNTRY_CODE)) {
    if (numeric.length !== DEFAULT_COUNTRY_CODE.length - 1 + NORWEGIAN_LENGTH)
      return null;
  } else if (numeric.length < 8 || numeric.length > 15) {
    return null;
  }
  return value;
}

export function formatPhone(e164: string): string {
  if (e164.startsWith(DEFAULT_COUNTRY_CODE)) {
    const d = e164.slice(3);
    return `${DEFAULT_COUNTRY_CODE} ${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5)}`.trim();
  }
  return e164;
}
