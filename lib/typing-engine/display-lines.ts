export interface TypingDisplayLine {
  start: number;
  end: number;
}

export const DEFAULT_TYPING_LINE_COLUMNS = 64;

function findExplicitBreak(
  characters: readonly string[],
  start: number,
  limit: number
): number | null {
  for (let index = start; index < limit; index += 1) {
    if (characters[index] === "\n") {
      let end = index + 1;
      while (end < characters.length && characters[end] === "\n") {
        end += 1;
      }
      return end;
    }
  }
  return null;
}

function findWordBreak(
  characters: readonly string[],
  start: number,
  limit: number,
  maxColumns: number
): number | null {
  const minimumLength = Math.max(1, Math.floor(maxColumns * 0.5));
  for (let index = limit - 1; index >= start + minimumLength; index -= 1) {
    if (characters[index] === " " || characters[index] === "\t") {
      return index + 1;
    }
  }
  return null;
}

export function splitTypingDisplayLines(
  text: string,
  maxColumns = DEFAULT_TYPING_LINE_COLUMNS
): TypingDisplayLine[] {
  if (!Number.isInteger(maxColumns) || maxColumns < 1) {
    throw new Error("maxColumns must be a positive integer.");
  }

  const characters = Array.from(text.normalize("NFC"));
  const lines: TypingDisplayLine[] = [];
  let start = 0;

  while (start < characters.length) {
    const limit = Math.min(start + maxColumns, characters.length);
    const explicitBreak = findExplicitBreak(characters, start, limit);
    let end = explicitBreak ?? limit;

    if (explicitBreak === null && limit < characters.length) {
      end = findWordBreak(characters, start, limit, maxColumns) ?? limit;
    }

    lines.push({ start, end });
    start = end;
  }

  return lines;
}

export function findActiveTypingLine(
  lines: readonly TypingDisplayLine[],
  currentIndex: number
): number {
  if (lines.length === 0) {
    return 0;
  }

  const normalizedIndex = Math.max(0, Math.trunc(currentIndex));
  const activeLine = lines.findIndex(({ end }) => normalizedIndex < end);
  return activeLine === -1 ? lines.length - 1 : activeLine;
}
