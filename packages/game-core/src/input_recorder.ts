import { ControlInput } from './types';

export interface RecordedInputFrame {
  f: number; // frame / tick index
  s: number; // steer
  t: number; // throttle
  b: number; // brake
  h: number; // handbrake (0 o 1)
  r?: number;// respawn
}

export class InputRecorder {
  private frames: RecordedInputFrame[] = [];
  private currentFrameIndex: number = 0;

  record(input: ControlInput): void {
    // Solo guardamos cuando hay cambios o inputs activos para mantener el peso mínimo
    this.frames.push({
      f: this.currentFrameIndex,
      s: Math.round(input.steer * 100) / 100,
      t: Math.round(input.throttle * 100) / 100,
      b: Math.round(input.brake * 100) / 100,
      h: input.handbrake ? 1 : 0,
      r: input.respawn ? 1 : undefined,
    });
    this.currentFrameIndex++;
  }

  getFrames(): RecordedInputFrame[] {
    return [...this.frames];
  }

  reset(): void {
    this.frames = [];
    this.currentFrameIndex = 0;
  }
}
