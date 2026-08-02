import paragraphsEn from "@/data/paragraphs-en.json";
import paragraphsVi from "@/data/paragraphs-vi.json";
import sentencesEn from "@/data/sentences-en.json";
import sentencesVi from "@/data/sentences-vi.json";
import type { GenerateRequest } from "@/lib/ai/types";

function hash(value: string): number {
  let result = 2_166_136_261;
  for (const character of value) {
    result ^= character.codePointAt(0) ?? 0;
    result = Math.imul(result, 16_777_619);
  }
  return result >>> 0;
}

function rotateSample(items: readonly string[], count: number, seed: number): string[] {
  const start = seed % items.length;
  return Array.from({ length: Math.min(count, items.length) }, (_, index) => (
    items[(start + index) % items.length]
  ));
}

export function createStaticFallback(request: GenerateRequest): string[] {
  const seed = hash(`${request.language}:${request.topic}:${request.difficulty}:${request.length}`);

  if (request.length === "long") {
    const paragraphs = request.language === "en" ? paragraphsEn.paragraphs : paragraphsVi.paragraphs;
    return rotateSample(paragraphs, 3, seed);
  }

  const sentences = request.language === "en" ? sentencesEn.sentences : sentencesVi.sentences;
  return rotateSample(sentences, request.length === "short" ? 4 : 8, seed);
}
