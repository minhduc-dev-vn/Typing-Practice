import { afterEach, describe, expect, it, vi } from "vitest";

import { CountdownTimer } from "./countdown";
import { TypingEngine } from "./engine";

describe("CountdownTimer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops the engine once time expires and does not accept more input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const engine = new TypingEngine("typing");
    const completed = vi.fn(() => engine.setEnabled(false));
    const timer = new CountdownTimer(30, () => undefined, completed);

    timer.start();
    engine.onKeyPress("t");
    vi.advanceTimersByTime(30_000);

    expect(completed).toHaveBeenCalledOnce();
    expect(engine.getSnapshot().isEnabled).toBe(false);
    expect(engine.onKeyPress("y").accepted).toBe(false);
  });
});
