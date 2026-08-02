import { describe, expect, it, vi } from "vitest";

import {
  KeySoundPlayer,
  synthesizeKeySound,
  type KeySoundAudioContext
} from "./key-sound";

interface FakeContext extends KeySoundAudioContext {
  started: number;
  resume: ReturnType<typeof vi.fn<() => Promise<void>>>;
  close: ReturnType<typeof vi.fn<() => Promise<void>>>;
}

function createFakeContext(initialState: "running" | "suspended" = "running"): FakeContext {
  const context: FakeContext = {
    state: initialState,
    sampleRate: 48_000,
    destination: {},
    started: 0,
    createBuffer: (_channels, length) => {
      const channel = new Float32Array(length);
      return { getChannelData: () => channel };
    },
    createBufferSource: () => ({
      buffer: null,
      connect: () => undefined,
      start: () => { context.started += 1; }
    }),
    createGain: () => ({
      gain: { value: 0 },
      connect: () => undefined
    }),
    resume: vi.fn(async () => { context.state = "running"; }),
    close: vi.fn(async () => { context.state = "closed"; })
  };
  return context;
}

describe("typing key sounds", () => {
  it("synthesizes deterministic, bounded and distinct key sounds", () => {
    const key = synthesizeKeySound("key", 48_000);
    const secondKey = synthesizeKeySound("key", 48_000);
    const backspace = synthesizeKeySound("backspace", 48_000);

    expect(key).toEqual(secondKey);
    expect(key.length).toBe(1_248);
    expect(backspace.length).toBe(2_160);
    expect([...key].every((sample) => sample >= -1 && sample <= 1)).toBe(true);
    expect(backspace).not.toEqual(key);
    expect(Math.abs(key.at(-1) ?? 1)).toBeLessThan(0.001);
  });

  it("does not initialize Web Audio while sound is disabled", () => {
    const factory = vi.fn(() => createFakeContext());
    const player = new KeySoundPlayer(factory);

    player.play("key");

    expect(factory).not.toHaveBeenCalled();
  });

  it("plays overlapping key and backspace buffers when enabled", () => {
    const context = createFakeContext();
    const player = new KeySoundPlayer(() => context);
    player.setEnabled(true);

    player.play("key");
    player.play("backspace");

    expect(context.started).toBe(2);
  });

  it("resumes a suspended context and closes it on dispose", async () => {
    const context = createFakeContext("suspended");
    const player = new KeySoundPlayer(() => context);
    player.setEnabled(true);

    player.play("key");
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.started).toBe(1);

    player.dispose();
    expect(context.close).toHaveBeenCalledOnce();
  });
});
