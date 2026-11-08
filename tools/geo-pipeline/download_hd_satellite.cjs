const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const trackPath = path.join(ROOT, 'packages/track-data/real_route_track.json');
const outDir = path.join(ROOT, 'apps/reto-ebejico/public/assets/satellite');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const track = JSON.parse(fs.readFileSync(trackPath, 'utf8'));

// ORIGEN EXACTO DE LA BOCA DE SALIDA OCCIDENTAL DEL TÚNEL DE OCCIDENTE (Lado con tráfico hacia Ebéjico)
const origin_lon = -75.686874;
const origin_lat = 6.324053;
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

// Google Satellite: Sin nubes sobre Ebéjico y con alta nitidez en el túnel
async function fetchTileWithRetry(z, x, y, retries = 3) {
  const server = (x + y) % 4;
  const url = `https://mt${server}.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    } catch (err) {}
    await new Promise((r) => setTimeout(r, 200 * attempt));
  }
  return null;
}

async function main() {
  console.log('--- Calculando franja satelital Google Cloud-Free (Origen Túnel con tráfico: -75.686874, 6.324053) ---');

  const bufferPx = 140 * METERS_TO_PX;
  const tilesMap = new Map();

  // Descargamos Zoom 16, 17 y 18 para el corredor
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
        const coords = unproject(pt.x + dx, pt.y + dy);
        const tile = lonLatToTile(coords.lon, coords.lat, z);
        const key = `${z}_${tile.x}_${tile.y}`;
        if (!tilesMap.has(key)) {
          tilesMap.set(key, tileToBounds(z, tile.x, tile.y));
        }
      });
    });
  });

  const allTiles = Array.from(tilesMap.values());
  console.log(
    `Total tiles requeridos: ${allTiles.length} (` +
      `${allTiles.filter((t) => t.z === 18).length} en Z18, ` +
      `${allTiles.filter((t) => t.z === 17).length} en Z17, ` +
      `${allTiles.filter((t) => t.z === 16).length} en Z16)`
  );

  const pending = allTiles.map(t => ({
    z: t.z,
    x: t.x,
    y: t.y,
    path: path.join(outDir, t.file),
  }));

  console.log(`Tiles a descargar desde Google Satellite: ${pending.length}`);

  let downloaded = 0;
  let failed = 0;
  const CONCURRENCY = 12;

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (item) => {
        const data = await fetchTileWithRetry(item.z, item.x, item.y);
        if (data && data.length > 1000) {
          fs.writeFileSync(item.path, data);
          downloaded++;
        } else {
          failed++;
        }
      })
    );
    if ((i + CONCURRENCY) % 120 < CONCURRENCY || i + CONCURRENCY >= pending.length) {
      console.log(`[Descarga Google Satellite] ${downloaded}/${pending.length} completados`);
    }
  }

  console.log(`\n--- Descarga completada sin nubes ---`);
  console.log(`Descargados: ${downloaded}, Fallos: ${failed}`);

  const manifest = {
    generated_at: new Date().toISOString(),
    source: 'Google Satellite (Sin nubes)',
    origin_lon,
    origin_lat,
    meters_to_px: METERS_TO_PX,
    tiles: allTiles,
  };

  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Manifiesto satelital guardado en: ${manifestPath}`);
}

main().catch(console.error);
