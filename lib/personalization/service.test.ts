import { describe, expect, it, vi } from "vitest";

import type { TopicSuggestionRepository } from "./repository";
import { createDailySuggestion } from "./service";
import type { RecentTopicPractice } from "./types";

class MemorySuggestionRepository implements TopicSuggestionRepository {
  readonly suggestions = new Map<string, string>();
  readonly rowsByUser = new Map<string, RecentTopicPractice[]>();

  async listRecentTopics(userId: string): Promise<RecentTopicPractice[]> {
    return this.rowsByUser.get(userId) ?? [];
  }

  async findSuggestion(sourceTopic: string): Promise<string | null> {
    return this.suggestions.get(sourceTopic) ?? null;
  }

  async saveSuggestion(sourceTopic: string, relatedTopic: string): Promise<void> {
    if (!this.suggestions.has(sourceTopic)) {
      this.suggestions.set(sourceTopic, relatedTopic);
    }
  }
}

function practices(topic: string, count: number): RecentTopicPractice[] {
  return Array.from({ length: count }, (_, index) => ({
    topic,
    createdAt: new Date(Date.UTC(2026, 7, 2, 10 - index)).toISOString()
  }));
}

describe("daily personalization service", () => {
  it("returns different history-driven suggestions for users with different familiar topics", async () => {
    const repository = new MemorySuggestionRepository();
    repository.rowsByUser.set("user-a", practices("Artificial intelligence", 3));
    repository.rowsByUser.set("user-b", practices("Mountain travel", 3));
    const generate = vi.fn(async (topic: string) => (
      topic === "Artificial intelligence" ? "Machine learning basics" : "Planning a hiking route"
    ));
    const now = new Date("2026-08-02T12:00:00.000Z");

    const first = await createDailySuggestion("user-a", { repository, generate, now });
    const second = await createDailySuggestion("user-b", { repository, generate, now });

    expect(first).toMatchObject({
      sourceTopic: "Artificial intelligence",
      relatedTopic: "Machine learning basics",
      reason: "familiar",
      familiarCount: 3
    });
    expect(second).toMatchObject({
      sourceTopic: "Mountain travel",
      relatedTopic: "Planning a hiking route",
      reason: "familiar",
      familiarCount: 3
    });
  });

  it("uses the shared cache on a repeat request and does not call AI twice", async () => {
    const repository = new MemorySuggestionRepository();
    repository.rowsByUser.set("user-a", practices("Home cooking", 3));
    const generate = vi.fn(async () => "Seasonal kitchen ingredients");
    const now = new Date("2026-08-02T12:00:00.000Z");

    const first = await createDailySuggestion("user-a", { repository, generate, now });
    const second = await createDailySuggestion("user-a", { repository, generate, now });

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.relatedTopic).toBe("Seasonal kitchen ingredients");
    expect(generate).toHaveBeenCalledOnce();
  });

  it("checks and prepares every familiar topic while choosing the strongest one", async () => {
    const repository = new MemorySuggestionRepository();
    repository.rowsByUser.set("user-a", [
      ...practices("Reading", 4),
      ...practices("Travel", 3)
    ]);
    const generate = vi.fn(async (topic: string) => `Related to ${topic}`);

    const result = await createDailySuggestion("user-a", {
      repository,
      generate,
      now: new Date("2026-08-02T12:00:00.000Z")
    });

    expect(result.sourceTopic).toBe("Reading");
    expect(generate).toHaveBeenCalledTimes(2);
    expect(repository.suggestions.size).toBe(2);
  });

  it("uses a deterministic static default without AI when history is insufficient", async () => {
    const repository = new MemorySuggestionRepository();
    repository.rowsByUser.set("user-a", practices("Rare topic", 2));
    const generate = vi.fn(async () => "Should not be generated");
    const now = new Date("2026-08-02T12:00:00.000Z");

    const first = await createDailySuggestion("user-a", { repository, generate, now });
    const second = await createDailySuggestion("user-a", { repository, generate, now });

    expect(first).toEqual(second);
    expect(first).toMatchObject({ sourceTopic: null, reason: "default" });
    expect(generate).not.toHaveBeenCalled();
  });
});

