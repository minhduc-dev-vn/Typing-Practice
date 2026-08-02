const DEFAULT_TOPICS = [
  "a quiet morning routine",
  "a walk through a city park",
  "learning a useful new skill",
  "a small neighborhood cafe",
  "planning a weekend adventure",
  "healthy habits for busy days",
  "books that change our perspective",
  "simple ways to stay creative"
] as const;

function hash(value: string): number {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.codePointAt(0) ?? 0;
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function getDefaultTopic(userId: string, day: string): string {
  return DEFAULT_TOPICS[hash(`${userId}:${day}`) % DEFAULT_TOPICS.length];
}

