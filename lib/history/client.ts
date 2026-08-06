"use client";

import type { PracticeHistoryRow, SavePracticeInput } from "@/lib/history/types";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

function requireClient() {
  const client = getBrowserSupabaseClient();
  if (!client) {
    throw new Error("Supabase is not configured.");
  }
  return client;
}

export async function savePracticeSession(input: SavePracticeInput): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("practice_history").insert(createHistoryInsert(input));
  if (error) {
    throw new Error(`Unable to save practice history: ${error.message}`);
  }
}

export function createHistoryInsert(input: SavePracticeInput) {
  return {
    user_id: input.userId,
    mode: input.mode,
    language: input.language,
    topic: input.topic,
    wpm: input.result.wpm,
    accuracy: input.result.accuracy,
    cpm: input.result.cpm,
    errors: input.result.errors,
    duration_seconds: Math.round(input.result.durationSeconds)
  };
}

export async function listPracticeHistory(limit = 200): Promise<PracticeHistoryRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("practice_history")
    .select("id,user_id,mode,language,topic,wpm,accuracy,cpm,errors,duration_seconds,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`Unable to load practice history: ${error.message}`);
  }
  return (data ?? []) as PracticeHistoryRow[];
}
