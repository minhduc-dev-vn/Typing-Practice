"use client";

import type {
  GenerateErrorResponse,
  GenerateRequest,
  GenerateResponse
} from "@/lib/ai/types";

const SESSION_COOKIE = "typing_generate_session";

export class GenerateClientError extends Error {
  constructor(message: string, readonly code?: GenerateErrorResponse["code"]) {
    super(message);
    this.name = "GenerateClientError";
  }
}

export function ensureGenerateSessionCookie(): void {
  const hasSession = document.cookie
    .split(";")
    .some((cookie) => cookie.trim().startsWith(`${SESSION_COOKIE}=`));
  if (hasSession) {
    return;
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE}=${crypto.randomUUID()}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
}

export async function requestGeneratedContent(
  request: GenerateRequest,
  signal?: AbortSignal
): Promise<GenerateResponse> {
  ensureGenerateSessionCookie();
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    credentials: "same-origin",
    signal
  });

  const body = await response.json() as GenerateResponse | GenerateErrorResponse;
  if (!response.ok) {
    const error = body as GenerateErrorResponse;
    throw new GenerateClientError(error.error || "Không thể tạo nội dung.", error.code);
  }
  return body as GenerateResponse;
}
