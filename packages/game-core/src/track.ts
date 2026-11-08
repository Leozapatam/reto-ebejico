import { TrackPoint, Vector2D } from './types';
import realTrackData from '../../track-data/real_route_track.json';

export interface NearestTrackInfo {
  distanceToCenterline: number;
  segmentIndex: number;
  projection: Vector2D;
  isOffroad: boolean;
  roadWidth: number;
  progressPercent: number;
  tangentAngle: number;
  z: number;
  elevationMeters: number;
  slopeGrade: number;
  isBridge?: boolean;
  bridgeName?: string;
  canyonDepth?: number;
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
    let bestSegment = 0;
    let bestProj: Vector2D = { x: this.points[0].x, y: this.points[0].y };
    let bestT = 0;

    // Búsqueda local adaptativa
    const searchRadius = 50;
    const startIdx = Math.max(0, lastSegmentIndex - 20);
    const endIdx = Math.min(this.points.length - 1, lastSegmentIndex + searchRadius);

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

    // Si el jugador se desvió mucho (posible trampa por la selva), buscar en toda la pista
    if (minDistanceSq > 150 * 150) {
      for (let i = 0; i < this.points.length - 1; i += 4) {
        const a = this.points[i];
        const b = this.points[i + 1];
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const segLenSq = abx * abx + aby * aby;
        if (segLenSq === 0) continue;
        const t = Math.max(0, Math.min(1, ((pos.x - a.x) * abx + (pos.y - a.y) * aby) / segLenSq));
        const px = a.x + t * abx;
        const py = a.y + t * aby;
        const dSq = (pos.x - px) * (pos.x - px) + (pos.y - py) * (pos.y - py);
        if (dSq < minDistanceSq) {
          minDistanceSq = dSq;
          bestSegment = i;
          bestProj = { x: px, y: py };
          bestT = t;
        }
      }
    }

    const dist = Math.sqrt(minDistanceSq);
    const a = this.points[bestSegment];
    const b = this.points[bestSegment + 1] || a;
    const tangentAngle = Math.atan2(b.y - a.y, b.x - a.x);
    const roadWidth = a.width + (b.width - a.width) * bestT;

    const zA = a.z || 0;
    const zB = b.z || 0;
    const z = zA + (zB - zA) * bestT;

    const elevA = a.elevationMeters || 1907;
    const elevB = b.elevationMeters || 1907;
    const elevationMeters = elevA + (elevB - elevA) * bestT;

    const segLength2D = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const slopeGrade = (zB - zA) / segLength2D;

    const segStartDist = this.cumulativeDistances[bestSegment];
    const distInSeg = Math.hypot(bestProj.x - a.x, bestProj.y - a.y);
    const totalDistAlong = segStartDist + distInSeg;
    const progressPercent = Math.min(100, Math.max(0, (totalDistAlong / this.totalLength) * 100));

    const decoyCheck = this.checkDecoyBranch(pos);

    return {
      distanceToCenterline: dist,
      segmentIndex: bestSegment,
      projection: bestProj,
      isOffroad: decoyCheck.onDecoy ? false : dist > (roadWidth / 2 + 10),
      roadWidth,
      progressPercent,
      tangentAngle,
      z,
      elevationMeters,
      slopeGrade,
      isBridge: a.isBridge || b.isBridge,
      bridgeName: a.bridgeName || b.bridgeName,
      canyonDepth: a.canyonDepth || b.canyonDepth,
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
