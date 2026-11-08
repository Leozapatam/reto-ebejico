export interface SatelliteTileMeta {
  id: string;
  z: number;
  x: number;
  y: number;
  file: string;
  px: number;
  py: number;
  width: number;
  height: number;
}

export interface SatelliteManifest {
  generatedAt: string;
  source: string;
  tileCount: number;
  origin: { lon: number; lat: number };
  tiles: SatelliteTileMeta[];
}

export class SatelliteLayer {
  private tiles: SatelliteTileMeta[] = [];
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private loadingSet: Set<string> = new Set();
  private manifestLoaded: boolean = false;
  public enabled: boolean = true;

  constructor() {
    this.loadManifest();
  }

  private async loadManifest(): Promise<void> {
    try {
      const res = await fetch('/assets/satellite/manifest.json');
      if (!res.ok) {
        console.warn('[SatelliteLayer] No se pudo cargar manifest.json, fallback a fondo vectorial');
        return;
      }
      const data: SatelliteManifest = await res.json();
      this.tiles = data.tiles;
      this.manifestLoaded = true;

      // Pre-cargar inmediatamente los tiles cercanos al punto de inicio (Túnel de Occidente ~2000, 2000)
      this.preloadArea(2000, 2000, 3500);
    } catch (err) {
      console.warn('[SatelliteLayer] Error cargando manifiesto satelital:', err);
    }
  }

  /**
   * Pre-carga tiles en un radio alrededor de (x, y)
   */
  public preloadArea(centerX: number, centerY: number, radius: number): void {
    if (!this.manifestLoaded) return;
    const r2 = radius * radius;
    for (const t of this.tiles) {
      // Chequear si el centro del tile está dentro del radio
      const tileCenterX = t.px + t.width / 2;
      const tileCenterY = t.py + t.height / 2;
      const dx = tileCenterX - centerX;
      const dy = tileCenterY - centerY;
      if (dx * dx + dy * dy <= r2) {
        this.getTileImage(t);
      }
    }
  }

  private getTileImage(tile: SatelliteTileMeta): HTMLImageElement | null {
    const cached = this.imageCache.get(tile.id);
    if (cached) return cached;

    if (!this.loadingSet.has(tile.id)) {
      this.loadingSet.add(tile.id);
      const img = new Image();
      img.src = `/assets/satellite/${tile.file}`;
      img.onload = () => {
        this.imageCache.set(tile.id, img);
        this.loadingSet.delete(tile.id);
      };
      img.onerror = () => {
        this.loadingSet.delete(tile.id);
      };
    }
    return null;
  }

  /**
   * Renderiza las ortofotos satelitales que intersecan la vista actual de la cámara.
   * Dibuja primero Zoom 15 como base continua, y luego superpone Zoom 16 en alta resolución.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    viewRadius: number = 2400
  ): void {
    if (!this.enabled || !this.manifestLoaded || this.tiles.length === 0) return;

    const minX = cameraX - viewRadius;
    const maxX = cameraX + viewRadius;
    const minY = cameraY - viewRadius;
    const maxY = cameraY + viewRadius;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    // 1. Capa base continua: Zoom 15
    for (const t of this.tiles) {
      if (t.z !== 15) continue;
      if (
        t.px + t.width < minX ||
        t.px > maxX ||
        t.py + t.height < minY ||
        t.py > maxY
      ) {
        continue;
      }
      const img = this.getTileImage(t);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, t.px, t.py, t.width, t.height);
      }
    }

    // 2. Capa de alta definición: Zoom 16
    for (const t of this.tiles) {
      if (t.z !== 16) continue;
      if (
        t.px + t.width < minX ||
        t.px > maxX ||
        t.py + t.height < minY ||
        t.py > maxY
      ) {
        continue;
      }
      const img = this.getTileImage(t);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, t.px, t.py, t.width, t.height);
      }
    }

    ctx.restore();
  }
}
