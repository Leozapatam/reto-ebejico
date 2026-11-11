export interface Vector2D {
  x: number;
  y: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface ControlInput {
  steer: number;     // -1 (izquierda) a +1 (derecha)
  throttle: number;  // 0 a 1
  brake: number;     // 0 a 1
  handbrake: boolean;// derrape / freno de mano
  respawn?: boolean; // botón de recuperación
}

export interface TrackPoint {
  x: number;
  y: number;
  z?: number;                 // Altura relativa en 3D
  elevationMeters?: number;   // Altitud real sobre el nivel del mar (msnm)
  width: number;
  name?: string;
  isCheckpoint?: boolean;
  isBridge?: boolean;         // Indicador de viaducto / puente sobre quebrada
  bridgeName?: string;        // Nombre del puente (ej. Puente Quebrada La Sucia)
  canyonDepth?: number;       // Profundidad del abismo o cañón bajo el puente
  hasGuardrailLeft?: boolean; // Defensa vial metálica en el borde izquierdo
  hasGuardrailRight?: boolean;// Defensa vial metálica en el borde derecho
}

export interface VehicleConfig {
  maxSpeed: number;          // píxeles/unidades por segundo
  acceleration: number;      // aceleración máx
  brakingPower: number;      // fuerza de frenado
  reverseSpeed: number;      // velocidad máx marcha atrás
  turnSpeed: number;         // velocidad angular base (rad/s)
  grip: number;              // agarre lateral (0 suelto, 1 pegado)
  drag: number;              // resistencia al aire
  offroadFriction: number;   // fricción fuera de calzada
  length: number;            // largo del carro de rodillos
  width: number;             // ancho del carro de rodillos
}

export interface VehicleState {
  x: number;
  y: number;
  z: number;                 // Altura 3D actual
  elevationMeters: number;   // Altitud actual (msnm)
  pitch: number;             // Cabeceo por pendiente (subida / bajada)
  roll: number;              // Inclinación lateral en curvas
  angle: number;             // Orientación en radianes en el plano X-Y
  speed: number;             // Velocidad escalar a lo largo del chasis
  vx: number;                // Velocidad global X
  vy: number;                // Velocidad global Y
  driftFactor: number;       // Factor de derrape de las balineras
  steer: number;             // Giro efectivo del eje delantero (-1 a +1)
  braking: boolean;          // Zapata de freno aplicada
  offroad: boolean;          // Si está fuera de la calzada
  distanceAlongTrack: number;// Progreso lineal
  lapFinished: boolean;
}

export type GamePhase = 'ready' | 'countdown' | 'racing' | 'finished' | 'paused';

/**
 * Sucesos puntuales de la simulación. El cliente (sonido, partículas, HUD)
 * reacciona a ellos sin tener que adivinar qué pasó comparando snapshots.
 */
export type GameEvent =
  | { type: 'countdown'; value: number }
  | { type: 'go' }
  | { type: 'checkpoint'; name: string; index: number; splitIndex: number; splitMs: number; isBridge: boolean }
  | { type: 'rail_hit'; intensity: number; side: -1 | 1 }
  | { type: 'fall' }
  | { type: 'shortcut' }
  | { type: 'offroad_reset' }
  | { type: 'respawn' }
  | { type: 'barricade' }
  | { type: 'penalty'; ms: number }
  | { type: 'finish'; timeMs: number };

export type CurveSeverity = 1 | 2 | 3; // 1 curva · 2 curva cerrada · 3 horquilla

export interface CurveAhead {
  direction: -1 | 1;        // -1 izquierda, +1 derecha
  severity: CurveSeverity;
  distanceMeters: number;   // Distancia hasta el inicio de la curva
}

export interface RaceStats {
  penaltyMs: number;
  penaltyCount: number;
  railHits: number;
  topSpeedKmh: number;
}

export interface GameSnapshot {
  phase: GamePhase;
  elapsedTimeMs: number;
  formattedTime: string;
  raceSteps: number;               // Pasos de simulación en carrera (sin penalizaciones): reloj del fantasma
  speedKmh: number;
  elevationMeters: number;
  gradePercent: number;            // Pendiente real de la vía en % (negativa = bajada)
  currentCheckpoint: number;
  totalCheckpoints: number;
  progressPercent: number;
  distanceMeters: number;          // Distancia recorrida sobre el eje de la vía
  totalMeters: number;
  segmentIndex: number;
  offroad: boolean;
  offroadCountdown: number | null; // Conteo regresivo antes de devolver al jugador a la pista
  onDecoyBranch?: boolean;
  isBridge?: boolean;
  bridgeName?: string;
  currentLocationName?: string;
  curveAhead: CurveAhead | null;
  splits: number[];
  stats: RaceStats;
  vehicle: VehicleState;
  recentNotice?: string;
  countdownNumber?: number;        // 3, 2, 1 para overlay centrado
  events: GameEvent[];             // Sucesos ocurridos desde el snapshot anterior
}
