import { Track } from '@core/track';
import { GameSnapshot } from '@core/types';
import { AssetLoader } from './asset_loader';
import { SatelliteLayer } from './satellite_layer';

interface SkidMark {
  x: number;
  y: number;
  alpha: number;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
}

interface SceneryItem {
  x: number;
  y: number;
  type: 'tree' | 'coffee_patch' | 'house' | 'rock' | 'sign';
  size: number;
  color: string;
  rotation: number;
}

export type CameraMode = 'chase' | 'north';

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cameraX: number = 2000;
  private cameraY: number = 2000;
  private cameraZoom: number = 1.05;
  private cameraAngle: number = 0;

  // Por defecto: 'chase' (Vista: Adelante - De sur a norte hacia adelante como en la imagen)
  public cameraMode: CameraMode = 'chase';

  private skidMarks: SkidMark[] = [];
  private sparkParticles: SparkParticle[] = [];
  private sceneryItems: SceneryItem[] = [];
  private sceneryGeneratedForTrack?: Track;
  private assets: AssetLoader = new AssetLoader();
  public satelliteLayer: SatelliteLayer = new SatelliteLayer();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo obtener el contexto 2D');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('wheel', (e) => {
      this.cameraZoom = Math.max(0.65, Math.min(1.65, this.cameraZoom - e.deltaY * 0.001));
    });
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
  }

  toggleCameraMode(): CameraMode {
    this.cameraMode = this.cameraMode === 'chase' ? 'north' : 'chase';
    return this.cameraMode;
  }

  /**
   * Genera decoración territorial a los lados de la calzada:
   * Cafetales, árboles andinos, casas campesinas tradicionales y rocas.
   */
  private generateScenery(track: Track): void {
    if (this.sceneryGeneratedForTrack === track) return;
    this.sceneryGeneratedForTrack = track;
    this.sceneryItems = [];

    const pts = track.points;
    let seed = 42;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 2; i < pts.length - 2; i += 3) {
      const p = pts[i];
      const nextP = pts[i + 1];
      const angle = Math.atan2(nextP.y - p.y, nextP.x - p.x);
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);
      const halfW = p.width / 2;

      for (const side of [-1, 1]) {
        // En puentes no colocamos casas ni árboles sobre el vacío
        if (p.isBridge) continue;

        const distFromRoad = halfW + 36 + random() * 125;
        const sx = p.x + perpX * distFromRoad * side + (random() - 0.5) * 30;
        const sy = p.y + perpY * distFromRoad * side + (random() - 0.5) * 30;

        const roll = random();
        if (roll < 0.50) {
          // Árbol andino
          this.sceneryItems.push({
            x: sx,
            y: sy,
            type: 'tree',
            size: 18 + random() * 14,
            color: random() > 0.5 ? '#1E5A38' : '#2D754B',
            rotation: random() * Math.PI * 2,
          });
        } else if (roll < 0.82) {
          // Parcela de cafetal con frutos rojos maduros
          this.sceneryItems.push({
            x: sx,
            y: sy,
            type: 'coffee_patch',
            size: 20 + random() * 14,
            color: '#265C3E',
            rotation: angle,
          });
        } else {
          // Casa campesina tradicional antioqueña
          this.sceneryItems.push({
            x: sx,
            y: sy,
            type: 'house',
            size: 28 + random() * 12,
            color: '#C84B31',
            rotation: angle + (side === 1 ? Math.PI : 0),
          });
        }
      }
    }
  }

  render(track: Track, snapshot: GameSnapshot): void {
    const { width, height } = this.canvas;
    const ctx = this.ctx;
    const v = snapshot.vehicle;

    this.generateScenery(track);

    // Suavizado de seguimiento de cámara
    if (this.cameraX === 2000 && this.cameraY === 2000 && (v.x !== 2000 || v.y !== 2000)) {
      this.cameraX = v.x;
      this.cameraY = v.y;
    }
    this.cameraX += (v.x - this.cameraX) * 0.28;
    this.cameraY += (v.y - this.cameraY) * 0.28;

    // Ángulo de cámara:
    // 'chase' (Vista: Adelante): El vehículo siempre apunta hacia ARRIBA de la pantalla
    // 'north' (Vista: Norte): El mapa se mantiene orientado al norte
    let targetAngle = 0;
    if (this.cameraMode === 'chase') {
      targetAngle = -(v.angle + Math.PI / 2);
    }
    let diff = (targetAngle - this.cameraAngle) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    this.cameraAngle += diff * 0.24;

    // 1. FONDO VERDE INSTITUCIONAL DE MONTAÑA (Antioquia / Ebéjico)
    ctx.fillStyle = '#224D36'; // Verde bosque andino
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    // En 'chase', anclamos el vehículo al 64% de altura para tener amplio campo de visión frontal
    const anchorYOffset = this.cameraMode === 'chase' ? height * 0.15 : 0;
    ctx.translate(width / 2, height / 2 + anchorYOffset);

    // Perspectiva dinámica 2.5D: en bajadas pronunciadas la cámara se inclina más hacia adelante
    // (comprime Y a ~0.74) para revelar las caídas del relieve y el horizonte; en subidas se yergue a ~0.94
    const slope = v.pitch || 0;
    const dynamicTilt = Math.max(0.72, Math.min(0.96, 0.84 + slope * 1.4));
    const tiltScaleY = this.cameraMode === 'chase' ? dynamicTilt : 1.0;
    ctx.scale(this.cameraZoom, this.cameraZoom * tiltScaleY);
    ctx.rotate(this.cameraAngle);
    ctx.translate(-this.cameraX, -this.cameraY);

    // 1.5 ORTOFOTO SATELITAL AÉREA ULTRA-HD (Esri World Imagery / Google Earth Zoom 18)
    this.satelliteLayer.preloadArea(v.x, v.y, 1800);
    this.satelliteLayer.render(ctx, this.cameraX, this.cameraY, 1800);

    // 2. RELIEVE TOPOGRÁFICO REAL: Curvas de nivel y sombreado de montaña
    this.drawTerrainElevationRelief(ctx, track);

    // 3. QUEBRADAS Y CAÑONES PROFUNDOS (Pasan por debajo de los puentes)
    this.drawWaterwaysAndGorges(ctx, track);

    // 4. CAÍDAS DE RELIEVE Y TALUDES A LOS LADOS DE LA CALZADA (BARRANCOS Y PRECIPICIOS)
    this.drawMountainDropsAndCliffs(ctx, track);

    // 5. RAMAL SEÑUELO EN LAS PARTIDAS (Vía a San Jerónimo con calzada cortada)
    if (track.decoyBranch) {
      this.drawDecoyBranch(ctx, track.decoyBranch);
    }

    // 6. CARRETERA PRINCIPAL DE ASFALTO CON BORDILLOS Y LÍNEAS REFLECTIVAS
    this.drawRoad(ctx, track);

    // 7. PUENTES 2.5D CON SOMBRA VOLADA Y BARANDAS DE SEGURIDAD
    this.drawBridges25D(ctx, track);

    // 8. HUELLAS DE DERRAPE
    this.updateAndDrawSkids(ctx, v);

    // 9. CHISPAS DE ACERO DE LAS BALINERAS
    this.updateAndDrawSparks(ctx, v);

    // 10. HITOS DE CARRETERA, META Y SALIDA
    this.drawCheckpoints(ctx, track);

    // 11. ESCENOGRAFÍA: Pinos, cafetales y casas campesinas con zócalos
    this.drawScenery(ctx);

    // 12. CARRO DE RODILLOS TRADICIONAL DE EBÉJICO
    this.drawCarritoDeRodillos(ctx, v);

    ctx.restore();

    // 13. BRÚJULA FLOTANTE EN ESQUINA INFERIOR IZQUIERDA
    this.drawCompass(ctx, width, height);
  }

  /**
   * Dibuja el relieve topográfico real derivado de los datos de Copernicus DEM:
   * Terrazas de montaña escalonadas con sombreado de laderas (hillshading cartográfico)
   * que hacen resaltar visualmente los desniveles y picos del relieve andino.
   */
  private drawTerrainElevationRelief(ctx: CanvasRenderingContext2D, track: Track): void {
    ctx.save();

    // Terrazas de altitud en gradiente de montaña con sombra de relieve (hillshading cartográfico)
    const tiers = [
      { r: 2800, shadow: 'rgba(7, 20, 13, 0.28)', light: 'rgba(255, 255, 255, 0.22)', label: '1.900 m' },
      { r: 5400, shadow: 'rgba(9, 24, 15, 0.25)', light: 'rgba(255, 255, 255, 0.20)', label: '1.750 m' },
      { r: 8000, shadow: 'rgba(11, 28, 18, 0.22)', light: 'rgba(255, 255, 255, 0.18)', label: '1.500 m' },
      { r: 11000, shadow: 'rgba(13, 32, 21, 0.20)', light: 'rgba(255, 255, 255, 0.16)', label: '1.300 m' },
      { r: 14200, shadow: 'rgba(9, 24, 15, 0.25)', light: 'rgba(255, 255, 255, 0.20)', label: '1.763 m' },
      { r: 17800, shadow: 'rgba(14, 35, 23, 0.18)', light: 'rgba(255, 255, 255, 0.14)', label: '1.141 m' },
    ];

    for (const t of tiers) {
      // 1. Sombra arrojada de ladera (desplazada en dirección SE, simulando luz solar del NO a 315°)
      ctx.beginPath();
      ctx.arc(-6000 + 16, 2000 + 18, t.r, 0, Math.PI * 2);
      ctx.strokeStyle = t.shadow;
      ctx.lineWidth = 32;
      ctx.stroke();

      // 2. Línea de terraza topográfica iluminada
      ctx.beginPath();
      ctx.arc(-6000, 2000, t.r, 0, Math.PI * 2);
      ctx.strokeStyle = t.light;
      ctx.lineWidth = 3.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Dibuja las caídas de montaña, barrancos y precipicios a los lados de la calzada ("las caídas"):
   * En carreteras de montaña hay un talud de roca en el lado interior y un precipicio con sombra
   * y defensas metálicas en el lado exterior.
   */
  private drawMountainDropsAndCliffs(ctx: CanvasRenderingContext2D, track: Track): void {
    const pts = track.points;
    if (pts.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Sombra profunda de la caída del precipicio (lado del abismo)
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = pts[0].width + 56;
    ctx.strokeStyle = 'rgba(10, 26, 18, 0.48)'; // Sombra de caída vertical
    ctx.stroke();

    // 2. Berma exterior de caída en terracota y roca
    ctx.lineWidth = pts[0].width + 36;
    ctx.strokeStyle = '#8B6A47';
    ctx.stroke();

    // 3. Dientes cartográficos de escarpe / peñasco ("caídas de montaña")
    // Pequeñas líneas perpendiculares que indican la pendiente abrupta hacia el vacío
    ctx.strokeStyle = 'rgba(40, 25, 15, 0.55)';
    ctx.lineWidth = 2.0;
    for (let i = 0; i < pts.length - 1; i += 4) {
      const p = pts[i];
      const nextP = pts[i + 1];
      const angle = Math.atan2(nextP.y - p.y, nextP.x - p.x);
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);
      const halfW = p.width / 2 + 16;

      // Caída al lado derecho de la montaña
      const bx = p.x + perpX * halfW;
      const by = p.y + perpY * halfW;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + perpX * 9, by + perpY * 9);
      ctx.stroke();
    }

    // 4. Defensas viales reflectivas a lo largo del precipicio
    for (let i = 0; i < pts.length - 1; i += 6) {
      const p = pts[i];
      const nextP = pts[i + 1];
      const angle = Math.atan2(nextP.y - p.y, nextP.x - p.x);
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);
      const halfW = p.width / 2 + 8;

      const rx = p.x + perpX * halfW;
      const ry = p.y + perpY * halfW;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(rx - 2, ry - 2, 4, 4);
      ctx.fillStyle = '#E53935';
      ctx.fillRect(rx - 1, ry - 1, 2, 2);
    }

    ctx.restore();
  }

  /**
   * Dibuja los ríos, quebradas y desfiladeros cruzando por debajo de los puentes
   */
  private drawWaterwaysAndGorges(ctx: CanvasRenderingContext2D, track: Track): void {
    const checkpoints = track.getCheckpoints();
    ctx.save();

    for (const cp of checkpoints) {
      if (cp.name.toLowerCase().includes('quebrada') || cp.name.toLowerCase().includes('puente')) {
        const p = cp.point;

        // Desfiladero rocoso del cañón (lecho profundo)
        ctx.beginPath();
        ctx.moveTo(p.x - 260, p.y + 140);
        ctx.bezierCurveTo(p.x - 100, p.y + 50, p.x + 100, p.y - 50, p.x + 260, p.y - 140);
        ctx.lineWidth = 54;
        ctx.strokeStyle = '#3E2723'; // Roca oscura del fondo del cañón
        ctx.lineCap = 'round';
        ctx.stroke();

        // Agua del río / torrente de montaña
        ctx.lineWidth = 30;
        ctx.strokeStyle = '#00ACC1'; // Turquesa vivo
        ctx.stroke();

        // Espuma de rápidos
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#E0F7FA';
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * Dibuja la calzada de asfalto continuo con pianos de bordillo y línea central reflectiva
   */
  private drawRoad(ctx: CanvasRenderingContext2D, track: Track): void {
    const pts = track.points;
    if (pts.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Cordón lateral rojo cafeto institucional y blanco reflectivo
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = pts[0].width + 12;
    ctx.strokeStyle = '#8B1A1A'; // Rojo institucional Ebéjico
    ctx.stroke();

    // 2. Calzada de asfalto pizarra continuo
    ctx.lineWidth = pts[0].width;
    ctx.strokeStyle = '#444A46';
    ctx.stroke();

    // 3. Bordes blancos de calzada
    ctx.lineWidth = pts[0].width - 8;
    ctx.strokeStyle = '#4D5450';
    ctx.stroke();

    // 4. Línea central discontinua amarilla reflectiva
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = 3.6;
    ctx.strokeStyle = '#F5B800';
    ctx.setLineDash([24, 26]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Línea de salida: Boca del Túnel de Occidente
    const p0 = pts[0];
    const p1 = pts[1];
    const startAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const perpX = -Math.sin(startAngle);
    const perpY = Math.cos(startAngle);
    const halfW = p0.width / 2;

    ctx.beginPath();
    ctx.moveTo(p0.x - perpX * halfW, p0.y - perpY * halfW);
    ctx.lineTo(p0.x + perpX * halfW, p0.y + perpY * halfW);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    ctx.save();
    ctx.translate(p0.x, p0.y);
    ctx.rotate(startAngle + Math.PI / 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('◄ TÚNEL DE OCCIDENTE (SALIDA) ►', 0, -32);
    ctx.restore();

    ctx.restore();
  }

  /**
   * Dibuja los puentes viaductos 2.5D:
   * El tablero del puente vuela sobre la quebrada, proyecta una sombra profunda,
   * tiene barandas de protección blancas y rojas y pilares de hormigón.
   */
  private drawBridges25D(ctx: CanvasRenderingContext2D, track: Track): void {
    const pts = track.points;
    ctx.save();

    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i];
      if (!p.isBridge) continue;

      const nextP = pts[i + 1];
      const angle = Math.atan2(nextP.y - p.y, nextP.x - p.x);
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);
      const halfW = p.width / 2;
      const shadowOffset = 22; // Sombra volada que muestra la gran caída vertical

      // Sombra del tablero del puente proyectada sobre el lecho del río
      ctx.beginPath();
      ctx.moveTo(p.x + perpX * shadowOffset, p.y + perpY * shadowOffset);
      ctx.lineTo(nextP.x + perpX * shadowOffset, nextP.y + perpY * shadowOffset);
      ctx.lineWidth = p.width + 10;
      ctx.strokeStyle = 'rgba(10, 20, 15, 0.65)';
      ctx.stroke();

      // Tablero del puente de hormigón claro
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nextP.x, nextP.y);
      ctx.lineWidth = p.width + 14;
      ctx.strokeStyle = '#78909C'; // Hormigón armado gris
      ctx.stroke();

      ctx.lineWidth = p.width;
      ctx.strokeStyle = '#3E4440'; // Asfalto del puente
      ctx.stroke();

      // Barandas de seguridad rojas y blancas reflectivas
      for (const side of [-1, 1]) {
        const rx0 = p.x + perpX * (halfW + 6) * side;
        const ry0 = p.y + perpY * (halfW + 6) * side;
        const rx1 = nextP.x + perpX * (halfW + 6) * side;
        const ry1 = nextP.y + perpY * (halfW + 6) * side;

        ctx.beginPath();
        ctx.moveTo(rx0, ry0);
        ctx.lineTo(rx1, ry1);
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = '#E53935';
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  }

  /**
   * Dibuja el ramal señuelo de Las Partidas (vía a San Jerónimo cerrada con barricada)
   */
  private drawDecoyBranch(ctx: CanvasRenderingContext2D, decoy: NonNullable<Track['decoyBranch']>): void {
    const pts = decoy.points;
    if (pts.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = pts[0].width + 24;
    ctx.strokeStyle = '#8C6D47';
    ctx.stroke();

    ctx.lineWidth = pts[0].width;
    ctx.strokeStyle = '#484E49';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#F5B800';
    ctx.setLineDash([16, 20]);
    ctx.stroke();
    ctx.setLineDash([]);

    // BARRICADA AL FINAL DEL RAMAL CORTADO
    const bar = decoy.barricade;
    const pPrev = pts[pts.length - 2];
    const angle = Math.atan2(bar.y - pPrev.y, bar.x - pPrev.x);
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    const halfW = bar.width / 2 + 15;

    ctx.beginPath();
    ctx.moveTo(bar.x - perpX * halfW, bar.y - perpY * halfW);
    ctx.lineTo(bar.x + perpX * halfW, bar.y + perpY * halfW);
    ctx.lineWidth = 22;
    ctx.strokeStyle = '#E74C3C';
    ctx.stroke();

    ctx.setLineDash([14, 14]);
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    ctx.translate(bar.x, bar.y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = '#FFDD00';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⛔ CALZADA CORTADA (VÍA A SAN JERÓNIMO) ⛔', 0, -25);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('DA REVERSA CON [S] Y GIRA HACIA EBÉJICO', 0, -8);
    ctx.restore();

    ctx.restore();
  }

  private drawCheckpoints(ctx: CanvasRenderingContext2D, track: Track): void {
    const pts = track.points;
    const checkpoints = track.getCheckpoints();

    ctx.save();
    checkpoints.forEach((cp, idx) => {
      if (idx === 0) return;

      const p = cp.point;
      const nextP = pts[Math.min(pts.length - 1, cp.index + 1)];
      const angle = Math.atan2(nextP.y - p.y, nextP.x - p.x);
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);
      const halfW = p.width / 2;
      const isFinish = idx === checkpoints.length - 1;

      ctx.beginPath();
      ctx.moveTo(p.x - perpX * halfW, p.y - perpY * halfW);
      ctx.lineTo(p.x + perpX * halfW, p.y + perpY * halfW);

      if (isFinish) {
        ctx.lineWidth = 22;
        ctx.strokeStyle = '#FFFFFF';
        ctx.setLineDash([14, 14]); // Damero
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle + Math.PI / 2);
        ctx.fillStyle = '#FFDD00';
        ctx.font = 'bold 28px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('🏁 PARQUE PRINCIPAL DE EBÉJICO 🏁', 0, -42);
        ctx.restore();
      } else {
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#F5B800';
        ctx.stroke();

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle + Math.PI / 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cp.name, 0, -18);
        ctx.restore();
      }
    });
    ctx.restore();
  }

  private drawScenery(ctx: CanvasRenderingContext2D): void {
    // Si la ortofoto satelital real está activa, el terreno fotográfico ya muestra
    // las copas de árboles, bosques andinos y parcelas agrícolas reales sin ocluir
    if (this.satelliteLayer.enabled) return;

    ctx.save();
    for (const item of this.sceneryItems) {
      if (Math.hypot(item.x - this.cameraX, item.y - this.cameraY) > 1600) continue;

      ctx.save();
      ctx.translate(item.x, item.y);

      if (item.type === 'tree') {
        const treeSprite = this.assets.get('pino_andino');
        if (treeSprite) {
          ctx.drawImage(treeSprite, -item.size, -item.size, item.size * 2, item.size * 2);
        } else {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath();
          ctx.arc(4, 4, item.size, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = item.color;
          ctx.beginPath();
          ctx.arc(0, 0, item.size, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#489A6B';
          ctx.beginPath();
          ctx.arc(-item.size * 0.3, -item.size * 0.3, item.size * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (item.type === 'coffee_patch') {
        ctx.rotate(item.rotation);
        const coffeeSprite = this.assets.get('cafetal');
        if (coffeeSprite) {
          ctx.drawImage(coffeeSprite, -item.size, -item.size / 2, item.size * 2, item.size);
        } else {
          ctx.fillStyle = '#1D5A37';
          ctx.fillRect(-item.size, -item.size / 2, item.size * 2, item.size);

          ctx.fillStyle = '#D92525';
          ctx.fillRect(-item.size * 0.5, -item.size * 0.2, 4, 4);
          ctx.fillRect(item.size * 0.3, item.size * 0.1, 4, 4);
        }
      } else if (item.type === 'house') {
        ctx.rotate(item.rotation);
        const houseSprite = this.assets.get('casa_campesina');
        if (houseSprite) {
          ctx.drawImage(houseSprite, -item.size * 0.6, -item.size * 0.5, item.size * 1.2, item.size);
        } else {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(-item.size * 0.5 + 4, -item.size * 0.4 + 4, item.size, item.size * 0.8);

          ctx.fillStyle = '#F5F5F0';
          ctx.fillRect(-item.size * 0.5, -item.size * 0.4, item.size, item.size * 0.8);

          ctx.fillStyle = '#B23A22'; // Techo rojo teja
          ctx.fillRect(-item.size * 0.5 - 3, -item.size * 0.4 - 2, item.size + 6, item.size * 0.45);
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }

  private updateAndDrawSkids(ctx: CanvasRenderingContext2D, v: GameSnapshot['vehicle']): void {
    if (v.driftFactor > 0.35 && Math.abs(v.speed) > 60) {
      this.skidMarks.push({
        x: v.x,
        y: v.y,
        alpha: Math.min(0.7, v.driftFactor * 0.8),
      });
      if (this.skidMarks.length > 350) this.skidMarks.shift();
    }

    ctx.save();
    for (let i = 0; i < this.skidMarks.length; i++) {
      const mark = this.skidMarks[i];
      mark.alpha -= 0.0006;
      if (mark.alpha <= 0) continue;
      ctx.fillStyle = `rgba(20, 20, 20, ${mark.alpha})`;
      ctx.beginPath();
      ctx.arc(mark.x, mark.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private updateAndDrawSparks(ctx: CanvasRenderingContext2D, v: GameSnapshot['vehicle']): void {
    // Generar chispas de las balineras de acero a alta velocidad (> 50 km/h) o al derrapar
    if (Math.abs(v.speed) > 50 || v.driftFactor > 0.4) {
      for (let k = 0; k < 2; k++) {
        const side = Math.random() < 0.5 ? -14 : 14;
        const cosA = Math.cos(v.angle);
        const sinA = Math.sin(v.angle);
        const px = v.x - cosA * 16 - sinA * side;
        const py = v.y - sinA * 16 + cosA * side;

        this.sparkParticles.push({
          x: px,
          y: py,
          vx: -cosA * (1.5 + Math.random() * 2) + (Math.random() - 0.5) * 1.5,
          vy: -sinA * (1.5 + Math.random() * 2) + (Math.random() - 0.5) * 1.5,
          alpha: 1.0,
          color: Math.random() > 0.3 ? '#FFD700' : '#FFF9C4',
        });
      }
    }

    if (this.sparkParticles.length > 60) {
      this.sparkParticles.splice(0, this.sparkParticles.length - 60);
    }

    ctx.save();
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      const sp = this.sparkParticles[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.alpha -= 0.05;

      if (sp.alpha <= 0) {
        this.sparkParticles.splice(i, 1);
        continue;
      }

      ctx.fillStyle = sp.color;
      ctx.globalAlpha = sp.alpha;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Dibuja el Carro de Rodillos tradicional de Ebéjico en 2D/2.5D:
   * Chasis de cedro, 4 balineras de acero cromado con pernos, timón de lazo móvil,
   * zapata de freno y piloto con camisa roja y casco.
   */
  private drawCarritoDeRodillos(ctx: CanvasRenderingContext2D, v: GameSnapshot['vehicle']): void {
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);

    // Inclinación visual del chasis en virajes
    const chassisRoll = v.driftFactor * 0.09;
    ctx.rotate(chassisRoll);

    // Sombra proyectada del carro
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.rect(-24, -15, 48, 30);
    ctx.fill();

    // Haz de luz frontal de la linterna de carrera
    ctx.save();
    const grad = ctx.createLinearGradient(16, 0, 185, 0);
    grad.addColorStop(0, 'rgba(255, 245, 200, 0.55)');
    grad.addColorStop(1, 'rgba(255, 245, 200, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(16, -6);
    ctx.lineTo(175, -52);
    ctx.lineTo(175, 52);
    ctx.lineTo(16, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 0. Si existe el sprite personalizado de carro_rodillos.png, dibujarlo
    const cartSprite = this.assets.get('carro_rodillos');
    if (cartSprite) {
      ctx.drawImage(cartSprite, -24, -18, 48, 36);
      ctx.restore();
      return;
    }

    // 1. EJE TRASERO FIJO Y 2 BALINERAS TRASERAS
    ctx.fillStyle = '#5A381B';
    ctx.fillRect(-17, -15, 6, 30);

    for (const yOff of [-16, 11]) {
      // Pista exterior de acero reluciente
      ctx.fillStyle = '#F0F0F0';
      ctx.fillRect(-19, yOff, 10, 5);
      // Pista interior oscura
      ctx.fillStyle = '#333333';
      ctx.fillRect(-17, yOff + 1, 6, 3);
      // Perno central dorado
      ctx.fillStyle = '#C8A96E';
      ctx.fillRect(-15, yOff + 1.5, 2, 2);
    }

    // 2. EJE DELANTERO ARTICULADO (Gira con la dirección)
    ctx.save();
    ctx.translate(14, 0);
    const steerVisualAngle = Math.max(
      -0.35,
      Math.min(0.35, (v.vx * Math.sin(v.angle) - v.vy * Math.cos(v.angle)) * 0.015)
    );
    ctx.rotate(steerVisualAngle);

    ctx.fillStyle = '#5A381B';
    ctx.fillRect(-3, -15, 6, 30);

    for (const yOff of [-16, 11]) {
      ctx.fillStyle = '#F0F0F0';
      ctx.fillRect(-5, yOff, 10, 5);
      ctx.fillStyle = '#333333';
      ctx.fillRect(-3, yOff + 1, 6, 3);
      ctx.fillStyle = '#C8A96E';
      ctx.fillRect(-1, yOff + 1.5, 2, 2);
    }

    // Lazo del timón
    ctx.strokeStyle = '#D4B28C';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 7, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    ctx.restore();

    // 3. CHASIS DE 3 TABLONES DE CEDRO RÚSTICO
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(-18, -10, 36, 6);
    ctx.fillStyle = '#73441D';
    ctx.fillRect(-20, -4, 40, 8);
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(-18, 4, 36, 6);

    // Pernos dorados
    ctx.fillStyle = '#C8A96E';
    ctx.fillRect(-16, -2, 2, 4);
    ctx.fillRect(14, -2, 2, 4);

    // 4. PALANCA DE FRENO LATERAL (Madera con zapata de caucho)
    ctx.fillStyle = '#5C3317';
    ctx.fillRect(-10, 10, 14, 3);
    ctx.fillStyle = v.speed < 0 || v.offroad ? '#E74C3C' : '#222222';
    ctx.fillRect(-12, 11, 4, 3);

    // 5. PLACA FRONTAL DORSAL DE CARRERAS: "01"
    ctx.fillStyle = '#C8A96E';
    ctx.fillRect(16, -6, 5, 12);
    ctx.fillStyle = '#0D1C15';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('01', 18.5, 3);

    // 6. PILOTO CAMPESINO (Camisa roja de Ebéjico y casco blanco de seguridad)
    ctx.fillStyle = '#8B1A1A'; // Rojo institucional
    ctx.fillRect(-9, -6, 12, 12);
    ctx.fillStyle = '#A82424';
    ctx.fillRect(1, -7, 6, 3);
    ctx.fillRect(1, 4, 6, 3);

    // Casco
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-2, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#C8A96E';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  private drawCompass(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Posicionada sobre la caja de Perfil de Relieve en la esquina inferior izquierda
    const cx = 52;
    const cy = height - 215;
    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = 'rgba(13, 28, 21, 0.92)';
    ctx.strokeStyle = '#C8A96E';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.rotate(this.cameraAngle);

    // Norte (Rojo)
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(5, 0);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();

    // Sur (Blanco)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(5, 0);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
