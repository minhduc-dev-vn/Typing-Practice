import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /api/suggestions/daily", () => {
  it("does not expose personalized suggestions to guests", async () => {
    const response = await GET(new NextRequest("http://localhost/api/suggestions/daily"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication is required." });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

