import { describe, expect, test } from "bun:test";
import { formatPhone, normalizePhoneOrNull } from "../src/lib/phone";

describe("normalizePhoneOrNull", () => {
  test("uses Norway as the default country", () => {
    expect(normalizePhoneOrNull("900 00 000")).toBe("+4790000000");
  });

  test("rejects too-short phone numbers", () => {
    expect(normalizePhoneOrNull("123")).toBeNull();
  });
});

test("formatPhone groups a Norwegian number", () => {
  expect(formatPhone("+4790000000")).toBe("+47 900 00 000");
});
