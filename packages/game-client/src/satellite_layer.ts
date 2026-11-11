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

interface TileNode extends SatelliteTileMeta {
  cx: number;
  cy: number;
  /** Teselas del nivel siguiente que cubren exactamente esta tesela (4 si la cobertura es completa). */
  children: TileNode[];
  img: HTMLImageElement | null;
  ready: boolean;
  loading: boolean;
  failed: boolean;
  lastUsed: number;
}

const MAX_CACHED_TILES = 260;
const MAX_PARALLEL_LOADS = 10;

/**
 * Ortofoto por teselas (niveles 16, 17 y 18) alineada con las coordenadas del juego.
 *
 * - Solo dibuja la tesela más nítida disponible en cada zona: si las cuatro hijas de una tesela
 *   ya cargaron, la madre no se pinta (antes se pintaban las tres capas una encima de otra).
 * - Carga primero lo más cercano a la cámara y limita las descargas simultáneas.
 * - Libera de memoria las teselas lejanas: el recorrido completo son 722 imágenes.
 */
export class SatelliteLayer {
  public enabled: boolean = true;

  private byZoom: Map<number, TileNode[]> = new Map();
  private all: TileNode[] = [];
  private manifestLoaded: boolean = false;
  private baseUrl: string;
  private activeLoads: number = 0;
  private frame: number = 0;
  private cachedCount: number = 0;

  constructor(baseUrl: string = './') {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    void this.loadManifest();
  }

  get ready(): boolean {
    return this.manifestLoaded && this.all.length > 0;
  }

  private async loadManifest(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}assets/satellite/manifest.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tiles: SatelliteTileMeta[] };

      const index = new Map<string, TileNode>();
      for (const t of data.tiles) {
        const node: TileNode = {
          ...t,
          cx: t.px + t.width / 2,
          cy: t.py + t.height / 2,
          children: [],
          img: null,
          ready: false,
          loading: false,
          failed: false,
          lastUsed: 0,
        };
        index.set(`${t.z}/${t.x}/${t.y}`, node);
        this.all.push(node);
        if (!this.byZoom.has(t.z)) this.byZoom.set(t.z, []);
        this.byZoom.get(t.z)!.push(node);
      }

      for (const node of this.all) {
        for (let dx = 0; dx < 2; dx++) {
          for (let dy = 0; dy < 2; dy++) {
            const child = index.get(`${node.z + 1}/${node.x * 2 + dx}/${node.y * 2 + dy}`);
            if (child) node.children.push(child);
          }
        }
      }
      this.manifestLoaded = true;
    } catch (err) {
      console.warn('[SatelliteLayer] Sin manifiesto satelital; se usa el mapa vectorial.', err);
      this.enabled = false;
    }
  }

  private requestTile(tile: TileNode): void {
    if (tile.ready || tile.loading || tile.failed || this.activeLoads >= MAX_PARALLEL_LOADS) return;
    tile.loading = true;
    this.activeLoads++;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      tile.img = img;
      tile.ready = true;
      tile.loading = false;
      this.activeLoads--;
      this.cachedCount++;
    };
    img.onerror = () => {
      tile.loading = false;
      tile.failed = true;
      this.activeLoads--;
    };
    img.src = `${this.baseUrl}assets/satellite/${tile.file}`;
  }

  /** ¿Está la zona de esta tesela completamente cubierta por teselas más nítidas ya cargadas? */
  private coveredByChildren(tile: TileNode): boolean {
    if (tile.children.length < 4) return false;
    for (const c of tile.children) {
      if (!c.ready && !this.coveredByChildren(c)) return false;
    }
    return true;
  }

  /**
   * Dibuja la ortofoto visible alrededor de la cámara (coordenadas de mundo ya aplicadas al contexto).
   */
  public render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, viewRadius: number): void {
    if (!this.enabled || !this.manifestLoaded) return;
    this.frame++;

    const minX = cameraX - viewRadius;
    const maxX = cameraX + viewRadius;
    const minY = cameraY - viewRadius;
    const maxY = cameraY + viewRadius;

    const visible: TileNode[] = [];
    for (const t of this.all) {
      if (t.px + t.width < minX || t.px > maxX || t.py + t.height < minY || t.py > maxY) continue;
      t.lastUsed = this.frame;
      visible.push(t);
    }

    // Descargas: primero el nivel base (cubre rápido), luego lo más cercano a la cámara
    const pending = visible.filter((t) => !t.ready && !t.loading && !t.failed);
    if (pending.length > 0) {
      pending.sort((a, b) => {
        const za = a.z === 16 ? 0 : 1;
        const zb = b.z === 16 ? 0 : 1;
        if (za !== zb) return za - zb;
        const da = (a.cx - cameraX) ** 2 + (a.cy - cameraY) ** 2;
        const db = (b.cx - cameraX) ** 2 + (b.cy - cameraY) ** 2;
        return da - db;
      });
      for (const t of pending) {
        if (this.activeLoads >= MAX_PARALLEL_LOADS) break;
        this.requestTile(t);
      }
    }

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    // De menor a mayor nitidez; un pequeño solape evita costuras al rotar la cámara
    visible.sort((a, b) => a.z - b.z);
    for (const t of visible) {
      if (!t.ready || !t.img) continue;
      if (this.coveredByChildren(t)) continue;
      ctx.drawImage(t.img, t.px - 0.4, t.py - 0.4, t.width + 0.8, t.height + 0.8);
    }
    ctx.restore();

    if (this.cachedCount > MAX_CACHED_TILES && this.frame % 120 === 0) this.evict();
  }

  private evict(): void {
    const loaded = this.all.filter((t) => t.ready).sort((a, b) => a.lastUsed - b.lastUsed);
    const excess = loaded.length - Math.floor(MAX_CACHED_TILES * 0.75);
    for (let i = 0; i < excess; i++) {
      const t = loaded[i];
      if (t.lastUsed >= this.frame - 60) break;
      t.img = null;
      t.ready = false;
      this.cachedCount--;
    }
  }
}
