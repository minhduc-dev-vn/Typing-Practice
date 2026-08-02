import { NextRequest, NextResponse } from "next/server";

import { createStaticFallback } from "@/lib/ai/fallback";
import { createAiContentRepository } from "@/lib/ai/repository";
import { GenerateServiceError, generatePracticeContent } from "@/lib/ai/service";
import {
  RequestValidationError,
  parseGenerateRequest,
  type GenerateErrorResponse
} from "@/lib/ai/types";

const SESSION_COOKIE = "typing_generate_session";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must contain valid JSON.", "INVALID_REQUEST", 400);
  }

  let generateRequest;
  try {
    generateRequest = parseGenerateRequest(body);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return errorResponse(error.message, "INVALID_REQUEST", 400);
    }
    throw error;
  }

  const existingSessionId = request.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = existingSessionId && /^[0-9a-f-]{36}$/iu.test(existingSessionId)
    ? existingSessionId
    : crypto.randomUUID();

  try {
    const responseBody = await generatePracticeContent(generateRequest, sessionId, {
      repository: createAiContentRepository(),
      onOperationalError: (error) => console.error("Generate operation failed", error)
    });
    const response = NextResponse.json(responseBody, {
      headers: { "Cache-Control": "no-store" }
    });
    if (!existingSessionId) {
      response.cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions());
    }
    return response;
  } catch (error) {
    if (error instanceof GenerateServiceError) {
      const response = errorResponse(error.message, error.code, error.status, error.resetAt);
      if (!existingSessionId) {
        response.cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions());
      }
      return response;
    }
    console.error("Unexpected generate route failure", error);
    return NextResponse.json({
      content: createStaticFallback(generateRequest),
      cached: false,
      fallback: true,
      message: "Không thể tạo nội dung lúc này. Nội dung tĩnh vẫn sẵn sàng."
    }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}

function errorResponse(
  error: string,
  code: GenerateErrorResponse["code"],
  status: number,
  resetAt?: string
) {
  return NextResponse.json<GenerateErrorResponse>(
    { error, code, ...(resetAt ? { resetAt } : {}) },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function sessionCookieOptions() {
  return {
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}
