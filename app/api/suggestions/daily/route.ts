import { NextRequest, NextResponse } from "next/server";

import { createTopicSuggestionRepository } from "@/lib/personalization/repository";
import { createDailySuggestion } from "@/lib/personalization/service";
import { getServerAuthClient } from "@/lib/supabase/server";

function readBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/iu);
  return match?.[1]?.trim() || null;
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(request: NextRequest) {
  const token = readBearerToken(request);
  if (!token) {
    return jsonError("Authentication is required.", 401);
  }

  const authClient = getServerAuthClient();
  const repository = createTopicSuggestionRepository();
  if (!authClient || !repository) {
    return jsonError("Personalized suggestions are not configured.", 503);
  }

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return jsonError("The authentication session is invalid or expired.", 401);
  }

  try {
    const suggestion = await createDailySuggestion(data.user.id, { repository });
    return NextResponse.json(suggestion, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch {
    return jsonError("A daily suggestion could not be prepared.", 503);
  }
}

