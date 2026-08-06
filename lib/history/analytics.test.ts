import { describe, expect, it } from "vitest";

import {
  aggregateHistory,
  calculateHistorySummary,
  formatDuration
} from "./analytics";
import type { PracticeHistoryRow } from "./types";

function row(overrides: Partial<PracticeHistoryRow>): PracticeHistoryRow {
  return {
    id: crypto.randomUUID(),
    user_id: "11111111-1111-4111-8111-111111111111",
    mode: "words",
    language: "en",
    topic: null,
    wpm: 40,
    accuracy: 90,
    cpm: 200,
    errors: 2,
    duration_seconds: 60,
    created_at: "2026-08-01T08:00:00.000Z",
    ...overrides
  };
}

describe("history analytics", () => {
  const rows = [
    row({ wpm: 40, accuracy: 90, duration_seconds: 60, topic: "Gardens" }),
    row({ wpm: 60, accuracy: 100, duration_seconds: 120, topic: "gardens", created_at: "2026-08-01T12:00:00.000Z" }),
    row({ wpm: 50, accuracy: 95, duration_seconds: 30, topic: "Travel", created_at: "2026-08-08T08:00:00.000Z" })
  ];

  it("calculates total time and average metrics", () => {
    expect(calculateHistorySummary(rows)).toEqual({
      totalSeconds: 210,
      averageWpm: 50,
      averageAccuracy: 95,
      sessionCount: 3
    });
    expect(formatDuration(3_900)).toBe("1h 5m");
  });

  it("groups sessions by day and averages each bucket", () => {
    expect(aggregateHistory(rows, "day")).toEqual([
      { key: "2026-08-01", label: "Aug 01", wpm: 50, accuracy: 95, sessions: 2 },
      { key: "2026-08-08", label: "Aug 08", wpm: 50, accuracy: 95, sessions: 1 }
    ]);
  });

  it("groups sessions by week and month", () => {
    expect(aggregateHistory(rows, "week").map((point) => point.sessions)).toEqual([2, 1]);
    expect(aggregateHistory(rows, "month")).toEqual([
      { key: "2026-08-01", label: "Aug 26", wpm: 50, accuracy: 95, sessions: 3 }
    ]);
  });

});
