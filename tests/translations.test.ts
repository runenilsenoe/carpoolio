import { expect, test } from "bun:test";
import { translate } from "../src/lib/translations";
import { formatEventDate, seatsLabel } from "../src/lib/format";

test("switches interface text without translating user content", () => {
  expect(translate("nb", "Create a carpool")).toBe("Opprett samkjøring");
  expect(translate("en", "Create a carpool")).toBe("Create a carpool");
  expect(translate("nb", "Our cabin trip")).toBe("Our cabin trip");
});

test("interpolates names as text and preserves unknown placeholders", () => {
  expect(translate("nb", "You're riding with {0}", ["Alex <3"])).toBe(
    "Du sitter på med Alex <3",
  );
  expect(translate("en", "Hello {0}")).toBe("Hello {0}");
});

test("localizes dates and seat counts", () => {
  expect(formatEventDate("2026-10-22", "nb")).toContain("torsdag");
  expect(formatEventDate("2026-10-22", "en")).toContain("Thursday");
  expect(seatsLabel(2, 3, "nb")).toBe("2 av 3 passasjerseter opptatt");
});
