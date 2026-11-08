export class StepTimer {
  private ticks: number = 0;
  private readonly tickDurationMs: number = 1000 / 60; // 16.666ms por paso
  private isRunning: boolean = false;
  private splitTimes: number[] = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.ticks = 0;
    this.isRunning = false;
    this.splitTimes = [];
  }

  start(): void {
    this.isRunning = true;
  }

  pause(): void {
    this.isRunning = false;
  }

  resume(): void {
    this.isRunning = true;
  }

  step(): void {
    if (this.isRunning) {
      this.ticks++;
    }
  }

  recordSplit(): number {
    const elapsed = this.getElapsedMs();
    this.splitTimes.push(elapsed);
    return elapsed;
  }

  addPenalty(ms: number): void {
    this.ticks += Math.round(ms / this.tickDurationMs);
  }

  getElapsedMs(): number {
    return Math.round(this.ticks * this.tickDurationMs);
  }

  getTicks(): number {
    return this.ticks;
  }

  getSplitTimes(): number[] {
    return [...this.splitTimes];
  }

  static formatTime(ms: number): string {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const hundredths = Math.floor((ms % 1000) / 10);

    const pad = (n: number, d = 2) => n.toString().padStart(d, '0');
    return `${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`;
  }

  getFormattedTime(): string {
    return StepTimer.formatTime(this.getElapsedMs());
  }
}
