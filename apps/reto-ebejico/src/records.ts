import { TrackType } from '@core/track';
import { Pose } from '@client/renderer';

/** Mejor bajada guardada en este navegador (no sale del dispositivo). */
export interface RaceRecord {
  timeMs: number;
  splits: number[];
  date: string;
  /** Trayectoria del fantasma: [x·10, y·10, ángulo·1000, …] cada GHOST_INTERVAL pasos de simulación. */
  ghost: number[];
}

export interface Settings {
  muted: boolean;
  camera: 'chase' | 'north';
  satellite: boolean;
}

export const GHOST_INTERVAL = 6; // 10 muestras por segundo a 60 Hz

// v2: la física cambió (gravedad real, defensas con roce); los tiempos anteriores no son comparables
const RECORD_KEY = 'reto-ebejico:record:v2:';
const SETTINGS_KEY = 'reto-ebejico:settings:v1';

export function loadRecord(trackType: TrackType): RaceRecord | null {
  try {
    const raw = localStorage.getItem(RECORD_KEY + trackType);
    if (!raw) return null;
    const rec = JSON.parse(raw) as RaceRecord;
    if (typeof rec.timeMs !== 'number' || !Array.isArray(rec.splits)) return null;
    if (!Array.isArray(rec.ghost)) rec.ghost = [];
    return rec;
  } catch {
    return null;
  }
}

export function saveRecord(trackType: TrackType, record: RaceRecord): void {
  try {
    localStorage.setItem(RECORD_KEY + trackType, JSON.stringify(record));
  } catch {
    // Almacenamiento lleno o bloqueado: se intenta al menos guardar el tiempo sin fantasma
    try {
      localStorage.setItem(RECORD_KEY + trackType, JSON.stringify({ ...record, ghost: [] }));
    } catch {
      /* sin almacenamiento disponible */
    }
  }
}

export function loadSettings(): Settings {
  const defaults: Settings = { muted: false, camera: 'chase', satellite: true };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) } : defaults;
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* sin almacenamiento disponible */
  }
}

export class GhostRecorder {
  private samples: number[] = [];

  reset(): void {
    this.samples = [];
  }

  /** Llamar una vez por paso de simulación en carrera. */
  record(raceSteps: number, pose: Pose): void {
    if (raceSteps % GHOST_INTERVAL !== 0) return;
    if (this.samples.length / 3 > raceSteps / GHOST_INTERVAL) return;
    this.samples.push(Math.round(pose.x * 10), Math.round(pose.y * 10), Math.round(pose.angle * 1000));
  }

  export(): number[] {
    return this.samples;
  }
}

/** Pose interpolada del fantasma en el paso de simulación indicado, o null si ya terminó. */
export function ghostPoseAt(ghost: number[], raceSteps: number): Pose | null {
  const count = Math.floor(ghost.length / 3);
  if (count < 2) return null;
  const f = raceSteps / GHOST_INTERVAL;
  const i = Math.floor(f);
  if (i >= count - 1) return null;
  const t = f - i;
  const a = i * 3;
  const b = a + 3;
  let da = (ghost[b + 2] - ghost[a + 2]) / 1000;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  return {
    x: (ghost[a] + (ghost[b] - ghost[a]) * t) / 10,
    y: (ghost[a + 1] + (ghost[b + 1] - ghost[a + 1]) * t) / 10,
    angle: ghost[a + 2] / 1000 + da * t,
  };
}
