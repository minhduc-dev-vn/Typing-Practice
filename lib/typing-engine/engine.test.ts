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

  it("resets cursor and character states when switching content mode", () => {
    const engine = new TypingEngine("A short sentence.");
    engine.onKeyPress("A");
    engine.onKeyPress(" ");

    engine.reset("A longer paragraph starts here.");

    expect(engine.getTarget()).toBe("A longer paragraph starts here.");
    expect(engine.getSnapshot()).toMatchObject({ currentIndex: 0, isComplete: false });
    expect(engine.getSnapshot().states.every((state) => state === "pending")).toBe(true);
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
