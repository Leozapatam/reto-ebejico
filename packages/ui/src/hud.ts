import { GameEvent, GameSnapshot } from '@core/types';
import { Track, TrackType } from '@core/track';
import { StepTimer } from '@core/timer';
import { InputManager } from '@client/input_manager';
import { SoundSynthesizer } from '@client/audio';
import { CameraMode } from '@client/renderer';

export interface HudCallbacks {
  onStartGame: (trackType: TrackType) => void;
  onRestart: () => void;
  onTogglePause: () => boolean;
  onExitToMenu: () => void;
  onSelectTrack: (trackType: TrackType) => void;
  onToggleMute: () => boolean;
  onToggleCamera: () => CameraMode;
  onToggleSatellite: () => boolean;
}

export interface BestRun {
  timeMs: number;
  splits: number[];
}

export interface FinishSummary {
  isRecord: boolean;
  previousBestMs: number | null;
}

export interface ViewState {
  heading: number; // rotación de cámara para la brújula
}

type Screen = 'menu' | 'race' | 'pause' | 'finish';

const ICONS = {
  camera:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 5.5l2.6 6.5H9.400z" fill="currentColor"/><path d="M12 18.5L9.4 12h5.2z" fill="currentColor" opacity=".45"/></svg>',
  map:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5l5.5-2 6 2 5.500-2v13l-5.500 2-6-2-5.500 2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 4.500v13M15 6.500v13" stroke="currentColor" stroke-width="1.8"/></svg>',
  soundOn:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.500h3.500L12 5.500v13l-4.500-4H4z" fill="currentColor"/><path d="M15.500 8.500a5 5 0 010 7M18 6a8.500 8.500 0 010 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  soundOff:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.500h3.500L12 5.500v13l-4.500-4H4z" fill="currentColor"/><path d="M16 9.500l5 5M21 9.500l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  pause:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.500" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="13.500" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>',
  restart:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.500 12a6.500 6.500 0 106.500-6.500H8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M10.500 2.500L7.500 5.500l3 3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  curve:
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M16 40V25c0-7 5-11 12-11h4" fill="none" stroke="#14181a" stroke-width="6" stroke-linecap="butt"/><path d="M30 5l11 9-11 9z" fill="#14181a"/></svg>',
  hairpin:
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 40V20a9 9 0 0118 0v8" fill="none" stroke="#14181a" stroke-width="6"/><path d="M23 26h18l-9 12z" fill="#14181a"/></svg>',
};

function shortName(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, '');
}

function fmtKm(meters: number): string {
  return (meters / 1000).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('es-CO');
}

function fmtDelta(ms: number): string {
  const sign = ms < 0 ? '−' : '+';
  return `${sign}${(Math.abs(ms) / 1000).toFixed(2)}`;
}

interface Landmark {
  label: string;
  dist: number; // px sobre la vía
  elev: number;
  x: number;
  y: number;
}

export class HudController {
  private root!: HTMLElement;
  private el: Record<string, HTMLElement> = {};
  private textCache: Map<HTMLElement, string> = new Map();

  private minimap!: HTMLCanvasElement;
  private elevation!: HTMLCanvasElement;
  private minimapStatic: HTMLCanvasElement = document.createElement('canvas');
  private elevationStatic: HTMLCanvasElement = document.createElement('canvas');
  private readonly panelW = 232;
  private readonly panelH = 118;
  private pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  private track?: Track;
  private landmarks: Landmark[] = [];
  private elevMin = 1100;
  private elevMax = 1950;
  private mapScale = 1;
  private mapOffX = 0;
  private mapOffY = 0;

  private screen: Screen = 'menu';
  private selectedTrack: TrackType = 'real';
  private best: BestRun | null = null;
  private lastSnapshot?: GameSnapshot;
  private toastTimer: number | undefined;
  private deltaTimer: number | undefined;
  private lastCountdown = '';

  constructor(
    private sound: SoundSynthesizer,
    private input: InputManager,
    private callbacks: HudCallbacks
  ) {
    this.mount();
    this.bind();
    this.setScreen('menu');
  }

  // ───────────────────────────── Datos de pista y récord ─────────────────────────────

  setTrack(track: Track, best: BestRun | null): void {
    this.track = track;
    this.selectedTrack = track.trackType;
    this.best = best;
    this.computeLandmarks(track);
    this.buildElevationStatic(track);
    this.buildMinimapStatic(track);
    this.renderMenuFacts(track);
    this.renderMenuProfile(track);
    this.syncTrackButtons();
    this.renderBest();
    this.buildProgressTicks(track);
  }

  setBest(best: BestRun | null): void {
    this.best = best;
    this.renderBest();
  }

  setToggles(state: { muted: boolean; camera: CameraMode; satellite: boolean }): void {
    this.el.btnMute.innerHTML = state.muted ? ICONS.soundOff : ICONS.soundOn;
    this.el.btnMute.setAttribute('aria-pressed', String(state.muted));
    this.el.btnCamera.classList.toggle('is-north', state.camera === 'north');
    this.el.btnCamera.title = state.camera === 'north' ? 'Vista: norte arriba (C)' : 'Vista: hacia adelante (C)';
    this.el.btnMap.setAttribute('aria-pressed', String(state.satellite));
    this.el.btnMap.title = state.satellite ? 'Mapa: ortofoto (M)' : 'Mapa: ilustrado (M)';
  }

  private computeLandmarks(track: Track): void {
    const cps = track.getCheckpoints();
    const pick: Array<{ match: RegExp; label: string }> = [
      { match: /Cruce hacia Ebéjico|Partidas/i, label: 'Las Partidas' },
      { match: /La Sucia/i, label: 'La Sucia' },
      { match: /Patudo/i, label: 'El Patudo' },
    ];
    const list: Landmark[] = [];
    const add = (index: number, label: string): void => {
      const p = track.points[index];
      list.push({ label, dist: track.cumulativeDistances[index], elev: p.elevationMeters ?? 0, x: p.x, y: p.y });
    };
    add(0, track.trackType === 'real' ? 'Túnel' : 'Salida');
    for (const rule of pick) {
      const cp = cps.find((c) => rule.match.test(c.name));
      if (cp && cp.index > 0 && cp.index < track.points.length - 1) add(cp.index, rule.label);
    }
    add(track.points.length - 1, track.trackType === 'real' ? 'Ebéjico' : 'Meta');
    this.landmarks = list;

    let min = Infinity;
    let max = -Infinity;
    for (const p of track.points) {
      const e = p.elevationMeters ?? 0;
      if (e < min) min = e;
      if (e > max) max = e;
    }
    const pad = Math.max(30, (max - min) * 0.12);
    this.elevMin = min - pad;
    this.elevMax = max + pad;
  }

  // ───────────────────────────── DOM ─────────────────────────────

  private mount(): void {
    const host = document.getElementById('app') || document.body;
    host.insertAdjacentHTML(
      'beforeend',
      `
      <div id="ui-overlay" data-screen="menu">
        <!-- HUD de carrera -->
        <div class="hud" aria-live="off">
          <header class="hud-top">
            <div class="hud-place" title="Ubicación actual">
              <span class="hud-place-name" data-el="placeName">Túnel de Occidente</span>
              <span class="hud-place-km"><span data-el="kmNow">0,0</span> / <span data-el="kmTotal">26,0</span> km</span>
            </div>

            <div class="hud-clock">
              <span class="hud-clock-time" data-el="timer">00:00.00</span>
              <span class="hud-clock-sub">
                <span class="hud-clock-best" data-el="bestLine">Sin marca todavía</span>
                <span class="hud-delta" data-el="delta" hidden></span>
              </span>
            </div>

            <nav class="hud-tools" aria-label="Opciones">
              <button class="icon-btn" data-el="btnCamera" title="Vista: hacia adelante (C)" aria-label="Cambiar vista">${ICONS.camera}</button>
              <button class="icon-btn" data-el="btnMap" title="Mapa: ortofoto (M)" aria-label="Cambiar mapa" aria-pressed="true">${ICONS.map}</button>
              <button class="icon-btn" data-el="btnMute" title="Sonido" aria-label="Silenciar" aria-pressed="false">${ICONS.soundOn}</button>
              <button class="icon-btn" data-el="btnPause" title="Pausa (P)" aria-label="Pausa">${ICONS.pause}</button>
              <button class="icon-btn" data-el="btnReset" title="Reiniciar (R)" aria-label="Reiniciar">${ICONS.restart}</button>
            </nav>
          </header>

          <div class="hud-progress" aria-hidden="true">
            <div class="hud-progress-fill" data-el="progressFill"></div>
            <div class="hud-progress-ticks" data-el="progressTicks"></div>
          </div>

          <div class="hud-curve" data-el="curve" hidden>
            <div class="hud-curve-sign" data-el="curveSign"></div>
            <div class="hud-curve-text"><strong data-el="curveName">Curva cerrada</strong><span data-el="curveDist">120 m</span></div>
          </div>

          <div class="hud-countdown" data-el="countdown" hidden>
            <div class="hud-countdown-num" data-el="countdownNum">3</div>
          </div>

          <div class="hud-toast" data-el="toast" hidden role="status"></div>
          <div class="hud-offroad" data-el="offroad" hidden>
            <span>Fuera de la calzada</span><strong data-el="offroadTime">3.0</strong>
          </div>

          <div class="hud-bottom">
            <section class="hud-panel hud-panel-elev">
              <header><span>Perfil de la ruta</span><span class="hud-slope" data-el="slope">0 %</span></header>
              <canvas data-el="elevation"></canvas>
            </section>

            <section class="hud-speedo" aria-label="Velocidad">
              <svg viewBox="0 0 120 70" class="hud-speedo-arc" aria-hidden="true">
                <path d="M12 62 A48 48 0 0 1 108 62" class="arc-bg"/>
                <path d="M12 62 A48 48 0 0 1 108 62" class="arc-fg" data-el="speedArc"/>
              </svg>
              <div class="hud-speedo-num"><span data-el="speed">0</span><small>km/h</small></div>
              <div class="hud-speedo-alt"><span data-el="altitude">1.907</span> msnm</div>
            </section>

            <section class="hud-panel hud-panel-map">
              <header><span>Mapa</span><span data-el="mapPct">0 %</span></header>
              <div class="hud-map-wrap">
                <canvas data-el="minimap"></canvas>
                <div class="hud-compass" title="Norte"><div class="hud-compass-needle" data-el="compass"></div><span>N</span></div>
              </div>
            </section>
          </div>

          <div class="touch-controls" aria-hidden="true">
            <div class="touch-cluster">
              <button class="touch-btn" data-touch="left" aria-label="Girar a la izquierda">◀</button>
              <button class="touch-btn" data-touch="right" aria-label="Girar a la derecha">▶</button>
            </div>
            <div class="touch-cluster">
              <button class="touch-btn touch-btn-small" data-touch="respawn" aria-label="Volver a la vía">↺</button>
              <button class="touch-btn" data-touch="drift" aria-label="Derrape">⟲</button>
              <button class="touch-btn" data-touch="brake" aria-label="Freno">▼</button>
              <button class="touch-btn touch-btn-gas" data-touch="gas" aria-label="Empujar">▲</button>
            </div>
          </div>
        </div>

        <!-- Inicio -->
        <section class="screen screen-menu" data-el="menu">
          <div class="menu-inner">
            <p class="eyebrow">Mirada Parda · Videojuegos territoriales</p>
            <h1 class="menu-title">Reto Ebéjico</h1>
            <p class="menu-tagline">Del túnel al pueblo, en carro de rodillos</p>

            <dl class="menu-facts" data-el="facts"></dl>

            <figure class="menu-profile">
              <svg data-el="menuProfile" viewBox="0 0 520 120" preserveAspectRatio="none" role="img" aria-label="Perfil de altura de la ruta"></svg>
              <div class="menu-profile-labels" data-el="menuProfileLabels"></div>
            </figure>

            <div class="segmented" role="radiogroup" aria-label="Recorrido">
              <button role="radio" data-el="optReal" aria-checked="true">Ruta real</button>
              <button role="radio" data-el="optTest" aria-checked="false">Circuito de práctica</button>
            </div>

            <div class="menu-cta">
              <button class="btn-primary" data-el="btnStart">Iniciar la bajada <kbd>Enter</kbd></button>
              <p class="menu-best" data-el="menuBest"></p>
            </div>

            <ul class="menu-keys">
              <li><kbd>↑</kbd> Empujar</li>
              <li><kbd>←</kbd><kbd>→</kbd> Timón de lazo</li>
              <li><kbd>↓</kbd> Freno de zapata</li>
              <li><kbd>Espacio</kbd> Derrape</li>
              <li><kbd>F</kbd> Volver a la vía</li>
              <li><kbd>P</kbd> Pausa</li>
            </ul>

            <p class="menu-credits">
              Trazado: © contribuidores de OpenStreetMap (ODbL) · Relieve: Copernicus DEM GLO-30 · Juego gratuito, sin publicidad ni datos personales.
            </p>
          </div>
        </section>

        <!-- Pausa -->
        <section class="screen screen-center" data-el="pause" hidden>
          <div class="card">
            <p class="eyebrow">Carrera detenida</p>
            <h2 class="card-title">Pausa</h2>
            <div class="card-actions">
              <button class="btn-primary" data-el="btnResume">Continuar <kbd>P</kbd></button>
              <button class="btn-ghost" data-el="btnPauseRestart">Reiniciar <kbd>R</kbd></button>
              <button class="btn-ghost" data-el="btnPauseMenu">Salir al inicio</button>
            </div>
            <ul class="menu-keys menu-keys-compact">
              <li><kbd>C</kbd> Cambiar vista</li>
              <li><kbd>M</kbd> Ortofoto / mapa ilustrado</li>
              <li><kbd>F</kbd> Volver a la vía (+2,5 s)</li>
              <li>Rueda del ratón: acercar o alejar</li>
            </ul>
          </div>
        </section>

        <!-- Meta -->
        <section class="screen screen-center" data-el="finish" hidden>
          <div class="card card-wide">
            <p class="eyebrow" data-el="finishEyebrow">Parque Principal · 1.141 msnm</p>
            <h2 class="card-title" data-el="finishTitle">¡Llegaste a Ebéjico!</h2>
            <div class="finish-time">
              <span class="finish-time-val" data-el="finishTime">00:00.00</span>
              <span class="finish-badge" data-el="finishBadge" hidden>Nueva marca personal</span>
              <span class="finish-compare" data-el="finishCompare"></span>
            </div>
            <dl class="finish-stats" data-el="finishStats"></dl>
            <div class="finish-splits" data-el="finishSplits"></div>
            <div class="card-actions">
              <button class="btn-primary" data-el="btnAgain">Otra bajada <kbd>Enter</kbd></button>
              <button class="btn-ghost" data-el="btnShare">Copiar resultado</button>
              <button class="btn-ghost" data-el="btnFinishMenu">Inicio</button>
            </div>
          </div>
        </section>
      </div>`
    );

    this.root = document.getElementById('ui-overlay') as HTMLElement;
    this.root.querySelectorAll<HTMLElement>('[data-el]').forEach((node) => {
      this.el[node.dataset.el as string] = node;
    });
    this.minimap = this.el.minimap as HTMLCanvasElement;
    this.elevation = this.el.elevation as HTMLCanvasElement;
    for (const c of [this.minimap, this.elevation, this.minimapStatic, this.elevationStatic]) {
      c.width = Math.round(this.panelW * this.pixelRatio);
      c.height = Math.round(this.panelH * this.pixelRatio);
    }
    this.el.curveSign.innerHTML = ICONS.curve;
  }

  private bind(): void {
    const click = (name: string, fn: () => void): void => {
      this.el[name].addEventListener('click', () => {
        this.sound.ensureStarted();
        (this.el[name] as HTMLButtonElement).blur(); // que Espacio/Enter no vuelvan a «pulsar» el botón enfocado
        fn();
      });
    };

    click('btnStart', () => this.start());
    click('optReal', () => this.callbacks.onSelectTrack('real'));
    click('optTest', () => this.callbacks.onSelectTrack('test'));

    click('btnCamera', () => this.callbacks.onToggleCamera());
    click('btnMap', () => this.callbacks.onToggleSatellite());
    click('btnMute', () => this.callbacks.onToggleMute());
    click('btnPause', () => this.togglePause());
    click('btnReset', () => this.restart());

    click('btnResume', () => this.togglePause());
    click('btnPauseRestart', () => this.restart());
    click('btnPauseMenu', () => this.exitToMenu());

    click('btnAgain', () => this.restart());
    click('btnFinishMenu', () => this.exitToMenu());
    click('btnShare', () => this.shareResult());

    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.code) {
        case 'Enter':
        case 'NumpadEnter':
          if (this.screen === 'menu') this.start();
          else if (this.screen === 'finish') this.restart();
          else if (this.screen === 'pause') this.togglePause();
          else return;
          e.preventDefault();
          break;
        case 'Escape':
        case 'KeyP':
          if (this.screen === 'race' || this.screen === 'pause') this.togglePause();
          break;
        case 'KeyR':
          if (this.screen !== 'menu') this.restart();
          break;
        case 'KeyC':
          if (this.screen !== 'menu') this.callbacks.onToggleCamera();
          break;
        case 'KeyM':
          this.callbacks.onToggleSatellite();
          break;
        default:
          return;
      }
      this.sound.ensureStarted();
    });

    // Controles táctiles con eventos de puntero (cubre soltar fuera del botón y cancelaciones)
    const touch = (name: string, set: (pressed: boolean) => void): void => {
      const btn = this.root.querySelector<HTMLElement>(`[data-touch="${name}"]`);
      if (!btn) return;
      const down = (e: PointerEvent): void => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        btn.classList.add('is-down');
        this.sound.ensureStarted();
        set(true);
      };
      const up = (e: PointerEvent): void => {
        e.preventDefault();
        btn.classList.remove('is-down');
        set(false);
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', () => {
        btn.classList.remove('is-down');
        set(false);
      });
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    let steerL = false;
    let steerR = false;
    const applySteer = (): void => this.input.setTouchSteer((steerR ? 1 : 0) - (steerL ? 1 : 0));
    touch('left', (p) => {
      steerL = p;
      applySteer();
    });
    touch('right', (p) => {
      steerR = p;
      applySteer();
    });
    touch('gas', (p) => this.input.setTouchThrottle(p));
    touch('brake', (p) => this.input.setTouchBrake(p));
    touch('drift', (p) => this.input.setTouchHandbrake(p));
    touch('respawn', (p) => {
      if (p) this.input.triggerTouchRespawn();
    });
  }

  // ───────────────────────────── Flujo de pantallas ─────────────────────────────

  private setScreen(screen: Screen): void {
    this.screen = screen;
    this.root.dataset.screen = screen;
    this.el.menu.hidden = screen !== 'menu';
    this.el.pause.hidden = screen !== 'pause';
    this.el.finish.hidden = screen !== 'finish';
  }

  get currentScreen(): Screen {
    return this.screen;
  }

  private start(): void {
    this.sound.ensureStarted();
    this.resetRaceWidgets();
    this.setScreen('race');
    this.callbacks.onStartGame(this.selectedTrack);
  }

  private restart(): void {
    this.resetRaceWidgets();
    this.setScreen('race');
    this.callbacks.onRestart();
  }

  private togglePause(): void {
    const paused = this.callbacks.onTogglePause();
    if (paused) this.setScreen('pause');
    else if (this.screen === 'pause') this.setScreen('race');
  }

  /** La app puede forzar la pausa (por ejemplo, al cambiar de pestaña). */
  showPaused(): void {
    if (this.screen === 'race') this.setScreen('pause');
  }

  private exitToMenu(): void {
    this.resetRaceWidgets();
    this.setScreen('menu');
    this.callbacks.onExitToMenu();
  }

  private resetRaceWidgets(): void {
    this.el.toast.hidden = true;
    this.el.delta.hidden = true;
    this.el.curve.hidden = true;
    this.el.offroad.hidden = true;
    this.el.countdown.hidden = true;
    this.lastCountdown = '';
    this.lastSnapshot = undefined;
  }

  showFinish(snapshot: GameSnapshot, summary: FinishSummary): void {
    const isReal = this.track?.trackType === 'real';
    this.setText(this.el.finishEyebrow, isReal ? 'Parque Principal · 1.141 msnm' : 'Circuito de práctica');
    this.setText(this.el.finishTitle, isReal ? '¡Llegaste a Ebéjico!' : '¡Circuito completado!');
    this.setText(this.el.finishTime, snapshot.formattedTime);
    this.el.finishBadge.hidden = !summary.isRecord;

    let compare = '';
    if (summary.previousBestMs !== null) {
      const d = snapshot.elapsedTimeMs - summary.previousBestMs;
      compare = summary.isRecord
        ? `${fmtDelta(d)} s frente a tu marca anterior (${StepTimer.formatTime(summary.previousBestMs)})`
        : `${fmtDelta(d)} s sobre tu mejor marca (${StepTimer.formatTime(summary.previousBestMs)})`;
    } else {
      compare = 'Primera bajada registrada en este dispositivo';
    }
    this.setText(this.el.finishCompare, compare);

    const st = snapshot.stats;
    const stats: Array<[string, string]> = [
      ['Distancia', `${fmtKm(snapshot.totalMeters)} km`],
      ['Velocidad máxima', `${Math.round(st.topSpeedKmh)} km/h`],
      ['Penalizaciones', st.penaltyCount === 0 ? 'Ninguna' : `${st.penaltyCount} · +${(st.penaltyMs / 1000).toFixed(1)} s`],
      ['Golpes a la defensa', String(st.railHits)],
    ];
    this.el.finishStats.innerHTML = stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

    // Parciales por hito
    const cps = this.track ? this.track.getCheckpoints().filter((c) => c.index > 0) : [];
    const prev = summary.previousBestMs !== null && this.best ? this.best.splits : null;
    const rows = snapshot.splits
      .map((ms, i) => {
        const name = shortName(cps[i]?.name ?? `Hito ${i + 1}`);
        let delta = '';
        if (prev && typeof prev[i] === 'number') {
          const d = ms - prev[i];
          delta = `<span class="${d <= 0 ? 'is-gain' : 'is-loss'}">${fmtDelta(d)}</span>`;
        }
        return `<li><span>${name}</span><span class="num">${StepTimer.formatTime(ms)}</span>${delta}</li>`;
      })
      .join('');
    this.el.finishSplits.innerHTML = `<h3>Parciales</h3><ol>${rows}</ol>`;
    this.setText(this.el.btnShare, 'Copiar resultado');
    this.setScreen('finish');
  }

  private shareResult(): void {
    const snap = this.lastSnapshot;
    if (!snap) return;
    const isReal = this.track?.trackType === 'real';
    const text = isReal
      ? `Bajé en carro de rodillos del Túnel de Occidente al parque de Ebéjico (${fmtKm(snap.totalMeters)} km) en ${snap.formattedTime}. Reto Ebéjico · Mirada Parda`
      : `Completé el circuito de práctica de Reto Ebéjico en ${snap.formattedTime}. Mirada Parda`;
    const done = (ok: boolean): void => this.setText(this.el.btnShare, ok ? 'Copiado ✓' : 'No se pudo copiar');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => done(true),
        () => done(false)
      );
    } else {
      done(false);
    }
  }

  // ───────────────────────────── Menú ─────────────────────────────

  private syncTrackButtons(): void {
    this.el.optReal.setAttribute('aria-checked', String(this.selectedTrack === 'real'));
    this.el.optTest.setAttribute('aria-checked', String(this.selectedTrack === 'test'));
  }

  private renderBest(): void {
    const label = this.best ? `Tu mejor marca: ${StepTimer.formatTime(this.best.timeMs)}` : '';
    this.setText(this.el.menuBest, label);
    this.setText(this.el.bestLine, this.best ? `Mejor ${StepTimer.formatTime(this.best.timeMs)}` : 'Sin marca todavía');
  }

  private renderMenuFacts(track: Track): void {
    const pts = track.points;
    const start = pts[0].elevationMeters ?? 0;
    const end = pts[pts.length - 1].elevationMeters ?? 0;
    const bridges = new Set(pts.filter((p) => p.isBridge && p.bridgeName).map((p) => p.bridgeName)).size;
    let curves = 0;
    let inCurve = false;
    for (const t of track.turn) {
      const sharp = Math.abs(t) > 0.9;
      if (sharp && !inCurve) curves++;
      inCurve = sharp;
    }
    const facts: Array<[string, string]> = [
      [`${fmtKm(track.totalMeters)} km`, 'de carretera real'],
      [`${fmtInt(start)} → ${fmtInt(end)} m`, 'sobre el nivel del mar'],
      [String(curves), 'curvas cerradas'],
      [String(bridges), bridges === 1 ? 'puente' : 'puentes y quebradas'],
    ];
    this.el.facts.innerHTML = facts.map(([v, k]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    this.setText(this.el.kmTotal, fmtKm(track.totalMeters));
  }

  /** Perfil de altura de la ruta en la pantalla de inicio (SVG generado con los datos reales). */
  private renderMenuProfile(track: Track): void {
    const W = 520;
    const H = 120;
    const pts = track.points;
    const toX = (d: number): number => (d / track.totalLength) * W;
    const toY = (e: number): number => 8 + (1 - (e - this.elevMin) / (this.elevMax - this.elevMin)) * (H - 16);
    let line = '';
    for (let i = 0; i < pts.length; i += 3) {
      line += `${i === 0 ? 'M' : 'L'}${toX(track.cumulativeDistances[i]).toFixed(1)} ${toY(pts[i].elevationMeters ?? 0).toFixed(1)}`;
    }
    const last = pts.length - 1;
    line += `L${W} ${toY(pts[last].elevationMeters ?? 0).toFixed(1)}`;
    const dots = this.landmarks
      .map((lm) => `<circle cx="${toX(lm.dist).toFixed(1)}" cy="${toY(lm.elev).toFixed(1)}" r="3.200" vector-effect="non-scaling-stroke"/>`)
      .join('');
    this.el.menuProfile.innerHTML = `
      <defs><linearGradient id="menuProfileFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#c8a96e" stop-opacity=".42"/><stop offset="1" stop-color="#c8a96e" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${line}L${W} ${H}L0 ${H}Z" fill="url(#menuProfileFill)"/>
      <path d="${line}" fill="none" stroke="#c8a96e" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
      <g fill="#f5efe0">${dots}</g>`;
    this.el.menuProfileLabels.innerHTML = this.landmarks
      .map((lm, i) => {
        const pct = (lm.dist / track.totalLength) * 100;
        const align = i === 0 ? 'start' : i === this.landmarks.length - 1 ? 'end' : 'mid';
        return `<span class="is-${align}" style="left:${pct.toFixed(1)}%"><b>${lm.label}</b>${fmtInt(lm.elev)} m</span>`;
      })
      .join('');
  }

  private buildProgressTicks(track: Track): void {
    this.el.progressTicks.innerHTML = this.landmarks
      .slice(1, -1)
      .map((lm) => `<i style="left:${((lm.dist / track.totalLength) * 100).toFixed(2)}%" title="${lm.label}"></i>`)
      .join('');
  }

  // ───────────────────────────── Actualización por cuadro ─────────────────────────────

  private setText(node: HTMLElement, text: string): void {
    if (this.textCache.get(node) === text) return;
    this.textCache.set(node, text);
    node.textContent = text;
  }

  update(snapshot: GameSnapshot, view: ViewState): void {
    this.handleEvents(snapshot.events, snapshot);

    if (this.screen === 'menu') {
      this.lastSnapshot = snapshot;
      return;
    }

    this.setText(this.el.timer, snapshot.formattedTime);
    this.setText(this.el.speed, String(snapshot.speedKmh));
    this.setText(this.el.altitude, fmtInt(snapshot.elevationMeters));
    this.setText(this.el.kmNow, fmtKm(snapshot.distanceMeters));
    this.setText(this.el.mapPct, `${Math.round(snapshot.progressPercent)} %`);
    this.el.progressFill.style.transform = `scaleX(${(snapshot.progressPercent / 100).toFixed(4)})`;

    const place = snapshot.isBridge && snapshot.bridgeName ? snapshot.bridgeName : snapshot.currentLocationName ?? '';
    this.setText(this.el.placeName, shortName(place).replace(/^Boca Occidental del /, ''));

    // Velocímetro: arco de 0 a 110 km/h
    const arcLen = 150.8;
    const ratio = Math.min(1, snapshot.speedKmh / 110);
    this.el.speedArc.style.strokeDasharray = `${(ratio * arcLen).toFixed(1)} ${arcLen}`;

    // Pendiente real de la vía
    const g = snapshot.gradePercent;
    const slopeText = Math.abs(g) < 1 ? 'Llano' : `${g < 0 ? '▼' : '▲'} ${Math.abs(g).toFixed(0)} %`;
    this.setText(this.el.slope, slopeText);
    this.el.slope.dataset.dir = Math.abs(g) < 1 ? 'flat' : g < 0 ? 'down' : 'up';

    // Aviso de copiloto: solo curvas cerradas y horquillas
    const curve = snapshot.curveAhead;
    if (curve && curve.severity >= 2 && snapshot.phase === 'racing') {
      this.el.curve.hidden = false;
      this.el.curve.dataset.dir = curve.direction === 1 ? 'right' : 'left';
      const hairpin = curve.severity === 3;
      const key = hairpin ? 'hairpin' : 'curve';
      if (this.el.curveSign.dataset.icon !== key) {
        this.el.curveSign.dataset.icon = key;
        this.el.curveSign.innerHTML = hairpin ? ICONS.hairpin : ICONS.curve;
      }
      this.setText(this.el.curveName, hairpin ? 'Horquilla' : 'Curva cerrada');
      const meters = Math.round(curve.distanceMeters / 10) * 10;
      this.setText(this.el.curveDist, meters <= 10 ? '¡Ya!' : `${meters} m`);
    } else {
      this.el.curve.hidden = true;
    }

    // Cuenta regresiva
    if (snapshot.phase === 'countdown' && snapshot.countdownNumber) {
      this.showCountdown(String(snapshot.countdownNumber));
    } else if (snapshot.phase === 'racing' && snapshot.raceSteps < 70) {
      this.showCountdown('¡Ya!');
    } else if (!this.el.countdown.hidden) {
      this.el.countdown.hidden = true;
      this.lastCountdown = '';
    }

    // Fuera de la calzada
    if (snapshot.offroadCountdown !== null && snapshot.phase === 'racing') {
      this.el.offroad.hidden = false;
      this.setText(this.el.offroadTime, `${snapshot.offroadCountdown.toFixed(1)} s`);
    } else {
      this.el.offroad.hidden = true;
    }

    // Avisos de la simulación (ramal cerrado, etc.)
    if (snapshot.recentNotice && snapshot.recentNotice !== this.lastSnapshot?.recentNotice) {
      const penalty = /\+\d/.test(snapshot.recentNotice);
      this.showToast(snapshot.recentNotice, penalty ? 'bad' : 'warn');
    }

    this.sound.updateRoll({
      speedKmh: snapshot.speedKmh,
      driftFactor: snapshot.vehicle.driftFactor,
      offroad: snapshot.offroad,
      braking: snapshot.vehicle.braking,
      active: snapshot.phase === 'racing',
    });

    this.drawMinimap(snapshot);
    this.drawElevation(snapshot);
    this.el.compass.style.transform = `rotate(${view.heading.toFixed(3)}rad)`;

    this.lastSnapshot = snapshot;
  }

  private handleEvents(events: GameEvent[], snapshot: GameSnapshot): void {
    for (const e of events) {
      switch (e.type) {
        case 'countdown':
          this.sound.playCountdown(false);
          break;
        case 'go':
          this.sound.playCountdown(true);
          break;
        case 'checkpoint': {
          this.sound.playCheckpoint();
          const bestSplit = this.best?.splits[e.splitIndex];
          let html = `<span class="toast-sign">${shortName(e.name)}</span><span class="toast-time">${StepTimer.formatTime(e.splitMs)}</span>`;
          if (typeof bestSplit === 'number') {
            const d = e.splitMs - bestSplit;
            html += `<span class="toast-delta ${d <= 0 ? 'is-gain' : 'is-loss'}">${fmtDelta(d)}</span>`;
            this.showDelta(d);
          }
          this.showToast(html, 'place', true);
          break;
        }
        case 'rail_hit':
          this.sound.playRailHit(e.intensity);
          break;
        case 'fall':
          this.sound.playFall();
          break;
        case 'penalty':
          this.sound.playPenalty();
          break;
        case 'barricade':
          this.sound.playBarricade();
          break;
        default:
          break;
      }
    }
    void snapshot;
  }

  private showCountdown(text: string): void {
    this.el.countdown.hidden = false;
    if (this.lastCountdown === text) return;
    this.lastCountdown = text;
    const num = this.el.countdownNum;
    num.textContent = text;
    num.classList.toggle('is-go', text === '¡Ya!');
    // Reinicia la animación en cada número
    num.classList.remove('pop');
    void num.offsetWidth;
    num.classList.add('pop');
  }

  private showToast(content: string, kind: 'place' | 'warn' | 'bad', isHtml: boolean = false): void {
    const toast = this.el.toast;
    toast.dataset.kind = kind;
    if (isHtml) toast.innerHTML = content;
    else toast.textContent = content;
    toast.hidden = false;
    toast.classList.remove('pop');
    void toast.offsetWidth;
    toast.classList.add('pop');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (toast.hidden = true), kind === 'place' ? 2600 : 2200);
  }

  private showDelta(deltaMs: number): void {
    const el = this.el.delta;
    el.textContent = fmtDelta(deltaMs);
    el.dataset.dir = deltaMs <= 0 ? 'gain' : 'loss';
    el.hidden = false;
    window.clearTimeout(this.deltaTimer);
    this.deltaTimer = window.setTimeout(() => (el.hidden = true), 5000);
  }

  // ───────────────────────────── Minimapa ─────────────────────────────

  private mapX(x: number): number {
    return this.mapOffX + x * this.mapScale;
  }

  private mapY(y: number): number {
    return this.mapOffY + y * this.mapScale;
  }

  private buildMinimapStatic(track: Track): void {
    const pts = track.points;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    // Escala uniforme: el mapa conserva la forma real de la ruta
    const pad = 12;
    this.mapScale = Math.min((this.panelW - pad * 2) / Math.max(1, maxX - minX), (this.panelH - pad * 2) / Math.max(1, maxY - minY));
    this.mapOffX = (this.panelW - (maxX - minX) * this.mapScale) / 2 - minX * this.mapScale;
    this.mapOffY = (this.panelH - (maxY - minY) * this.mapScale) / 2 - minY * this.mapScale;

    const ctx = this.minimapStatic.getContext('2d')!;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.panelW, this.panelH);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (track.decoyBranch) {
      const d = track.decoyBranch.points;
      ctx.beginPath();
      ctx.moveTo(this.mapX(d[0].x), this.mapY(d[0].y));
      for (let i = 1; i < d.length; i++) ctx.lineTo(this.mapX(d[i].x), this.mapY(d[i].y));
      ctx.strokeStyle = 'rgba(215, 56, 44, 0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(this.mapX(pts[0].x), this.mapY(pts[0].y));
    for (let i = 1; i < pts.length; i++) ctx.lineTo(this.mapX(pts[i].x), this.mapY(pts[i].y));
    ctx.strokeStyle = 'rgba(245, 239, 224, 0.28)';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.font = '600 9px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    this.landmarks.forEach((lm, i) => {
      const x = this.mapX(lm.x);
      const y = this.mapY(lm.y);
      const edge = i === 0 || i === this.landmarks.length - 1;
      ctx.fillStyle = edge ? '#f5efe0' : 'rgba(245, 239, 224, 0.7)';
      ctx.beginPath();
      ctx.arc(x, y, edge ? 3 : 2.2, 0, Math.PI * 2);
      ctx.fill();
      if (edge) {
        const right = x < this.panelW / 2;
        ctx.textAlign = right ? 'left' : 'right';
        ctx.fillStyle = 'rgba(245, 239, 224, 0.85)';
        ctx.fillText(lm.label, x + (right ? 6 : -6), y + (i === 0 ? 9 : -9));
      }
    });
  }

  private drawMinimap(snapshot: GameSnapshot): void {
    if (!this.track) return;
    const ctx = this.minimap.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.minimap.width, this.minimap.height);
    ctx.drawImage(this.minimapStatic, 0, 0);
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

    // Tramo ya recorrido
    const pts = this.track.points;
    const upTo = Math.min(pts.length - 1, snapshot.segmentIndex);
    if (upTo > 0) {
      ctx.beginPath();
      ctx.moveTo(this.mapX(pts[0].x), this.mapY(pts[0].y));
      for (let i = 2; i <= upTo; i += 2) ctx.lineTo(this.mapX(pts[i].x), this.mapY(pts[i].y));
      ctx.lineTo(this.mapX(snapshot.vehicle.x), this.mapY(snapshot.vehicle.y));
      ctx.strokeStyle = '#c8a96e';
      ctx.lineWidth = 2.6;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Carro: flecha orientada
    const px = this.mapX(snapshot.vehicle.x);
    const py = this.mapY(snapshot.vehicle.y);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(snapshot.vehicle.angle);
    ctx.fillStyle = '#14181a';
    ctx.beginPath();
    ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2cf63';
    ctx.beginPath();
    ctx.moveTo(5.5, 0);
    ctx.lineTo(-3.5, -3.8);
    ctx.lineTo(-1.5, 0);
    ctx.lineTo(-3.5, 3.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ───────────────────────────── Perfil de altura ─────────────────────────────

  private elevX(dist: number): number {
    return 8 + (dist / (this.track?.totalLength || 1)) * (this.panelW - 16);
  }

  private elevY(elev: number): number {
    return 14 + (1 - (elev - this.elevMin) / (this.elevMax - this.elevMin)) * (this.panelH - 34);
  }

  private traceProfile(ctx: CanvasRenderingContext2D, track: Track, upToDist: number): number {
    const pts = track.points;
    ctx.beginPath();
    ctx.moveTo(this.elevX(0), this.elevY(pts[0].elevationMeters ?? 0));
    let lastX = this.elevX(0);
    for (let i = 2; i < pts.length; i += 2) {
      const d = track.cumulativeDistances[i];
      if (d > upToDist) break;
      lastX = this.elevX(d);
      ctx.lineTo(lastX, this.elevY(pts[i].elevationMeters ?? 0));
    }
    return lastX;
  }

  private buildElevationStatic(track: Track): void {
    const ctx = this.elevationStatic.getContext('2d')!;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.panelW, this.panelH);
    const base = this.panelH - 20;

    const endX = this.traceProfile(ctx, track, Infinity);
    ctx.lineTo(endX, base);
    ctx.lineTo(this.elevX(0), base);
    ctx.closePath();
    ctx.fillStyle = 'rgba(245, 239, 224, 0.07)';
    ctx.fill();

    this.traceProfile(ctx, track, Infinity);
    ctx.strokeStyle = 'rgba(245, 239, 224, 0.32)';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.font = '600 9px system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    // Primero los extremos; los hitos intermedios solo si su etiqueta cabe sin pisar otra
    const taken: Array<[number, number]> = [];
    const order = [0, this.landmarks.length - 1, ...this.landmarks.map((_, i) => i).slice(1, -1)];
    for (const i of order) {
      const lm = this.landmarks[i];
      const x = this.elevX(lm.dist);
      ctx.strokeStyle = 'rgba(245, 239, 224, 0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, this.elevY(lm.elev));
      ctx.lineTo(x, base);
      ctx.stroke();

      const w = ctx.measureText(lm.label).width;
      const align = i === 0 ? 'left' : i === this.landmarks.length - 1 ? 'right' : 'center';
      const left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
      if (taken.some(([a, b]) => left < b + 5 && left + w > a - 5)) continue;
      taken.push([left, left + w]);
      ctx.fillStyle = 'rgba(245, 239, 224, 0.72)';
      ctx.textAlign = align;
      ctx.fillText(lm.label, x, this.panelH - 7);
    }
  }

  private drawElevation(snapshot: GameSnapshot): void {
    if (!this.track) return;
    const ctx = this.elevation.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.elevation.width, this.elevation.height);
    ctx.drawImage(this.elevationStatic, 0, 0);
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

    const base = this.panelH - 20;
    const dist = (snapshot.progressPercent / 100) * this.track.totalLength;
    const px = this.elevX(dist);
    const py = this.elevY(snapshot.vehicle.elevationMeters || snapshot.elevationMeters);

    // Tramo recorrido resaltado
    this.traceProfile(ctx, this.track, dist);
    ctx.lineTo(px, py);
    ctx.strokeStyle = '#c8a96e';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.lineTo(px, base);
    ctx.lineTo(this.elevX(0), base);
    ctx.closePath();
    ctx.fillStyle = 'rgba(200, 169, 110, 0.2)';
    ctx.fill();

    ctx.fillStyle = '#14181a';
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2cf63';
    ctx.beginPath();
    ctx.arc(px, py, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
