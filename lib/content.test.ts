import { describe, expect, it } from "vitest";

import {
  MAX_CUSTOM_TEXT_LENGTH,
  createPracticeText,
  normalizeCustomPracticeText
} from "./content";

describe("static Phase 0 content integration", () => {
  it.each([
    ["words", "en"],
    ["words", "vi"],
    ["paragraph", "en"],
    ["paragraph", "vi"]
  ] as const)("provides %s practice in %s without an external service", (mode, language) => {
    const text = createPracticeText(mode, language, 42);

    expect(text.length).toBeGreaterThan(100);
    expect(text).not.toContain("undefined");
  });

  it("keeps static content size independent from the selected duration", () => {
    const words = createPracticeText("words", "en", 42).split(" ");
    const paragraphs = createPracticeText("paragraph", "en", 42).split("\n\n");

    expect(words).toHaveLength(90);
    expect(paragraphs).toHaveLength(3);
  });

  it("normalizes pasted custom text without changing its wording", () => {
    expect(normalizeCustomPracticeText("  First line.\r\nSecond a\u0301 line.  "))
      .toBe("First line.\nSecond á line.");
    expect(MAX_CUSTOM_TEXT_LENGTH).toBe(5_000);
  });

});
