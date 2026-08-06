import { describe, expect, it } from "vitest";

import { parseTimeLimit } from "./typingStore";

describe("parseTimeLimit", () => {
  it.each([
    ["10", 10],
    ["90", 90],
    ["120.6", 121],
    ["3600", 3_600]
  ])("accepts %s seconds", (input, expected) => {
    expect(parseTimeLimit(input)).toBe(expected);
  });

  it.each(["", "   ", "nine", "9", "3601", "Infinity"])(
    "rejects invalid duration %j",
    (input) => {
      expect(parseTimeLimit(input)).toBeNull();
    }
  );
});
