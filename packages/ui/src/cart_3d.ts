/**
 * Renderizador 3D en Canvas 2D de un auténtico Carro de Rodillos tradicional de Ebéjico:
 * - Chasis de tablón macizo de madera de cedro con veta y biseles.
 * - Eje delantero pivotante con timón de lazo de fique y nudos campesinos.
 * - 4 balineras industriales de acero pulido (pistas concéntricas, bolas y brillo metálico).
 * - Palanca lateral de freno de zapata con caucho de llanta.
 * - Sombra de suelo interactiva y rotación suave 360° en perspectiva isométrica.
 */

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
}

interface Polygon3D {
  pts: Point3D[];
  color: string;
  stroke?: string;
  lineWidth?: number;
}

export class Cart3DRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animId: number = 0;
  private running: boolean = false;
  private angle: number = -0.5;
  private pitch: number = 0.38; // ~22 grados de inclinación cenital
  private lastTime: number = 0;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartAngle: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D context for Cart3D');
    this.ctx = ctx;
    this.setupInteractivity();
  }

  private setupInteractivity(): void {
    const onStart = (clientX: number) => {
      this.isDragging = true;
      this.dragStartX = clientX;
      this.dragStartAngle = this.angle;
    };
    const onMove = (clientX: number) => {
      if (!this.isDragging) return;
      const dx = clientX - this.dragStartX;
      this.angle = this.dragStartAngle + dx * 0.015;
    };
    const onEnd = () => {
      this.isDragging = false;
    };

    this.canvas.addEventListener('mousedown', (e) => onStart(e.clientX));
    window.addEventListener('mousemove', (e) => onMove(e.clientX));
    window.addEventListener('mouseup', onEnd);

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) onStart(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) onMove(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchend', onEnd);
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = (time: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (time - this.lastTime) / 1000);
      this.lastTime = time;
      if (!this.isDragging) {
        this.angle += dt * 0.75; // Rotación lenta y contemplativa
      }
      this.render();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  public stop(): void {
    this.running = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = 0;
    }
  }

  private project(p: Point3D, cx: number, cy: number, scale: number): ProjectedPoint {
    // Rotación Yaw (alrededor de Y)
    const cosY = Math.cos(this.angle);
    const sinY = Math.sin(this.angle);
    const x1 = p.x * cosY - p.z * sinY;
    const y1 = p.y;
    const z1 = p.x * sinY + p.z * cosY;

    // Rotación Pitch (alrededor de X)
    const cosX = Math.cos(this.pitch);
    const sinX = Math.sin(this.pitch);
    const y2 = y1 * cosX - z1 * sinX;
    const z2 = y1 * sinX + z1 * cosX;

    // Perspectiva débil (tipo teleobjetivo para dibujo técnico artesanal)
    const fov = 480;
    const pScale = fov / (fov + z2);

    return {
      x: cx + x1 * scale * pScale,
      y: cy + y2 * scale * pScale,
      depth: z2,
    };
  }

  public render(): void {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2 + 10;
    const scale = Math.min(W, H) / 220;

    // ── Sombra proyectada en el suelo ──
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + 38 * scale, 64 * scale, 24 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.filter = 'blur(6px)';
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();

    // Modelo paramétrico del Carro de Rodillos (coordenadas locales en cm)
    // X = lateral, Y = vertical (hacia arriba negativo), Z = longitudinal (frente = +Z)
    const polys: Array<{ pts: ProjectedPoint[]; color: string; stroke?: string; avgZ: number; isLine?: boolean; lw?: number }> = [];

    const addBox = (x: number, y: number, z: number, w: number, h: number, d: number, colorTop: string, colorSide: string, colorFront: string) => {
      const x0 = x - w / 2;
      const x1 = x + w / 2;
      const y0 = y - h / 2;
      const y1 = y + h / 2;
      const z0 = z - d / 2;
      const z1 = z + d / 2;

      const p000 = this.project({ x: x0, y: y0, z: z0 }, cx, cy, scale);
      const p100 = this.project({ x: x1, y: y0, z: z0 }, cx, cy, scale);
      const p110 = this.project({ x: x1, y: y1, z: z0 }, cx, cy, scale);
      const p010 = this.project({ x: x0, y: y1, z: z0 }, cx, cy, scale);
      const p001 = this.project({ x: x0, y: y0, z: z1 }, cx, cy, scale);
      const p101 = this.project({ x: x1, y: y0, z: z1 }, cx, cy, scale);
      const p111 = this.project({ x: x1, y: y1, z: z1 }, cx, cy, scale);
      const p011 = this.project({ x: x0, y: y1, z: z1 }, cx, cy, scale);

      // Top (Y-)
      polys.push({
        pts: [p000, p100, p101, p001],
        color: colorTop,
        stroke: 'rgba(0,0,0,0.18)',
        avgZ: (p000.depth + p100.depth + p101.depth + p001.depth) / 4,
      });
      // Bottom (Y+)
      polys.push({
        pts: [p010, p110, p111, p011],
        color: '#3d2514',
        avgZ: (p010.depth + p110.depth + p111.depth + p011.depth) / 4,
      });
      // Front (Z+)
      polys.push({
        pts: [p001, p101, p111, p011],
        color: colorFront,
        stroke: 'rgba(0,0,0,0.15)',
        avgZ: (p001.depth + p101.depth + p111.depth + p011.depth) / 4,
      });
      // Back (Z-)
      polys.push({
        pts: [p000, p100, p110, p010],
        color: '#4a2c16',
        stroke: 'rgba(0,0,0,0.15)',
        avgZ: (p000.depth + p100.depth + p110.depth + p010.depth) / 4,
      });
      // Left (X-)
      polys.push({
        pts: [p000, p001, p011, p010],
        color: colorSide,
        stroke: 'rgba(0,0,0,0.15)',
        avgZ: (p000.depth + p001.depth + p011.depth + p010.depth) / 4,
      });
      // Right (X+)
      polys.push({
        pts: [p100, p101, p111, p110],
        color: colorSide,
        stroke: 'rgba(0,0,0,0.15)',
        avgZ: (p100.depth + p101.depth + p111.depth + p110.depth) / 4,
      });
    };

    // 1. Chasis principal de cedro (tablón)
    addBox(0, -2, 0, 32, 4.5, 78, '#ab6838', '#784420', '#94542a');

    // 2. Travesaño trasero (soporte del eje posterior)
    addBox(0, 3, -26, 46, 5, 8, '#8c4e24', '#663615', '#78431e');

    // 3. Eje delantero pivotante (timón de dirección)
    const steerAngle = Math.sin(this.angle * 2) * 0.12; // sutil oscilación del timón
    const cosS = Math.cos(steerAngle);
    const sinS = Math.sin(steerAngle);
    const frontAxleZ = 28;
    const axleW = 46;
    const axP0 = this.project({ x: -axleW / 2 * cosS, y: 3, z: frontAxleZ - axleW / 2 * sinS }, cx, cy, scale);
    const axP1 = this.project({ x: axleW / 2 * cosS, y: 3, z: frontAxleZ + axleW / 2 * sinS }, cx, cy, scale);
    polys.push({
      pts: [axP0, axP1],
      color: '#8c4e24',
      stroke: '#78431e',
      avgZ: (axP0.depth + axP1.depth) / 2,
      isLine: true,
      lw: 5 * scale,
    });

    // 4. Asiento de madera / cajón trasero
    addBox(0, -9, -20, 26, 9, 20, '#b87542', '#824c25', '#9e5e30');
    // Espaldar
    addBox(0, -18, -28, 26, 12, 3.5, '#ab6838', '#784420', '#94542a');

    // 5. Palanca de freno de zapata (lado derecho)
    const brakeLeverP0 = this.project({ x: 18, y: -2, z: -8 }, cx, cy, scale);
    const brakeLeverP1 = this.project({ x: 22, y: -22, z: -16 }, cx, cy, scale);
    polys.push({
      pts: [brakeLeverP0, brakeLeverP1],
      color: '#6e3d1c',
      stroke: '#4a250d',
      avgZ: (brakeLeverP0.depth + brakeLeverP1.depth) / 2,
      isLine: true,
      lw: 3.5 * scale,
    });
    // Zapata de caucho
    addBox(18, 5, -8, 5, 4, 8, '#242424', '#151515', '#1a1a1a');

    // 6. Lazos de fique (timón delantero)
    const ropeDriverP = this.project({ x: 0, y: -12, z: 0 }, cx, cy, scale);
    const ropeLeftP = this.project({ x: -axleW / 2 * cosS + 3, y: 1, z: frontAxleZ - axleW / 2 * sinS }, cx, cy, scale);
    const ropeRightP = this.project({ x: axleW / 2 * cosS - 3, y: 1, z: frontAxleZ + axleW / 2 * sinS }, cx, cy, scale);
    polys.push({
      pts: [ropeDriverP, ropeLeftP],
      color: '#d4b279',
      stroke: '#d4b279',
      avgZ: (ropeDriverP.depth + ropeLeftP.depth) / 2,
      isLine: true,
      lw: 2.2 * scale,
    });
    polys.push({
      pts: [ropeDriverP, ropeRightP],
      color: '#d4b279',
      stroke: '#d4b279',
      avgZ: (ropeDriverP.depth + ropeRightP.depth) / 2,
      isLine: true,
      lw: 2.2 * scale,
    });

    // 7. Las 4 balineras industriales de acero
    const addBearing = (bx: number, by: number, bz: number) => {
      const radius = 8.5;
      const thickness = 4;
      const segments = 12;

      // Anillo exterior de acero
      const rimPts: ProjectedPoint[] = [];
      for (let s = 0; s < segments; s++) {
        const rad = (s / segments) * Math.PI * 2;
        const ly = Math.sin(rad) * radius;
        const lz = Math.cos(rad) * radius;
        rimPts.push(this.project({ x: bx, y: by + ly, z: bz + lz }, cx, cy, scale));
      }
      const avgZ = rimPts.reduce((acc, p) => acc + p.depth, 0) / rimPts.length;

      polys.push({
        pts: rimPts,
        color: '#d8dee3',
        stroke: '#828c94',
        avgZ,
      });

      // Pista interior oscura y centro metálico
      const innerPts: ProjectedPoint[] = [];
      for (let s = 0; s < segments; s++) {
        const rad = (s / segments) * Math.PI * 2;
        const ly = Math.sin(rad) * (radius * 0.58);
        const lz = Math.cos(rad) * (radius * 0.58);
        innerPts.push(this.project({ x: bx + (bx > 0 ? 0.3 : -0.3), y: by + ly, z: bz + lz }, cx, cy, scale));
      }
      polys.push({
        pts: innerPts,
        color: '#282d32',
        stroke: '#1e2225',
        avgZ: avgZ + 0.1,
      });

      // Eje central / tuerca
      const hubPts: ProjectedPoint[] = [];
      for (let s = 0; s < 8; s++) {
        const rad = (s / 8) * Math.PI * 2;
        const ly = Math.sin(rad) * (radius * 0.28);
        const lz = Math.cos(rad) * (radius * 0.28);
        hubPts.push(this.project({ x: bx + (bx > 0 ? 0.6 : -0.6), y: by + ly, z: bz + lz }, cx, cy, scale));
      }
      polys.push({
        pts: hubPts,
        color: '#f0f3f6',
        stroke: '#a0aab2',
        avgZ: avgZ + 0.2,
      });
    };

    // Balineras delanteras (siguen giro del timón)
    addBearing(-axleW / 2 * cosS - 3, 5, frontAxleZ - axleW / 2 * sinS);
    addBearing(axleW / 2 * cosS + 3, 5, frontAxleZ + axleW / 2 * sinS);

    // Balineras traseras fijas
    addBearing(-25, 5, -26);
    addBearing(25, 5, -26);

    // ── Ordenar polígonos por profundidad (Painter's Algorithm) ──
    polys.sort((a, b) => b.avgZ - a.avgZ);

    for (const poly of polys) {
      if (poly.isLine) {
        ctx.beginPath();
        ctx.moveTo(poly.pts[0].x, poly.pts[0].y);
        ctx.lineTo(poly.pts[1].x, poly.pts[1].y);
        ctx.strokeStyle = poly.stroke || poly.color;
        ctx.lineWidth = poly.lw || 2;
        ctx.lineCap = 'round';
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(poly.pts[0].x, poly.pts[0].y);
        for (let i = 1; i < poly.pts.length; i++) {
          ctx.lineTo(poly.pts[i].x, poly.pts[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = poly.color;
        ctx.fill();
        if (poly.stroke) {
          ctx.strokeStyle = poly.stroke;
          ctx.lineWidth = 0.8 * scale;
          ctx.stroke();
        }
      }
    }
  }
}
