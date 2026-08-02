import { describe, expect, it } from "vitest";

import { createGeneratedPracticeText, createPracticeText } from "./content";

describe("static Phase 0 content integration", () => {
  it.each([
    ["words", "en"],
    ["words", "vi"],
    ["sentences", "en"],
    ["sentences", "vi"],
    ["paragraph", "en"],
    ["paragraph", "vi"]
  ] as const)("provides %s practice in %s without an external service", (mode, language) => {
    const text = createPracticeText(mode, language, 60, 42);

    expect(text.length).toBeGreaterThan(100);
    expect(text).not.toContain("undefined");
  });

  it("joins generated content according to the active mode", () => {
    const content = ["First item.", "Second item."];

    expect(createGeneratedPracticeText(content, "words")).toBe("First item. Second item.");
    expect(createGeneratedPracticeText(content, "sentences")).toBe("First item. Second item.");
    expect(createGeneratedPracticeText(content, "paragraph")).toBe("First item.\n\nSecond item.");
  });
});
