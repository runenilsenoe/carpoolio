import { describe, expect, test } from "bun:test";
import { formatTime, seatsLabel } from "../src/lib/format";

describe("formatTime", () => {
  test("removes seconds", () => {
    expect(formatTime("09:30:00")).toBe("09:30");
  });

  test("preserves missing values", () => {
    expect(formatTime(null)).toBeNull();
  });
});

test("seatsLabel uses singular passenger seat", () => {
  expect(seatsLabel(0, 1)).toBe("0 of 1 passenger seat taken");
});
