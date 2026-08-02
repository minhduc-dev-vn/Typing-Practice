import { describe, expect, it, vi } from "vitest";

import {
  KeySoundPlayer,
  synthesizeKeySound,
  type KeySoundAudioContext
} from "./key-sound";

interface FakeContext extends KeySoundAudioContext {
  started: number;
  createdBuffers: number;
  resume: ReturnType<typeof vi.fn<() => Promise<void>>>;
  close: ReturnType<typeof vi.fn<() => Promise<void>>>;
}

function createFakeContext(initialState: "running" | "suspended" = "running"): FakeContext {
  const context: FakeContext = {
    state: initialState,
    sampleRate: 48_000,
    destination: {},
    started: 0,
    createdBuffers: 0,
    createBuffer: (_channels, length) => {
      context.createdBuffers += 1;
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
  it("synthesizes deterministic, bounded and layered mechanical key sounds", () => {
    const key = synthesizeKeySound("key", 48_000);
    const secondKey = synthesizeKeySound("key", 48_000);
    const backspace = synthesizeKeySound("backspace", 48_000);
    const variant = synthesizeKeySound("key", 48_000, 1);

    expect(key).toEqual(secondKey);
    expect(key.length).toBe(3_456);
    expect(backspace.length).toBe(4_704);
    expect([...key].every((sample) => sample >= -1 && sample <= 1)).toBe(true);
    expect(backspace).not.toEqual(key);
    expect(variant).not.toEqual(key);
    expect(Math.max(...key.map(Math.abs))).toBeCloseTo(0.8, 5);
    expect(Math.max(...backspace.map(Math.abs))).toBeCloseTo(0.86, 5);
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

  it("cycles a finite variation pool instead of allocating a buffer on every key", () => {
    const context = createFakeContext();
    const player = new KeySoundPlayer(() => context);
    player.setEnabled(true);

    for (let index = 0; index < 15; index += 1) {
      player.play("key");
    }

    expect(context.started).toBe(15);
    expect(context.createdBuffers).toBe(7);
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
