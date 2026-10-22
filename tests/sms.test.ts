import { expect, test } from "bun:test";
import { smsLink, smsRecipients } from "../src/lib/sms";

test("normalizes and deduplicates recipients, rejecting URL injection", () => {
  expect(
    smsRecipients([
      "900 00 000",
      "+4790000000",
      "+12025550198",
      "123?body=oops",
      "",
    ]),
  ).toEqual(["+4790000000", "+12025550198"]);
});

test("builds Apple group composer and encodes message parameters", () => {
  expect(smsLink(["90000000", "+12025550198"], "Hi & hello?\n🚗", true)).toBe(
    "sms:/open?addresses=+4790000000,+12025550198&body=Hi%20%26%20hello%3F%0A%F0%9F%9A%97",
  );
});

test("builds Android group composer", () => {
  expect(smsLink(["90000000", "+12025550198"], "Hello", false)).toBe(
    "sms:+4790000000;+12025550198?body=Hello",
  );
});

test("does not create an SMS link without recipients", () => {
  expect(() => smsLink([], "Hello", false)).toThrow();
});
