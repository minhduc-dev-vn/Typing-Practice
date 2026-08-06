import { describe, expect, it } from "vitest";

import { findActiveTypingLine, splitTypingDisplayLines } from "./display-lines";

describe("typing display lines", () => {
  it("splits on word boundaries without changing character indexes", () => {
    const text = "alpha beta gamma delta";
    const lines = splitTypingDisplayLines(text, 11);

    expect(lines).toEqual([
      { start: 0, end: 11 },
      { start: 11, end: 22 }
    ]);
    expect(lines.map(({ start, end }) => Array.from(text).slice(start, end).join("")))
      .toEqual(["alpha beta ", "gamma delta"]);
  });

  it("keeps explicit paragraph breaks in the preceding line", () => {
    const text = "first\n\nsecond";

    expect(splitTypingDisplayLines(text, 20)).toEqual([
      { start: 0, end: 7 },
      { start: 7, end: 13 }
    ]);
  });

  it("hard-wraps long words and validates the column limit", () => {
    expect(splitTypingDisplayLines("abcdefghij", 4)).toEqual([
      { start: 0, end: 4 },
      { start: 4, end: 8 },
      { start: 8, end: 10 }
    ]);
    expect(() => splitTypingDisplayLines("text", 0)).toThrow("positive integer");
  });

  it("moves a whole word to the next line even when the preceding line is short", () => {
    const text = "a abcdefgh";
    const lines = splitTypingDisplayLines(text, 6);

    expect(lines.map(({ start, end }) => Array.from(text).slice(start, end).join("")))
      .toEqual(["a ", "abcdef", "gh"]);
  });

  it("moves forward and backward at exact line boundaries", () => {
    const lines = splitTypingDisplayLines("one two three", 8);

    expect(findActiveTypingLine(lines, 0)).toBe(0);
    expect(findActiveTypingLine(lines, lines[0].end - 1)).toBe(0);
    expect(findActiveTypingLine(lines, lines[0].end)).toBe(1);
    expect(findActiveTypingLine(lines, lines[0].end - 1)).toBe(0);
    expect(findActiveTypingLine(lines, 999)).toBe(lines.length - 1);
  });

  it("handles empty text and normalized unicode consistently", () => {
    expect(splitTypingDisplayLines("")).toEqual([]);
    expect(splitTypingDisplayLines("a\u0301 b", 2)).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 3 }
    ]);
  });
});
