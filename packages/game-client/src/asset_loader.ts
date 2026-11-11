/**
 * AssetLoader — sprites opcionales con respaldo vectorial.
 *
 * El juego se dibuja completo con vectores. Si alguien quiere sustituir una pieza por una
 * imagen (PNG/WebP/SVG transparente), basta con dejarla en `public/assets/sprites/` y
 * declararla en `public/assets/sprites/sprites.json`:
 *
 *   { "carro_rodillos": "carro_rodillos.png" }
 *
 * Solo se piden al servidor las imágenes declaradas, así que no hay peticiones fallidas
 * por sprites que todavía no existen.
 */
export class AssetLoader {
  private images: Map<string, HTMLImageElement> = new Map();

  constructor(baseUrl: string = './') {
    const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    void this.loadManifest(`${base}assets/sprites/`);
  }

  private async loadManifest(dir: string): Promise<void> {
    try {
      const res = await fetch(`${dir}sprites.json`);
      if (!res.ok) return;
      const manifest = (await res.json()) as Record<string, string>;
      for (const [key, file] of Object.entries(manifest)) {
        this.loadImage(key, dir + file);
      }
    } catch {
      // Sin manifiesto de sprites: todo se dibuja con vectores
    }
  }

  loadImage(key: string, src: string): void {
    const img = new Image();
    img.onload = () => this.images.set(key, img);
    img.src = src;
  }

  /** Imagen lista para dibujar, o undefined si no existe (se usa el dibujo vectorial). */
  get(key: string): HTMLImageElement | undefined {
    return this.images.get(key);
  }

  has(key: string): boolean {
    return this.images.has(key);
  }
}
