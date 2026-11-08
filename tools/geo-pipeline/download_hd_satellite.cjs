const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const trackPath = path.join(ROOT, 'packages/track-data/real_route_track.json');
const outDir = path.join(ROOT, 'apps/reto-ebejico/public/assets/satellite');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const track = JSON.parse(fs.readFileSync(trackPath, 'utf8'));

// ORIGEN EXACTO DE RUTA_CANDIDATA_OSM.GEOJSON Y BUILD_REAL_TRACK.PY (Boca Occidental del Túnel de Occidente)
const origin_lon = -75.687336;
const origin_lat = 6.324080;
const mean_lat_rad = (origin_lat * Math.PI) / 180;
const METERS_TO_PX = 1.8;
const R = 6371000.0;

function unproject(px, py) {
  const x_meters = (px - 2000) / METERS_TO_PX;
  const y_meters = (2000 - py) / METERS_TO_PX;
  const d_lat_rad = y_meters / R;
  const d_lon_rad = x_meters / (R * Math.cos(mean_lat_rad));
  const lat = origin_lat + (d_lat_rad * 180) / Math.PI;
  const lon = origin_lon + (d_lon_rad * 180) / Math.PI;
  return { lon, lat };
}

function project(lon, lat) {
  const d_lon_rad = ((lon - origin_lon) * Math.PI) / 180;
  const d_lat_rad = ((lat - origin_lat) * Math.PI) / 180;
  const x_meters = R * d_lon_rad * Math.cos(mean_lat_rad);
  const y_meters = R * d_lat_rad;
  const px = 2000 + x_meters * METERS_TO_PX;
  const py = 2000 - y_meters * METERS_TO_PX;
  return { px, py };
}

function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { z, x, y };
}

function tileToBounds(z, x, y) {
  const n = 2 ** z;
  const lonWest = (x / n) * 360 - 180;
  const lonEast = ((x + 1) / n) * 360 - 180;
  const latNorthRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const latSouthRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  const latNorth = (latNorthRad * 180) / Math.PI;
  const latSouth = (latSouthRad * 180) / Math.PI;

  const topLeft = project(lonWest, latNorth);
  const bottomRight = project(lonEast, latSouth);

  return {
    id: `z${z}_${x}_${y}`,
    z,
    x,
    y,
    file: `z${z}_${x}_${y}.jpg`,
    lonWest,
    lonEast,
    latNorth,
    latSouth,
    px: Math.round(topLeft.px * 100) / 100,
    py: Math.round(topLeft.py * 100) / 100,
    width: Math.round((bottomRight.px - topLeft.px) * 100) / 100,
    height: Math.round((bottomRight.py - topLeft.py) * 100) / 100,
  };
}

async function fetchTileWithRetry(z, x, y, retries = 3) {
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'RetoEbejicoGame/2.0' } });
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    } catch (err) {}
    await new Promise((r) => setTimeout(r, 400 * attempt));
  }
  return null;
}

async function main() {
  console.log('--- Calculando franja satelital REAL (Origen Exacto del Túnel: -75.686887, 6.323970) ---');
  
  const bufferPx = 140 * METERS_TO_PX;
  const tilesMap = new Map();

  // Descargamos Zoom 16 (base continua), Zoom 17 y Zoom 18 (ultra HD sub-métrica)
  [16, 17, 18].forEach((z) => {
    track.forEach((pt) => {
      const offsets = [
        [0, 0],
        [-bufferPx, -bufferPx],
        [bufferPx, -bufferPx],
        [-bufferPx, bufferPx],
        [bufferPx, bufferPx],
      ];
      offsets.forEach(([dx, dy]) => {
        const geo = unproject(pt.x + dx, pt.y + dy);
        const t = lonLatToTile(geo.lon, geo.lat, z);
        const key = `z${t.z}_${t.x}_${t.y}`;
        if (!tilesMap.has(key)) {
          tilesMap.set(key, tileToBounds(t.z, t.x, t.y));
        }
      });
    });
  });

  const allTiles = Array.from(tilesMap.values());
  console.log(`Total tiles requeridos: ${allTiles.length} (${allTiles.filter(t => t.z === 18).length} en Z18, ${allTiles.filter(t => t.z === 17).length} en Z17, ${allTiles.filter(t => t.z === 16).length} en Z16)`);

  const pendingTiles = allTiles.filter(t => {
    const filePath = path.join(outDir, t.file);
    return !fs.existsSync(filePath) || fs.statSync(filePath).size < 1000;
  });

  console.log(`Tiles pendientes por descargar: ${pendingTiles.length}`);

  let downloadedCount = 0;
  let failedCount = 0;
  const concurrency = 8;
  const queue = [...pendingTiles];

  async function worker(workerId) {
    while (queue.length > 0) {
      const tile = queue.shift();
      const filePath = path.join(outDir, tile.file);

      const buffer = await fetchTileWithRetry(tile.z, tile.x, tile.y);
      if (buffer && buffer.length > 1000) {
        fs.writeFileSync(filePath, buffer);
        downloadedCount++;
        if (downloadedCount % 50 === 0 || queue.length === 0) {
          console.log(`[Descarga] ${downloadedCount}/${pendingTiles.length} completados (Restantes: ${queue.length})`);
        }
      } else {
        failedCount++;
      }
    }
  }

  const workers = Array.from({ length: concurrency }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  console.log('\n--- Descarga completada con alineación exacta ---');
  console.log(`Nuevos descargados: ${downloadedCount}, Fallos: ${failedCount}`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: 'Esri World Imagery (Calibrado con origen exacto Túnel de Occidente)',
    tileCount: allTiles.length,
    origin: { lon: origin_lon, lat: origin_lat },
    tiles: allTiles,
  };

  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Manifiesto satelital guardado en: ${manifestPath}`);
}

main().catch(console.error);
