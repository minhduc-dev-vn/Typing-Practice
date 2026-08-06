export type CharacterState = "correct" | "incorrect" | "pending";
export type TypingLanguage = "en" | "vi";

export interface TypingSnapshot {
  currentIndex: number;
  backspaceFloor: number;
  extraErrors: number;
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
  private overflowElements = new Map<number, HTMLElement | null>();
  private overflowErrors = new Map<number, string[]>();
  private currentIndex = 0;
  private backspaceFloor = 0;
  private enabled = true;
  private maxLatencyMs = 0;
  private completedCorrectCharacters = 0;
  private completedErrors = 0;
  private completedCorrectSyllables = 0;

  constructor(target: string) {
    this.targetCharacters = Array.from(target.normalize("NFC"));
    this.states = this.targetCharacters.map(() => "pending");
  }

  attachElements(elements: ArrayLike<HTMLElement | null>): void {
    this.elements = Array.from(elements);
    this.syncAllElements();
  }

  attachOverflowElements(elements: ReadonlyMap<number, HTMLElement | null>): void {
    this.overflowElements = new Map(elements);
    this.syncAllOverflowElements();
  }

  onKeyPress(char: string): KeyOperationResult {
    const startedAt = performance.now();
    const normalizedCharacters = Array.from(char.normalize("NFC"));

    if (!this.enabled || normalizedCharacters.length !== 1) {
      return this.completeOperation(startedAt, false);
    }

    const typedCharacter = normalizedCharacters[0];
    if (this.isComplete()) {
      if (!/\s/u.test(typedCharacter)) {
        this.appendOverflowError(this.targetCharacters.length, typedCharacter);
        return this.completeOperation(startedAt, true);
      }
      return this.completeOperation(startedAt, false);
    }

    if (/\s/u.test(typedCharacter)) {
      return this.commitCurrentWord(typedCharacter, startedAt);
    }

    const wordEnd = this.findCurrentWordEnd();
    if (this.currentIndex >= wordEnd) {
      this.appendOverflowError(wordEnd, typedCharacter);
      return this.completeOperation(startedAt, true);
    }

    const index = this.currentIndex;
    this.states[index] = typedCharacter === this.targetCharacters[index]
      ? "correct"
      : "incorrect";
    this.currentIndex += 1;
    this.syncElement(index);
    this.syncElement(this.currentIndex);

    return this.completeOperation(startedAt, true);
  }

  onTextInput(text: string): KeyOperationResult {
    const startedAt = performance.now();
    const characters = Array.from(text.normalize("NFC"));
    if (!this.enabled || characters.length === 0) {
      return this.completeOperation(startedAt, false);
    }

    let accepted = false;
    for (const character of characters) {
      const operation = this.onKeyPress(character);
      accepted ||= operation.accepted;
      if (operation.completed) {
        break;
      }
    }
    return this.completeOperation(startedAt, accepted);
  }

  onCompositionUpdate(previousText: string, nextText: string): KeyOperationResult {
    const startedAt = performance.now();
    if (!this.enabled) {
      return this.completeOperation(startedAt, false);
    }

    const previousCharacters = Array.from(previousText.normalize("NFC"));
    const nextCharacters = Array.from(nextText.normalize("NFC"));
    let sharedPrefixLength = 0;
    while (
      sharedPrefixLength < previousCharacters.length &&
      sharedPrefixLength < nextCharacters.length &&
      previousCharacters[sharedPrefixLength] === nextCharacters[sharedPrefixLength]
    ) {
      sharedPrefixLength += 1;
    }

    let accepted = false;
    for (let index = sharedPrefixLength; index < previousCharacters.length; index += 1) {
      const operation = this.onBackspace();
      accepted = operation.accepted || accepted;
    }
    for (const character of nextCharacters.slice(sharedPrefixLength)) {
      const operation = this.onKeyPress(character);
      accepted = operation.accepted || accepted;
    }
    return this.completeOperation(startedAt, accepted);
  }

  onBackspace(): KeyOperationResult {
    const startedAt = performance.now();

    if (!this.enabled) {
      return this.completeOperation(startedAt, false);
    }

    const wordEnd = this.findCurrentWordEnd();
    const overflow = this.overflowErrors.get(wordEnd);
    if (overflow && overflow.length > 0) {
      overflow.pop();
      if (overflow.length === 0) {
        this.overflowErrors.delete(wordEnd);
      }
      this.syncOverflowElement(wordEnd);
      return this.completeOperation(startedAt, true);
    }

    if (this.currentIndex <= this.backspaceFloor) {
      return this.completeOperation(startedAt, false);
    }

    const previousCursor = this.currentIndex;
    this.currentIndex -= 1;
    this.states[this.currentIndex] = "pending";
    this.syncElement(previousCursor);
    this.syncElement(this.currentIndex);

    return this.completeOperation(startedAt, true);
  }

  skipCurrentWord(): KeyOperationResult {
    const startedAt = performance.now();
    if (!this.enabled || this.isComplete()) {
      return this.completeOperation(startedAt, false);
    }

    const wordEnd = this.findCurrentWordEnd();
    for (let index = this.currentIndex; index < wordEnd; index += 1) {
      this.states[index] = "incorrect";
      this.syncElement(index);
    }

    if (wordEnd < this.targetCharacters.length) {
      this.states[wordEnd] = "incorrect";
      this.currentIndex = wordEnd + 1;
      this.syncElement(wordEnd);
    } else {
      this.currentIndex = wordEnd;
    }
    this.backspaceFloor = this.currentIndex;
    this.syncElement(this.currentIndex);
    return this.completeOperation(startedAt, true);
  }

  reset(target?: string): void {
    if (target !== undefined) {
      this.targetCharacters = Array.from(target.normalize("NFC"));
    }

    this.completedCorrectCharacters = 0;
    this.completedErrors = 0;
    this.completedCorrectSyllables = 0;
    this.enabled = true;
    this.maxLatencyMs = 0;
    this.resetCurrentCycle();
  }

  continueFromStart(): boolean {
    if (!this.enabled || !this.isComplete()) {
      return false;
    }

    this.completedCorrectCharacters += this.states.filter((state) => state === "correct").length;
    this.completedErrors += this.states.filter((state) => state === "incorrect").length
      + this.getOverflowErrorCount();
    this.completedCorrectSyllables += countCorrectSyllables(
      this.getTarget(),
      this.states,
      new Set(this.overflowErrors.keys())
    );
    this.resetCurrentCycle();
    return true;
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
      backspaceFloor: this.backspaceFloor,
      extraErrors: this.getOverflowErrorCount(),
      states: [...this.states],
      isComplete: this.isComplete(),
      isEnabled: this.enabled,
      maxLatencyMs: this.maxLatencyMs
    };
  }

  getResult(language: TypingLanguage, elapsedMs: number): TypingResult {
    const correctCharacters = this.completedCorrectCharacters
      + this.states.filter((state) => state === "correct").length;
    const errors = this.completedErrors
      + this.states.filter((state) => state === "incorrect").length
      + this.getOverflowErrorCount();
    const correctSyllables = this.completedCorrectSyllables + countCorrectSyllables(
      this.getTarget(),
      this.states,
      new Set(this.overflowErrors.keys())
    );

    return createTypingResult(
      correctCharacters,
      errors,
      correctSyllables,
      language,
      elapsedMs,
      this.maxLatencyMs
    );
  }

  private commitCurrentWord(typedDelimiter: string, startedAt: number): KeyOperationResult {
    if (typedDelimiter === " " && this.currentIndex === this.backspaceFloor) {
      return this.completeOperation(startedAt, false);
    }

    const wordEnd = this.findCurrentWordEnd();
    if (wordEnd === this.targetCharacters.length && typedDelimiter === " ") {
      for (let index = this.currentIndex; index < wordEnd; index += 1) {
        this.states[index] = "incorrect";
        this.syncElement(index);
      }
      this.currentIndex = wordEnd;
      this.backspaceFloor = this.currentIndex;
      return this.completeOperation(startedAt, true);
    }

    if (this.targetCharacters[wordEnd] !== typedDelimiter) {
      this.appendOverflowError(wordEnd, typedDelimiter);
      return this.completeOperation(startedAt, true);
    }

    for (let index = this.currentIndex; index < wordEnd; index += 1) {
      this.states[index] = "incorrect";
      this.syncElement(index);
    }
    this.states[wordEnd] = "correct";
    this.currentIndex = wordEnd + 1;
    this.backspaceFloor = this.currentIndex;
    this.syncElement(wordEnd);
    this.syncElement(this.currentIndex);
    return this.completeOperation(startedAt, true);
  }

  private findCurrentWordEnd(): number {
    let wordEnd = this.currentIndex;
    while (
      wordEnd < this.targetCharacters.length &&
      !/\s/u.test(this.targetCharacters[wordEnd])
    ) {
      wordEnd += 1;
    }
    return wordEnd;
  }

  private appendOverflowError(wordEnd: number, character: string): void {
    const overflow = this.overflowErrors.get(wordEnd) ?? [];
    overflow.push(character === " " ? "·" : character === "\n" ? "↵" : character);
    this.overflowErrors.set(wordEnd, overflow);
    this.syncOverflowElement(wordEnd);
  }

  private getOverflowErrorCount(): number {
    let count = 0;
    for (const characters of this.overflowErrors.values()) {
      count += characters.length;
    }
    return count;
  }

  private resetCurrentCycle(): void {
    this.states = this.targetCharacters.map(() => "pending");
    this.overflowErrors.clear();
    this.currentIndex = 0;
    this.backspaceFloor = 0;
    this.syncAllElements();
    this.syncAllOverflowElements();
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

  private syncAllOverflowElements(): void {
    for (const wordEnd of this.overflowElements.keys()) {
      this.syncOverflowElement(wordEnd);
    }
  }

  private syncOverflowElement(wordEnd: number): void {
    const element = this.overflowElements.get(wordEnd);
    if (element) {
      element.textContent = this.overflowErrors.get(wordEnd)?.join("") ?? "";
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
  maxLatencyMs = 0,
  extraErrors = 0,
  overflowWordEnds: ReadonlySet<number> = new Set()
): TypingResult {
  const correctCharacters = states.filter((state) => state === "correct").length;
  const errors = states.filter((state) => state === "incorrect").length + extraErrors;
  const correctSyllables = countCorrectSyllables(target, states, overflowWordEnds);

  return createTypingResult(
    correctCharacters,
    errors,
    correctSyllables,
    language,
    elapsedMs,
    maxLatencyMs
  );
}

function createTypingResult(
  correctCharacters: number,
  errors: number,
  correctSyllables: number,
  language: TypingLanguage,
  elapsedMs: number,
  maxLatencyMs: number
): TypingResult {
  const typedCharacters = correctCharacters + errors;
  const durationSeconds = Math.max(0, elapsedMs / 1000);
  const minutes = durationSeconds / 60;

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
  states: readonly CharacterState[],
  overflowWordEnds: ReadonlySet<number> = new Set()
): number {
  const characters = Array.from(target.normalize("NFC"));
  let syllableIndexes: number[] = [];
  let correctSyllables = 0;

  const finishSyllable = (wordEnd: number) => {
    if (
      syllableIndexes.length > 0 &&
      !overflowWordEnds.has(wordEnd) &&
      syllableIndexes.every((index) => states[index] === "correct")
    ) {
      correctSyllables += 1;
    }
    syllableIndexes = [];
  };

  characters.forEach((character, index) => {
    if (/\s/u.test(character)) {
      finishSyllable(index);
    } else {
      syllableIndexes.push(index);
    }
  });
  finishSyllable(characters.length);

  return correctSyllables;
}
