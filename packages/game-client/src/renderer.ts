import { Track, PX_PER_METER } from '@core/track';
import { GameEvent, GameSnapshot, VehicleState } from '@core/types';
import { AssetLoader } from './asset_loader';
import { SatelliteLayer } from './satellite_layer';

export type CameraMode = 'chase' | 'north';

export interface Pose {
  x: number;
  y: number;
  angle: number;
}

export interface FrameContext {
  /** Segundos desde el cuadro anterior. */
  dt: number;
  /** Carro fantasma del mejor tiempo, si existe. */
  ghost?: Pose | null;
  /** Sobrevuelo del menú: la cámara sigue esta pose y no se dibuja el carro. */
  attract?: Pose | null;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  hot: boolean;
}

interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface SkidSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
}

interface SceneryItem {
  x: number;
  y: number;
  type: 'tree' | 'coffee_patch' | 'house';
  size: number;
  tone: number;
  rotation: number;
}

interface RoadSign {
  x: number;
  y: number;
  rx: number; // punto de la vía al que pertenece (para abrir el tablero hacia fuera)
  ry: number;
  text: string;
  kind: 'place' | 'km' | 'start' | 'finish' | 'closed';
}

interface PathRun {
  a: number; // índice inicial (inclusive)
  b: number; // índice final (inclusive)
  w: number; // ancho de calzada del tramo
}

const SKID_LIFE_S = 14;
const MAX_SKIDS = 520;
const MAX_SPARKS = 160;
const MAX_DUST = 70;
const CART_SCALE = 0.35;

const COLORS = {
  groundSat: '#1b2f24',
  groundVector: '#2f5d40',
  asphalt: '#35393a',
  asphaltWorn: 'rgba(255, 255, 255, 0.035)',
  edgeLine: 'rgba(240, 238, 225, 0.82)',
  centerLine: '#e8b62c',
  concrete: '#9ea6a4',
  railBeam: '#c5cdd0',
  railShine: '#f4f7f8',
};

function shortName(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, '').replace(/^Boca Occidental del /, '');
}

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number = 1;
  private viewW: number = 0;
  private viewH: number = 0;

  private cameraX: number = 0;
  private cameraY: number = 0;
  private cameraAngle: number = 0;
  private zoom: number = 1.35;
  private userZoom: number = 1.35;
  private tilt: number = 0.84;
  private cameraInitialized: boolean = false;
  private shake: number = 0;
  private time: number = 0;

  public cameraMode: CameraMode = 'chase';
  public satelliteLayer: SatelliteLayer;
  private assets: AssetLoader;

  private sparks: Spark[] = [];
  private dust: Dust[] = [];
  private skids: SkidSegment[] = [];
  private lastWheel: Array<{ x: number; y: number } | null> = [null, null];

  private preparedTrack?: Track;
  private scenery: SceneryItem[] = [];
  private signs: RoadSign[] = [];

  private lastVehicle: Pose = { x: 0, y: 0, angle: 0 };
  private flashDark: number = 0;   // Fundido tras una caída
  private flashRed: number = 0;    // Viñeta de penalización
  private blink: number = 0;       // Parpadeo del carro reincorporado

  constructor(canvas: HTMLCanvasElement, assetBaseUrl: string = './') {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('No se pudo obtener el contexto 2D');
    this.ctx = ctx;
    this.satelliteLayer = new SatelliteLayer(assetBaseUrl);
    this.assets = new AssetLoader(assetBaseUrl);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener(
      'wheel',
      (e) => {
        this.userZoom = Math.max(0.8, Math.min(2.4, this.userZoom * Math.exp(-e.deltaY * 0.0012)));
      },
      { passive: true }
    );
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.canvas.width = Math.round(this.viewW * this.dpr);
    this.canvas.height = Math.round(this.viewH * this.dpr);
  }

  toggleCameraMode(): CameraMode {
    this.cameraMode = this.cameraMode === 'chase' ? 'north' : 'chase';
    return this.cameraMode;
  }

  toggleSatellite(): boolean {
    if (!this.satelliteLayer.ready) return false;
    this.satelliteLayer.enabled = !this.satelliteLayer.enabled;
    return this.satelliteLayer.enabled;
  }

  /** Rotación actual de la cámara (rad); el HUD la usa para la brújula. */
  get heading(): number {
    return this.cameraAngle;
  }

  private get satellite(): boolean {
    return this.satelliteLayer.enabled && this.satelliteLayer.ready;
  }

  // ───────────────────────────── Preparación por pista ─────────────────────────────

  private prepareTrack(track: Track): void {
    if (this.preparedTrack === track) return;
    this.preparedTrack = track;
    this.cameraInitialized = false;
    this.sparks = [];
    this.dust = [];
    this.skids = [];
    this.lastWheel = [null, null];
    this.buildSigns(track);
    this.buildScenery(track);
  }

  private buildSigns(track: Track): void {
    const pts = track.points;
    const signs: RoadSign[] = [];
    const sideOf = (i: number, dist: number): { x: number; y: number; rx: number; ry: number } => {
      const h = track.headings[Math.min(i, pts.length - 1)];
      return { x: pts[i].x - Math.sin(h) * dist, y: pts[i].y + Math.cos(h) * dist, rx: pts[i].x, ry: pts[i].y };
    };

    const checkpoints = track.getCheckpoints();
    checkpoints.forEach((cp, idx) => {
      const offset = cp.point.width / 2 + 14;
      if (idx === 0) {
        signs.push({ ...sideOf(cp.index, offset), text: 'Túnel de Occidente · Salida', kind: 'start' });
      } else if (idx === checkpoints.length - 1) {
        signs.push({ ...sideOf(cp.index, offset), text: 'META · Parque Principal de Ebéjico', kind: 'finish' });
      } else {
        signs.push({ ...sideOf(cp.index, offset), text: shortName(cp.name), kind: 'place' });
      }
    });

    // Postes de referencia cada kilómetro, como en las vías nacionales
    let nextKm = 1;
    for (let i = 1; i < pts.length; i++) {
      const meters = track.cumulativeDistances[i] / PX_PER_METER;
      if (meters >= nextKm * 1000) {
        signs.push({ ...sideOf(i, -(pts[i].width / 2 + 12)), text: `Km ${nextKm}`, kind: 'km' });
        nextKm++;
      }
    }

    if (track.decoyBranch) {
      const b = track.decoyBranch.barricade;
      signs.push({ x: b.x, y: b.y, rx: b.x, ry: b.y, text: 'VÍA CERRADA · San Jerónimo', kind: 'closed' });
    }
    this.signs = signs;
  }

  /** Vegetación y casas del mapa vectorial (cuando la ortofoto está apagada). */
  private buildScenery(track: Track): void {
    const pts = track.points;
    const items: SceneryItem[] = [];
    let seed = 42;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // Rejilla espacial para no sembrar nada sobre otro tramo de la vía (horquillas)
    const CELL = 120;
    const grid = new Map<string, number[]>();
    pts.forEach((p, i) => {
      const key = `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(i);
    });
    const onRoad = (x: number, y: number): boolean => {
      const gx = Math.floor(x / CELL);
      const gy = Math.floor(y / CELL);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const cell = grid.get(`${gx + dx},${gy + dy}`);
          if (!cell) continue;
          for (const i of cell) {
            if (Math.hypot(pts[i].x - x, pts[i].y - y) < pts[i].width / 2 + 34) return true;
          }
        }
      }
      return false;
    };

    for (let i = 2; i < pts.length - 2; i += 2) {
      const p = pts[i];
      if (p.isBridge) continue;
      const h = track.headings[i];
      const perpX = -Math.sin(h);
      const perpY = Math.cos(h);
      for (const side of [-1, 1]) {
        const dist = p.width / 2 + 40 + random() * 150;
        const x = p.x + perpX * dist * side + (random() - 0.5) * 40;
        const y = p.y + perpY * dist * side + (random() - 0.5) * 40;
        const roll = random();
        const tone = random();
        const size = random();
        if (onRoad(x, y)) continue;
        if (roll < 0.56) items.push({ x, y, type: 'tree', size: 15 + size * 15, tone, rotation: 0 });
        else if (roll < 0.86) items.push({ x, y, type: 'coffee_patch', size: 22 + size * 16, tone, rotation: h });
        else items.push({ x, y, type: 'house', size: 24 + size * 10, tone, rotation: h + (side === 1 ? Math.PI : 0) });
      }
    }
    this.scenery = items;
  }

  // ───────────────────────────── Cuadro ─────────────────────────────

  render(track: Track, snapshot: GameSnapshot, frame: FrameContext): void {
    const ctx = this.ctx;
    const dt = Math.min(0.05, Math.max(0.001, frame.dt));
    const W = this.viewW;
    const H = this.viewH;
    const v = snapshot.vehicle;
    const attract = frame.attract ?? null;
    const chase = this.cameraMode === 'chase' || attract !== null;
    this.time += dt;

    this.prepareTrack(track);
    this.handleEvents(snapshot.events, v);

    // ── Cámara ──
    const focus: Pose = attract ?? v;
    const speed = attract ? 0 : Math.hypot(v.vx, v.vy);
    const speedRatio = Math.min(1.2, speed / 420);
    const lookAhead = attract ? 0 : 0.40;
    const targetX = focus.x + (attract ? 0 : v.vx * lookAhead);
    const targetY = focus.y + (attract ? 0 : v.vy * lookAhead);

    if (!this.cameraInitialized || Math.hypot(targetX - this.cameraX, targetY - this.cameraY) > 900) {
      this.cameraX = targetX;
      this.cameraY = targetY;
      this.cameraAngle = chase ? -(focus.angle + Math.PI / 2) : 0;
      this.cameraInitialized = true;
    }
    const follow = 1 - Math.exp(-dt * 8);
    this.cameraX += (targetX - this.cameraX) * follow;
    this.cameraY += (targetY - this.cameraY) * follow;

    const targetAngle = chase ? -(focus.angle + Math.PI / 2) : 0;
    let diff = (targetAngle - this.cameraAngle) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    this.cameraAngle += diff * (1 - Math.exp(-dt * (attract ? 2.2 : 5.5)));

    // El zoom se abre con la velocidad para ver venir las curvas
    const viewportFactor = Math.max(0.70, Math.min(1.20, Math.min(W, H) / 760));
    const targetZoom = (attract ? 1.15 : this.userZoom * (1 - 0.14 * Math.min(1, speedRatio))) * viewportFactor;
    this.zoom += (targetZoom - this.zoom) * (1 - Math.exp(-dt * 3));

    // Perspectiva 2.5D: en las bajadas la cámara se inclina hacia el valle
    const slope = attract ? 0 : v.pitch || 0;
    const targetTilt = chase ? Math.max(0.74, Math.min(0.94, 0.84 + slope * 1.4)) : 1;
    this.tilt += (targetTilt - this.tilt) * (1 - Math.exp(-dt * 4));

    this.shake = Math.max(0, this.shake - dt * 3.2);
    const shakeAmp = this.shake * this.shake * 9;
    const shakeX = (Math.random() - 0.5) * shakeAmp;
    const shakeY = (Math.random() - 0.5) * shakeAmp;

    const anchorX = W / 2;
    const anchorY = chase ? H * 0.70 : H / 2;

    // ── Fondo ──
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.satellite ? COLORS.groundSat : COLORS.groundVector;
    ctx.fillRect(0, 0, W, H);

    // ── Mundo ──
    ctx.save();
    ctx.translate(anchorX + shakeX, anchorY + shakeY);
    ctx.scale(this.zoom, this.zoom * this.tilt);
    ctx.rotate(this.cameraAngle);
    ctx.translate(-this.cameraX, -this.cameraY);
    const worldMatrix = ctx.getTransform();

    const viewRadius = Math.hypot(W / 2, Math.max(anchorY, H - anchorY)) / (this.zoom * Math.min(1, this.tilt)) + 40;
    const runs = this.visibleRuns(track, viewRadius + 70);

    if (this.satellite) {
      this.drawSatelliteFallback(ctx, track, runs, viewRadius);
      this.satelliteLayer.render(ctx, this.cameraX, this.cameraY, viewRadius);
    } else {
      this.drawVectorTerrain(ctx, track, runs, viewRadius);
    }

    if (track.decoyBranch) this.drawDecoyBranch(ctx, track.decoyBranch);
    this.drawBridgeDecks(ctx, track, runs);
    this.drawRoad(ctx, track, runs);
    this.drawGuardrails(ctx, track, runs);
    this.drawRoadMarkers(ctx, track, viewRadius);
    this.drawSkids(ctx, dt);

    if (!this.satellite) this.drawScenery(ctx, viewRadius);
    this.drawCloudShadows(ctx, viewRadius);

    if (!attract) {
      this.emitParticles(snapshot, dt);
      this.drawDust(ctx, dt);
      if (frame.ghost) this.drawCart(ctx, frame.ghost, null, 0.4);

      this.blink = Math.max(0, this.blink - dt);
      const blinkAlpha = this.blink > 0 && Math.floor(this.blink * 10) % 2 === 0 ? 0.35 : 1;
      this.drawCart(ctx, v, v, blinkAlpha);
      this.drawSparks(ctx, dt);
    }
    ctx.restore();

    // ── Pantalla ──
    this.drawSigns(ctx, worldMatrix, W, H);
    this.drawAtmosphere(ctx, W, H, chase, attract ? 0 : speedRatio, anchorX, anchorY, dt);

    this.lastVehicle = { x: v.x, y: v.y, angle: v.angle };
  }

  private handleEvents(events: GameEvent[], v: VehicleState): void {
    for (const e of events) {
      switch (e.type) {
        case 'rail_hit': {
          this.shake = Math.min(1, this.shake + 0.25 + e.intensity * 0.6);
          // Chispas en el costado que rozó la bionda
          const nx = -Math.sin(v.angle) * e.side;
          const ny = Math.cos(v.angle) * e.side;
          const count = 5 + Math.round(e.intensity * 16);
          for (let i = 0; i < count; i++) {
            const along = (Math.random() - 0.5) * 14;
            this.pushSpark(
              v.x + nx * 7 + Math.cos(v.angle) * along,
              v.y + ny * 7 + Math.sin(v.angle) * along,
              v.vx * 0.5 - nx * (40 + Math.random() * 120) + (Math.random() - 0.5) * 90,
              v.vy * 0.5 - ny * (40 + Math.random() * 120) + (Math.random() - 0.5) * 90,
              0.2 + Math.random() * 0.35
            );
          }
          break;
        }
        case 'fall':
          this.flashDark = 1;
          this.shake = 1;
          for (let i = 0; i < 14; i++) {
            this.pushDust(this.lastVehicle.x, this.lastVehicle.y, (Math.random() - 0.5) * 90, (Math.random() - 0.5) * 90, 9);
          }
          break;
        case 'penalty':
          this.flashRed = 1;
          this.blink = 1.3;
          this.lastWheel = [null, null];
          break;
        case 'barricade':
          this.shake = 0.9;
          break;
        default:
          break;
      }
    }
  }

  /** Tramos de la vía dentro del radio visible, partidos por ancho de calzada. */
  private visibleRuns(track: Track, radius: number): PathRun[] {
    const pts = track.points;
    const r2 = radius * radius;
    const runs: PathRun[] = [];
    let start = -1;
    for (let i = 0; i <= pts.length; i++) {
      let inside = false;
      if (i < pts.length) {
        const dx = pts[i].x - this.cameraX;
        const dy = pts[i].y - this.cameraY;
        inside = dx * dx + dy * dy < r2;
      }
      if (inside && start < 0) start = i;
      if (!inside && start >= 0) {
        const a = Math.max(0, start - 1);
        const b = Math.min(pts.length - 1, i);
        // Subdivide donde cambia el ancho
        let s = a;
        for (let k = a + 1; k <= b; k++) {
          if (k === b || pts[k].width !== pts[s].width) {
            runs.push({ a: s, b: k, w: pts[s].width });
            s = k;
          }
        }
        start = -1;
      }
    }
    return runs;
  }

  private tracePath(ctx: CanvasRenderingContext2D, track: Track, a: number, b: number): void {
    const pts = track.points;
    ctx.beginPath();
    ctx.moveTo(pts[a].x, pts[a].y);
    for (let i = a + 1; i <= b; i++) ctx.lineTo(pts[i].x, pts[i].y);
  }

  // ───────────────────────────── Vía ─────────────────────────────

  private drawRoad(ctx: CanvasRenderingContext2D, track: Track, runs: PathRun[]): void {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Hombro: funde la calzada con la foto aérea / cuneta de tierra en el mapa vectorial
    for (const r of runs) {
      this.tracePath(ctx, track, r.a, r.b);
      if (this.satellite) {
        ctx.lineWidth = r.w + 8;
        ctx.strokeStyle = 'rgba(16, 20, 18, 0.42)';
        ctx.stroke();
      } else {
        ctx.lineWidth = r.w + 16;
        ctx.strokeStyle = '#7f6a49';
        ctx.stroke();
        ctx.lineWidth = r.w + 7;
        ctx.strokeStyle = '#5f5137';
        ctx.stroke();
      }
    }

    for (const r of runs) {
      this.tracePath(ctx, track, r.a, r.b);
      ctx.lineWidth = r.w;
      ctx.strokeStyle = COLORS.asphalt;
      ctx.stroke();
      // Líneas de borde: blanco bajo una segunda capa de asfalto más angosta
      ctx.lineWidth = r.w - 4;
      ctx.strokeStyle = COLORS.edgeLine;
      ctx.stroke();
      ctx.lineWidth = r.w - 7;
      ctx.strokeStyle = COLORS.asphalt;
      ctx.stroke();
      // Huella de rodadura más clara al centro de cada carril
      ctx.lineWidth = r.w * 0.5;
      ctx.strokeStyle = COLORS.asphaltWorn;
      ctx.stroke();
    }

    // Línea central amarilla; el desfase ancla los trazos al mundo para que no «naden»
    ctx.lineCap = 'butt';
    ctx.setLineDash([15, 17]);
    ctx.lineWidth = 1.7;
    ctx.strokeStyle = COLORS.centerLine;
    for (const r of runs) {
      this.tracePath(ctx, track, r.a, r.b);
      ctx.lineDashOffset = track.cumulativeDistances[r.a] % 32;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    ctx.restore();
  }

  /** Tableros de los puentes: sombra volada sobre la quebrada y losa de concreto. */
  private drawBridgeDecks(ctx: CanvasRenderingContext2D, track: Track, runs: PathRun[]): void {
    const pts = track.points;
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    for (const r of runs) {
      let s = -1;
      for (let i = r.a; i <= r.b + 1; i++) {
        const bridge = i <= r.b && Boolean(pts[i].isBridge);
        if (bridge && s < 0) s = i;
        if (!bridge && s >= 0) {
          const a = Math.max(r.a, s - 1);
          const b = Math.min(r.b, i);
          if (b > a) {
            if (!this.satellite) this.drawStream(ctx, track, Math.floor((a + b) / 2));
            ctx.save();
            ctx.translate(9, 12);
            this.tracePath(ctx, track, a, b);
            ctx.lineWidth = r.w + 12;
            ctx.strokeStyle = 'rgba(6, 14, 10, 0.5)';
            ctx.stroke();
            ctx.restore();

            this.tracePath(ctx, track, a, b);
            ctx.lineWidth = r.w + 13;
            ctx.strokeStyle = '#6f7775';
            ctx.stroke();
            ctx.lineWidth = r.w + 10;
            ctx.strokeStyle = COLORS.concrete;
            ctx.stroke();
          }
          s = -1;
        }
      }
    }
    ctx.restore();
  }

  private drawStream(ctx: CanvasRenderingContext2D, track: Track, i: number): void {
    const p = track.points[i];
    const h = track.headings[i];
    const px = -Math.sin(h);
    const py = Math.cos(h);
    const fx = Math.cos(h);
    const fy = Math.sin(h);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x - px * 260 - fx * 70, p.y - py * 260 - fy * 70);
    ctx.bezierCurveTo(p.x - px * 90 + fx * 50, p.y - py * 90 + fy * 50, p.x + px * 90 - fx * 50, p.y + py * 90 - fy * 50, p.x + px * 260 + fx * 70, p.y + py * 260 + fy * 70);
    ctx.lineWidth = 46;
    ctx.strokeStyle = '#24452f';
    ctx.stroke();
    ctx.lineWidth = 20;
    ctx.strokeStyle = '#3f8f9a';
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(214, 240, 240, 0.7)';
    ctx.setLineDash([10, 22]);
    ctx.stroke();
    ctx.restore();
  }

  /** Defensas viales tipo bionda con postes y captafaros. */
  private drawGuardrails(ctx: CanvasRenderingContext2D, track: Track, runs: PathRun[]): void {
    const pts = track.points;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const side of [-1, 1] as const) {
      for (const r of runs) {
        let chain: number[] = [];
        const flush = (): void => {
          if (chain.length > 3) this.drawRailChain(ctx, chain, side);
          chain = [];
        };
        for (let i = r.a; i <= r.b; i++) {
          const p = pts[i];
          const has = side === -1 ? p.hasGuardrailLeft : p.hasGuardrailRight;
          if (!has) {
            flush();
            continue;
          }
          const h = track.headings[i];
          const offset = (p.width / 2 + 3) * side;
          chain.push(p.x - Math.sin(h) * offset, p.y + Math.cos(h) * offset);
        }
        flush();
      }
    }
    ctx.restore();
  }

  private drawRailChain(ctx: CanvasRenderingContext2D, chain: number[], side: -1 | 1): void {
    const trace = (dx: number, dy: number): void => {
      ctx.beginPath();
      ctx.moveTo(chain[0] + dx, chain[1] + dy);
      for (let k = 2; k < chain.length; k += 2) ctx.lineTo(chain[k] + dx, chain[k + 1] + dy);
    };
    // Sombra arrojada (sol del noroeste)
    trace(1.6, 2.2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.stroke();

    trace(0, 0);
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = '#3c4549';
    ctx.stroke();
    ctx.lineWidth = 2.3;
    ctx.strokeStyle = COLORS.railBeam;
    ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = COLORS.railShine;
    ctx.stroke();

    // Captafaros: amarillo a la izquierda, rojo a la derecha
    ctx.fillStyle = side === -1 ? '#ffe37a' : '#ff5a4d';
    for (let k = 4; k < chain.length; k += 8) {
      ctx.beginPath();
      ctx.arc(chain[k], chain[k + 1], 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Ramal señuelo de Las Partidas (vía a San Jerónimo, cerrada con barricada). */
  private drawDecoyBranch(ctx: CanvasRenderingContext2D, decoy: NonNullable<Track['decoyBranch']>): void {
    const pts = decoy.points;
    if (pts.length < 2) return;
    if (Math.hypot(pts[0].x - this.cameraX, pts[0].y - this.cameraY) > 2200) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = pts[0].width + 8;
    ctx.strokeStyle = this.satellite ? 'rgba(16, 20, 18, 0.42)' : '#5f5137';
    ctx.stroke();
    ctx.lineWidth = pts[0].width;
    ctx.strokeStyle = '#3d4142';
    ctx.stroke();
    ctx.lineWidth = 1.7;
    ctx.strokeStyle = 'rgba(232, 182, 44, 0.55)';
    ctx.setLineDash([15, 17]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Barricada: maletines rojos y blancos
    const bar = decoy.barricade;
    const prev = pts[pts.length - 2];
    const angle = Math.atan2(bar.y - prev.y, bar.x - prev.x);
    ctx.translate(bar.x, bar.y);
    ctx.rotate(angle);
    const half = bar.width / 2 + 6;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(-3, -half + 3, 12, half * 2);
    const blocks = 9;
    const size = (half * 2) / blocks;
    for (let k = 0; k < blocks; k++) {
      ctx.fillStyle = k % 2 === 0 ? '#d7382c' : '#f2efe6';
      ctx.fillRect(-6, -half + k * size, 11, size - 1);
    }
    ctx.restore();
  }

  /** Portal del túnel, líneas de paso por los hitos y meta ajedrezada. */
  private drawRoadMarkers(ctx: CanvasRenderingContext2D, track: Track, viewRadius: number): void {
    const pts = track.points;
    const checkpoints = track.getCheckpoints();
    const near = (x: number, y: number): boolean => Math.hypot(x - this.cameraX, y - this.cameraY) < viewRadius + 120;
    ctx.save();

    checkpoints.forEach((cp, idx) => {
      const p = cp.point;
      if (!near(p.x, p.y)) return;
      const h = track.headings[Math.min(cp.index, pts.length - 1)];
      const half = p.width / 2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(h);

      if (idx === 0) {
        // Boca del túnel: muro frontal de concreto y la calzada saliendo de la sombra
        const wallX = -half - 2;
        const shade = ctx.createLinearGradient(wallX, 0, wallX + 46, 0);
        shade.addColorStop(0, 'rgba(4, 6, 5, 0.94)');
        shade.addColorStop(1, 'rgba(4, 6, 5, 0)');
        ctx.fillStyle = shade;
        ctx.fillRect(wallX, -half, 46, p.width);
        // Sombra arrojada y muro con aletas
        ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        ctx.fillRect(wallX - 5, -half - 13, 10, p.width + 30);
        ctx.fillStyle = '#b4b8ad';
        ctx.fillRect(wallX - 9, -half - 16, 10, p.width + 32);
        ctx.fillStyle = '#d3d6cb';
        ctx.fillRect(wallX - 9, -half - 16, 3, p.width + 32);
        ctx.fillStyle = '#8b9086';
        ctx.fillRect(wallX - 9, -half - 16, 10, 6);
        ctx.fillRect(wallX - 9, half + 10, 10, 6);
        // Línea de salida
        ctx.fillStyle = 'rgba(245, 242, 230, 0.92)';
        ctx.fillRect(half + 4, -half + 2, 3.5, p.width - 4);
      } else if (idx === checkpoints.length - 1) {
        // Meta ajedrezada
        const cols = 3;
        const sq = 4;
        const rows = Math.floor((p.width - 2) / sq);
        const y0 = -(rows * sq) / 2;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            ctx.fillStyle = (c + r) % 2 === 0 ? '#f5f2e6' : '#17191a';
            ctx.fillRect(-cols * sq + c * sq, y0 + r * sq, sq, sq);
          }
        }
      } else {
        ctx.fillStyle = 'rgba(232, 182, 44, 0.8)';
        ctx.fillRect(-1, -half + 3, 2, p.width - 6);
      }
      ctx.restore();
    });
    ctx.restore();
  }

  // ───────────────────────────── Terreno satelital (respaldo) ─────────────────────────────

  /** Terreno de respaldo bajo la ortofoto cuando las teselas satelitales aún no cargan o tienen huecos. */
  private drawSatelliteFallback(ctx: CanvasRenderingContext2D, track: Track, runs: PathRun[], viewRadius: number): void {
    ctx.save();

    // Textura y relieve montañoso determinista (tonalidades satelitales)
    const CELL = 220;
    const gx0 = Math.floor((this.cameraX - viewRadius) / CELL);
    const gx1 = Math.floor((this.cameraX + viewRadius) / CELL);
    const gy0 = Math.floor((this.cameraY - viewRadius) / CELL);
    const gy1 = Math.floor((this.cameraY + viewRadius) / CELL);

    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const n1 = Math.abs(Math.sin(gx * 127.1 + gy * 311.7) * 43758.5453) % 1;
        const n2 = Math.abs(Math.sin(gx * 269.5 + gy * 183.3) * 28461.1278) % 1;

        // Manchas de bosque y cañadas
        ctx.fillStyle = n1 < 0.28
          ? 'rgba(10, 24, 16, 0.55)'
          : n1 < 0.58
            ? 'rgba(24, 48, 34, 0.40)'
            : n1 < 0.82
              ? 'rgba(38, 62, 44, 0.28)'
              : 'rgba(52, 60, 36, 0.18)';
        ctx.beginPath();
        ctx.ellipse(
          gx * CELL + n1 * 130,
          gy * CELL + n2 * 130,
          130 + n1 * 80,
          90 + n2 * 60,
          n1 * Math.PI,
          0,
          Math.PI * 2
        );
        ctx.fill();

        // Relieve y curvas de nivel sutiles
        if (n2 > 0.45) {
          ctx.strokeStyle = 'rgba(12, 28, 18, 0.35)';
          ctx.lineWidth = 14 + n1 * 16;
          ctx.beginPath();
          ctx.arc(
            gx * CELL + 110,
            gy * CELL + 110,
            70 + n2 * 50,
            n1 * 2,
            n1 * 2 + 1.2
          );
          ctx.stroke();
        }
      }
    }

    // Corte de ladera y terraplén de la vía (evita que la carretera parezca flotar sobre fondo plano)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Franja de desmonte / vegetación despejada alrededor de la calzada
    for (const r of runs) {
      this.tracePath(ctx, track, r.a, r.b);
      ctx.lineWidth = r.w + 38;
      ctx.strokeStyle = 'rgba(20, 36, 26, 0.42)';
      ctx.stroke();
    }

    // 2. Sombra del talud de corte sobre la ladera montañosa
    for (const r of runs) {
      ctx.save();
      ctx.translate(6, 9);
      this.tracePath(ctx, track, r.a, r.b);
      ctx.lineWidth = r.w + 24;
      ctx.strokeStyle = 'rgba(8, 16, 12, 0.48)';
      ctx.stroke();
      ctx.restore();
    }

    // 3. Terraplén y berma de apoyo
    for (const r of runs) {
      this.tracePath(ctx, track, r.a, r.b);
      ctx.lineWidth = r.w + 16;
      ctx.strokeStyle = 'rgba(30, 46, 34, 0.55)';
      ctx.stroke();
    }

    ctx.restore();
  }

  // ───────────────────────────── Mapa vectorial ─────────────────────────────

  private drawVectorTerrain(ctx: CanvasRenderingContext2D, track: Track, runs: PathRun[], viewRadius: number): void {
    ctx.save();
    // Moteado de potreros y monte alrededor de la cámara
    const CELL = 260;
    const gx0 = Math.floor((this.cameraX - viewRadius) / CELL);
    const gx1 = Math.floor((this.cameraX + viewRadius) / CELL);
    const gy0 = Math.floor((this.cameraY - viewRadius) / CELL);
    const gy1 = Math.floor((this.cameraY + viewRadius) / CELL);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const n = Math.abs(Math.sin(gx * 127.1 + gy * 311.7) * 43758.5453) % 1;
        ctx.fillStyle = n < 0.33 ? 'rgba(20, 60, 38, 0.5)' : n < 0.66 ? 'rgba(70, 120, 70, 0.22)' : 'rgba(150, 150, 80, 0.10)';
        ctx.beginPath();
        ctx.ellipse(gx * CELL + n * 150, gy * CELL + ((n * 7) % 1) * 150, 150 + n * 90, 110 + n * 60, n * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Sombra del corte de la vía sobre la ladera
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const r of runs) {
      ctx.save();
      ctx.translate(7, 10);
      this.tracePath(ctx, track, r.a, r.b);
      ctx.lineWidth = r.w + 30;
      ctx.strokeStyle = 'rgba(8, 24, 15, 0.26)';
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  private drawScenery(ctx: CanvasRenderingContext2D, viewRadius: number): void {
    const r2 = (viewRadius + 60) ** 2;
    for (const item of this.scenery) {
      const dx = item.x - this.cameraX;
      const dy = item.y - this.cameraY;
      if (dx * dx + dy * dy > r2) continue;

      ctx.save();
      ctx.translate(item.x, item.y);
      const sprite = this.assets.get(item.type === 'tree' ? 'pino_andino' : item.type === 'house' ? 'casa_campesina' : 'cafetal');
      if (sprite) {
        ctx.rotate(item.rotation);
        ctx.drawImage(sprite, -item.size, -item.size, item.size * 2, item.size * 2);
      } else if (item.type === 'tree') {
        const s = item.size;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.ellipse(s * 0.35, s * 0.45, s, s * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = item.tone > 0.5 ? '#1f5a37' : '#2a6d45';
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = item.tone > 0.5 ? '#2f7a4c' : '#3b8a59';
        ctx.beginPath();
        ctx.arc(-s * 0.22, -s * 0.24, s * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(150, 205, 140, 0.35)';
        ctx.beginPath();
        ctx.arc(-s * 0.36, -s * 0.38, s * 0.26, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.type === 'coffee_patch') {
        ctx.rotate(item.rotation);
        const s = item.size;
        ctx.fillStyle = '#24573a';
        ctx.fillRect(-s, -s * 0.6, s * 2, s * 1.2);
        // Surcos de café con cerezas maduras
        for (let row = -2; row <= 2; row++) {
          ctx.fillStyle = '#2f7046';
          ctx.fillRect(-s + 2, row * s * 0.24 - 1.6, s * 2 - 4, 3.2);
          ctx.fillStyle = '#c0392b';
          ctx.fillRect(-s * 0.6 + ((row + 2) * 7) % (s * 1.2), row * s * 0.24 - 1, 2, 2);
        }
      } else {
        ctx.rotate(item.rotation);
        const s = item.size;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
        ctx.fillRect(-s * 0.5 + 4, -s * 0.4 + 5, s, s * 0.8);
        // Corredor encalado y techo de teja a dos aguas
        ctx.fillStyle = '#f1ebdc';
        ctx.fillRect(-s * 0.54, -s * 0.44, s * 1.08, s * 0.88);
        ctx.fillStyle = '#a8452c';
        ctx.fillRect(-s * 0.5, -s * 0.4, s, s * 0.4);
        ctx.fillStyle = '#8e3823';
        ctx.fillRect(-s * 0.5, 0, s, s * 0.4);
        ctx.fillStyle = 'rgba(255, 220, 190, 0.35)';
        ctx.fillRect(-s * 0.5, -1, s, 2);
      }
      ctx.restore();
    }
  }

  /** Sombras de nubes que cruzan la cordillera: dan escala y sensación de altura. */
  private drawCloudShadows(ctx: CanvasRenderingContext2D, viewRadius: number): void {
    const CELL = 1500;
    const driftX = this.time * 16;
    const driftY = this.time * 7;
    const gx0 = Math.floor((this.cameraX - viewRadius - driftX) / CELL) - 1;
    const gx1 = Math.floor((this.cameraX + viewRadius - driftX) / CELL) + 1;
    const gy0 = Math.floor((this.cameraY - viewRadius - driftY) / CELL) - 1;
    const gy1 = Math.floor((this.cameraY + viewRadius - driftY) / CELL) + 1;
    ctx.save();
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const n = Math.abs(Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453) % 1;
        if (n < 0.45) continue;
        const cx = gx * CELL + n * 900 + driftX;
        const cy = gy * CELL + ((n * 13) % 1) * 900 + driftY;
        const radius = 380 + n * 420;
        if (Math.hypot(cx - this.cameraX, cy - this.cameraY) > viewRadius + radius) continue;
        const grad = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius);
        grad.addColorStop(0, 'rgba(4, 16, 12, 0.24)');
        grad.addColorStop(1, 'rgba(4, 16, 12, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius, radius * 0.62, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ───────────────────────────── Partículas ─────────────────────────────

  private pushSpark(x: number, y: number, vx: number, vy: number, life: number): void {
    if (this.sparks.length >= MAX_SPARKS) this.sparks.shift();
    this.sparks.push({ x, y, vx, vy, life, maxLife: life, hot: Math.random() > 0.35 });
  }

  private pushDust(x: number, y: number, vx: number, vy: number, size: number): void {
    if (this.dust.length >= MAX_DUST) this.dust.shift();
    const life = 0.5 + Math.random() * 0.5;
    this.dust.push({ x, y, vx, vy, life, maxLife: life, size });
  }

  private emitParticles(snapshot: GameSnapshot, dt: number): void {
    if (snapshot.phase !== 'racing') {
      this.lastWheel = [null, null];
      return;
    }
    const v = snapshot.vehicle;
    const speed = Math.hypot(v.vx, v.vy);
    const cosA = Math.cos(v.angle);
    const sinA = Math.sin(v.angle);
    const wheels = [-1, 1].map((side) => ({
      x: v.x - cosA * (16 * CART_SCALE) - sinA * side * (18 * CART_SCALE),
      y: v.y - sinA * (16 * CART_SCALE) + cosA * side * (18 * CART_SCALE),
    }));

    // Las balineras de acero sueltan chispa cuando derrapan o cuando la zapata muerde a alta velocidad
    const sliding = v.driftFactor > 0.3 && speed > 70;
    const hardBrake = v.braking && speed > 150;
    const flatOut = speed > 400;
    const rate = (sliding ? 70 * v.driftFactor : 0) + (hardBrake ? 45 : 0) + (flatOut ? 10 : 0);
    let n = rate * dt;
    while (n > 0) {
      if (n < 1 && Math.random() > n) break;
      const w = wheels[Math.random() < 0.5 ? 0 : 1];
      this.pushSpark(
        w.x,
        w.y,
        v.vx * 0.25 - cosA * (30 + Math.random() * 90) + (Math.random() - 0.5) * 80,
        v.vy * 0.25 - sinA * (30 + Math.random() * 90) + (Math.random() - 0.5) * 80,
        0.15 + Math.random() * 0.3
      );
      n--;
    }

    if (v.offroad && speed > 40 && Math.random() < dt * 40) {
      const w = wheels[Math.random() < 0.5 ? 0 : 1];
      this.pushDust(w.x, w.y, -cosA * 20 + (Math.random() - 0.5) * 30, -sinA * 20 + (Math.random() - 0.5) * 30, 4 + Math.random() * 4);
    }

    // Huellas de derrape: una línea por rueda trasera
    const marking = (v.driftFactor > 0.35 && speed > 60) || (v.braking && speed > 120);
    for (let i = 0; i < 2; i++) {
      const last = this.lastWheel[i];
      if (marking && last && Math.hypot(wheels[i].x - last.x, wheels[i].y - last.y) < 40) {
        if (this.skids.length >= MAX_SKIDS) this.skids.shift();
        this.skids.push({ x1: last.x, y1: last.y, x2: wheels[i].x, y2: wheels[i].y, life: SKID_LIFE_S });
      }
      this.lastWheel[i] = marking ? wheels[i] : null;
    }
  }

  private drawSkids(ctx: CanvasRenderingContext2D, dt: number): void {
    if (this.skids.length === 0) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.2;
    let alive = 0;
    for (const s of this.skids) {
      s.life -= dt;
      if (s.life <= 0) continue;
      this.skids[alive++] = s;
      ctx.strokeStyle = `rgba(12, 12, 12, ${Math.min(0.5, (s.life / SKID_LIFE_S) * 0.55)})`;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    this.skids.length = alive;
    ctx.restore();
  }

  private drawSparks(ctx: CanvasRenderingContext2D, dt: number): void {
    if (this.sparks.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    let alive = 0;
    for (const s of this.sparks) {
      s.life -= dt;
      if (s.life <= 0) continue;
      this.sparks[alive++] = s;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 1 - dt * 3;
      s.vy *= 1 - dt * 3;
      const k = s.life / s.maxLife;
      ctx.strokeStyle = s.hot ? `rgba(255, ${Math.round(150 + 90 * k)}, ${Math.round(60 * k)}, ${k})` : `rgba(255, 244, 200, ${k})`;
      ctx.lineWidth = 0.9 + k * 0.9;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.035, s.y - s.vy * 0.035);
      ctx.stroke();
    }
    this.sparks.length = alive;
    ctx.restore();
  }

  private drawDust(ctx: CanvasRenderingContext2D, dt: number): void {
    if (this.dust.length === 0) return;
    ctx.save();
    let alive = 0;
    for (const d of this.dust) {
      d.life -= dt;
      if (d.life <= 0) continue;
      this.dust[alive++] = d;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const k = d.life / d.maxLife;
      ctx.fillStyle = `rgba(150, 125, 90, ${k * 0.42})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size * (1.6 - k * 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
    this.dust.length = alive;
    ctx.restore();
  }

  // ───────────────────────────── Carro de rodillos ─────────────────────────────

  /**
   * Carro de rodillos tradicional de Ebéjico visto desde arriba: tablón de cedro, eje trasero fijo,
   * eje delantero que pivota con el lazo y los pies, cuatro balineras de acero y piloto con casco.
   * Si `state` es null se dibuja como fantasma (sin sombra ni dirección).
   */
  private drawCart(ctx: CanvasRenderingContext2D, pose: Pose, state: VehicleState | null, alpha: number): void {
    const ghost = state === null;
    ctx.save();
    ctx.globalAlpha = alpha;

    if (!ghost) {
      // Sombra con desfase fijo en el mundo (sol del noroeste)
      ctx.save();
      ctx.translate(pose.x + 2.4, pose.y + 3.2);
      ctx.rotate(pose.angle);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
      const shadowW = 56 * CART_SCALE;
      const shadowH = 38 * CART_SCALE;
      this.roundRect(ctx, -shadowW / 2, -shadowH / 2, shadowW, shadowH, 6 * CART_SCALE);
      ctx.fill();
      ctx.restore();
    }

    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.angle + (state ? state.driftFactor * 0.1 * Math.sign(state.steer || 0) : 0));
    ctx.scale(CART_SCALE, CART_SCALE);

    const sprite = this.assets.get('carro_rodillos');
    if (sprite) {
      ctx.drawImage(sprite, -34, -22, 68, 44);
      ctx.restore();
      return;
    }

    const steerAngle = state ? state.steer * 0.42 : 0;
    const wood = ghost ? '#cfe6e0' : '#a56d37';
    const woodDark = ghost ? '#9fbdb6' : '#6b4423';
    const woodLight = ghost ? '#e6f4f0' : '#c48f52';
    const steel = ghost ? '#e9f2f0' : '#d5dbdf';
    const steelDark = ghost ? '#9fbdb6' : '#59636b';

    const bearing = (x: number, y: number): void => {
      ctx.fillStyle = steelDark;
      this.roundRect(ctx, x - 6, y - 3.6, 12, 7.2, 2.2);
      ctx.fill();
      ctx.fillStyle = steel;
      this.roundRect(ctx, x - 5, y - 2.8, 10, 4.2, 1.6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(x - 3.5, y - 2.2, 7, 1);
    };

    // Eje trasero fijo
    ctx.fillStyle = woodDark;
    this.roundRect(ctx, -27, -18, 7, 36, 1.5);
    ctx.fill();
    bearing(-23.5, -20.5);
    bearing(-23.5, 20.5);

    // Tablón central y asiento
    ctx.fillStyle = woodDark;
    this.roundRect(ctx, -31, -8, 58, 16, 3);
    ctx.fill();
    ctx.fillStyle = wood;
    this.roundRect(ctx, -30, -7, 56, 14, 2.5);
    ctx.fill();
    ctx.fillStyle = woodLight;
    ctx.fillRect(-28, -6, 52, 1.6);
    ctx.fillStyle = woodDark;
    ctx.fillRect(-26, -1.5, 46, 0.8);
    ctx.fillRect(-20, 3, 38, 0.8);

    ctx.fillStyle = woodDark;
    this.roundRect(ctx, -30, -14, 26, 28, 3);
    ctx.fill();
    ctx.fillStyle = wood;
    this.roundRect(ctx, -29, -13, 24, 26, 2.5);
    ctx.fill();
    ctx.fillStyle = woodDark;
    ctx.fillRect(-29, -4.6, 24, 0.9);
    ctx.fillRect(-29, 4, 24, 0.9);
    ctx.fillStyle = woodLight;
    ctx.fillRect(-28, -12, 22, 1.4);

    // Palanca de freno con zapata de caucho (lado derecho)
    const braking = Boolean(state?.braking);
    ctx.fillStyle = woodDark;
    this.roundRect(ctx, -16, 14, 20, 3.2, 1.2);
    ctx.fill();
    ctx.fillStyle = braking ? '#ff7a2e' : '#1d1d1d';
    this.roundRect(ctx, -21, 13.4, 6, 4.6, 1.2);
    ctx.fill();

    // Eje delantero articulado
    const pivotX = 22;
    const footL = { x: pivotX + Math.sin(steerAngle) * 11, y: -Math.cos(steerAngle) * 11 };
    const footR = { x: pivotX - Math.sin(steerAngle) * 11, y: Math.cos(steerAngle) * 11 };
    const tipL = { x: pivotX + Math.sin(steerAngle) * 17, y: -Math.cos(steerAngle) * 17 };
    const tipR = { x: pivotX - Math.sin(steerAngle) * 17, y: Math.cos(steerAngle) * 17 };

    ctx.save();
    ctx.translate(pivotX, 0);
    ctx.rotate(steerAngle);
    ctx.fillStyle = woodDark;
    this.roundRect(ctx, -3.5, -18, 7, 36, 1.5);
    ctx.fill();
    ctx.fillStyle = woodLight;
    ctx.fillRect(-2.4, -17, 1.2, 34);
    bearing(0, -20.5);
    bearing(0, 20.5);
    ctx.fillStyle = ghost ? steel : '#d4b06a';
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (!ghost) {
      // Piernas extendidas: los pies gobiernan el eje delantero
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#2f3f55';
      ctx.lineWidth = 6.2;
      ctx.beginPath();
      ctx.moveTo(-8, -5);
      ctx.quadraticCurveTo(8, -9, footL.x - 2, footL.y);
      ctx.moveTo(-8, 5);
      ctx.quadraticCurveTo(8, 9, footR.x - 2, footR.y);
      ctx.stroke();
      ctx.fillStyle = '#1b1b1b';
      ctx.beginPath();
      ctx.ellipse(footL.x, footL.y, 3.6, 2.8, steerAngle, 0, Math.PI * 2);
      ctx.ellipse(footR.x, footR.y, 3.6, 2.8, steerAngle, 0, Math.PI * 2);
      ctx.fill();

      // Lazo del timón, de las puntas del eje a las manos
      ctx.strokeStyle = '#e6d5ab';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tipL.x, tipL.y);
      ctx.quadraticCurveTo(10, -13, 1, -7);
      ctx.moveTo(tipR.x, tipR.y);
      ctx.quadraticCurveTo(10, 13, 1, 7);
      ctx.stroke();

      // Torso (camisa roja de Ebéjico) y brazos
      ctx.fillStyle = '#7d1712';
      this.roundRect(ctx, -22, -10.5, 17, 21, 6);
      ctx.fill();
      ctx.fillStyle = '#b3261e';
      this.roundRect(ctx, -21, -9.5, 15, 19, 5.5);
      ctx.fill();
      ctx.strokeStyle = '#b3261e';
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.moveTo(-10, -9);
      ctx.quadraticCurveTo(-3, -11, 1, -7);
      ctx.moveTo(-10, 9);
      ctx.quadraticCurveTo(-3, 11, 1, 7);
      ctx.stroke();
      ctx.fillStyle = '#c8905f';
      ctx.beginPath();
      ctx.arc(1.5, -7, 2.4, 0, Math.PI * 2);
      ctx.arc(1.5, 7, 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Casco blanco con franja dorada y visera
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(-12.4, 1, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4f0e4';
      ctx.beginPath();
      ctx.arc(-13, 0, 7.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c8a96e';
      ctx.fillRect(-20.4, -1.3, 14.8, 2.6);
      ctx.fillStyle = '#20262b';
      ctx.beginPath();
      ctx.arc(-13, 0, 7.6, -0.75, 0.75);
      ctx.arc(-13, 0, 4.6, 0.75, -0.75, true);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(-15.5, -3, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Fantasma: contorno del piloto
      ctx.fillStyle = 'rgba(230, 245, 240, 0.9)';
      this.roundRect(ctx, -21, -9.5, 15, 19, 5.5);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-13, 0, 7.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ───────────────────────────── Señales y atmósfera (espacio de pantalla) ─────────────────────────────

  /** Señales viales siempre de frente al jugador: informativas verdes, postes de kilómetro, meta. */
  private drawSigns(ctx: CanvasRenderingContext2D, m: DOMMatrix, W: number, H: number): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const r2 = 1700 * 1700;

    for (const s of this.signs) {
      const dx = s.x - this.cameraX;
      const dy = s.y - this.cameraY;
      if (dx * dx + dy * dy > r2) continue;
      const sx = (m.a * s.x + m.c * s.y + m.e) / this.dpr;
      const sy = (m.b * s.x + m.d * s.y + m.f) / this.dpr;
      if (sx < -160 || sx > W + 160 || sy < 60 || sy > H + 40) continue;

      const small = s.kind === 'km';
      ctx.font = small ? '700 10px system-ui, sans-serif' : '700 12px system-ui, sans-serif';
      const text = small ? s.text.toUpperCase() : s.text;
      const tw = ctx.measureText(text).width;
      const bw = tw + (small ? 10 : 18);
      const bh = small ? 16 : 24;
      const by = sy - (small ? 20 : 34);
      // El tablero se abre hacia el lado contrario a la vía para no taparla
      const roadSx = (m.a * s.rx + m.c * s.ry + m.e) / this.dpr;
      const dir = s.kind === 'closed' ? 0 : sx >= roadSx ? 1 : -1;
      const bx = sx + dir * (bw / 2 - 6);

      // Poste
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(sx - 0.5, by + bh / 2, 2.5, sy - by - bh / 2 + 1);
      ctx.fillStyle = '#c9cfcc';
      ctx.fillRect(sx - 1, by + bh / 2, 2, sy - by - bh / 2);

      let bg = '#0b6b3a';
      let fg = '#ffffff';
      let border = '#ffffff';
      if (s.kind === 'km') {
        bg = '#f4f1e6';
        fg = '#14181a';
        border = '#14181a';
      } else if (s.kind === 'finish') {
        bg = '#14181a';
        fg = '#f2cf63';
        border = '#f2cf63';
      } else if (s.kind === 'closed') {
        bg = '#f2b90f';
        fg = '#14181a';
        border = '#14181a';
      } else if (s.kind === 'start') {
        bg = '#1b4965';
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      this.roundRect(ctx, bx - bw / 2 + 1.5, by - bh / 2 + 2.5, bw, bh, small ? 3 : 5);
      ctx.fill();
      ctx.fillStyle = bg;
      this.roundRect(ctx, bx - bw / 2, by - bh / 2, bw, bh, small ? 3 : 5);
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = small ? 1 : 1.4;
      this.roundRect(ctx, bx - bw / 2 + 2, by - bh / 2 + 2, bw - 4, bh - 4, small ? 2 : 3.5);
      ctx.stroke();
      ctx.fillStyle = fg;
      ctx.fillText(text, bx, by + 0.5);
    }
    ctx.restore();
  }

  private drawAtmosphere(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    chase: boolean,
    speedRatio: number,
    anchorX: number,
    anchorY: number,
    dt: number
  ): void {
    ctx.save();

    // Bruma de cordillera hacia el horizonte (solo con la cámara inclinada)
    if (chase) {
      const haze = ctx.createLinearGradient(0, 0, 0, H * 0.42);
      haze.addColorStop(0, 'rgba(196, 214, 206, 0.34)');
      haze.addColorStop(1, 'rgba(196, 214, 206, 0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, W, H * 0.42);
    }

    // Líneas de velocidad
    if (speedRatio > 0.7) {
      const strength = Math.min(1, (speedRatio - 0.7) / 0.4);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + strength * 0.16})`;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      const count = Math.round(6 + strength * 12);
      const reach = Math.hypot(W, H) * 0.55;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = reach * (0.55 + Math.random() * 0.4);
        const len = 24 + Math.random() * 70 * strength;
        ctx.moveTo(anchorX + Math.cos(a) * r0, anchorY + Math.sin(a) * r0 * 0.8);
        ctx.lineTo(anchorX + Math.cos(a) * (r0 + len), anchorY + Math.sin(a) * (r0 + len) * 0.8);
      }
      ctx.stroke();
    }

    // Viñeta
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    vig.addColorStop(0, 'rgba(5, 14, 10, 0)');
    vig.addColorStop(1, 'rgba(5, 14, 10, 0.5)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    if (this.flashRed > 0) {
      this.flashRed = Math.max(0, this.flashRed - dt * 1.4);
      const red = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      red.addColorStop(0, 'rgba(160, 20, 20, 0)');
      red.addColorStop(1, `rgba(160, 20, 20, ${this.flashRed * 0.55})`);
      ctx.fillStyle = red;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.flashDark > 0) {
      this.flashDark = Math.max(0, this.flashDark - dt * 1.8);
      ctx.fillStyle = `rgba(4, 10, 7, ${this.flashDark * 0.8})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }
}
