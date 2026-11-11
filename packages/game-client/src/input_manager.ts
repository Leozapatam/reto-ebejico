import { ControlInput } from '@core/types';

/**
 * Entrada unificada: teclado, botones táctiles y mando.
 *
 *   ↑ / W        Empujar
 *   ↓ / S        Freno de zapata / reversa
 *   ← → / A D    Timón de lazo
 *   Espacio      Derrape (zapata a fondo)
 *   F            Volver a la vía (reincorporación con penalización)
 *
 * Los atajos de interfaz (pausa, cámara, mapa, reinicio) viven en el HUD para que
 * ninguna tecla de conducción dispare otra acción por accidente.
 */
export class InputManager {
  private keys: Set<string> = new Set();
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
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      this.keys.add(e.code);
      // Evita que las flechas y el espacio desplacen la página o activen el botón enfocado
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  releaseAll(): void {
    this.keys.clear();
    this.resetTouch();
  }

  // Controles táctiles en pantalla
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

  private readGamepad(): { steer: number; throttle: number; brake: number; handbrake: boolean; respawn: boolean } | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    for (const pad of navigator.getGamepads()) {
      if (!pad || !pad.connected) continue;
      const axis = pad.axes[0] ?? 0;
      const dpad = (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0);
      const steer = Math.abs(axis) > 0.15 ? axis : dpad;
      const throttle = Math.max(pad.buttons[7]?.value ?? 0, pad.buttons[0]?.pressed ? 1 : 0);
      const brake = Math.max(pad.buttons[6]?.value ?? 0, pad.buttons[1]?.pressed ? 1 : 0);
      const handbrake = Boolean(pad.buttons[2]?.pressed || pad.buttons[5]?.pressed);
      const respawn = Boolean(pad.buttons[3]?.pressed);
      if (steer !== 0 || throttle > 0.05 || brake > 0.05 || handbrake || respawn) {
        return { steer, throttle, brake, handbrake, respawn };
      }
    }
    return null;
  }

  getInput(): ControlInput {
    const k = this.keys;
    const left = k.has('ArrowLeft') || k.has('KeyA');
    const right = k.has('ArrowRight') || k.has('KeyD');
    const up = k.has('ArrowUp') || k.has('KeyW');
    const down = k.has('ArrowDown') || k.has('KeyS');

    let steer = 0;
    if (left && !right) steer = -1;
    if (right && !left) steer = 1;
    if (this.touchSteer !== 0) steer = this.touchSteer;

    let throttle = up || this.touchThrottle ? 1 : 0;
    let brake = down || this.touchBrake ? 1 : 0;
    let handbrake = k.has('Space') || this.touchHandbrake;
    let respawn = k.has('KeyF') || this.touchRespawn;

    const pad = this.readGamepad();
    if (pad) {
      if (steer === 0) steer = pad.steer;
      throttle = Math.max(throttle, pad.throttle);
      brake = Math.max(brake, pad.brake);
      handbrake = handbrake || pad.handbrake;
      respawn = respawn || pad.respawn;
    }

    // Empuje asistido (opción de accesibilidad): acelera solo mientras no se frene
    if (this.assistedAcceleration && brake === 0) throttle = 1;

    // El respawn táctil es un pulso de un solo paso
    this.touchRespawn = false;

    return { steer, throttle, brake, handbrake, respawn };
  }
}
