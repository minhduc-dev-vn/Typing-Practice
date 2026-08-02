import { describe, expect, it, vi } from "vitest";

import {
  KeySoundPlayer,
  synthesizeKeySound,
  type KeySoundAudioContext
} from "./key-sound";

interface FakeContext extends KeySoundAudioContext {
  started: number;
  createdBuffers: number;
  playedBuffers: Array<ReturnType<KeySoundAudioContext["createBuffer"]> | null>;
  playbackRates: number[];
  decodeAudioData: ReturnType<typeof vi.fn<(audioData: ArrayBuffer) => Promise<ReturnType<KeySoundAudioContext["createBuffer"]>>>>;
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
    playedBuffers: [],
    playbackRates: [],
    createBuffer: (_channels, length) => {
      context.createdBuffers += 1;
      const channel = new Float32Array(length);
      return { getChannelData: () => channel };
    },
    createBufferSource: () => {
      const source = {
        buffer: null as ReturnType<KeySoundAudioContext["createBuffer"]> | null,
        playbackRate: { value: 1 },
        connect: () => undefined,
        start: () => {
          context.started += 1;
          context.playedBuffers.push(source.buffer);
          context.playbackRates.push(source.playbackRate.value);
        }
      };
      return source;
    },
    createGain: () => ({
      gain: { value: 0 },
      connect: () => undefined
    }),
    decodeAudioData: vi.fn(async () => {
      const channel = new Float32Array(128);
      return { getChannelData: () => channel };
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

  it("uses the bundled recording with subtle key and backspace pitch variation", async () => {
    const context = createFakeContext();
    const loader = vi.fn(async () => new ArrayBuffer(32));
    const player = new KeySoundPlayer(() => context, loader);

    player.setEnabled(true);
    await expect(player.preload()).resolves.toBe(true);
    player.play("key");
    player.play("backspace");

    expect(loader).toHaveBeenCalledOnce();
    expect(context.decodeAudioData).toHaveBeenCalledOnce();
    expect(context.createdBuffers).toBe(0);
    expect(context.playedBuffers[0]).toBe(context.playedBuffers[1]);
    expect(context.playbackRates).toEqual([0.97, 0.82]);
  });

  it("falls back to synthesized audio when the recording cannot be loaded", async () => {
    const context = createFakeContext();
    const loader = vi.fn(async () => { throw new Error("missing sample"); });
    const player = new KeySoundPlayer(() => context, loader);

    player.setEnabled(true);
    await expect(player.preload()).resolves.toBe(false);
    player.play("key");

    expect(context.started).toBe(1);
    expect(context.createdBuffers).toBe(1);
    expect(context.playbackRates).toEqual([1]);
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
