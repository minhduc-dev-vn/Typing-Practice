import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiGenerationError, buildGenerationPrompt, generateAiContent } from "./generate";
import type { GenerateRequest } from "./types";

const request: GenerateRequest = {
  language: "vi",
  topic: "khu vườn buổi sáng",
  difficulty: "hard",
  length: "long"
};

describe("OpenAI-compatible generation", () => {
  beforeEach(() => {
    process.env.OPENAI_API_BASE_URL = "https://example.test/v1";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "test-model";
  });

  afterEach(() => {
    delete process.env.OPENAI_API_BASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    vi.restoreAllMocks();
  });

  it("builds a JSON-only prompt with language, difficulty, and length guidance", () => {
    const prompt = buildGenerationPrompt(request);

    expect(prompt).toContain("Output language: Vietnamese");
    expect(prompt).toContain("Difficulty: hard");
    expect(prompt).toContain("Length: long");
    expect(prompt).toContain("Return only a raw JSON object");
    expect(prompt).toContain("Do not include Markdown");
  });

  it("parses valid content from an OpenAI-compatible response", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({
        choices: [{ message: { content: "{\"content\":[\"Buổi sáng trong vườn rất yên tĩnh.\"]}" } }]
      }), { status: 200 });
    });
    const fetchMock = fetchSpy as unknown as typeof fetch;

    await expect(generateAiContent(request, fetchMock)).resolves.toEqual([
      "Buổi sáng trong vườn rất yên tĩnh."
    ]);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://example.test/v1/chat/completions");
  });

  it("retries once when the first response is not valid JSON", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "not json" } }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "{\"content\":[\"Nội dung hợp lệ.\"]}" } }]
      }), { status: 200 })) as unknown as typeof fetch;

    await expect(generateAiContent(request, fetchMock)).resolves.toEqual(["Nội dung hợp lệ."]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails after at most one retry", async () => {
    const fetchMock = vi.fn(async () => new Response("provider unavailable", { status: 503 })) as unknown as typeof fetch;

    await expect(generateAiContent(request, fetchMock)).rejects.toBeInstanceOf(AiGenerationError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
