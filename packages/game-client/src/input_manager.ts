import { ControlInput } from '@core/types';

export class InputManager {
  private keys: Record<string, boolean> = {};
  public assistedAcceleration: boolean = false;

  // Estados táctiles
  private touchSteer: number = 0;
  private touchThrottle: boolean = false;
  private touchBrake: boolean = false;
  private touchHandbrake: boolean = false;
  private touchRespawn: boolean = false;

  constructor() {
    this.initKeyboardListeners();
  }

  private initKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      this.keys[e.code] = true;
      // Prevenir desplazamiento de página con flechas y espacio
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
      this.keys[e.code] = false;
    });

    window.addEventListener('blur', () => {
      this.keys = {};
      this.resetTouch();
    });
  }

  // Métodos para controles táctiles en pantalla
  setTouchSteer(val: number): void {
    this.touchSteer = Math.max(-1, Math.min(1, val));
  }

  setTouchThrottle(active: boolean): void {
    this.touchThrottle = active;
  }

  setTouchBrake(active: boolean): void {
    this.touchBrake = active;
  }

  setTouchHandbrake(active: boolean): void {
    this.touchHandbrake = active;
  }

  triggerTouchRespawn(): void {
    this.touchRespawn = true;
  }

  resetTouch(): void {
    this.touchSteer = 0;
    this.touchThrottle = false;
    this.touchBrake = false;
    this.touchHandbrake = false;
    this.touchRespawn = false;
  }

  getInput(): ControlInput {
    // Teclas de dirección
    const left = this.keys['arrowleft'] || this.keys['a'] || this.keys['keya'];
    const right = this.keys['arrowright'] || this.keys['d'] || this.keys['keyd'];
    const up = this.keys['arrowup'] || this.keys['w'] || this.keys['keyw'];
    const down = this.keys['arrowdown'] || this.keys['s'] || this.keys['keys'];
    const space = this.keys[' '] || this.keys['space'];
    const respawnKey = this.keys['r'] || this.keys['keyr'];

    // Dirección combinada (-1 a +1)
    let steer = 0;
    if (left && !right) steer = -1;
    if (right && !left) steer = 1;
    if (this.touchSteer !== 0) steer = this.touchSteer;

    // Aceleración y freno
    let throttle = up || this.touchThrottle ? 1 : 0;
    const brake = down || this.touchBrake ? 1 : 0;

    // Aceleración asistida (opción de accesibilidad)
    if (this.assistedAcceleration) {
      if (brake === 0) {
        throttle = 1;
      }
    }

    const handbrake = Boolean(space || this.touchHandbrake);
    const respawn = Boolean(respawnKey || this.touchRespawn);

    // Consumir respawn de un solo pulso
    this.touchRespawn = false;

    return {
      steer,
      throttle,
      brake,
      handbrake,
      respawn,
    };
  }
}
