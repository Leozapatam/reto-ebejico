import './style.css';
import { Simulation } from '@core/simulation';
import { Track, TrackType } from '@core/track';
import { InputManager } from '@client/input_manager';
import { GameRenderer } from '@client/renderer';
import { SoundSynthesizer } from '@client/audio';
import { HudController } from '@ui/hud';

class GameApp {
  private simulation: Simulation;
  private input: InputManager;
  private renderer: GameRenderer;
  private sound: SoundSynthesizer;
  private hud: HudController;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedStep: number = 1 / 60;
  private currentTrackType: TrackType = 'real';

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Elemento #game-canvas no encontrado');

    const track = new Track(this.currentTrackType);
    this.simulation = new Simulation(track);
    this.input = new InputManager();
    this.sound = new SoundSynthesizer();
    this.renderer = new GameRenderer(canvas);

    this.hud = new HudController(this.sound, this.input, {
      onStartGame: (trackType: 'real' | 'test') => {
        this.switchTrack(trackType);
        this.simulation.startCountdown();
      },
      onRestart: () => {
        this.restartGame();
      },
      onToggleMute: () => {
        return this.sound.toggleMute();
      },
      onToggleCamera: () => {
        return this.renderer.toggleCameraMode();
      },
    });

    this.hud.setTrack(track);

    this.bindGlobalShortcuts();
    this.startLoop();
  }

  private switchTrack(trackType: TrackType): void {
    if (this.currentTrackType !== trackType) {
      this.currentTrackType = trackType;
      const newTrack = new Track(trackType);
      this.simulation = new Simulation(newTrack);
      this.hud.setTrack(newTrack);
    }
  }

  private restartGame(): void {
    this.simulation.reset();
    this.simulation.startCountdown();
  }

  private bindGlobalShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'r') {
        this.restartGame();
      }
    });
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  private loop(currentTime: number): void {
    const frameTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;
    this.accumulator += frameTime;

    while (this.accumulator >= this.fixedStep) {
      const controls = this.input.getInput();
      this.simulation.step(controls, this.fixedStep);
      this.accumulator -= this.fixedStep;
    }

    const snapshot = this.simulation.getSnapshot();
    this.renderer.render(this.simulation.track, snapshot);
    this.hud.update(snapshot);

    requestAnimationFrame(this.loop.bind(this));
  }
}

function initGame(): void {
  try {
    new GameApp();
    console.log('[Reto Ebéjico] 3D Environment initialized successfully');
  } catch (err) {
    console.error('[Reto Ebéjico] Initialization error:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
