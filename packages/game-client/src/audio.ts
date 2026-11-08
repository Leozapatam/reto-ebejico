export class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private screechGain: GainNode | null = null;
  private isInitialized: boolean = false;

  constructor() {
    // Inicialización bajo primera interacción de usuario
  }

  private init(): void {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Motor: oscilador en onda de sierra suave
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.04;

      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 280;

      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();

      // Derrape: nodo de ruido blanco
      this.initScreechNoise();

      this.isInitialized = true;
    } catch {
      // AudioContext no disponible o bloqueado por navegador
    }
  }

  private initScreechNoise(): void {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 3.0;

    this.screechGain = this.ctx.createGain();
    this.screechGain.gain.value = 0;

    noise.connect(filter);
    filter.connect(this.screechGain);
    this.screechGain.connect(this.ctx.destination);
    noise.start();
  }

  ensureStarted(): void {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.04, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  updateEngine(speedKmh: number, throttle: number, driftFactor: number): void {
    if (!this.ctx || this.isMuted) return;

    // Frecuencia del motor según velocidad y acelerador (60 Hz a 220 Hz)
    const baseFreq = 50 + (speedKmh / 140) * 140 + throttle * 25;
    if (this.engineOsc) {
      this.engineOsc.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.05);
    }

    // Volumen del chillido de llantas según derrape
    if (this.screechGain) {
      const screechVol = driftFactor > 0.35 && speedKmh > 25 ? (driftFactor - 0.35) * 0.12 : 0;
      this.screechGain.gain.setTargetAtTime(screechVol, this.ctx.currentTime, 0.04);
    }
  }

  playCountdown(isGo: boolean = false): void {
    this.ensureStarted();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = isGo ? 880 : 440; // La4 / La5

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (isGo ? 0.35 : 0.15));

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + (isGo ? 0.35 : 0.15));
  }

  playCheckpoint(): void {
    this.ensureStarted();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // Do5
    osc.frequency.exponentialRampToValueAtTime(783.99, this.ctx.currentTime + 0.12); // Sol5

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playFinish(): void {
    this.ensureStarted();
    if (!this.ctx || this.isMuted) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // Do - Mi - Sol - Do
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const startTime = this.ctx!.currentTime + idx * 0.12;

      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }
}
