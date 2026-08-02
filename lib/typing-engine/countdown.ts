export type CountdownTick = (remainingSeconds: number) => void;

export class CountdownTimer {
  private readonly durationMs: number;
  private readonly onTick: CountdownTick;
  private readonly onComplete: () => void;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private deadline = 0;
  private completed = false;

  constructor(durationSeconds: number, onTick: CountdownTick, onComplete: () => void) {
    this.durationMs = durationSeconds * 1000;
    this.onTick = onTick;
    this.onComplete = onComplete;
  }

  start(): void {
    if (this.intervalId !== null || this.completed) {
      return;
    }

    this.deadline = Date.now() + this.durationMs;
    this.onTick(this.durationMs / 1000);
    this.intervalId = setInterval(() => this.update(), 100);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reset(): void {
    this.stop();
    this.deadline = 0;
    this.completed = false;
    this.onTick(this.durationMs / 1000);
  }

  private update(): void {
    const remainingMs = Math.max(0, this.deadline - Date.now());
    this.onTick(remainingMs / 1000);

    if (remainingMs === 0 && !this.completed) {
      this.completed = true;
      this.stop();
      this.onComplete();
    }
  }
}
