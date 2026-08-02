import type { TypingLanguage, TypingResult } from "@/lib/typing-engine/engine";
import type { PracticeMode } from "@/store/typingStore";

export interface PracticeHistoryRow {
  id: string;
  user_id: string;
  mode: PracticeMode;
  language: TypingLanguage;
  topic: string | null;
  wpm: number;
  accuracy: number;
  cpm: number;
  errors: number;
  duration_seconds: number;
  created_at: string;
}

export interface FavoriteTopicRow {
  id: string;
  user_id: string;
  topic: string;
  created_at: string;
}

export interface SavePracticeInput {
  userId: string;
  mode: PracticeMode;
  language: TypingLanguage;
  topic: string | null;
  result: TypingResult;
}
