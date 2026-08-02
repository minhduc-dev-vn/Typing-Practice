"use client";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { DailySuggestion } from "@/lib/personalization/types";

const CACHE_PREFIX = "keysteady-daily-suggestion";

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function dailySuggestionCacheKey(userId: string, now = new Date()): string {
  return `${CACHE_PREFIX}:${userId}:${dayKey(now)}`;
}

export function isDailySuggestion(value: unknown): value is DailySuggestion {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    (item.sourceTopic === null || typeof item.sourceTopic === "string") &&
    typeof item.relatedTopic === "string" &&
    item.relatedTopic.trim().length >= 2 &&
    (item.reason === "familiar" || item.reason === "default")
  );
}

function readCachedSuggestion(key: string): DailySuggestion | null {
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    return isDailySuggestion(value) ? value : null;
  } catch {
    return null;
  }
}

export async function requestDailySuggestion(userId: string): Promise<DailySuggestion> {
  const key = dailySuggestionCacheKey(userId);
  const cached = readCachedSuggestion(key);
  if (cached) {
    return cached;
  }

  const client = getBrowserSupabaseClient();
  if (!client) {
    throw new Error("Supabase Auth is not configured.");
  }

  const { data, error } = await client.auth.getSession();
  const session = data.session;
  if (error || !session || session.user.id !== userId) {
    throw new Error("The authentication session is unavailable.");
  }

  const response = await fetch("/api/suggestions/daily", {
    method: "GET",
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store"
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !isDailySuggestion(body)) {
    throw new Error("The daily suggestion is unavailable.");
  }

  window.localStorage.setItem(key, JSON.stringify(body));
  return body;
}

