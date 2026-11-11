import './style.css';
import { Simulation } from '@core/simulation';
import { Track, TrackType } from '@core/track';
import { GameSnapshot, VehicleState } from '@core/types';
import { InputManager } from '@client/input_manager';
import { GameRenderer, Pose } from '@client/renderer';
import { SoundSynthesizer } from '@client/audio';
import { HudController } from '@ui/hud';
import { GhostRecorder, RaceRecord, Settings, ghostPoseAt, loadRecord, loadSettings, saveRecord, saveSettings } from './records';

const FIXED_STEP = 1 / 60;
const ATTRACT_SPEED = 150; // px/s del sobrevuelo del menú

class GameApp {
  private simulation: Simulation;
  private input: InputManager;
  private renderer: GameRenderer;
  private sound: SoundSynthesizer;
  private hud: HudController;

  private lastTime = 0;
  private accumulator = 0;
  private trackType: TrackType = 'real';
  private record: RaceRecord | null = null;
  private settings: Settings;
  private ghostRecorder = new GhostRecorder();
  private prevVehicle: VehicleState | null = null;
  private attractDistance = 0;

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    if (!canvas) throw new Error('Elemento #game-canvas no encontrado');

    this.settings = loadSettings();
    this.simulation = new Simulation(new Track(this.trackType));
    this.record = loadRecord(this.trackType);
    this.input = new InputManager();
    this.sound = new SoundSynthesizer();
    this.sound.setMuted(this.settings.muted);
    this.renderer = new GameRenderer(canvas, import.meta.env.BASE_URL);
    this.renderer.cameraMode = this.settings.camera;
    this.renderer.satelliteLayer.enabled = this.settings.satellite;

    this.hud = new HudController(this.sound, this.input, {
      onStartGame: () => this.restartRace(),
      onRestart: () => this.restartRace(),
      onTogglePause: () => this.simulation.togglePause(),
      onExitToMenu: () => this.simulation.reset(),
      onSelectTrack: (type, mode) => this.selectTrack(type, mode),
      onToggleMute: () => {
        this.settings.muted = this.sound.toggleMute();
        this.persistSettings();
        return this.settings.muted;
      },
      onToggleCamera: () => {
        this.settings.camera = this.renderer.toggleCameraMode();
        this.persistSettings();
        this.hud.showToast(
          this.settings.camera === 'north' ? '🧭 Vista: norte arriba (C)' : '🏎️ Vista: hacia adelante (C)',
          'place'
        );
        return this.settings.camera;
      },
      onToggleSatellite: () => {
        this.settings.satellite = this.renderer.toggleSatellite();
        this.persistSettings();
        this.hud.showToast(
          this.settings.satellite ? '🛰️ Ortofoto satelital activa' : '🗺️ Mapa ilustrado (tecla M)',
          'place'
        );
        return this.settings.satellite;
      },
    });

    this.hud.setTrack(this.simulation.track, this.record);
    this.hud.setToggles(this.settings);

    // Al cambiar de pestaña la carrera se pausa sola: el cronómetro no corre a espaldas del jugador
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (this.simulation.phase === 'racing' || this.simulation.phase === 'countdown')) {
        if (this.simulation.togglePause()) this.hud.showPaused();
      }
    });

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private persistSettings(): void {
    saveSettings(this.settings);
    this.hud.setToggles(this.settings);
  }

  public gameMode: 'race' | 'tour' = 'race';

  private selectTrack(type: TrackType, mode: 'race' | 'tour' = 'race'): void {
    this.gameMode = mode;
    if (type === this.trackType) return;
    this.trackType = type;
    this.simulation = new Simulation(new Track(type));
    this.record = loadRecord(type);
    this.attractDistance = 0;
    this.prevVehicle = null;
    this.hud.setTrack(this.simulation.track, this.record);
  }

  private restartRace(): void {
    this.simulation.reset();
    this.simulation.startCountdown();
    this.ghostRecorder.reset();
    this.prevVehicle = null;
    this.accumulator = 0;
  }

  private onFinish(snapshot: GameSnapshot): void {
    const previous = this.record;
    const isRecord = !previous || snapshot.elapsedTimeMs < previous.timeMs;
    this.sound.playFinish(isRecord);
    // El resumen compara contra la marca anterior, así que se muestra antes de reemplazarla
    this.hud.showFinish(snapshot, { isRecord, previousBestMs: previous ? previous.timeMs : null });

    if (isRecord) {
      this.record = {
        timeMs: snapshot.elapsedTimeMs,
        splits: snapshot.splits,
        date: new Date().toISOString(),
        ghost: this.ghostRecorder.export().slice(),
      };
      saveRecord(this.trackType, this.record);
      this.hud.setBest(this.record);
    }
  }

  /** Pose de la cámara que sobrevuela la ruta mientras se muestra el menú. */
  private attractPose(dt: number): Pose {
    const track = this.simulation.track;
    this.attractDistance = (this.attractDistance + ATTRACT_SPEED * dt) % track.totalLength;
    const d = this.attractDistance;
    const cum = track.cumulativeDistances;
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= d) lo = mid;
      else hi = mid;
    }
    const a = track.points[lo];
    const b = track.points[hi];
    const t = (d - cum[lo]) / Math.max(1, cum[hi] - cum[lo]);
    // Rumbo suavizado mirando unos puntos adelante para que el vuelo no cabecee en cada vértice
    const ahead = track.points[Math.min(track.points.length - 1, lo + 6)];
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      angle: Math.atan2(ahead.y - a.y, ahead.x - a.x),
    };
  }

  private loop(now: number): void {
    const frameTime = Math.max(0, Math.min((now - this.lastTime) / 1000, 0.1));
    this.lastTime = now;
    this.accumulator += frameTime;

    const events: GameSnapshot['events'] = [];
    let snapshot: GameSnapshot | null = null;
    while (this.accumulator >= FIXED_STEP) {
      this.prevVehicle = { ...this.simulation.vehicle.state };
      this.simulation.step(this.input.getInput(), FIXED_STEP);
      this.accumulator -= FIXED_STEP;

      if (this.simulation.phase === 'racing' || this.simulation.phase === 'finished') {
        snapshot = this.simulation.getSnapshot();
        events.push(...snapshot.events);
        if (snapshot.phase === 'racing') this.ghostRecorder.record(snapshot.raceSteps, snapshot.vehicle);
      }
    }
    if (!snapshot) {
      snapshot = this.simulation.getSnapshot();
      events.push(...snapshot.events);
    }
    snapshot.events = events;

    // Interpola el carro entre el paso anterior y el actual: movimiento fluido en pantallas de más de 60 Hz
    const teleported = events.some((e) => e.type === 'penalty');
    if (this.prevVehicle && snapshot.phase === 'racing' && !teleported) {
      const alpha = this.accumulator / FIXED_STEP;
      const prev = this.prevVehicle;
      const cur = snapshot.vehicle;
      let da = cur.angle - prev.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      snapshot.vehicle = {
        ...cur,
        x: prev.x + (cur.x - prev.x) * alpha,
        y: prev.y + (cur.y - prev.y) * alpha,
        angle: prev.angle + da * alpha,
      };
    }

    const onMenu = this.hud.currentScreen === 'menu';
    const ghost =
      !onMenu && this.record && this.record.ghost.length > 0 && (snapshot.phase === 'racing' || snapshot.phase === 'paused')
        ? ghostPoseAt(this.record.ghost, snapshot.raceSteps)
        : null;

    this.renderer.render(this.simulation.track, snapshot, {
      dt: frameTime,
      ghost,
      attract: onMenu ? this.attractPose(frameTime) : null,
    });
    this.hud.update(snapshot, { heading: this.renderer.heading });

    if (events.some((e) => e.type === 'finish')) this.onFinish(snapshot);

    requestAnimationFrame((t) => this.loop(t));
  }
}

function initGame(): void {
  try {
    const app = new GameApp();
    if (import.meta.env.DEV) (window as unknown as { gameApp: GameApp }).gameApp = app;
  } catch (err) {
    console.error('[Reto Ebéjico] Error de inicialización:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
