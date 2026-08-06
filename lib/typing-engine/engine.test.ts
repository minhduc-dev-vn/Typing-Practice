import { describe, expect, it } from "vitest";

import { TypingEngine, calculateTypingResult } from "./engine";

describe("TypingEngine", () => {
  it("types a complete English phrase with 100% accuracy and correct metrics", () => {
    const engine = new TypingEngine("hello world");

    for (const character of "hello world") {
      engine.onKeyPress(character);
    }

    const snapshot = engine.getSnapshot();
    const result = engine.getResult("en", 60_000);

    expect(snapshot.isComplete).toBe(true);
    expect(snapshot.states.every((state) => state === "correct")).toBe(true);
    expect(result.accuracy).toBe(100);
    expect(result.wpm).toBeCloseTo(2.2);
    expect(result.cpm).toBe(11);
    expect(result.errors).toBe(0);
  });

  it("removes the incorrect state when backspace is used before correcting it", () => {
    const engine = new TypingEngine("cat");

    engine.onKeyPress("c");
    engine.onKeyPress("x");
    expect(engine.getSnapshot().states).toEqual(["correct", "incorrect", "pending"]);

    engine.onBackspace();
    expect(engine.getSnapshot().states).toEqual(["correct", "pending", "pending"]);

    engine.onKeyPress("a");
    engine.onKeyPress("t");
    expect(engine.getResult("en", 30_000)).toMatchObject({ accuracy: 100, errors: 0 });
  });

  it("locks completed words after space while keeping the current word editable", () => {
    const engine = new TypingEngine("cat dog");

    for (const character of "cat ") {
      engine.onKeyPress(character);
    }

    expect(engine.getSnapshot()).toMatchObject({ currentIndex: 4, backspaceFloor: 4 });
    expect(engine.onBackspace().accepted).toBe(false);
    expect(engine.getSnapshot().currentIndex).toBe(4);

    engine.onKeyPress("d");
    engine.onKeyPress("x");
    expect(engine.onBackspace().accepted).toBe(true);
    expect(engine.onBackspace().accepted).toBe(true);
    expect(engine.onBackspace().accepted).toBe(false);
    expect(engine.getSnapshot()).toMatchObject({ currentIndex: 4, backspaceFloor: 4 });
  });

  it("ignores Space when the current word has no typed characters", () => {
    const engine = new TypingEngine("cat dog");

    expect(engine.onKeyPress(" ").accepted).toBe(false);
    expect(engine.getSnapshot()).toMatchObject({ currentIndex: 0, backspaceFloor: 0 });

    for (const character of "cat ") {
      engine.onKeyPress(character);
    }
    const snapshotBeforeSecondSpace = engine.getSnapshot();

    expect(engine.onKeyPress(" ").accepted).toBe(false);
    expect(engine.getSnapshot()).toMatchObject({
      currentIndex: snapshotBeforeSecondSpace.currentIndex,
      backspaceFloor: snapshotBeforeSecondSpace.backspaceFloor,
      extraErrors: snapshotBeforeSecondSpace.extraErrors,
      states: snapshotBeforeSecondSpace.states
    });
    expect(engine.getResult("en", 60_000)).toMatchObject({ errors: 0 });
  });

  it("keeps extra characters attached to the current word and counts them as errors", () => {
    const engine = new TypingEngine("cat dog");
    const overflowElement = { textContent: "" } as HTMLElement;
    engine.attachOverflowElements(new Map([[3, overflowElement]]));

    for (const character of "catxy") {
      engine.onKeyPress(character);
    }

    expect(engine.getSnapshot()).toMatchObject({ currentIndex: 3, extraErrors: 2 });
    expect(engine.getSnapshot().states[3]).toBe("pending");
    expect(overflowElement.textContent).toBe("xy");
    expect(engine.getResult("en", 60_000)).toMatchObject({
      errors: 2,
      typedCharacters: 5,
      accuracy: 60
    });

    expect(engine.onBackspace().accepted).toBe(true);
    expect(engine.getSnapshot()).toMatchObject({ currentIndex: 3, extraErrors: 1 });
    expect(overflowElement.textContent).toBe("x");
  });

  it("marks missing characters as errors when space or ArrowRight commits a word", () => {
    const withSpace = new TypingEngine("cat dog");
    withSpace.onKeyPress("c");
    withSpace.onKeyPress(" ");

    expect(withSpace.getSnapshot()).toMatchObject({ currentIndex: 4, backspaceFloor: 4 });
    expect(withSpace.getSnapshot().states.slice(0, 4)).toEqual([
      "correct",
      "incorrect",
      "incorrect",
      "correct"
    ]);

    const withArrow = new TypingEngine("cat dog");
    withArrow.onKeyPress("c");
    expect(withArrow.skipCurrentWord().accepted).toBe(true);
    expect(withArrow.getSnapshot()).toMatchObject({ currentIndex: 4, backspaceFloor: 4 });
    expect(withArrow.getSnapshot().states.slice(0, 4)).toEqual([
      "correct",
      "incorrect",
      "incorrect",
      "incorrect"
    ]);
  });

  it("finishes an incomplete final word when space commits it", () => {
    const engine = new TypingEngine("cat");
    engine.onKeyPress("c");

    const operation = engine.onKeyPress(" ");

    expect(operation.completed).toBe(true);
    expect(engine.getSnapshot().states).toEqual(["correct", "incorrect", "incorrect"]);
  });

  it("does not count a Vietnamese syllable as correct while it has overflow errors", () => {
    const engine = new TypingEngine("xin chào");
    for (const character of "xinz") {
      engine.onKeyPress(character);
    }

    expect(engine.getResult("vi", 60_000)).toMatchObject({
      correctSyllables: 0,
      errors: 1
    });
  });

  it("accepts completed Unicode text from the operating system IME", () => {
    const engine = new TypingEngine("xin chào bạn");

    engine.onTextInput("xin ");
    engine.onTextInput("chào ");
    engine.onTextInput("bạn");

    expect(engine.getSnapshot()).toMatchObject({ isComplete: true, extraErrors: 0 });
    expect(engine.getSnapshot().states.every((state) => state === "correct")).toBe(true);
    expect(engine.getResult("vi", 60_000)).toMatchObject({
      accuracy: 100,
      correctSyllables: 3
    });
  });

  it("reconciles operating-system composition updates in real time", () => {
    const engine = new TypingEngine("chào bạn");

    engine.onCompositionUpdate("", "c");
    expect(engine.getSnapshot()).toMatchObject({ currentIndex: 1, isComplete: false });
    engine.onCompositionUpdate("c", "ch");
    expect(engine.getSnapshot().currentIndex).toBe(2);
    engine.onCompositionUpdate("ch", "cha");
    expect(engine.getSnapshot().states.slice(0, 3)).toEqual(["correct", "correct", "incorrect"]);
    engine.onCompositionUpdate("cha", "chao");
    expect(engine.getSnapshot().currentIndex).toBe(4);

    engine.onCompositionUpdate("chao", "chào");

    expect(engine.getSnapshot()).toMatchObject({ currentIndex: 4, extraErrors: 0 });
    expect(engine.getSnapshot().states.slice(0, 4)).toEqual([
      "correct",
      "correct",
      "correct",
      "correct"
    ]);
  });

  it("keeps provisional overflow synchronized when an IME revises its composition", () => {
    const engine = new TypingEngine("á");

    engine.onCompositionUpdate("", "a");
    engine.onCompositionUpdate("a", "az");
    expect(engine.getSnapshot()).toMatchObject({ currentIndex: 1, extraErrors: 1 });

    engine.onCompositionUpdate("az", "á");

    expect(engine.getSnapshot()).toMatchObject({ currentIndex: 1, extraErrors: 0 });
    expect(engine.getSnapshot().states).toEqual(["correct"]);
  });

  it("keeps overflow errors inside an IME-composed Vietnamese word", () => {
    const engine = new TypingEngine("chào bạn");

    engine.onTextInput("chàoz");

    expect(engine.getSnapshot()).toMatchObject({ currentIndex: 4, extraErrors: 1 });
    expect(engine.getSnapshot().states[4]).toBe("pending");
    expect(engine.getResult("vi", 60_000)).toMatchObject({ errors: 1, correctSyllables: 0 });
  });

  it("resets cursor and character states when switching content mode", () => {
    const engine = new TypingEngine("A short sentence.");
    engine.onKeyPress("A");
    engine.onKeyPress(" ");

    engine.reset("A longer paragraph starts here.");

    expect(engine.getTarget()).toBe("A longer paragraph starts here.");
    expect(engine.getSnapshot()).toMatchObject({ currentIndex: 0, backspaceFloor: 0, isComplete: false });
    expect(engine.getSnapshot().states.every((state) => state === "pending")).toBe(true);
  });

  it("loops completed content while preserving metrics from earlier cycles", () => {
    const engine = new TypingEngine("cat");

    for (const character of "cx ") {
      engine.onKeyPress(character);
    }
    expect(engine.getSnapshot().isComplete).toBe(true);
    expect(engine.continueFromStart()).toBe(true);
    expect(engine.getSnapshot()).toMatchObject({
      currentIndex: 0,
      backspaceFloor: 0,
      extraErrors: 0,
      isComplete: false
    });

    for (const character of "cat") {
      engine.onKeyPress(character);
    }

    const result = engine.getResult("en", 60_000);
    expect(result).toMatchObject({
      correctCharacters: 4,
      errors: 2,
      typedCharacters: 6,
      cpm: 4,
      wpm: 0.8
    });
    expect(result.accuracy).toBeCloseTo(400 / 6);
  });

  it("clears accumulated cycle metrics when the session is reset", () => {
    const engine = new TypingEngine("a");

    engine.onKeyPress("a");
    engine.continueFromStart();
    engine.reset("b");

    expect(engine.getResult("en", 60_000)).toMatchObject({
      correctCharacters: 0,
      errors: 0,
      typedCharacters: 0
    });
    expect(engine.continueFromStart()).toBe(false);
  });

  it("updates attached character elements directly through classList", () => {
    const classNames = new Set<string>();
    const element = {
      classList: {
        add: (...names: string[]) => names.forEach((name) => classNames.add(name)),
        remove: (...names: string[]) => names.forEach((name) => classNames.delete(name))
      }
    } as unknown as HTMLElement;
    const engine = new TypingEngine("a");

    engine.attachElements([element]);
    expect(classNames).toContain("char-current");

    engine.onKeyPress("a");
    expect(classNames).toContain("char-correct");
    expect(classNames).not.toContain("char-current");
  });

  it("calculates Vietnamese WPM by correct whitespace-delimited syllables", () => {
    const result = calculateTypingResult(
      "xin chào",
      Array.from("xin chào", () => "correct"),
      "vi",
      60_000
    );

    expect(result.wpm).toBe(2);
    expect(result.cpm).toBe(8);
    expect(result.correctSyllables).toBe(2);
    expect(result.accuracy).toBe(100);
  });

  it("keeps simulated keystroke processing below one 16ms frame", () => {
    const target = "a".repeat(2_000);
    const engine = new TypingEngine(target);
    const mockElements = Array.from({ length: target.length }, () => {
      const classNames = new Set<string>();
      return {
        classList: {
          add: (...names: string[]) => names.forEach((name) => classNames.add(name)),
          remove: (...names: string[]) => names.forEach((name) => classNames.delete(name))
        }
      } as unknown as HTMLElement;
    });
    const measurements: number[] = [];
    engine.attachElements(mockElements);

    for (const character of target) {
      measurements.push(engine.onKeyPress(character).latencyMs);
    }

    const measuredMaximum = Math.max(...measurements);
    const measuredAverage = measurements.reduce((sum, value) => sum + value, 0) / measurements.length;
    console.info(
      `[latency] 2,000 simulated keystrokes with classList updates: average=${measuredAverage.toFixed(4)}ms max=${measuredMaximum.toFixed(4)}ms`
    );
    expect(measuredMaximum).toBeLessThan(16);
    expect(engine.getSnapshot().maxLatencyMs).toBe(measuredMaximum);
  });
});
