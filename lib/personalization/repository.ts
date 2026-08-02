import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeCacheTopic } from "@/lib/ai/types";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import type { RecentTopicPractice } from "@/lib/personalization/types";

export interface TopicSuggestionRepository {
  listRecentTopics: (userId: string, since: Date) => Promise<RecentTopicPractice[]>;
  findSuggestion: (sourceTopic: string) => Promise<string | null>;
  saveSuggestion: (sourceTopic: string, relatedTopic: string) => Promise<void>;
}

interface RecentTopicRow {
  topic: string | null;
  created_at: string;
}

export class SupabaseTopicSuggestionRepository implements TopicSuggestionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listRecentTopics(userId: string, since: Date): Promise<RecentTopicPractice[]> {
    const { data, error } = await this.client
      .from("practice_history")
      .select("topic,created_at")
      .eq("user_id", userId)
      .gte("created_at", since.toISOString())
      .not("topic", "is", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Supabase history lookup failed: ${error.message}`);
    }

    return ((data ?? []) as RecentTopicRow[]).map((row) => ({
      topic: row.topic,
      createdAt: row.created_at
    }));
  }

  async findSuggestion(sourceTopic: string): Promise<string | null> {
    const { data, error } = await this.client
      .from("topic_suggestions")
      .select("related_topic")
      .eq("source_topic", normalizeCacheTopic(sourceTopic))
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase suggestion lookup failed: ${error.message}`);
    }
    return typeof data?.related_topic === "string" ? data.related_topic : null;
  }

  async saveSuggestion(sourceTopic: string, relatedTopic: string): Promise<void> {
    const { error } = await this.client
      .from("topic_suggestions")
      .upsert({
        source_topic: normalizeCacheTopic(sourceTopic),
        related_topic: relatedTopic
      }, {
        onConflict: "source_topic",
        ignoreDuplicates: true
      });

    if (error) {
      throw new Error(`Supabase suggestion write failed: ${error.message}`);
    }
  }
}

export function createTopicSuggestionRepository(): TopicSuggestionRepository | null {
  const client = getServerSupabaseClient();
  return client ? new SupabaseTopicSuggestionRepository(client) : null;
}

