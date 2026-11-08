import { ControlInput, GamePhase, GameSnapshot } from './types';
import { Vehicle } from './vehicle';
import { Track, NearestTrackInfo } from './track';
import { StepTimer } from './timer';

export class Simulation {
  public vehicle: Vehicle;
  public track: Track;
  public timer: StepTimer;
  public phase: GamePhase = 'ready';

  private lastSegmentIndex: number = 0;
  private currentCheckpointIndex: number = 0;
  private totalCheckpoints: number = 0;
  private checkpoints: Array<{ index: number; name: string }>;
  private recentNotice?: string;
  private currentLocationName: string = 'Salida del Túnel de Occidente';
  private noticeTimer: number = 0;
  private countdownTimer: number = 0;
  private countdownNumber: number = 3;

  // Mecánica anti-atajos: contador al salirse de la carretera a la manga o selva
  private offroadTimer: number = 3.0;
  private readonly maxOffroadTime: number = 3.0;

  constructor(track?: Track) {
    this.track = track || new Track();
    const startPoint = this.track.getStartPoint();
    const startAngle = this.track.getStartAngle();

    this.vehicle = new Vehicle(startPoint.x, startPoint.y, startAngle);
    this.timer = new StepTimer();

    this.checkpoints = this.track.getCheckpoints();
    this.totalCheckpoints = this.checkpoints.length;
    this.reset();
  }

  reset(): void {
    const startPoint = this.track.getStartPoint();
    const startAngle = this.track.getStartAngle();

    this.vehicle.reset(startPoint.x, startPoint.y, startAngle, startPoint.z || 0, startPoint.elevationMeters || 1907);
    this.timer.reset();
    this.phase = 'ready';
    this.lastSegmentIndex = 0;
    this.currentCheckpointIndex = 0;
    this.recentNotice = undefined;
    this.noticeTimer = 0;
    this.countdownTimer = 0;
    this.countdownNumber = 3;
    this.offroadTimer = this.maxOffroadTime;
  }

  startCountdown(): void {
    this.phase = 'countdown';
    this.countdownNumber = 3;
    this.countdownTimer = 60; // 1 segundo (a 60 Hz) por número
    this.setNotice('3');
  }

  step(input: ControlInput, dt: number = 1 / 60): GameSnapshot {
    // 1. Manejo de cuentas regresivas iniciales
    if (this.phase === 'countdown') {
      this.countdownTimer--;
      if (this.countdownTimer <= 0) {
        if (this.countdownNumber === 3) {
          this.countdownNumber = 2;
          this.countdownTimer = 60;
          this.setNotice('2');
        } else if (this.countdownNumber === 2) {
          this.countdownNumber = 1;
          this.countdownTimer = 60;
          this.setNotice('1');
        } else if (this.countdownNumber === 1) {
          this.phase = 'racing';
          this.timer.start();
          this.setNotice('¡ARRANCA! DEL TÚNEL AL PUEBLO');
        }
      }
      return this.getSnapshot();
    }

    if (this.phase !== 'racing') {
      return this.getSnapshot();
    }

    // Cronómetro determinista
    this.timer.step();

    // 2. Detección respecto a la pista y elevación
    const trackInfo = this.track.getNearestTrackInfo(
      { x: this.vehicle.state.x, y: this.vehicle.state.y },
      this.lastSegmentIndex
    );
    this.lastSegmentIndex = trackInfo.segmentIndex;

    // 3. Comprobación de recuperación manual
    if (input.respawn) {
      this.respawnVehicle(trackInfo);
      this.setNotice('Carro de rodillos reincorporado (+2.5s penalización)');
      return this.getSnapshot();
    }

    // 4. Mecánica Anti-Trampas (Fuera de Pista / Manga / Selva)
    if (trackInfo.isOffroad) {
      this.offroadTimer -= dt;
      // Si se acaba el tiempo o si se aleja demasiado de la calzada
      if (this.offroadTimer <= 0 || trackInfo.distanceToCenterline > 110) {
        this.respawnVehicle(trackInfo);
        this.setNotice('⚠️ REINCORPORADO A LA PISTA (SALIDA DE CALZADA)');
        this.offroadTimer = this.maxOffroadTime;
        return this.getSnapshot();
      }
    } else {
      this.offroadTimer = this.maxOffroadTime;
    }

    // 5. Actualización física del Carro de Rodillos (con pendiente 3D y gravedad)
    this.vehicle.update(
      input,
      dt,
      trackInfo.isOffroad,
      trackInfo.z,
      trackInfo.elevationMeters,
      trackInfo.slopeGrade
    );

    // 6. Colisión con barricada en ramal cerrado de Las Partidas
    if (trackInfo.decoyBarricadeHit) {
      this.vehicle.state.speed = -40;
      this.vehicle.state.vx = -this.vehicle.state.vx * 0.4;
      this.vehicle.state.vy = -this.vehicle.state.vy * 0.4;
      this.setNotice('🛑 CALZADA CORTADA: Da reversa con [S] y toma Las Partidas hacia Ebéjico');
    } else if (trackInfo.onDecoyBranch) {
      this.setNotice('⚠️ ¡VÍA A SAN JERÓNIMO! Está cerrada. Gira hacia Ebéjico');
    }

    // 7. Verificación de Checkpoints, Puentes y Meta
    this.checkCheckpointsAndFinish(trackInfo);

    // 8. Temporizador de avisos
    if (this.noticeTimer > 0) {
      this.noticeTimer--;
      if (this.noticeTimer <= 0) {
        this.recentNotice = undefined;
      }
    }

    return this.getSnapshot();
  }

  private checkCheckpointsAndFinish(trackInfo: NearestTrackInfo): void {
    if (trackInfo.segmentIndex >= this.track.points.length - 2 && trackInfo.progressPercent >= 98.5) {
      this.phase = 'finished';
      this.timer.pause();
      this.setNotice('🏁 ¡LLEGADA TRIUNFAL AL PARQUE PRINCIPAL DE EBÉJICO! 🏁');
      return;
    }

    if (this.currentCheckpointIndex < this.checkpoints.length) {
      const nextCp = this.checkpoints[this.currentCheckpointIndex];
      if (trackInfo.segmentIndex >= nextCp.index) {
        this.timer.recordSplit();
        this.currentCheckpointIndex++;
        this.currentLocationName = nextCp.name;
        this.setNotice(nextCp.name);
      }
    }
  }

  private respawnVehicle(trackInfo: NearestTrackInfo): void {
    this.vehicle.respawn(
      trackInfo.projection.x,
      trackInfo.projection.y,
      trackInfo.tangentAngle,
      trackInfo.z,
      trackInfo.elevationMeters
    );
    // Añadimos penalización de 2.5 segundos
    this.timer.addPenalty(2500);
  }

  setNotice(msg: string, durationFrames: number = 180): void {
    this.recentNotice = msg;
    this.noticeTimer = durationFrames;
  }

  getSnapshot(): GameSnapshot {
    const trackInfo = this.track.getNearestTrackInfo(
      { x: this.vehicle.state.x, y: this.vehicle.state.y },
      this.lastSegmentIndex
    );

    // Velocidad en km/h calculada a escala proporcional
    const speedKmh = Math.round(Math.abs(this.vehicle.state.speed) * 0.22);

    return {
      phase: this.phase,
      elapsedTimeMs: this.timer.getElapsedMs(),
      formattedTime: this.timer.getFormattedTime(),
      speedKmh,
      elevationMeters: Math.round(trackInfo.elevationMeters),
      currentCheckpoint: this.currentCheckpointIndex,
      totalCheckpoints: this.totalCheckpoints,
      progressPercent: Math.round(trackInfo.progressPercent * 10) / 10,
      offroad: trackInfo.isOffroad,
      offroadCountdown: trackInfo.isOffroad ? Math.max(0, this.offroadTimer) : null,
      onDecoyBranch: trackInfo.onDecoyBranch,
      isBridge: trackInfo.isBridge,
      bridgeName: trackInfo.bridgeName,
      currentLocationName: this.currentLocationName,
      vehicle: { ...this.vehicle.state },
      recentNotice: this.recentNotice,
      countdownNumber: this.phase === 'countdown' ? this.countdownNumber : undefined,
    };
  }
}
