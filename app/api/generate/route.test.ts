import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/generate", () => {
  it("allows a guest session and returns static fallback when services are not configured", async () => {
    const request = new NextRequest("http://localhost/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "en",
        topic: "quiet libraries",
        difficulty: "easy",
        length: "short"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ cached: false, fallback: true });
    expect(body.content.length).toBe(4);
    expect(response.headers.get("set-cookie")).toContain("typing_generate_session=");
  });

  it("returns a clear error for a blocked topic", async () => {
    const request = new NextRequest("http://localhost/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "typing_generate_session=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      },
      body: JSON.stringify({
        language: "vi",
        topic: "MA TÚY",
        difficulty: "medium",
        length: "short"
      })
    });

    const response = await POST(request);
    await expect(response.json()).resolves.toMatchObject({ code: "BLOCKED_TOPIC" });
    expect(response.status).toBe(403);
  });
});
