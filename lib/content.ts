import paragraphsEn from "@/data/paragraphs-en.json";
import paragraphsVi from "@/data/paragraphs-vi.json";
import sentencesEn from "@/data/sentences-en.json";
import sentencesVi from "@/data/sentences-vi.json";
import wordsEn from "@/data/words-en.json";
import wordsVi from "@/data/words-vi.json";
import type { TypingLanguage } from "@/lib/typing-engine/engine";
import type { PracticeMode, TimeLimit } from "@/store/typingStore";

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
  mode: PracticeMode,
  language: TypingLanguage,
  timeLimit: TimeLimit,
  seed: number
): string {
  if (mode === "words") {
    const words = language === "en" ? wordsEn.words : wordsVi.words;
    return sample(words, Math.ceil(timeLimit * 1.5), seed).join(" ");
  }

  if (mode === "sentences") {
    const sentences = language === "en" ? sentencesEn.sentences : sentencesVi.sentences;
    return sample(sentences, Math.ceil(timeLimit / 8), seed).join(" ");
  }

  const paragraphs = language === "en" ? paragraphsEn.paragraphs : paragraphsVi.paragraphs;
  return sample(paragraphs, Math.ceil(timeLimit / 25), seed).join("\n\n");
}

export function createGeneratedPracticeText(
  content: readonly string[],
  mode: PracticeMode
): string {
  const normalizedContent = content
    .map((item) => item.trim().normalize("NFC"))
    .filter(Boolean);

  if (normalizedContent.length === 0) {
    throw new Error("Generated content must contain at least one non-empty item.");
  }

  return normalizedContent.join(mode === "paragraph" ? "\n\n" : " ");
}
