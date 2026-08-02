import { describe, expect, it } from "vitest";

import { RequestValidationError, normalizeCacheTopic, parseGenerateRequest } from "./types";

describe("generate request validation", () => {
  it("accepts and normalizes the required request schema", () => {
    expect(parseGenerateRequest({
      language: "vi",
      topic: "  Khu   vườn  ",
      difficulty: "medium",
      length: "short"
    })).toEqual({
      language: "vi",
      topic: "Khu vườn",
      difficulty: "medium",
      length: "short"
    });
  });

  it.each([
    { language: "fr", topic: "garden", difficulty: "easy", length: "short" },
    { language: "en", topic: "x", difficulty: "easy", length: "short" },
    { language: "en", topic: "garden", difficulty: "expert", length: "short" },
    { language: "en", topic: "garden", difficulty: "easy", length: "huge" }
  ])("rejects an invalid request", (request) => {
    expect(() => parseGenerateRequest(request)).toThrow(RequestValidationError);
  });

  it("normalizes cache topics to make equivalent requests share a key", () => {
    expect(normalizeCacheTopic("  Morning   Garden ")).toBe("morning garden");
  });
});
