import { CurveAhead, CurveSeverity, TrackPoint, Vector2D } from './types';
import realTrackData from '../../track-data/real_route_track.json';

/** Escala del mundo: unidades de juego (px) por metro real. Coincide con `meters_to_px` del manifiesto satelital. */
export const PX_PER_METER = 1.8;

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d < -Math.PI) d += Math.PI * 2;
  while (d > Math.PI) d -= Math.PI * 2;
  return d;
}

export interface NearestTrackInfo {
  distanceToCenterline: number;
  lateralOffset: number;       // Desfase lateral con signo (- izquierda, + derecha)
  segmentIndex: number;
  projection: Vector2D;
  isOffroad: boolean;
  roadWidth: number;
  progressPercent: number;
  distanceAlong: number;       // Distancia acumulada sobre el eje de la vía (px)
  tangentAngle: number;
  z: number;
  elevationMeters: number;
  slopeGrade: number;
  gradePercent: number;        // Pendiente real en % calculada con las cotas msnm (negativa = bajada)
  isBridge?: boolean;
  bridgeName?: string;
  canyonDepth?: number;
  hasGuardrailLeft?: boolean;
  hasGuardrailRight?: boolean;
  onDecoyBranch?: boolean;
  decoyBarricadeHit?: boolean;
}

export interface DecoyBranch {
  name: string;
  points: TrackPoint[];
  barricade: TrackPoint;
}

export type TrackType = 'real' | 'test';

export class Track {
  public readonly points: TrackPoint[];
  public readonly totalLength: number;
  public readonly cumulativeDistances: number[];
  public readonly trackType: TrackType;
  public readonly decoyBranch?: DecoyBranch;
  /** Rumbo de cada segmento i → i+1 (rad). */
  public readonly headings: number[] = [];
  /** Cambio de rumbo con signo alrededor de cada punto, medido en una ventana de ±2 segmentos (+ derecha, − izquierda). */
  public readonly turn: number[] = [];

  constructor(trackType: TrackType = 'real', customPoints?: TrackPoint[]) {
    this.trackType = trackType;
    if (customPoints) {
      this.points = customPoints;
    } else if (trackType === 'real') {
      this.points = realTrackData as TrackPoint[];
      this.decoyBranch = Track.createLasPartidasDecoyBranch(this.points);
    } else {
      this.points = Track.createDefaultTestTrack();
    }

    this.cumulativeDistances = [0];
    let acc = 0;
    for (let i = 1; i < this.points.length; i++) {
      const dx = this.points[i].x - this.points[i - 1].x;
      const dy = this.points[i].y - this.points[i - 1].y;
      acc += Math.hypot(dx, dy);
      this.cumulativeDistances.push(acc);
    }
    this.totalLength = acc;
    this.computeGuardrails();
    this.openGuardrailGapForDecoy();
    this.computeCurvature();
  }

  /**
   * El ramal señuelo de Las Partidas sale de la vía principal: sin este hueco,
   * la defensa vial exterior lo tapaba y el desvío equivocado era inalcanzable.
   */
  private openGuardrailGapForDecoy(): void {
    if (!this.decoyBranch) return;
    const dPts = this.decoyBranch.points;
    const end = dPts[dPts.length - 1];
    const fork = this.points.findIndex((p) => p.x === dPts[0].x && p.y === dPts[0].y);
    if (fork < 0) return;

    for (let i = Math.max(0, fork - 1); i < Math.min(this.points.length - 1, fork + 18); i++) {
      const p = this.points[i];
      const next = this.points[i + 1];

      let nearDecoy = false;
      for (const d of dPts) {
        if (Math.hypot(d.x - p.x, d.y - p.y) < p.width / 2 + 46) {
          nearDecoy = true;
          break;
        }
      }
      if (!nearDecoy) continue;

      const ang = Math.atan2(next.y - p.y, next.x - p.x);
      const side = (end.x - p.x) * -Math.sin(ang) + (end.y - p.y) * Math.cos(ang);
      if (side > 0) {
        p.hasGuardrailRight = false;
        next.hasGuardrailRight = false;
      } else {
        p.hasGuardrailLeft = false;
        next.hasGuardrailLeft = false;
      }
    }
  }

  get totalMeters(): number {
    return this.totalLength / PX_PER_METER;
  }

  private computeCurvature(): void {
    const pts = this.points;
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      this.headings.push(Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x));
    }
    this.headings.push(this.headings[n - 2] ?? 0);
    for (let i = 0; i < n; i++) {
      const a = this.headings[Math.max(0, i - 2)];
      const b = this.headings[Math.min(n - 1, i + 2)];
      this.turn.push(angleDiff(b, a));
    }
  }

  /**
   * Nota de copiloto: busca la próxima curva exigente por delante del carro.
   * Devuelve dirección, severidad y distancia, o null si viene un tramo franco.
   */
  getCurveAhead(segmentIndex: number, distanceAlong: number, lookAheadPx: number = 360): CurveAhead | null {
    const n = this.points.length;
    for (let i = Math.max(0, segmentIndex); i < n - 1; i++) {
      const ahead = this.cumulativeDistances[i] - distanceAlong;
      if (ahead > lookAheadPx) break;
      const t = this.turn[i];
      if (Math.abs(t) < 0.9) continue;

      // Recorre la curva completa para medir su giro total y su punto más cerrado
      const sign = t > 0 ? 1 : -1;
      let total = 0;
      let peak = 0;
      let j = i;
      while (j < n - 1 && this.turn[j] * sign > 0.3) {
        peak = Math.max(peak, Math.abs(this.turn[j]));
        total += angleDiff(this.headings[Math.min(n - 1, j + 1)], this.headings[j]) * sign;
        j++;
      }
      let severity: CurveSeverity = 1;
      if (total > 2.3 || peak > 1.75) severity = 3;
      else if (total > 1.4 || peak > 1.25) severity = 2;

      return {
        direction: sign as -1 | 1,
        severity,
        distanceMeters: Math.max(0, ahead) / PX_PER_METER,
      };
    }
    return null;
  }

  /**
   * Genera defensas viales metálicas y quitamiedos reflectivos en:
   * 1. Todos los viaductos y puentes (ambos lados sobre el vacío).
   * 2. Curvas pronunciadas de montaña (lado exterior/abismo).
   * 3. Tramos donde curvas o calzadas no contiguas discurren a menos de 180 px por la ladera.
   */
  private computeGuardrails(): void {
    const pts = this.points;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.isBridge) {
        p.hasGuardrailLeft = true;
        p.hasGuardrailRight = true;
        continue;
      }

      if (i > 1 && i < pts.length - 2) {
        const prev = pts[i - 2];
        const next = pts[i + 2];
        const a1 = Math.atan2(p.y - prev.y, p.x - prev.x);
        const a2 = Math.atan2(next.y - p.y, next.x - p.x);
        let diff = a2 - a1;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        // Curva a la derecha: el exterior hacia el barranco es la izquierda (-1)
        if (diff > 0.035) {
          p.hasGuardrailLeft = true;
        }
        // Curva a la izquierda: el exterior hacia el barranco es la derecha (+1)
        if (diff < -0.035) {
          p.hasGuardrailRight = true;
        }
      }
    }

    // Proteger tramos donde una curva no contigua discurre a menos de 180 px en la ladera
    for (let i = 0; i < pts.length; i += 2) {
      for (let j = i + 10; j < Math.min(pts.length, i + 90); j += 2) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        if (dx * dx + dy * dy < 180 * 180) {
          const p = pts[i];
          const next = pts[Math.min(pts.length - 1, i + 1)];
          const angle = Math.atan2(next.y - p.y, next.x - p.x);
          const nx = -Math.sin(angle);
          const ny = Math.cos(angle);
          const dot = dx * nx + dy * ny;
          if (dot > 0) {
            pts[i].hasGuardrailRight = true;
          } else {
            pts[i].hasGuardrailLeft = true;
          }
        }
      }
    }
  }

  static createDefaultTestTrack(): TrackPoint[] {
    const rawWaypoints: TrackPoint[] = [
      { x: 1000, y: 1000, z: 100, elevationMeters: 1907, width: 90, name: 'Salida del Túnel (Boca Occidental)', isCheckpoint: true },
      { x: 1000, y: 1600, z: 90, elevationMeters: 1850, width: 85, name: 'Recta inicial de descenso' },
      { x: 1100, y: 2200, z: 80, elevationMeters: 1780, width: 80, name: 'Curva suave a derecha' },
      { x: 1400, y: 2700, z: 70, elevationMeters: 1700, width: 80, name: 'Puente Quebrada (Prueba)', isCheckpoint: true, isBridge: true, bridgeName: 'Puente de Prueba' },
      { x: 1700, y: 3100, z: 50, elevationMeters: 1560, width: 75, name: 'S-Curvas rápidas' },
      { x: 1500, y: 3600, z: 35, elevationMeters: 1450, width: 75 },
      { x: 1800, y: 4100, z: 20, elevationMeters: 1350, width: 75, name: 'Aproximación a Horquilla', isCheckpoint: true },
      { x: 2300, y: 4400, z: 15, elevationMeters: 1300, width: 70 },
      { x: 2500, y: 4300, z: 30, elevationMeters: 1400, width: 70, name: 'Horquilla El Caracol' },
      { x: 2300, y: 3900, z: 45, elevationMeters: 1500, width: 70 },
      { x: 2600, y: 3400, z: 65, elevationMeters: 1620, width: 75, name: 'Valle intermedio', isCheckpoint: true },
      { x: 3100, y: 3200, z: 85, elevationMeters: 1750, width: 75 },
      { x: 3600, y: 3400, z: 70, elevationMeters: 1650, width: 70, name: 'Alto de Montaña', isCheckpoint: true },
      { x: 4100, y: 3800, z: 50, elevationMeters: 1500, width: 70 },
      { x: 4500, y: 4300, z: 35, elevationMeters: 1380, width: 70 },
      { x: 4900, y: 4700, z: 20, elevationMeters: 1280, width: 70 },
      { x: 5300, y: 4900, z: 10, elevationMeters: 1200, width: 70, name: 'Descenso final hacia el pueblo' },
      { x: 5700, y: 4800, z: 5, elevationMeters: 1160, width: 65, name: 'Entrada urbana', isCheckpoint: true },
      { x: 6100, y: 4800, z: 2, elevationMeters: 1145, width: 65 },
      { x: 6500, y: 5500, z: 0, elevationMeters: 1141, width: 80, name: 'Parque Principal de Ebéjico (META)', isCheckpoint: true },
    ];

    return Track.subdivideSpline(rawWaypoints, 6);
  }

  private static subdivideSpline(pts: TrackPoint[], subdivisions: number): TrackPoint[] {
    const result: TrackPoint[] = [];
    const n = pts.length;

    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(n - 1, i + 2)];

      for (let s = 0; s < subdivisions; s++) {
        const t = s / subdivisions;
        const t2 = t * t;
        const t3 = t2 * t;

        const x = 0.5 * (
          (2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );

        const y = 0.5 * (
          (2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );

        const z0 = p0.z || 0;
        const z1 = p1.z || 0;
        const z2 = p2.z || 0;
        const z3 = p3.z || 0;
        const z = 0.5 * (
          (2 * z1) +
          (-z0 + z2) * t +
          (2 * z0 - 5 * z1 + 4 * z2 - z3) * t2 +
          (-z0 + 3 * z1 - 3 * z2 + z3) * t3
        );

        const e1 = p1.elevationMeters || 1907;
        const e2 = p2.elevationMeters || 1907;
        const elevationMeters = e1 + (e2 - e1) * t;

        const width = p1.width + (p2.width - p1.width) * t;

        result.push({
          x,
          y,
          z,
          elevationMeters,
          width,
          name: s === 0 ? p1.name : undefined,
          isCheckpoint: s === 0 ? p1.isCheckpoint : false,
          isBridge: p1.isBridge,
          bridgeName: p1.bridgeName,
          canyonDepth: p1.canyonDepth,
        });
      }
    }

    result.push(pts[n - 1]);
    return result;
  }

  private static createLasPartidasDecoyBranch(mainPoints: TrackPoint[]): DecoyBranch {
    const forkIndex = 347;
    const pPrev = mainPoints[forkIndex - 1] || mainPoints[0];
    const pFork = mainPoints[forkIndex];

    const dx = pFork.x - pPrev.x;
    const dy = pFork.y - pPrev.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    const branchPts: TrackPoint[] = [{ ...pFork, width: 84 }];
    let cx = pFork.x;
    let cy = pFork.y;
    let cz = pFork.z || 0;

    for (let step = 1; step <= 13; step++) {
      cx += ux * 32.0;
      cy += uy * 32.0;
      cz -= 1.8;
      branchPts.push({
        x: Math.round(cx * 10) / 10,
        y: Math.round(cy * 10) / 10,
        z: Math.round(cz * 10) / 10,
        elevationMeters: Math.round(((pFork.elevationMeters || 1560) - step * 2) * 10) / 10,
        width: 84,
      });
    }

    const barricadePt = branchPts[branchPts.length - 1];

    return {
      name: 'Vía a San Jerónimo (Obras / Calzada Cortada)',
      points: branchPts,
      barricade: barricadePt,
    };
  }

  checkDecoyBranch(pos: Vector2D): { onDecoy: boolean; hitBarricade: boolean } {
    if (!this.decoyBranch) return { onDecoy: false, hitBarricade: false };

    let minDistSq = Infinity;
    const bPts = this.decoyBranch.points;

    for (let i = 1; i < bPts.length; i++) {
      const a = bPts[i - 1];
      const b = bPts[i];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const apx = pos.x - a.x;
      const apy = pos.y - a.y;
      const segLenSq = abx * abx + aby * aby;
      if (segLenSq === 0) continue;

      const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / segLenSq));
      const px = a.x + t * abx;
      const py = a.y + t * aby;
      const dSq = (pos.x - px) * (pos.x - px) + (pos.y - py) * (pos.y - py);
      if (dSq < minDistSq) {
        minDistSq = dSq;
      }
    }

    const dist = Math.sqrt(minDistSq);
    const onDecoy = dist < 45;

    const barricade = this.decoyBranch.barricade;
    const distToBarricade = Math.hypot(pos.x - barricade.x, pos.y - barricade.y);
    const hitBarricade = distToBarricade < 48;

    return { onDecoy, hitBarricade };
  }

  getNearestTrackInfo(pos: Vector2D, lastSegmentIndex: number = 0): NearestTrackInfo {
    let minDistanceSq = Infinity;
    let bestSegment = lastSegmentIndex;
    let bestProj: Vector2D = {
      x: this.points[lastSegmentIndex]?.x || this.points[0].x,
      y: this.points[lastSegmentIndex]?.y || this.points[0].y,
    };
    let bestT = 0;

    // Búsqueda secuencial estricta: un vehículo solo puede avanzar progresivamente a lo largo de la calzada
    // Se acota la ventana a [-5, +8] segmentos para impedir matemáticamente que el detector salte
    // o encaje con curvas inferiores o tramos lejanos campo a través (anti-atajos).
    const searchBack = 5;
    const searchForward = 8;
    const startIdx = Math.max(0, lastSegmentIndex - searchBack);
    const endIdx = Math.min(this.points.length - 1, lastSegmentIndex + searchForward);

    for (let i = startIdx; i < endIdx; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const apx = pos.x - a.x;
      const apy = pos.y - a.y;

      const segLenSq = abx * abx + aby * aby;
      if (segLenSq === 0) continue;

      const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / segLenSq));
      const projX = a.x + t * abx;
      const projY = a.y + t * aby;

      const dx = pos.x - projX;
      const dy = pos.y - projY;
      const distSq = dx * dx + dy * dy;

      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        bestSegment = i;
        bestProj = { x: projX, y: projY };
        bestT = t;
      }
    }

    const dist = Math.sqrt(minDistanceSq);
    const a = this.points[bestSegment];
    const b = this.points[bestSegment + 1] || a;
    const tangentAngle = Math.atan2(b.y - a.y, b.x - a.x);
    const roadWidth = a.width + (b.width - a.width) * bestT;

    // Desfase lateral perpendicular con signo (- izquierda, + derecha respecto al sentido de avance)
    const normalX = -Math.sin(tangentAngle);
    const normalY = Math.cos(tangentAngle);
    const lateralOffset = (pos.x - bestProj.x) * normalX + (pos.y - bestProj.y) * normalY;

    const zA = a.z || 0;
    const zB = b.z || 0;
    const z = zA + (zB - zA) * bestT;

    const elevA = a.elevationMeters || 1907;
    const elevB = b.elevationMeters || 1907;
    const elevationMeters = elevA + (elevB - elevA) * bestT;

    const segLength2D = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const slopeGrade = (zB - zA) / segLength2D;
    const gradePercent = ((elevB - elevA) / (segLength2D / PX_PER_METER)) * 100;

    const segStartDist = this.cumulativeDistances[bestSegment];
    const distInSeg = Math.hypot(bestProj.x - a.x, bestProj.y - a.y);
    const totalDistAlong = segStartDist + distInSeg;
    const progressPercent = Math.min(100, Math.max(0, (totalDistAlong / this.totalLength) * 100));

    const decoyCheck = this.checkDecoyBranch(pos);

    return {
      distanceToCenterline: dist,
      lateralOffset,
      segmentIndex: bestSegment,
      projection: bestProj,
      isOffroad: decoyCheck.onDecoy ? false : dist > (roadWidth / 2 + 14),
      roadWidth,
      progressPercent,
      distanceAlong: totalDistAlong,
      tangentAngle,
      z,
      elevationMeters,
      slopeGrade,
      gradePercent,
      isBridge: a.isBridge || b.isBridge,
      bridgeName: a.bridgeName || b.bridgeName,
      canyonDepth: a.canyonDepth || b.canyonDepth,
      hasGuardrailLeft: a.hasGuardrailLeft || b.hasGuardrailLeft,
      hasGuardrailRight: a.hasGuardrailRight || b.hasGuardrailRight,
      onDecoyBranch: decoyCheck.onDecoy,
      decoyBarricadeHit: decoyCheck.hitBarricade,
    };
  }

  getStartPoint(): TrackPoint {
    return this.points[0];
  }

  getStartAngle(): number {
    const p0 = this.points[0];
    const p1 = this.points[1];
    return Math.atan2(p1.y - p0.y, p1.x - p0.x);
  }

  getCheckpoints(): Array<{ index: number; name: string; point: TrackPoint }> {
    const list: Array<{ index: number; name: string; point: TrackPoint }> = [];
    this.points.forEach((p, idx) => {
      if (p.isCheckpoint) {
        list.push({ index: idx, name: p.name || `Hito ${list.length + 1}`, point: p });
      }
    });
    return list;
  }
}
