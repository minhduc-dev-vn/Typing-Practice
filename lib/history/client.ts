"use client";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  FavoriteTopicRow,
  PracticeHistoryRow,
  SavePracticeInput
} from "@/lib/history/types";

function requireClient() {
  const client = getBrowserSupabaseClient();
  if (!client) {
    throw new Error("Supabase chưa được cấu hình.");
  }
  return client;
}

export async function savePracticeSession(input: SavePracticeInput): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("practice_history").insert(createHistoryInsert(input));
  if (error) {
    throw new Error(`Không thể lưu lịch sử: ${error.message}`);
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
    throw new Error(`Không thể tải lịch sử: ${error.message}`);
  }
  return (data ?? []) as PracticeHistoryRow[];
}

export async function listFavoriteTopics(): Promise<FavoriteTopicRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("favorite_topics")
    .select("id,user_id,topic,created_at")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Không thể tải chủ đề yêu thích: ${error.message}`);
  }
  return (data ?? []) as FavoriteTopicRow[];
}

export async function addFavoriteTopic(userId: string, topic: string): Promise<FavoriteTopicRow> {
  const client = requireClient();
  const normalizedTopic = topic.trim().replace(/\s+/gu, " ");
  const { data, error } = await client
    .from("favorite_topics")
    .insert({ user_id: userId, topic: normalizedTopic })
    .select("id,user_id,topic,created_at")
    .single();
  if (error) {
    throw new Error(error.code === "23505" ? "Chủ đề này đã có trong danh sách yêu thích." : error.message);
  }
  return data as FavoriteTopicRow;
}

export async function removeFavoriteTopic(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("favorite_topics").delete().eq("id", id);
  if (error) {
    throw new Error(`Không thể xóa chủ đề: ${error.message}`);
  }
}

export async function updateFavoriteTopic(id: string, topic: string): Promise<FavoriteTopicRow> {
  const client = requireClient();
  const normalizedTopic = topic.trim().replace(/\s+/gu, " ");
  const { data, error } = await client
    .from("favorite_topics")
    .update({ topic: normalizedTopic })
    .eq("id", id)
    .select("id,user_id,topic,created_at")
    .single();
  if (error) {
    throw new Error(error.code === "23505" ? "Chủ đề này đã có trong danh sách yêu thích." : error.message);
  }
  return data as FavoriteTopicRow;
}
