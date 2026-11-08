const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const trackPath = path.join(ROOT, 'packages/track-data/real_route_track.json');
const track = JSON.parse(fs.readFileSync(trackPath, 'utf8'));

// Coordenadas origen de build_real_track.py
const origin_lon = -75.666497;
const origin_lat = 6.297072;
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
    z,
    x,
    y,
    lonWest,
    lonEast,
    latNorth,
    latSouth,
    px: topLeft.px,
    py: topLeft.py,
    width: bottomRight.px - topLeft.px,
    height: bottomRight.py - topLeft.py,
  };
}

console.log('Total track points:', track.length);

// Analyze Zoom 15 and Zoom 16 tiles needed to cover the track + corridor buffer
[15, 16].forEach((z) => {
  const tileSet = new Set();
  const bufferMeters = 300; // 300m buffer each side of the road
  const bufferPx = bufferMeters * METERS_TO_PX;

  track.forEach((pt) => {
    // sample center and 4 corners of buffer
    const samples = [
      { x: pt.x, y: pt.y },
      { x: pt.x - bufferPx, y: pt.y - bufferPx },
      { x: pt.x + bufferPx, y: pt.y - bufferPx },
      { x: pt.x - bufferPx, y: pt.y + bufferPx },
      { x: pt.x + bufferPx, y: pt.y + bufferPx },
    ];
    samples.forEach((s) => {
      const geo = unproject(s.x, s.y);
      const t = lonLatToTile(geo.lon, geo.lat, z);
      tileSet.add(`${t.z}_${t.x}_${t.y}`);
    });
  });

  console.log(`Zoom ${z}: ${tileSet.size} tiles needed for full 26.1km corridor.`);
});
