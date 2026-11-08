import { GameSnapshot } from '@core/types';
import { Track } from '@core/track';
import { InputManager } from '@client/input_manager';
import { SoundSynthesizer } from '@client/audio';
import { CameraMode } from '@client/renderer';

export interface HudCallbacks {
  onStartGame: (trackType: 'real' | 'test') => void;
  onRestart: () => void;
  onToggleMute: () => boolean;
  onToggleCamera: () => CameraMode | string;
  onToggleSatellite?: () => boolean;
}

export class HudController {
  private timerEl!: HTMLElement;
  private speedEl!: HTMLElement;
  private elevationEl!: HTMLElement;
  private locationEl!: HTMLElement;
  private progressFillEl!: HTMLElement;
  private noticeContainerEl!: HTMLElement;
  private noticeTextEl!: HTMLElement;
  private bigCountdownContainer!: HTMLElement;
  private bigCountdownNum!: HTMLElement;
  private offroadAlertEl!: HTMLElement;
  private offroadTextEl!: HTMLElement;
  private modalEl!: HTMLElement;
  private startScreenEl!: HTMLElement;
  private muteBtn!: HTMLElement;
  private cameraBtn!: HTMLElement;
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;
  private elevationCanvas!: HTMLCanvasElement;
  private elevationCtx!: CanvasRenderingContext2D;
  private slopeBadgeEl!: HTMLElement;
  private elevationSamples: { dist: number; elev: number; name?: string }[] = [];
  private totalElevationLength: number = 0;

  private lastSnapshot?: GameSnapshot;
  private sound: SoundSynthesizer;
  private input: InputManager;
  private callbacks: HudCallbacks;
  private selectedTrackType: 'real' | 'test' = 'real';
  private track?: Track;

  private mapMinX: number = -14500;
  private mapMaxX: number = 2200;
  private mapMinY: number = -5900;
  private mapMaxY: number = 2200;

  constructor(sound: SoundSynthesizer, input: InputManager, callbacks: HudCallbacks) {
    this.sound = sound;
    this.input = input;
    this.callbacks = callbacks;
    this.mountElements();
    this.bindEvents();
  }

  setTrack(track: Track): void {
    this.track = track;
    this.calculateMinimapBounds();
    this.buildElevationProfile(track);
  }

  private buildElevationProfile(track: Track): void {
    const pts = track.points;
    this.elevationSamples = [];
    if (pts.length === 0) return;

    let accum = 0;
    this.elevationSamples.push({
      dist: 0,
      elev: pts[0].elevationMeters || 1907,
      name: 'Túnel',
    });

    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      accum += d;

      if (i % 6 === 0 || i === pts.length - 1 || p1.isCheckpoint) {
        this.elevationSamples.push({
          dist: accum,
          elev: p1.elevationMeters || 1907,
          name: p1.name,
        });
      }
    }
    this.totalElevationLength = Math.max(1, accum);
  }

  private calculateMinimapBounds(): void {
    if (!this.track || this.track.points.length === 0) return;
    const xs = this.track.points.map((p) => p.x);
    const ys = this.track.points.map((p) => p.y);
    this.mapMinX = Math.min(...xs) - 400;
    this.mapMaxX = Math.max(...xs) + 400;
    this.mapMinY = Math.min(...ys) - 400;
    this.mapMaxY = Math.max(...ys) + 400;
  }

  private mountElements(): void {
    const root = document.getElementById('app') || document.body;

    const hudHtml = `
      <div id="ui-overlay">
        <!-- Pantalla de Inicio -->
        <div id="start-screen" class="start-screen">
          <div class="start-badge">Mirada Parda · Colección de Videojuegos Territoriales</div>
          <h1 class="start-title">RETO EBÉJICO</h1>
          <div class="start-subtitle">Carrera de Carros de Rodillos · Del túnel al pueblo (26.1 km)</div>
          <p class="start-desc">
            Súbete al tradicional <strong>Carro de Rodillos de Ebéjico</strong> con balineras de acero. Desciende por la carretera de montaña desde los 1.907 m en el <strong>Túnel de Occidente</strong>, sortea el desvío de <strong>Las Partidas</strong>, cruza el cañón de <strong>La Sucia</strong> (1.300 m), corona el alto de <strong>El Patudo</strong> (1.763 m) y desciende al <strong>Parque Principal</strong>. ¡Cuidado con salirte a la manga o te devolverá la penalización!
          </p>

          <div style="display: flex; gap: 12px; margin-bottom: 24px;">
            <button id="opt-track-real" class="hud-button" style="background: var(--ebejico-oro-ancestral); color: var(--ebejico-verde-oscuro); font-weight: bold; padding: 10px 18px;">
              🗺️ RUTA REAL COMPLETA (26 KM · 3D)
            </button>
            <button id="opt-track-test" class="hud-button" style="padding: 10px 18px;">
              ⚡ CIRCUITO DE PRUEBA
            </button>
          </div>

          <div class="start-instructions">
            <div><span class="start-key">↑ / W</span> Empuje / Acelerar</div>
            <div><span class="start-key">↓ / S</span> Freno de palanca / Reversa</div>
            <div><span class="start-key">← / →</span> Girar timón de lazo</div>
            <div><span class="start-key">ESPACIO</span> Derrape de balineras</div>
            <div><span class="start-key">C</span> Vista Isométrica (Dinámica / 45°)</div>
            <div><span class="start-key">R</span> Reiniciar</div>
          </div>

          <button id="btn-start-game" class="btn-primary" style="font-size: 20px; padding: 16px 48px;">
            INICIAR RECORRIDO
          </button>
        </div>

        <!-- Barra Superior (HUD) -->
        <header class="hud-top">
          <div class="hud-brand">
            <span class="hud-brand-title">RETO EBÉJICO</span>
            <div id="hud-location-badge" class="hud-location-badge">
              <span>📍</span> <span id="hud-location-name">Salida del Túnel de Occidente</span>
            </div>
          </div>

          <div class="hud-timer-container">
            <span class="hud-timer-label">Cronómetro Oficial</span>
            <span id="hud-timer-val" class="hud-timer-value">00:00.00</span>
          </div>

          <div class="hud-stats">
            <div class="hud-stat-box" title="Velocidad del Carro de Rodillos">
              <span id="hud-speed-val" class="hud-stat-num">0</span>
              <span class="hud-stat-unit">km/h</span>
            </div>

            <div class="hud-stat-box" title="Altitud real sobre el nivel del mar">
              <span id="hud-elevation-val" class="hud-stat-num">1907</span>
              <span class="hud-stat-unit">msnm</span>
            </div>

            <button id="btn-camera" class="hud-button" title="Alternar vista (C)">🧭 Vista: Adelante</button>
            <button id="btn-satellite" class="hud-button" title="Alternar ortofoto satelital (S)">🛰️ Satelital: ON</button>
            <button id="btn-mute" class="hud-button" title="Silenciar / Activar sonido">🔊</button>
            <button id="btn-reset" class="hud-button" title="Reiniciar partida (R)">Reiniciar</button>
          </div>
        </header>

        <!-- Barra de progreso -->
        <div class="hud-progress-bar">
          <div id="hud-progress-fill" class="hud-progress-fill"></div>
        </div>

        <!-- Conteo Gigante Centrado Arcade (3 - 2 - 1 - ¡ARRANCA!) -->
        <div id="hud-big-countdown" class="big-countdown-container" style="display: none;">
          <div id="big-countdown-num" class="big-countdown-text">3</div>
          <div class="big-countdown-sub">CARRERA DE CARROS DE RODILLOS · EBÉJICO</div>
        </div>

        <!-- Alerta Anti-Trampas Fuera de Pista (Manga / Selva) -->
        <div id="hud-offroad-alert" class="offroad-alert-banner" style="display: none;">
          <span>⚠️</span>
          <span id="hud-offroad-text">¡FUERA DE PISTA! Regresa a la calzada: 3.0s</span>
        </div>

        <!-- Avisos dinámicos en pantalla -->
        <div id="notice-container" class="notice-container" style="display: none;">
          <div id="notice-text" class="notice-text"></div>
        </div>

        <!-- Perfil Altimétrico y Relieve en Tiempo Real (Copernicus DEM) en la esquina izquierda -->
        <div class="hud-elevation-box">
          <div class="hud-elevation-title">
            <span>⛰️ PERFIL DE RELIEVE</span>
            <span id="hud-slope-badge" class="hud-slope-badge">▼ -8.4%</span>
          </div>
          <canvas id="elevation-canvas" width="240" height="140"></canvas>
        </div>

        <!-- Minimapa Geográfico Flotante en la esquina derecha -->
        <div class="hud-minimap-box">
          <div class="hud-minimap-title">
            <span>🗺️ MAPA TERRITORIAL</span>
            <span id="hud-minimap-progress" style="color: var(--ebejico-crema-papel); font-family: var(--font-mono);">0%</span>
          </div>
          <canvas id="minimap-canvas" width="240" height="140"></canvas>
        </div>

        <!-- Controles Táctiles (Móviles / Tabletas) -->
        <div class="touch-controls">
          <div class="touch-cluster-left">
            <button id="touch-left" class="touch-btn">◀</button>
            <button id="touch-right" class="touch-btn">▶</button>
          </div>
          <div class="touch-cluster-right">
            <button id="touch-handbrake" class="touch-btn">🛑</button>
            <button id="touch-brake" class="touch-btn">▼</button>
            <button id="touch-gas" class="touch-btn touch-btn-gas">▲</button>
          </div>
        </div>

        <!-- Modal de Meta / Resultados -->
        <div id="modal-finished" class="modal-overlay" style="display: none;">
          <div class="modal-card">
            <h2 class="modal-title">🏁 ¡LLEGADA A EBÉJICO! 🏁</h2>
            <div class="modal-subtitle">Has coronado la meta en el Parque Principal con tu Carro de Rodillos</div>

            <div class="modal-time-display">
              <div class="modal-time-label">Tiempo Oficial</div>
              <div id="modal-final-time" class="modal-time-val">00:00.00</div>
            </div>

            <div style="margin-bottom: 24px; font-size: 13px; color: var(--ebejico-texto-suave); line-height: 1.5;">
              ¡Gran bajada desde el Túnel de Occidente! Recorriste los 26.15 kilómetros de cordillera, cruzaste las quebradas y superaste las curvas de montaña.
            </div>

            <button id="modal-btn-restart" class="btn-primary" style="width: 100%; font-size: 18px; padding: 14px;">
              VOLVER A JUGAR
            </button>
          </div>
        </div>
      </div>
    `;

    root.insertAdjacentHTML('beforeend', hudHtml);

    this.timerEl = document.getElementById('hud-timer-val') as HTMLElement;
    this.speedEl = document.getElementById('hud-speed-val') as HTMLElement;
    this.elevationEl = document.getElementById('hud-elevation-val') as HTMLElement;
    this.locationEl = document.getElementById('hud-location-name') as HTMLElement;
    this.progressFillEl = document.getElementById('hud-progress-fill') as HTMLElement;
    this.noticeContainerEl = document.getElementById('notice-container') as HTMLElement;
    this.noticeTextEl = document.getElementById('notice-text') as HTMLElement;
    this.bigCountdownContainer = document.getElementById('hud-big-countdown') as HTMLElement;
    this.bigCountdownNum = document.getElementById('big-countdown-num') as HTMLElement;
    this.offroadAlertEl = document.getElementById('hud-offroad-alert') as HTMLElement;
    this.offroadTextEl = document.getElementById('hud-offroad-text') as HTMLElement;
    this.modalEl = document.getElementById('modal-finished') as HTMLElement;
    this.startScreenEl = document.getElementById('start-screen') as HTMLElement;
    this.muteBtn = document.getElementById('btn-mute') as HTMLElement;
    this.cameraBtn = document.getElementById('btn-camera') as HTMLElement;
    this.minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
    this.elevationCanvas = document.getElementById('elevation-canvas') as HTMLCanvasElement;
    this.elevationCtx = this.elevationCanvas.getContext('2d')!;
    this.slopeBadgeEl = document.getElementById('hud-slope-badge') as HTMLElement;
  }

  private bindEvents(): void {
    const btnStart = document.getElementById('btn-start-game');
    const optReal = document.getElementById('opt-track-real');
    const optTest = document.getElementById('opt-track-test');

    optReal?.addEventListener('click', () => {
      this.selectedTrackType = 'real';
      optReal.style.background = 'var(--ebejico-oro-ancestral)';
      optReal.style.color = 'var(--ebejico-verde-oscuro)';
      optReal.style.fontWeight = 'bold';
      if (optTest) {
        optTest.style.background = 'var(--ebejico-verde-selva)';
        optTest.style.color = 'var(--ebejico-crema-papel)';
        optTest.style.fontWeight = 'normal';
      }
    });

    optTest?.addEventListener('click', () => {
      this.selectedTrackType = 'test';
      optTest.style.background = 'var(--ebejico-oro-ancestral)';
      optTest.style.color = 'var(--ebejico-verde-oscuro)';
      optTest.style.fontWeight = 'bold';
      if (optReal) {
        optReal.style.background = 'var(--ebejico-verde-selva)';
        optReal.style.color = 'var(--ebejico-crema-papel)';
        optReal.style.fontWeight = 'normal';
      }
    });

    btnStart?.addEventListener('click', () => {
      this.sound.ensureStarted();
      this.startScreenEl.style.display = 'none';
      this.callbacks.onStartGame(this.selectedTrackType);
    });

    const btnReset = document.getElementById('btn-reset');
    btnReset?.addEventListener('click', () => {
      this.callbacks.onRestart();
    });

    const modalBtnRestart = document.getElementById('modal-btn-restart');
    modalBtnRestart?.addEventListener('click', () => {
      this.modalEl.style.display = 'none';
      this.callbacks.onRestart();
    });

    this.muteBtn.addEventListener('click', () => {
      const isMuted = this.callbacks.onToggleMute();
      this.muteBtn.textContent = isMuted ? '🔇' : '🔊';
    });

    this.cameraBtn.addEventListener('click', () => {
      this.toggleCameraDisplay();
    });

    const btnSatellite = document.getElementById('btn-satellite');
    btnSatellite?.addEventListener('click', () => {
      if (this.callbacks.onToggleSatellite) {
        const enabled = this.callbacks.onToggleSatellite();
        btnSatellite.textContent = enabled ? '🛰️ Satelital: ON' : '🗺️ Vector';
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'c') {
        this.toggleCameraDisplay();
      } else if (e.key.toLowerCase() === 's') {
        if (this.callbacks.onToggleSatellite) {
          const enabled = this.callbacks.onToggleSatellite();
          if (btnSatellite) {
            btnSatellite.textContent = enabled ? '🛰️ Satelital: ON' : '🗺️ Vector';
          }
        }
      }
    });

    this.bindTouchButton('touch-left', (pressed) => this.input.setTouchSteer(pressed ? -1 : 0));
    this.bindTouchButton('touch-right', (pressed) => this.input.setTouchSteer(pressed ? 1 : 0));
    this.bindTouchButton('touch-gas', (pressed) => this.input.setTouchThrottle(pressed));
    this.bindTouchButton('touch-brake', (pressed) => this.input.setTouchBrake(pressed));
    this.bindTouchButton('touch-handbrake', (pressed) => this.input.setTouchHandbrake(pressed));
  }

  private toggleCameraDisplay(): void {
    const mode = this.callbacks.onToggleCamera();
    this.cameraBtn.textContent = mode === 'north' ? '🧭 Vista: Norte' : '🧭 Vista: Adelante';
  }

  private bindTouchButton(id: string, callback: (pressed: boolean) => void): void {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.sound.ensureStarted();
      callback(true);
    });

    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      callback(false);
    });

    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.sound.ensureStarted();
      callback(true);
    });

    el.addEventListener('mouseup', (e) => {
      e.preventDefault();
      callback(false);
    });
  }

  update(snapshot: GameSnapshot): void {
    // 1. Cronómetro, Velocidad y Altitud
    this.timerEl.textContent = snapshot.formattedTime;
    this.speedEl.textContent = snapshot.speedKmh.toString();
    if (this.elevationEl) {
      this.elevationEl.textContent = snapshot.elevationMeters.toString();
    }
    this.progressFillEl.style.width = `${snapshot.progressPercent.toFixed(1)}%`;

    // 2. Ubicación territorial o puente actual
    if (snapshot.isBridge && snapshot.bridgeName) {
      this.locationEl.innerHTML = `🌉 <strong>${snapshot.bridgeName}</strong>`;
    } else if (snapshot.currentLocationName) {
      this.locationEl.textContent = snapshot.currentLocationName;
    }

    // 3. Conteo gigante centrado en pantalla (3 - 2 - 1 - ¡ARRANCA!)
    if (snapshot.phase === 'countdown' && snapshot.countdownNumber) {
      this.bigCountdownContainer.style.display = 'flex';
      const numStr = snapshot.countdownNumber.toString();
      if (this.bigCountdownNum.textContent !== numStr) {
        this.bigCountdownNum.textContent = numStr;
        this.sound.playCountdown(false);
      }
    } else if (snapshot.phase === 'racing' && snapshot.elapsedTimeMs < 1200) {
      this.bigCountdownContainer.style.display = 'flex';
      this.bigCountdownNum.textContent = '¡ARRANCA!';
      this.bigCountdownNum.style.fontSize = '85px';
    } else {
      this.bigCountdownContainer.style.display = 'none';
    }

    // 4. Alerta anti-trampas: Fuera de Pista (Manga / Selva)
    if (snapshot.offroadCountdown !== null) {
      this.offroadAlertEl.style.display = 'flex';
      this.offroadTextEl.textContent = `¡FUERA DE PISTA! Regresa a la calzada: ${snapshot.offroadCountdown.toFixed(1)}s`;
    } else {
      this.offroadAlertEl.style.display = 'none';
    }

    // 5. Avisos y carteles de carretera
    if (snapshot.recentNotice && !['3', '2', '1'].includes(snapshot.recentNotice) && !snapshot.recentNotice.includes('ARRANCA')) {
      this.noticeContainerEl.style.display = 'flex';
      this.noticeTextEl.textContent = snapshot.recentNotice;
    } else {
      this.noticeContainerEl.style.display = 'none';
    }

    // 6. Modal de meta al llegar al Parque de Ebéjico
    if (snapshot.phase === 'finished') {
      if (!this.lastSnapshot || this.lastSnapshot.phase !== 'finished') {
        this.sound.playFinish();
        this.modalEl.style.display = 'flex';
        const modalFinalTime = document.getElementById('modal-final-time');
        if (modalFinalTime) {
          modalFinalTime.textContent = snapshot.formattedTime;
        }
      }
    }

    // 7. Sonido del Carro de Rodillos (balineras y fricción)
    this.sound.updateEngine(snapshot.speedKmh, snapshot.vehicle.speed > 0 ? 1 : 0, snapshot.vehicle.driftFactor);

    // 8. Actualización del minimapa territorial y perfil de relieve
    this.drawMinimap(snapshot);
    this.drawElevationProfile(snapshot);

    // 9. Actualización de la pendiente en tiempo real
    const slope = snapshot.vehicle.pitch || 0;
    if (this.slopeBadgeEl) {
      if (slope < -0.012) {
        this.slopeBadgeEl.textContent = `▼ ${Math.abs(Math.round(slope * 100))}% Bajada`;
        this.slopeBadgeEl.className = 'hud-slope-badge';
      } else if (slope > 0.012) {
        this.slopeBadgeEl.textContent = `▲ +${Math.round(slope * 100)}% Subida`;
        this.slopeBadgeEl.className = 'hud-slope-badge climb';
      } else {
        this.slopeBadgeEl.textContent = '▶ 0% Llano';
        this.slopeBadgeEl.className = 'hud-slope-badge';
      }
    }

    const mapProgEl = document.getElementById('hud-minimap-progress');
    if (mapProgEl) {
      mapProgEl.textContent = `${Math.round(snapshot.progressPercent)}%`;
    }

    this.lastSnapshot = snapshot;
  }

  private drawMinimap(snapshot: GameSnapshot): void {
    if (!this.track) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const pad = 12;
    const mapW = w - pad * 2;
    const mapH = h - pad * 2;

    const spanX = Math.max(1, this.mapMaxX - this.mapMinX);
    const spanY = Math.max(1, this.mapMaxY - this.mapMinY);

    const toMapX = (gx: number) => pad + ((gx - this.mapMinX) / spanX) * mapW;
    const toMapY = (gy: number) => pad + ((gy - this.mapMinY) / spanY) * mapH;

    // Ramal cerrado Las Partidas hacia San Jerónimo
    if (this.track.decoyBranch && this.track.decoyBranch.points.length > 1) {
      const dpts = this.track.decoyBranch.points;
      ctx.beginPath();
      ctx.moveTo(toMapX(dpts[0].x), toMapY(dpts[0].y));
      for (let i = 1; i < dpts.length; i++) {
        ctx.lineTo(toMapX(dpts[i].x), toMapY(dpts[i].y));
      }
      ctx.strokeStyle = '#D9534F';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Carretera oficial de Ebéjico
    const pts = this.track.points;
    ctx.beginPath();
    ctx.moveTo(toMapX(pts[0].x), toMapY(pts[0].y));
    for (let i = 1; i < pts.length; i += 2) {
      ctx.lineTo(toMapX(pts[i].x), toMapY(pts[i].y));
    }
    ctx.strokeStyle = '#C8A96E';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // Hitos y Puentes principales
    const checkpoints = this.track.getCheckpoints();
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';

    checkpoints.forEach((cp, idx) => {
      const mx = toMapX(cp.point.x);
      const my = toMapY(cp.point.y);

      if (idx === 0) {
        ctx.fillStyle = '#E74C3C';
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F5EFE0';
        ctx.fillText('Túnel', mx, my + 10);
      } else if (idx === checkpoints.length - 1) {
        ctx.fillStyle = '#2ECC71';
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFDD00';
        ctx.fillText('Ebéjico (Meta)', mx, my + 11);
      } else if (cp.name.includes('Sucia')) {
        ctx.fillStyle = '#2980B9';
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#A9CCE3';
        ctx.fillText('La Sucia', mx, my - 6);
      } else if (cp.name.includes('Partidas') || cp.name.includes('Cruce')) {
        ctx.fillStyle = '#FFDD00';
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('Las Partidas', mx, my - 6);
      } else if (cp.name.includes('Patudo')) {
        ctx.fillStyle = '#F5EFE0';
        ctx.beginPath();
        ctx.arc(mx, my, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('El Patudo', mx, my + 9);
      }
    });

    // Balinera / Carrito de Rodillos del jugador en el mapa
    const px = toMapX(snapshot.vehicle.x);
    const py = toMapY(snapshot.vehicle.y);

    ctx.fillStyle = '#FFDD00';
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8B1A1A';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  private drawElevationProfile(snapshot: GameSnapshot): void {
    if (!this.track || this.elevationSamples.length < 2) return;
    const ctx = this.elevationCtx;
    const w = this.elevationCanvas.width;
    const h = this.elevationCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const padL = 26;
    const padR = 10;
    const padT = 16;
    const padB = 20;

    const graphW = w - padL - padR;
    const graphH = h - padT - padB;

    const minElev = 1100;
    const maxElev = 1950;
    const elevSpan = maxElev - minElev;

    const toX = (dist: number) => padL + (dist / this.totalElevationLength) * graphW;
    const toY = (elev: number) => padT + (1 - (elev - minElev) / elevSpan) * graphH;

    // 1. Líneas de referencia horizontales (1.900m, 1.500m, 1.200m)
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const gridLevels = [1900, 1500, 1200];
    for (const lvl of gridLevels) {
      const gy = toY(lvl);
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(w - padR, gy);
      ctx.strokeStyle = 'rgba(200, 169, 110, 0.20)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(200, 169, 110, 0.70)';
      ctx.fillText(`${lvl}m`, padL - 3, gy);
    }

    // 2. Silueta de montaña rellena con degradado institucional
    const samples = this.elevationSamples;
    const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
    grad.addColorStop(0, 'rgba(200, 169, 110, 0.40)');
    grad.addColorStop(0.5, 'rgba(46, 125, 50, 0.30)');
    grad.addColorStop(1, 'rgba(13, 28, 21, 0.85)');

    ctx.beginPath();
    ctx.moveTo(toX(samples[0].dist), toY(samples[0].elev));
    for (let i = 1; i < samples.length; i++) {
      ctx.lineTo(toX(samples[i].dist), toY(samples[i].elev));
    }
    ctx.lineTo(toX(samples[samples.length - 1].dist), h - padB);
    ctx.lineTo(toX(samples[0].dist), h - padB);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 3. Línea dorada de cresta
    ctx.beginPath();
    ctx.moveTo(toX(samples[0].dist), toY(samples[0].elev));
    for (let i = 1; i < samples.length; i++) {
      ctx.lineTo(toX(samples[i].dist), toY(samples[i].elev));
    }
    ctx.strokeStyle = '#C8A96E';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // 4. Hitos territoriales sobre la silueta
    ctx.font = 'bold 7.5px sans-serif';
    ctx.textAlign = 'center';

    const landmarks = [
      { name: 'Túnel', elev: 1907, pct: 0 },
      { name: 'Partidas', elev: 1540, pct: 0.24 },
      { name: 'La Sucia', elev: 1300, pct: 0.48 },
      { name: 'El Patudo', elev: 1763, pct: 0.72 },
      { name: 'Ebéjico', elev: 1141, pct: 1.0 },
    ];

    for (const lm of landmarks) {
      const lx = padL + lm.pct * graphW;
      const ly = toY(lm.elev);

      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#E0D6C3';
      if (lm.pct === 0) {
        ctx.textAlign = 'left';
        ctx.fillText(lm.name, lx + 5, ly - 6);
      } else if (lm.pct === 1.0) {
        ctx.textAlign = 'right';
        ctx.fillText(lm.name, lx - 4, ly + 9);
      } else {
        ctx.textAlign = 'center';
        const labelY = lm.name === 'La Sucia' ? ly + 9 : ly - 8;
        ctx.fillText(lm.name, lx, labelY);
      }
    }

    // 5. Posición actual del jugador (balinera) en el perfil
    const playerProgress = Math.max(0, Math.min(1, snapshot.progressPercent / 100));
    const px = padL + playerProgress * graphW;
    const currentElev = snapshot.vehicle.elevationMeters || 1907;
    const py = toY(currentElev);

    // Guía vertical
    ctx.beginPath();
    ctx.moveTo(px, padT);
    ctx.lineTo(px, h - padB);
    ctx.strokeStyle = 'rgba(255, 221, 0, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Blip de vehículo
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFDD00';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Badge flotante de altitud actual
    ctx.fillStyle = 'rgba(13, 28, 21, 0.92)';
    ctx.strokeStyle = '#FFDD00';
    ctx.lineWidth = 1;
    const badgeW = 46;
    const badgeH = 14;
    const badgeX = Math.max(padL, Math.min(w - padR - badgeW, px - badgeW / 2));
    const badgeY = Math.max(padT - 12, py - 20);
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

    ctx.fillStyle = '#FFDD00';
    ctx.font = 'bold 8.5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(currentElev)}m`, badgeX + badgeW / 2, badgeY + badgeH / 2);
  }
}
