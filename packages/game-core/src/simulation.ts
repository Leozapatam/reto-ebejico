import { ControlInput, GameEvent, GamePhase, GameSnapshot, RaceStats } from './types';
import { Vehicle } from './vehicle';
import { Track, NearestTrackInfo, PX_PER_METER } from './track';
import { StepTimer } from './timer';

/** Conversión de velocidad de juego (px/s) a km/h mostrados (escala arcade). */
export const SPEED_TO_KMH = 0.22;

const STEPS_PER_SECOND = 60;
const OFFROAD_GRACE_S = 3.0;        // Tiempo máximo rodando por la berma
const FALL_MARGIN_PX = 28;          // Más allá de la berma: barranco
const PENALTY_RESPAWN_MS = 2500;
const PENALTY_FALL_MS = 3000;
const PENALTY_SHORTCUT_MS = 4000;

export class Simulation {
  public vehicle: Vehicle;
  public track: Track;
  public timer: StepTimer;
  public phase: GamePhase = 'ready';

  private checkpoints: Array<{ index: number; name: string; isBridge: boolean }>;
  private currentCheckpointIndex: number = 0;
  private currentLocationName: string = '';

  private recentNotice?: string;
  private noticeTimer: number = 0;
  private countdownTimer: number = 0;
  private countdownNumber: number = 3;
  private phaseBeforePause: GamePhase = 'racing';

  // Seguimiento secuencial sobre la vía (anti-atajos)
  private searchIndex: number = 0;
  private info: NearestTrackInfo;
  private lastOnRoadInfo?: NearestTrackInfo;

  // Estado fuera de calzada
  private wasOffroad: boolean = false;
  private offroadTimer: number = OFFROAD_GRACE_S;
  private offroadPath: number = 0;       // Camino real recorrido por fuera (px)
  private offroadEntryDist: number = 0;  // Progreso sobre la vía al salirse (px)

  private raceSteps: number = 0;
  private respawnHeld: boolean = false;
  private railCooldown: number = 0;
  private barricadeCooldown: number = 0;
  private events: GameEvent[] = [];
  private stats: RaceStats = { penaltyMs: 0, penaltyCount: 0, railHits: 0, topSpeedKmh: 0 };

  constructor(track?: Track) {
    this.track = track || new Track();
    const startPoint = this.track.getStartPoint();
    const startAngle = this.track.getStartAngle();

    this.vehicle = new Vehicle(startPoint.x, startPoint.y, startAngle);
    this.timer = new StepTimer();

    this.checkpoints = this.track.getCheckpoints().map((cp) => ({
      index: cp.index,
      name: cp.name,
      isBridge: Boolean(cp.point.isBridge),
    }));
    this.info = this.track.getNearestTrackInfo(startPoint, 0);
    this.reset();
  }

  reset(): void {
    const startPoint = this.track.getStartPoint();
    const startAngle = this.track.getStartAngle();

    this.vehicle.reset(startPoint.x, startPoint.y, startAngle, startPoint.z || 0, startPoint.elevationMeters || 1907);
    this.timer.reset();
    this.phase = 'ready';
    this.searchIndex = 0;
    this.lastOnRoadInfo = undefined;
    this.wasOffroad = false;
    this.offroadTimer = OFFROAD_GRACE_S;
    this.offroadPath = 0;
    this.offroadEntryDist = 0;
    // El hito 0 es la propia salida: se da por validado para no anunciarlo en el segundo cero
    this.currentCheckpointIndex = this.checkpoints.length > 0 && this.checkpoints[0].index === 0 ? 1 : 0;
    this.currentLocationName = this.checkpoints[0]?.name ?? '';
    this.recentNotice = undefined;
    this.noticeTimer = 0;
    this.countdownTimer = 0;
    this.countdownNumber = 3;
    this.raceSteps = 0;
    this.respawnHeld = false;
    this.railCooldown = 0;
    this.barricadeCooldown = 0;
    this.events = [];
    this.stats = { penaltyMs: 0, penaltyCount: 0, railHits: 0, topSpeedKmh: 0 };
    this.info = this.track.getNearestTrackInfo(startPoint, 0);
  }

  startCountdown(): void {
    this.phase = 'countdown';
    this.countdownNumber = 3;
    this.countdownTimer = STEPS_PER_SECOND;
    this.events.push({ type: 'countdown', value: 3 });
  }

  /** Pausa o reanuda. Devuelve true si la simulación queda en pausa. */
  togglePause(): boolean {
    if (this.phase === 'paused') {
      this.phase = this.phaseBeforePause;
      return false;
    }
    if (this.phase === 'racing' || this.phase === 'countdown') {
      this.phaseBeforePause = this.phase;
      this.phase = 'paused';
      return true;
    }
    return false;
  }

  step(input: ControlInput, dt: number = 1 / STEPS_PER_SECOND): void {
    // 1. Cuenta regresiva inicial
    if (this.phase === 'countdown') {
      this.countdownTimer--;
      if (this.countdownTimer <= 0) {
        if (this.countdownNumber > 1) {
          this.countdownNumber--;
          this.countdownTimer = STEPS_PER_SECOND;
          this.events.push({ type: 'countdown', value: this.countdownNumber });
        } else {
          this.phase = 'racing';
          this.timer.start();
          this.events.push({ type: 'go' });
        }
      }
      return;
    }

    if (this.phase !== 'racing') return;

    // Cronómetro determinista
    this.timer.step();
    this.raceSteps++;
    if (this.railCooldown > 0) this.railCooldown--;
    if (this.barricadeCooldown > 0) this.barricadeCooldown--;
    this.tickNotice();

    const state = this.vehicle.state;

    // 2. Posición respecto a la vía con búsqueda secuencial estricta
    const info = this.track.getNearestTrackInfo({ x: state.x, y: state.y }, this.searchIndex);
    this.info = info;
    const roadHalfW = info.roadWidth / 2;

    // 3. Colisión contra las defensas viales
    this.resolveGuardrails(info, roadHalfW);

    // 4. Reincorporación manual (un pulso por pulsación)
    const respawnPressed = Boolean(input.respawn);
    if (respawnPressed && !this.respawnHeld) {
      this.respawnHeld = true;
      this.respawnVehicle(this.lastOnRoadInfo || info, PENALTY_RESPAWN_MS);
      this.events.push({ type: 'respawn' });
      this.setNotice('Reincorporado a la vía  +2.5 s');
      return;
    }
    this.respawnHeld = respawnPressed;

    // 5. Calzada, berma y barranco
    if (!info.isOffroad) {
      if (this.wasOffroad) {
        // Reingreso: ¿ganó mucho más recorrido de vía que el camino que realmente rodó por fuera?
        const gained = info.distanceAlong - this.offroadEntryDist;
        if (gained > this.offroadPath * 1.8 + 140) {
          this.respawnVehicle(this.lastOnRoadInfo || info, PENALTY_SHORTCUT_MS);
          this.events.push({ type: 'shortcut' });
          this.setNotice('Atajo no permitido  +4.0 s');
          return;
        }
      }
      this.wasOffroad = false;
      this.offroadTimer = OFFROAD_GRACE_S;
      this.searchIndex = info.segmentIndex;
      this.lastOnRoadInfo = info;
    } else {
      if (!this.wasOffroad) {
        this.wasOffroad = true;
        this.offroadPath = 0;
        this.offroadEntryDist = this.lastOnRoadInfo?.distanceAlong ?? info.distanceAlong;
      }
      this.offroadPath += Math.hypot(state.vx, state.vy) * dt;
      this.offroadTimer -= dt;

      if (info.distanceToCenterline > roadHalfW + FALL_MARGIN_PX) {
        this.respawnVehicle(this.lastOnRoadInfo || info, PENALTY_FALL_MS);
        this.events.push({ type: 'fall' });
        this.setNotice('¡Caída al barranco!  +3.0 s');
        return;
      }

      if (this.offroadTimer <= 0) {
        this.respawnVehicle(this.lastOnRoadInfo || info, PENALTY_RESPAWN_MS);
        this.events.push({ type: 'offroad_reset' });
        this.setNotice('Demasiado tiempo fuera de la calzada  +2.5 s');
        return;
      }

      // Rodando por la berma el detector sigue avanzando con el carro: antes se quedaba anclado
      // y a los pocos metros declaraba una «caída» aunque el carro siguiera pegado a la vía.
      this.searchIndex = info.segmentIndex;
    }

    // 6. Física del carro de rodillos (pendiente real y gravedad)
    this.vehicle.update(input, dt, info.isOffroad, info.z, info.elevationMeters, info.slopeGrade, info.gradePercent / 100);
    state.distanceAlongTrack = info.distanceAlong;

    const kmh = Math.abs(state.speed) * SPEED_TO_KMH;
    if (kmh > this.stats.topSpeedKmh) this.stats.topSpeedKmh = kmh;

    // 7. Barricada del ramal cerrado de Las Partidas
    if (info.decoyBarricadeHit) {
      if (this.barricadeCooldown === 0) {
        this.events.push({ type: 'barricade' });
        this.barricadeCooldown = 45;
      }
      state.speed = -40;
      state.vx = -state.vx * 0.4;
      state.vy = -state.vy * 0.4;
      this.setNotice('Vía cerrada: retrocede y toma el desvío a Ebéjico');
    } else if (info.onDecoyBranch && info.distanceToCenterline > roadHalfW + 14) {
      this.setNotice('Esta es la vía a San Jerónimo. Ebéjico es por el desvío', 60);
    }

    // 8. Hitos y meta
    this.checkCheckpointsAndFinish(info);
  }

  /**
   * Rebote contra la bionda: se refleja la componente normal (e ≈ 0,35) y el roce
   * resta velocidad, así que «apoyarse» en la defensa nunca es la línea rápida.
   */
  private resolveGuardrails(info: NearestTrackInfo, roadHalfW: number): void {
    const state = this.vehicle.state;
    const limit = roadHalfW + 1;
    let side: -1 | 1 | 0 = 0;
    if (info.hasGuardrailLeft && info.lateralOffset < -limit) side = -1;
    else if (info.hasGuardrailRight && info.lateralOffset > limit) side = 1;
    if (side === 0) return;

    const normalX = -Math.sin(info.tangentAngle);
    const normalY = Math.cos(info.tangentAngle);
    const excess = side * limit - info.lateralOffset;
    state.x += normalX * excess;
    state.y += normalY * excess;

    const vDotN = state.vx * normalX + state.vy * normalY;
    const impact = vDotN * side; // > 0 si se mueve hacia la defensa
    if (impact > 0) {
      state.vx -= vDotN * 1.35 * normalX;
      state.vy -= vDotN * 1.35 * normalY;

      const intensity = Math.min(1, impact / 160);
      const scrub = 1 - (0.012 + 0.2 * intensity);
      state.vx *= scrub;
      state.vy *= scrub;
      state.driftFactor = Math.min(1, state.driftFactor + 0.35);

      if (this.railCooldown === 0 && impact > 12) {
        this.events.push({ type: 'rail_hit', intensity, side });
        this.railCooldown = 9;
        if (impact > 45) this.stats.railHits++;
      }
    }
  }

  private checkCheckpointsAndFinish(info: NearestTrackInfo): void {
    const lastCp = this.checkpoints.length - 1;

    // Hitos intermedios: la progresión es secuencial, así que basta con haber llegado a su índice
    while (this.currentCheckpointIndex < lastCp && info.segmentIndex >= this.checkpoints[this.currentCheckpointIndex].index) {
      const cp = this.checkpoints[this.currentCheckpointIndex];
      const splitMs = this.timer.recordSplit();
      this.events.push({
        type: 'checkpoint',
        name: cp.name,
        index: this.currentCheckpointIndex,
        splitIndex: this.timer.getSplitTimes().length - 1,
        splitMs,
        isBridge: cp.isBridge,
      });
      this.currentCheckpointIndex++;
      this.currentLocationName = cp.name;
    }

    // Meta: fin del trazado. (El detector nunca devuelve el índice del último punto,
    // por eso la llegada se mide por distancia y no por índice de hito.)
    if (this.currentCheckpointIndex >= lastCp && info.distanceAlong >= this.track.totalLength - 6) {
      const finishName = this.checkpoints[lastCp]?.name ?? 'Meta';
      const timeMs = this.timer.recordSplit();
      this.currentCheckpointIndex = this.checkpoints.length;
      this.currentLocationName = finishName;
      this.phase = 'finished';
      this.timer.pause();
      this.recentNotice = undefined;
      this.noticeTimer = 0;
      this.events.push({ type: 'finish', timeMs });
    }
  }

  private respawnVehicle(target: NearestTrackInfo, penaltyMs: number): void {
    this.vehicle.respawn(target.projection.x, target.projection.y, target.tangentAngle, target.z, target.elevationMeters);
    this.searchIndex = target.segmentIndex;
    this.wasOffroad = false;
    this.offroadTimer = OFFROAD_GRACE_S;
    this.offroadPath = 0;
    this.info = this.track.getNearestTrackInfo(target.projection, this.searchIndex);
    if (penaltyMs > 0) {
      this.timer.addPenalty(penaltyMs);
      this.stats.penaltyMs += penaltyMs;
      this.stats.penaltyCount++;
      this.events.push({ type: 'penalty', ms: penaltyMs });
    }
  }

  private tickNotice(): void {
    if (this.noticeTimer > 0) {
      this.noticeTimer--;
      if (this.noticeTimer <= 0) this.recentNotice = undefined;
    }
  }

  setNotice(msg: string, durationSteps: number = 150): void {
    this.recentNotice = msg;
    this.noticeTimer = durationSteps;
  }

  /** Estado completo para dibujar. Entrega (y vacía) los sucesos acumulados desde la llamada anterior. */
  getSnapshot(): GameSnapshot {
    const info = this.info;
    const events = this.events;
    this.events = [];
    const racingLike = this.phase === 'racing' || (this.phase === 'paused' && this.phaseBeforePause === 'racing');

    return {
      phase: this.phase,
      elapsedTimeMs: this.timer.getElapsedMs(),
      formattedTime: this.timer.getFormattedTime(),
      raceSteps: this.raceSteps,
      speedKmh: Math.round(Math.abs(this.vehicle.state.speed) * SPEED_TO_KMH),
      elevationMeters: Math.round(info.elevationMeters),
      gradePercent: info.gradePercent,
      currentCheckpoint: this.currentCheckpointIndex,
      totalCheckpoints: this.checkpoints.length,
      progressPercent: Math.round(info.progressPercent * 10) / 10,
      distanceMeters: info.distanceAlong / PX_PER_METER,
      totalMeters: this.track.totalMeters,
      segmentIndex: info.segmentIndex,
      offroad: info.isOffroad,
      offroadCountdown: racingLike && info.isOffroad ? Math.max(0, this.offroadTimer) : null,
      onDecoyBranch: info.onDecoyBranch,
      isBridge: info.isBridge,
      bridgeName: info.bridgeName,
      currentLocationName: this.currentLocationName,
      curveAhead: racingLike
        ? this.track.getCurveAhead(info.segmentIndex, info.distanceAlong, 150 + Math.abs(this.vehicle.state.speed) * 0.85)
        : null,
      splits: this.timer.getSplitTimes(),
      stats: { ...this.stats },
      vehicle: { ...this.vehicle.state },
      recentNotice: this.recentNotice,
      countdownNumber: this.phase === 'countdown' ? this.countdownNumber : undefined,
      events,
    };
  }
}
