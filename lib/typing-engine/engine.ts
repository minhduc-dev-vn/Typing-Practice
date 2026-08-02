export type CharacterState = "correct" | "incorrect" | "pending";
export type TypingLanguage = "en" | "vi";

export interface TypingSnapshot {
  currentIndex: number;
  states: CharacterState[];
  isComplete: boolean;
  isEnabled: boolean;
  maxLatencyMs: number;
}

export interface KeyOperationResult {
  accepted: boolean;
  completed: boolean;
  latencyMs: number;
}

export interface TypingResult {
  wpm: number;
  cpm: number;
  accuracy: number;
  errors: number;
  correctCharacters: number;
  typedCharacters: number;
  correctSyllables: number;
  durationSeconds: number;
  maxLatencyMs: number;
}

const STATE_CLASSES = ["char-correct", "char-incorrect", "char-pending", "char-current"];

export class TypingEngine {
  private targetCharacters: string[];
  private states: CharacterState[];
  private elements: Array<HTMLElement | null> = [];
  private currentIndex = 0;
  private enabled = true;
  private maxLatencyMs = 0;

  constructor(target: string) {
    this.targetCharacters = Array.from(target.normalize("NFC"));
    this.states = this.targetCharacters.map(() => "pending");
  }

  attachElements(elements: ArrayLike<HTMLElement | null>): void {
    this.elements = Array.from(elements);
    this.syncAllElements();
  }

  onKeyPress(char: string): KeyOperationResult {
    const startedAt = performance.now();
    const normalizedCharacters = Array.from(char.normalize("NFC"));

    if (!this.enabled || this.isComplete() || normalizedCharacters.length !== 1) {
      return this.completeOperation(startedAt, false);
    }

    const index = this.currentIndex;
    this.states[index] = normalizedCharacters[0] === this.targetCharacters[index]
      ? "correct"
      : "incorrect";
    this.currentIndex += 1;
    this.syncElement(index);
    this.syncElement(this.currentIndex);

    return this.completeOperation(startedAt, true);
  }

  onBackspace(): KeyOperationResult {
    const startedAt = performance.now();

    if (!this.enabled || this.currentIndex === 0) {
      return this.completeOperation(startedAt, false);
    }

    const previousCursor = this.currentIndex;
    this.currentIndex -= 1;
    this.states[this.currentIndex] = "pending";
    this.syncElement(previousCursor);
    this.syncElement(this.currentIndex);

    return this.completeOperation(startedAt, true);
  }

  reset(target?: string): void {
    if (target !== undefined) {
      this.targetCharacters = Array.from(target.normalize("NFC"));
    }

    this.states = this.targetCharacters.map(() => "pending");
    this.currentIndex = 0;
    this.enabled = true;
    this.maxLatencyMs = 0;
    this.syncAllElements();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.syncElement(this.currentIndex);
  }

  getTarget(): string {
    return this.targetCharacters.join("");
  }

  getSnapshot(): TypingSnapshot {
    return {
      currentIndex: this.currentIndex,
      states: [...this.states],
      isComplete: this.isComplete(),
      isEnabled: this.enabled,
      maxLatencyMs: this.maxLatencyMs
    };
  }

  getResult(language: TypingLanguage, elapsedMs: number): TypingResult {
    return calculateTypingResult(
      this.getTarget(),
      this.states,
      language,
      elapsedMs,
      this.maxLatencyMs
    );
  }

  private isComplete(): boolean {
    return this.currentIndex >= this.targetCharacters.length;
  }

  private completeOperation(startedAt: number, accepted: boolean): KeyOperationResult {
    const latencyMs = performance.now() - startedAt;
    this.maxLatencyMs = Math.max(this.maxLatencyMs, latencyMs);

    return {
      accepted,
      completed: this.isComplete(),
      latencyMs
    };
  }

  private syncAllElements(): void {
    for (let index = 0; index < this.elements.length; index += 1) {
      this.syncElement(index);
    }
  }

  private syncElement(index: number): void {
    const element = this.elements[index];
    if (!element) {
      return;
    }

    element.classList.remove(...STATE_CLASSES);
    element.classList.add(`char-${this.states[index] ?? "pending"}`);

    if (this.enabled && !this.isComplete() && index === this.currentIndex) {
      element.classList.add("char-current");
    }
  }
}

export function calculateTypingResult(
  target: string,
  states: readonly CharacterState[],
  language: TypingLanguage,
  elapsedMs: number,
  maxLatencyMs = 0
): TypingResult {
  const correctCharacters = states.filter((state) => state === "correct").length;
  const errors = states.filter((state) => state === "incorrect").length;
  const typedCharacters = correctCharacters + errors;
  const durationSeconds = Math.max(0, elapsedMs / 1000);
  const minutes = durationSeconds / 60;
  const correctSyllables = countCorrectSyllables(target, states);

  const wpm = minutes > 0
    ? language === "en"
      ? correctCharacters / 5 / minutes
      : correctSyllables / minutes
    : 0;
  const cpm = minutes > 0 ? correctCharacters / minutes : 0;
  const accuracy = typedCharacters > 0 ? (correctCharacters / typedCharacters) * 100 : 0;

  return {
    wpm,
    cpm,
    accuracy,
    errors,
    correctCharacters,
    typedCharacters,
    correctSyllables,
    durationSeconds,
    maxLatencyMs
  };
}

export function countCorrectSyllables(
  target: string,
  states: readonly CharacterState[]
): number {
  const characters = Array.from(target.normalize("NFC"));
  let syllableIndexes: number[] = [];
  let correctSyllables = 0;

  const finishSyllable = () => {
    if (
      syllableIndexes.length > 0 &&
      syllableIndexes.every((index) => states[index] === "correct")
    ) {
      correctSyllables += 1;
    }
    syllableIndexes = [];
  };

  characters.forEach((character, index) => {
    if (/\s/u.test(character)) {
      finishSyllable();
    } else {
      syllableIndexes.push(index);
    }
  });
  finishSyllable();

  return correctSyllables;
}
