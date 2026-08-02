import { afterEach, describe, expect, it, vi } from "vitest";

import { generateRelatedTopic, parseRelatedTopic } from "./generate-related";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("related-topic generation", () => {
  it("accepts only the exact JSON contract", () => {
    expect(parseRelatedTopic('{"related_topic":"Urban balcony gardens"}')).toBe("Urban balcony gardens");
    expect(() => parseRelatedTopic('{"related_topic":"Gardens","extra":true}')).toThrow();
    expect(() => parseRelatedTopic("not json")).toThrow();
  });

  it("retries once after an invalid provider response", async () => {
    vi.stubEnv("OPENAI_API_BASE_URL", "https://provider.test/v1");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "test-model");
    const fetchImplementation = vi.fn()
      .mockResolvedValueOnce(new Response("upstream error", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '{"related_topic":"Coastal train journeys"}' } }]
      }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(generateRelatedTopic("City travel", fetchImplementation)).resolves.toBe("Coastal train journeys");
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });
});

