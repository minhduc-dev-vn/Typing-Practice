import { describe, expect, it } from "vitest";

import { VietnameseComposer, convertTelex, convertVni } from "./vietnamese";

describe("Vietnamese Telex conversion", () => {
  it.each([
    ["as", "á"],
    ["af", "à"],
    ["ar", "ả"],
    ["ax", "ã"],
    ["aj", "ạ"],
    ["aw", "ă"],
    ["aa", "â"],
    ["ee", "ê"],
    ["oo", "ô"],
    ["ow", "ơ"],
    ["uw", "ư"],
    ["dd", "đ"],
    ["chaof", "chào"],
    ["tieengs", "tiếng"]
  ])("converts %s to %s", (raw, expected) => {
    expect(convertTelex(raw)).toBe(expected);
  });

  it("reconciles a tone key without exposing character state", () => {
    const composer = new VietnameseComposer("telex");

    expect(composer.press("a")).toEqual({ backspaces: 0, text: "a" });
    expect(composer.press("s")).toEqual({ backspaces: 1, text: "á" });
  });
});

describe("Vietnamese VNI conversion", () => {
  it.each([
    ["a1", "á"],
    ["a2", "à"],
    ["a8", "ă"],
    ["o7", "ơ"],
    ["d9", "đ"]
  ])("converts %s to %s", (raw, expected) => {
    expect(convertVni(raw)).toBe(expected);
  });
});
