import { ControlInput, VehicleConfig, VehicleState } from './types';

export const DEFAULT_VEHICLE_CONFIG: VehicleConfig = {
  maxSpeed: 420,           // Ajustado para Carro de Rodillos (controlable y emocionante en curvas de montaña)
  acceleration: 310,       // Aceleración de empuje / inercia
  brakingPower: 760,       // Freno de palanca con zapata de caucho
  reverseSpeed: 100,       // Marcha atrás moderada
  turnSpeed: 3.8,          // Respuesta de giro ágil en horquillas y curvas cerradas
  grip: 0.90,              // Balineras de acero sobre asfalto con buen agarre
  drag: 0.988,             // Inercia alta (rueda con suavidad cuesta abajo)
  offroadFriction: 0.58,   // Fricción suave y controlable si pisa la berma o la manga
  length: 22,              // Tamaño reducido y proporcional a los carriles
  width: 12,               // Permite maniobrar y trazar curvas con amplitud
};

export class Vehicle {
  public state: VehicleState;
  public config: VehicleConfig;
  private angularVelocity: number = 0;

  constructor(startX: number, startY: number, startAngle: number, config: VehicleConfig = DEFAULT_VEHICLE_CONFIG) {
    this.config = { ...config };
    this.state = {
      x: startX,
      y: startY,
      z: 0,
      elevationMeters: 1907,
      pitch: 0,
      roll: 0,
      angle: startAngle,
      speed: 0,
      vx: 0,
      vy: 0,
      driftFactor: 0,
      offroad: false,
      distanceAlongTrack: 0,
      lapFinished: false,
    };
  }

  reset(x: number, y: number, angle: number, z: number = 0, elevationMeters: number = 1907): void {
    this.state.x = x;
    this.state.y = y;
    this.state.z = z;
    this.state.elevationMeters = elevationMeters;
    this.state.pitch = 0;
    this.state.roll = 0;
    this.state.angle = angle;
    this.state.speed = 0;
    this.state.vx = 0;
    this.state.vy = 0;
    this.state.driftFactor = 0;
    this.state.offroad = false;
    this.state.distanceAlongTrack = 0;
    this.state.lapFinished = false;
    this.angularVelocity = 0;
  }

  update(
    input: ControlInput,
    dt: number,
    isOffroad: boolean,
    terrainZ: number = 0,
    elevationMeters: number = 1907,
    slopeGrade: number = 0
  ): void {
    this.state.offroad = isOffroad;
    this.state.z += (terrainZ - this.state.z) * 0.25;
    this.state.elevationMeters = elevationMeters;

    // Cabeceo por pendiente (subida / bajada)
    this.state.pitch = Math.max(-0.25, Math.min(0.25, slopeGrade * 0.5));

    // 1. Aceleración y frenado longitudinal
    const forwardX = Math.cos(this.state.angle);
    const forwardY = Math.sin(this.state.angle);
    const rightX = -Math.sin(this.state.angle);
    const rightY = Math.cos(this.state.angle);

    let forwardSpeed = this.state.vx * forwardX + this.state.vy * forwardY;
    let lateralSpeed = this.state.vx * rightX + this.state.vy * rightY;

    // Efecto de gravedad por pendiente (cuesta abajo acelera el carro de rodillos de forma natural)
    const gravitySlopeBonus = slopeGrade < 0 ? Math.abs(slopeGrade) * 140 : -slopeGrade * 90;

    const effectiveMaxSpeed = isOffroad ? this.config.maxSpeed * this.config.offroadFriction : this.config.maxSpeed;

    if (input.throttle > 0) {
      forwardSpeed += (input.throttle * this.config.acceleration + gravitySlopeBonus) * dt;
      if (forwardSpeed > effectiveMaxSpeed) {
        forwardSpeed = effectiveMaxSpeed;
      }
    } else if (slopeGrade < -0.02) {
      // Gravedad residual rodando cuesta abajo sin acelerador
      forwardSpeed += gravitySlopeBonus * 0.5 * dt;
      if (forwardSpeed > effectiveMaxSpeed * 0.75) {
        forwardSpeed = effectiveMaxSpeed * 0.75;
      }
    }

    if (input.brake > 0) {
      if (forwardSpeed > 10) {
        forwardSpeed -= input.brake * this.config.brakingPower * dt;
        if (forwardSpeed < 0) forwardSpeed = 0;
      } else {
        forwardSpeed -= input.brake * (this.config.acceleration * 0.5) * dt;
        if (forwardSpeed < -this.config.reverseSpeed) {
          forwardSpeed = -this.config.reverseSpeed;
        }
      }
    }

    // Fricción aerodinámica
    if (input.throttle === 0 && input.brake === 0) {
      forwardSpeed *= Math.pow(this.config.drag, dt * 60);
      if (Math.abs(forwardSpeed) < 2) forwardSpeed = 0;
    }

    // 2. Giro y dirección
    const speedRatio = Math.min(1, Math.abs(forwardSpeed) / (this.config.maxSpeed * 0.35));
    const highSpeedDamp = 1 / (1 + (Math.abs(forwardSpeed) / this.config.maxSpeed) * 0.6);
    const steerFactor = speedRatio * highSpeedDamp;

    const targetAngularVelocity = input.steer * this.config.turnSpeed * steerFactor * (forwardSpeed >= 0 ? 1 : -1);
    this.angularVelocity = this.angularVelocity * 0.72 + targetAngularVelocity * 0.28;
    this.state.angle += this.angularVelocity * dt;

    // Roll (inclinación lateral en virajes)
    this.state.roll = this.angularVelocity * 0.08;

    // 3. Fricción lateral y agarre de balineras
    let currentGrip = isOffroad ? 0.65 : this.config.grip;
    if (input.handbrake) {
      currentGrip = 0.38; // Derrape controlado con palanca de zapata
    }

    lateralSpeed *= Math.pow(1 - currentGrip, dt * 10);
    this.state.driftFactor = Math.min(1, Math.abs(lateralSpeed) / 100);

    // 4. Vector de velocidad global
    const newForwardX = Math.cos(this.state.angle);
    const newForwardY = Math.sin(this.state.angle);
    const newRightX = -Math.sin(this.state.angle);
    const newRightY = Math.cos(this.state.angle);

    this.state.vx = forwardSpeed * newForwardX + lateralSpeed * newRightX;
    this.state.vy = forwardSpeed * newForwardY + lateralSpeed * newRightY;
    this.state.speed = forwardSpeed;

    // 5. Integración de posición
    this.state.x += this.state.vx * dt;
    this.state.y += this.state.vy * dt;
  }

  respawn(trackX: number, trackY: number, trackAngle: number, trackZ: number = 0, elevationMeters: number = 1907): void {
    this.state.x = trackX;
    this.state.y = trackY;
    this.state.z = trackZ;
    this.state.elevationMeters = elevationMeters;
    this.state.angle = trackAngle;
    this.state.speed = 0;
    this.state.vx = 0;
    this.state.vy = 0;
    this.state.driftFactor = 0;
    this.state.pitch = 0;
    this.state.roll = 0;
    this.angularVelocity = 0;
  }
}
