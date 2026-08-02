import { describe, expect, it, vi } from "vitest";

import type { AiContentRepository, UsageDecision } from "./repository";
import {
  DAILY_GENERATION_LIMIT,
  generatePracticeContent
} from "./service";
import { normalizeCacheTopic, type GenerateRequest } from "./types";

class MemoryRepository implements AiContentRepository {
  readonly cache = new Map<string, string[]>();
  usageCount = 0;
  cacheReads = 0;
  cacheWrites = 0;

  async findCached(request: GenerateRequest): Promise<string[] | null> {
    this.cacheReads += 1;
    return this.cache.get(this.key(request)) ?? null;
  }

  async saveCached(request: GenerateRequest, content: string[]): Promise<void> {
    this.cacheWrites += 1;
    this.cache.set(this.key(request), content);
  }

  async consumeUsage(_sessionId: string, limit: number, now: Date): Promise<UsageDecision> {
    this.usageCount += 1;
    return {
      allowed: this.usageCount <= limit,
      currentCount: this.usageCount,
      resetAt: new Date(now.getTime() + 86_400_000).toISOString()
    };
  }

  private key(request: GenerateRequest): string {
    return [request.language, normalizeCacheTopic(request.topic), request.difficulty, request.length].join(":");
  }
}

function request(topic = "morning garden"): GenerateRequest {
  return { language: "en", topic, difficulty: "medium", length: "short" };
}

describe("generate practice service", () => {
  it("returns the second equivalent request from cache without calling AI or consuming quota again", async () => {
    const repository = new MemoryRepository();
    const generate = vi.fn(async () => ["A calm garden wakes beneath the early light."]);

    const first = await generatePracticeContent(request("Morning Garden"), "session-a", {
      repository,
      generate
    });
    const second = await generatePracticeContent(request("morning garden"), "session-a", {
      repository,
      generate
    });

    expect(first.cached).toBe(false);
    expect(second).toEqual({
      content: ["A calm garden wakes beneath the early light."],
      cached: true
    });
    expect(generate).toHaveBeenCalledOnce();
    expect(repository.usageCount).toBe(1);
    expect(repository.cacheWrites).toBe(1);
  });

  it("blocks the twenty-first uncached generation in a 24-hour session window", async () => {
    const repository = new MemoryRepository();
    const generate = vi.fn(async () => ["Fresh practice content."]);

    for (let index = 1; index <= DAILY_GENERATION_LIMIT; index += 1) {
      const result = await generatePracticeContent(request(`safe topic ${index}`), "session-b", {
        repository,
        generate
      });
      expect(result.cached).toBe(false);
    }

    await expect(generatePracticeContent(request("safe topic 21"), "session-b", {
      repository,
      generate
    })).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429
    });
    expect(generate).toHaveBeenCalledTimes(DAILY_GENERATION_LIMIT);
  });

  it("rejects blocked topics before cache, usage, or AI", async () => {
    const repository = new MemoryRepository();
    const generate = vi.fn(async () => ["Should not be generated."]);

    await expect(generatePracticeContent(request("MA TÚY"), "session-c", {
      repository,
      generate
    })).rejects.toMatchObject({
      code: "BLOCKED_TOPIC",
      status: 403
    });
    expect(repository.cacheReads).toBe(0);
    expect(repository.usageCount).toBe(0);
    expect(generate).not.toHaveBeenCalled();
  });

  it("falls back to matching static language content when AI fails", async () => {
    const repository = new MemoryRepository();
    const result = await generatePracticeContent({
      ...request("public parks"),
      language: "vi"
    }, "session-d", {
      repository,
      generate: async () => { throw new Error("network timeout"); }
    });

    expect(result.cached).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.content.length).toBe(4);
    expect(result.message).toContain("nội dung tĩnh");
  });

  it("uses static fallback when Supabase is not configured", async () => {
    const generate = vi.fn(async () => ["Should not bypass rate limiting."]);
    const result = await generatePracticeContent(request(), "session-e", {
      repository: null,
      generate
    });

    expect(result.fallback).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
    expect(generate).not.toHaveBeenCalled();
  });
});
