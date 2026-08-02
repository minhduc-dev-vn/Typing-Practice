const BLOCKED_KEYWORDS = [
  "child abuse",
  "explosive weapon",
  "giet nguoi",
  "khung bo",
  "ma tuy",
  "pornography",
  "self harm",
  "sexual violence",
  "tu sat"
] as const;

export function normalizeForKeywordCheck(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/đ/gu, "d")
    .replace(/Đ/gu, "D")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function findBlockedKeyword(topic: string): string | null {
  const normalizedTopic = ` ${normalizeForKeywordCheck(topic)} `;
  return BLOCKED_KEYWORDS.find((keyword) => normalizedTopic.includes(` ${keyword} `)) ?? null;
}
