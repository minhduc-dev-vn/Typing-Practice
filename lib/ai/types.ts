import type { TypingLanguage } from "@/lib/typing-engine/engine";

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const CONTENT_LENGTHS = ["short", "medium", "long"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];
export type ContentLength = (typeof CONTENT_LENGTHS)[number];

export interface GenerateRequest {
  language: TypingLanguage;
  topic: string;
  difficulty: Difficulty;
  length: ContentLength;
}

export interface GenerateResponse {
  content: string[];
  cached: boolean;
  fallback?: boolean;
  message?: string;
}

export interface GenerateErrorResponse {
  error: string;
  code: "INVALID_REQUEST" | "BLOCKED_TOPIC" | "RATE_LIMITED";
  resetAt?: string;
}

export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export function parseGenerateRequest(value: unknown): GenerateRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestValidationError("Request body must be a JSON object.");
  }

  const body = value as Record<string, unknown>;
  const language = body.language;
  const difficulty = body.difficulty;
  const length = body.length;
  const topic = typeof body.topic === "string" ? body.topic.trim().replace(/\s+/gu, " ") : "";

  if (language !== "en" && language !== "vi") {
    throw new RequestValidationError("Language must be either \"en\" or \"vi\".");
  }
  if (!DIFFICULTIES.includes(difficulty as Difficulty)) {
    throw new RequestValidationError("Difficulty must be easy, medium, or hard.");
  }
  if (!CONTENT_LENGTHS.includes(length as ContentLength)) {
    throw new RequestValidationError("Length must be short, medium, or long.");
  }
  if (topic.length < 2 || topic.length > 80) {
    throw new RequestValidationError("Topic must contain between 2 and 80 characters.");
  }

  return {
    language,
    topic,
    difficulty: difficulty as Difficulty,
    length: length as ContentLength
  };
}

export function normalizeCacheTopic(topic: string): string {
  return topic.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}
