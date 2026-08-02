import type { SupabaseClient } from "@supabase/supabase-js";

import type { GenerateRequest } from "@/lib/ai/types";
import { normalizeCacheTopic } from "@/lib/ai/types";
import { getServerSupabaseClient } from "@/lib/supabase/server";

export interface UsageDecision {
  allowed: boolean;
  currentCount: number;
  resetAt: string;
}

export interface AiContentRepository {
  findCached: (request: GenerateRequest) => Promise<string[] | null>;
  saveCached: (request: GenerateRequest, content: string[]) => Promise<void>;
  consumeUsage: (sessionId: string, limit: number, now: Date) => Promise<UsageDecision>;
}

interface UsageRpcRow {
  allowed: boolean;
  current_count: number;
  next_reset_at: string;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export class SupabaseAiContentRepository implements AiContentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findCached(request: GenerateRequest): Promise<string[] | null> {
    const { data, error } = await this.client
      .from("ai_content_cache")
      .select("content")
      .eq("language", request.language)
      .eq("topic", normalizeCacheTopic(request.topic))
      .eq("difficulty", request.difficulty)
      .eq("length", request.length)
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase cache lookup failed: ${error.message}`);
    }
    if (!data) {
      return null;
    }
    if (!isStringArray(data.content)) {
      throw new Error("Supabase cache content has an invalid shape.");
    }
    return data.content;
  }

  async saveCached(request: GenerateRequest, content: string[]): Promise<void> {
    const { error } = await this.client
      .from("ai_content_cache")
      .upsert({
        language: request.language,
        topic: normalizeCacheTopic(request.topic),
        difficulty: request.difficulty,
        length: request.length,
        content
      }, {
        onConflict: "language,topic,difficulty,length",
        ignoreDuplicates: true
      });

    if (error) {
      throw new Error(`Supabase cache write failed: ${error.message}`);
    }
  }

  async consumeUsage(sessionId: string, limit: number, now: Date): Promise<UsageDecision> {
    const { data, error } = await this.client.rpc("consume_generate_usage", {
      p_session_id: sessionId,
      p_limit: limit,
      p_now: now.toISOString()
    });

    if (error) {
      throw new Error(`Supabase rate-limit check failed: ${error.message}`);
    }

    const row = (Array.isArray(data) ? data[0] : data) as UsageRpcRow | undefined;
    if (!row || typeof row.allowed !== "boolean") {
      throw new Error("Supabase rate-limit function returned an invalid response.");
    }

    return {
      allowed: row.allowed,
      currentCount: row.current_count,
      resetAt: row.next_reset_at
    };
  }
}

export function createAiContentRepository(): AiContentRepository | null {
  const client = getServerSupabaseClient();
  return client ? new SupabaseAiContentRepository(client) : null;
}
