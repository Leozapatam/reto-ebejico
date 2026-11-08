/**
 * AssetLoader — Cargador inteligente de sprites y texturas con Fallback Vectorial Seguro.
 * 
 * Permite cargar imágenes PNG/SVG/WebP transparentes para vehículos, casas, vegetación y asfalto.
 * Si la imagen existe, la dibuja directamente. Si no existe o está cargando, el motor
 * utiliza automáticamente el renderizado vectorial para garantizar que nunca se rompa el juego.
 */
export class AssetLoader {
  private images: Map<string, HTMLImageElement> = new Map();
  private loaded: Map<string, boolean> = new Map();

  constructor() {
    this.preloadDefaults();
  }

  private preloadDefaults(): void {
    const assetsToLoad: Record<string, string> = {
      carro_rodillos: 'assets/sprites/carro_rodillos.png',
      casa_campesina: 'assets/sprites/casa_campesina.png',
      cafetal: 'assets/sprites/cafetal.png',
      pino_andino: 'assets/sprites/pino_andino.png',
      asfalto_textura: 'assets/textures/asfalto_carretera.png',
      roca_canon: 'assets/textures/roca_canon.png',
    };

    for (const [key, src] of Object.entries(assetsToLoad)) {
      this.loadImage(key, src);
    }
  }

  loadImage(key: string, src: string): void {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      this.images.set(key, img);
      this.loaded.set(key, true);
    };
    img.onerror = () => {
      // Si la imagen no existe aún en public/assets/, marcamos false para usar el fallback vectorial
      this.loaded.set(key, false);
    };
  }

  /**
   * Obtiene la imagen cargada si está lista; de lo contrario retorna undefined.
   */
  get(key: string): HTMLImageElement | undefined {
    if (this.loaded.get(key)) {
      return this.images.get(key);
    }
    return undefined;
  }

  /**
   * Indica si un sprite o textura específica está disponible.
   */
  has(key: string): boolean {
    return Boolean(this.loaded.get(key) && this.images.has(key));
  }
}
