import { describe, expect, it } from "vitest";

import { createHistoryInsert } from "./client";

describe("practice history persistence payload", () => {
  it("maps a completed session to the Phase 3 schema", () => {
    expect(createHistoryInsert({
      userId: "11111111-1111-4111-8111-111111111111",
      mode: "sentences",
      language: "vi",
      topic: "khu vườn",
      result: {
        wpm: 42.5,
        cpm: 215,
        accuracy: 98.4,
        errors: 1,
        correctCharacters: 120,
        typedCharacters: 121,
        correctSyllables: 25,
        durationSeconds: 59.7,
        maxLatencyMs: 0.2
      }
    })).toEqual({
      user_id: "11111111-1111-4111-8111-111111111111",
      mode: "sentences",
      language: "vi",
      topic: "khu vườn",
      wpm: 42.5,
      accuracy: 98.4,
      cpm: 215,
      errors: 1,
      duration_seconds: 60
    });
  });
});
