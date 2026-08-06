import paragraphsEn from "@/data/paragraphs-en.json";
import paragraphsVi from "@/data/paragraphs-vi.json";
import wordsEn from "@/data/words-en.json";
import wordsVi from "@/data/words-vi.json";
import type { TypingLanguage } from "@/lib/typing-engine/engine";
import type { PracticeMode } from "@/store/typingStore";

export type StaticPracticeMode = Exclude<PracticeMode, "custom">;
export const MAX_CUSTOM_TEXT_LENGTH = 5_000;

const STATIC_CONTENT_COUNTS: Record<StaticPracticeMode, number> = {
  words: 90,
  paragraph: 3
};

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function sample<T>(items: readonly T[], count: number, seed: number): T[] {
  const copy = [...items];
  const random = seededRandom(seed);

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy.slice(0, Math.min(count, copy.length));
}

export function createPracticeText(
  mode: StaticPracticeMode,
  language: TypingLanguage,
  seed: number
): string {
  if (mode === "words") {
    const words = language === "en" ? wordsEn.words : wordsVi.words;
    return sample(words, STATIC_CONTENT_COUNTS.words, seed).join(" ");
  }

  const paragraphs = language === "en" ? paragraphsEn.paragraphs : paragraphsVi.paragraphs;
  return sample(paragraphs, STATIC_CONTENT_COUNTS.paragraph, seed).join("\n\n");
}

export function normalizeCustomPracticeText(value: string): string {
  return value
    .replace(/\r\n?/gu, "\n")
    .trim()
    .normalize("NFC");
}
