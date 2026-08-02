import { describe, expect, it } from "vitest";

import { findFamiliarTopics } from "./algorithm";

describe("findFamiliarTopics", () => {
  it("groups normalized topics and keeps only topics practiced at least three times", () => {
    const result = findFamiliarTopics([
      { topic: "Quiet Gardens", createdAt: "2026-08-02T08:00:00.000Z" },
      { topic: " quiet   gardens ", createdAt: "2026-08-01T08:00:00.000Z" },
      { topic: "QUIET GARDENS", createdAt: "2026-07-31T08:00:00.000Z" },
      { topic: "City travel", createdAt: "2026-08-02T09:00:00.000Z" },
      { topic: "City travel", createdAt: "2026-08-01T09:00:00.000Z" },
      { topic: null, createdAt: "2026-08-01T09:00:00.000Z" }
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      topic: "Quiet Gardens",
      normalizedTopic: "quiet gardens",
      count: 3
    });
  });

  it("ranks higher frequency before recency", () => {
    const result = findFamiliarTopics([
      ...Array.from({ length: 4 }, (_, index) => ({
        topic: "Reading",
        createdAt: `2026-08-0${index + 1}T08:00:00.000Z`
      })),
      ...Array.from({ length: 3 }, () => ({
        topic: "Travel",
        createdAt: "2026-08-02T10:00:00.000Z"
      }))
    ]);

    expect(result.map((item) => item.topic)).toEqual(["Reading", "Travel"]);
  });
});

