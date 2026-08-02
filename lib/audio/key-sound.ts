export type KeySoundKind = "key" | "backspace";

interface AudioBufferPort {
  getChannelData: (channel: number) => Float32Array;
}

interface AudioBufferSourcePort {
  buffer: AudioBufferPort | null;
  connect: (target: unknown) => void;
  start: () => void;
}

interface GainPort {
  gain: { value: number };
  connect: (target: unknown) => void;
}

export interface KeySoundAudioContext {
  state: "suspended" | "running" | "closed";
  sampleRate: number;
  destination: unknown;
  createBuffer: (channels: number, length: number, sampleRate: number) => AudioBufferPort;
  createBufferSource: () => AudioBufferSourcePort;
  createGain: () => GainPort;
  resume: () => Promise<void>;
  close: () => Promise<void>;
}

export type KeySoundAudioContextFactory = () => KeySoundAudioContext;

const OUTPUT_VOLUME = 0.22;
const VARIANT_COUNTS: Record<KeySoundKind, number> = {
  key: 7,
  backspace: 4
};

function defaultContextFactory(): KeySoundAudioContext {
  const audioWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error("Web Audio is not supported in this browser.");
  }
  return new AudioContextConstructor() as unknown as KeySoundAudioContext;
}

function nextNoise(seed: number): { seed: number; value: number } {
  let nextSeed = seed | 0;
  nextSeed ^= nextSeed << 13;
  nextSeed ^= nextSeed >>> 17;
  nextSeed ^= nextSeed << 5;
  return {
    seed: nextSeed,
    value: ((nextSeed >>> 0) / 4_294_967_295) * 2 - 1
  };
}

function impactEnvelope(time: number, offset: number, decay: number): number {
  return time < offset ? 0 : Math.exp(-(time - offset) * decay);
}

function normalizeSamples(samples: Float32Array, targetPeak: number): Float32Array {
  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }
  if (peak === 0) {
    return samples;
  }

  const scale = targetPeak / peak;
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] *= scale;
  }
  return samples;
}

export function synthesizeKeySound(
  kind: KeySoundKind,
  sampleRate: number,
  variant = 0
): Float32Array {
  const durationSeconds = kind === "backspace" ? 0.098 : 0.072;
  const length = Math.max(1, Math.round(sampleRate * durationSeconds));
  const samples = new Float32Array(length);
  const normalizedVariant = Math.abs(Math.trunc(variant)) % VARIANT_COUNTS[kind];
  const pitchOffsets = [-0.031, 0.017, -0.008, 0.029, -0.021, 0.007, 0.038];
  const pitch = 1 + pitchOffsets[normalizedVariant];
  const reboundOffset = (kind === "backspace" ? 0.035 : 0.027) + normalizedVariant * 0.00035;
  let seed = (kind === "backspace" ? 0x5f37_59df : 0x13ab_91c7) ^ (normalizedVariant * 0x45d9_f3b);
  let previousNoise = 0;
  let lowNoise = 0;

  for (let index = 0; index < length; index += 1) {
    const time = index / sampleRate;
    const noise = nextNoise(seed);
    seed = noise.seed;
    const brightNoise = noise.value - previousNoise * 0.82;
    previousNoise = noise.value;
    lowNoise += (noise.value - lowNoise) * 0.16;

    const switchClick = impactEnvelope(time, 0, kind === "backspace" ? 420 : 560);
    const bottomOut = impactEnvelope(time, kind === "backspace" ? 0.0048 : 0.0034, kind === "backspace" ? 78 : 96);
    const rebound = impactEnvelope(time, reboundOffset, kind === "backspace" ? 230 : 285);
    const plasticClick = (
      Math.sin(2 * Math.PI * 2_150 * pitch * time) * 0.24 +
      Math.sin(2 * Math.PI * 3_650 * pitch * time + 0.4) * 0.13 +
      brightNoise * 0.31
    ) * switchClick;

    const caseResonance = kind === "backspace"
      ? (
          Math.sin(2 * Math.PI * 118 * pitch * time + 0.3) * 0.34 +
          Math.sin(2 * Math.PI * 236 * pitch * time) * 0.25 +
          Math.sin(2 * Math.PI * 418 * pitch * time + 0.8) * 0.13 +
          lowNoise * 0.2
        ) * bottomOut
      : (
          Math.sin(2 * Math.PI * 168 * pitch * time + 0.2) * 0.26 +
          Math.sin(2 * Math.PI * 337 * pitch * time) * 0.2 +
          Math.sin(2 * Math.PI * 618 * pitch * time + 0.7) * 0.12 +
          lowNoise * 0.14
        ) * bottomOut;

    const stabilizerRattle = kind === "backspace"
      ? (
          Math.sin(2 * Math.PI * 1_260 * pitch * time + noise.value * 0.5) * 0.1 +
          brightNoise * 0.075
        ) * impactEnvelope(time, 0.006, 112)
      : 0;

    const returnTap = (
      Math.sin(2 * Math.PI * (kind === "backspace" ? 720 : 1_080) * pitch * time) * 0.075 +
      brightNoise * 0.045
    ) * rebound;

    const remaining = durationSeconds - time;
    const endFade = Math.min(1, Math.max(0, remaining / 0.012));
    samples[index] = (plasticClick + caseResonance + stabilizerRattle + returnTap) * endFade * endFade;
  }

  return normalizeSamples(samples, kind === "backspace" ? 0.86 : 0.8);
}

export class KeySoundPlayer {
  private enabled = false;
  private disposed = false;
  private context: KeySoundAudioContext | null = null;
  private output: GainPort | null = null;
  private buffers: Partial<Record<KeySoundKind, Array<AudioBufferPort | undefined>>> = {};
  private variantCursors: Record<KeySoundKind, number> = { key: 0, backspace: 0 };

  constructor(private readonly contextFactory: KeySoundAudioContextFactory = defaultContextFactory) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  play(kind: KeySoundKind): void {
    if (!this.enabled || this.disposed) {
      return;
    }

    const context = this.getContext();
    if (!context || context.state === "closed") {
      return;
    }

    if (context.state === "suspended") {
      void context.resume()
        .then(() => this.startSound(context, kind))
        .catch(() => undefined);
      return;
    }

    this.startSound(context, kind);
  }

  dispose(): void {
    this.disposed = true;
    this.buffers = {};
    this.output = null;
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  private getContext(): KeySoundAudioContext | null {
    if (this.context) {
      return this.context;
    }

    try {
      const context = this.contextFactory();
      const output = context.createGain();
      output.gain.value = OUTPUT_VOLUME;
      output.connect(context.destination);
      this.context = context;
      this.output = output;
      return context;
    } catch {
      return null;
    }
  }

  private getBuffer(context: KeySoundAudioContext, kind: KeySoundKind): AudioBufferPort {
    const variantCount = VARIANT_COUNTS[kind];
    const variant = this.variantCursors[kind];
    this.variantCursors[kind] = (variant + 3) % variantCount;
    const pool = this.buffers[kind] ?? [];
    this.buffers[kind] = pool;
    const cached = pool[variant];
    if (cached) {
      return cached;
    }

    const samples = synthesizeKeySound(kind, context.sampleRate, variant);
    const buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.getChannelData(0).set(samples);
    pool[variant] = buffer;
    return buffer;
  }

  private startSound(context: KeySoundAudioContext, kind: KeySoundKind): void {
    if (this.disposed || !this.enabled || context.state !== "running" || !this.output) {
      return;
    }

    try {
      const source = context.createBufferSource();
      source.buffer = this.getBuffer(context, kind);
      source.connect(this.output);
      source.start();
    } catch {
      // Audio feedback is optional and must never interrupt typing.
    }
  }
}
