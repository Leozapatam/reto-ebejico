export interface RollState {
  speedKmh: number;
  driftFactor: number;
  offroad: boolean;
  braking: boolean;
  active: boolean; // false en menús, pausa y meta: los bucles se apagan
}

/**
 * Sonido sintetizado con Web Audio (sin archivos): un carro de rodillos no tiene motor,
 * suena a balineras de acero rodando sobre asfalto, viento y zapata de caucho.
 */
export class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private isMuted: boolean = false;
  private noiseBuffer: AudioBuffer | null = null;

  // Bucles continuos
  private rollGain: GainNode | null = null;
  private rollFilter: BiquadFilterNode | null = null;
  private rumbleGain: GainNode | null = null;
  private whineOscA: OscillatorNode | null = null;
  private whineOscB: OscillatorNode | null = null;
  private whineGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private screechGain: GainNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;

  private init(): void {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = this.isMuted ? 0 : 0.9;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -14;
      limiter.ratio.value = 6;
      this.master.connect(limiter);
      limiter.connect(ctx.destination);

      // Ruido blanco compartido por todos los bucles
      const size = ctx.sampleRate * 2;
      this.noiseBuffer = ctx.createBuffer(1, size, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

      // 1. Rodadura de las balineras: ruido en banda media que sube de tono con la velocidad
      this.rollFilter = ctx.createBiquadFilter();
      this.rollFilter.type = 'bandpass';
      this.rollFilter.frequency.value = 420;
      this.rollFilter.Q.value = 0.9;
      this.rollGain = ctx.createGain();
      this.rollGain.gain.value = 0;
      this.loopNoise(this.rollFilter);
      this.rollFilter.connect(this.rollGain);
      this.rollGain.connect(this.master);

      // 2. Retumbe grave del tablón sobre el asfalto (más fuerte en la berma)
      const rumbleFilter = ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = 110;
      this.rumbleGain = ctx.createGain();
      this.rumbleGain.gain.value = 0;
      this.loopNoise(rumbleFilter);
      rumbleFilter.connect(this.rumbleGain);
      this.rumbleGain.connect(this.master);

      // 3. Zumbido metálico de los rodamientos: dos osciladores desafinados
      this.whineGain = ctx.createGain();
      this.whineGain.gain.value = 0;
      const whineFilter = ctx.createBiquadFilter();
      whineFilter.type = 'lowpass';
      whineFilter.frequency.value = 1800;
      this.whineOscA = ctx.createOscillator();
      this.whineOscA.type = 'triangle';
      this.whineOscB = ctx.createOscillator();
      this.whineOscB.type = 'sawtooth';
      this.whineOscA.connect(whineFilter);
      this.whineOscB.connect(whineFilter);
      whineFilter.connect(this.whineGain);
      this.whineGain.connect(this.master);
      this.whineOscA.start();
      this.whineOscB.start();

      // 4. Viento
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'highpass';
      windFilter.frequency.value = 1900;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      this.loopNoise(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.master);

      // 5. Chillido de acero al derrapar y de caucho al frenar
      this.screechFilter = ctx.createBiquadFilter();
      this.screechFilter.type = 'bandpass';
      this.screechFilter.frequency.value = 2300;
      this.screechFilter.Q.value = 5;
      this.screechGain = ctx.createGain();
      this.screechGain.gain.value = 0;
      this.loopNoise(this.screechFilter);
      this.screechFilter.connect(this.screechGain);
      this.screechGain.connect(this.master);
    } catch {
      this.ctx = null; // AudioContext no disponible o bloqueado
    }
  }

  private loopNoise(destination: AudioNode): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.loopStart = Math.random();
    src.connect(destination);
    src.start();
  }

  /** Debe llamarse desde un gesto del usuario (clic, tecla, toque). */
  ensureStarted(): void {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.03);
    }
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  /** Actualiza los bucles continuos según el estado del carro. */
  updateRoll(s: RollState): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const speed = s.active ? Math.min(1.25, s.speedKmh / 92) : 0;

    this.rollFilter?.frequency.setTargetAtTime(320 + speed * 1150, t, 0.08);
    this.rollGain?.gain.setTargetAtTime(speed > 0.02 ? 0.03 + speed * 0.13 : 0, t, 0.08);
    this.rumbleGain?.gain.setTargetAtTime(speed * (s.offroad ? 0.5 : 0.16), t, 0.1);

    const whineFreq = 140 + speed * 520;
    this.whineOscA?.frequency.setTargetAtTime(whineFreq, t, 0.06);
    this.whineOscB?.frequency.setTargetAtTime(whineFreq * 1.507, t, 0.06);
    this.whineGain?.gain.setTargetAtTime(speed > 0.05 ? 0.004 + speed * 0.016 : 0, t, 0.1);

    this.windGain?.gain.setTargetAtTime(speed * speed * 0.05, t, 0.15);

    const drift = s.active && s.speedKmh > 18 ? Math.max(0, s.driftFactor - 0.25) : 0;
    const brakeScrub = s.active && s.braking && s.speedKmh > 12 ? 0.35 : 0;
    this.screechFilter?.frequency.setTargetAtTime(brakeScrub > drift ? 900 : 2100 + drift * 900, t, 0.05);
    this.screechGain?.gain.setTargetAtTime(Math.min(0.11, Math.max(drift * 0.16, brakeScrub * 0.06)), t, 0.04);
  }

  private tone(freq: number, duration: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slideTo?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const start = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(opts.gain ?? 0.12, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private noiseBurst(duration: number, filterFreq: number, gainValue: number, type: BiquadFilterType = 'bandpass', q: number = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(ctx.currentTime, Math.random());
    src.stop(ctx.currentTime + duration + 0.02);
  }

  playCountdown(isGo: boolean = false): void {
    this.ensureStarted();
    if (isGo) {
      this.tone(880, 0.5, { type: 'triangle', gain: 0.16 });
      this.tone(1320, 0.5, { type: 'sine', gain: 0.07 });
    } else {
      this.tone(440, 0.16, { type: 'triangle', gain: 0.13 });
    }
  }

  playCheckpoint(): void {
    this.tone(659.25, 0.16, { type: 'triangle', gain: 0.1 });
    this.tone(987.77, 0.3, { type: 'triangle', gain: 0.1, delay: 0.09 });
  }

  /** Golpe contra la bionda: parciales inarmónicos de chapa + chasquido. */
  playRailHit(intensity: number): void {
    const g = 0.04 + intensity * 0.14;
    this.noiseBurst(0.09, 3200, g * 1.2, 'bandpass', 0.8);
    for (const [f, d] of [[212, 0.35], [547, 0.28], [1130, 0.2], [1765, 0.14]] as const) {
      this.tone(f * (0.96 + Math.random() * 0.08), d, { type: 'square', gain: g * 0.35 });
    }
  }

  playFall(): void {
    this.tone(620, 0.55, { type: 'sine', gain: 0.12, slideTo: 110 });
    this.noiseBurst(0.5, 500, 0.12, 'lowpass');
  }

  playPenalty(): void {
    this.tone(196, 0.22, { type: 'sawtooth', gain: 0.07 });
    this.tone(146.8, 0.3, { type: 'sawtooth', gain: 0.07, delay: 0.16 });
  }

  playBarricade(): void {
    this.noiseBurst(0.25, 180, 0.3, 'lowpass');
    this.tone(90, 0.25, { type: 'sine', gain: 0.2, slideTo: 50 });
  }

  playFinish(isRecord: boolean = false): void {
    this.ensureStarted();
    const notes = isRecord ? [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568] : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      this.tone(freq, 0.42, { type: 'triangle', gain: 0.12, delay: idx * 0.12 });
    });
  }
}
