import fs from 'node:fs';
import path from 'node:path';

const TRACK_PATH = path.resolve('packages/track-data/real_route_track.json');
const raw = fs.readFileSync(TRACK_PATH, 'utf8');
const track = JSON.parse(raw);

const CALIBRATED_BRIDGES = [
  {
    name: 'Puente Quebrada La Negra',
    start: 5,
    end: 14,
    depth: 45.0,
  },
  {
    name: 'Puente Quebrada La Volcana',
    start: 115,
    end: 121,
    depth: 45.0,
  },
  {
    name: 'Puente Quebrada La Nuez',
    start: 142,
    end: 151,
    depth: 45.0,
  },
  {
    name: 'Puente Quebrada La Cáusala',
    start: 168,
    end: 175,
    depth: 45.0,
  },
  {
    name: 'Puente Quebrada La Potrera',
    start: 307,
    end: 316,
    depth: 45.0,
  },
  {
    name: 'Puente vehicular Ebéjico - Ruta 62 (km 8.2)',
    start: 497,
    end: 504,
    depth: 35.0,
  },
  {
    name: 'Puente Quebrada La Sucia / La Frisola (km 9.4)',
    start: 563,
    end: 568,
    depth: 35.0,
  },
  {
    name: 'Quebrada Agua de La Peña (km 12.0)',
    start: 676,
    end: 683,
    depth: 35.0,
  },
  {
    name: 'Paso Quebrada El Patudo (km 17.0, alto de montaña)',
    start: 958,
    end: 962,
    depth: 25.0,
  },
  {
    name: 'Puente vehicular Ebéjico - Ruta 62 (km 18.9)',
    start: 1012,
    end: 1017,
    depth: 30.0,
  },
  {
    name: 'Puente Quebrada Juan Ramos (km 25.2)',
    start: 1430,
    end: 1436,
    depth: 25.0,
  },
];

// 1. Limpiar flags de puente anteriores
let cleaned = 0;
for (const p of track) {
  if (p.isBridge) {
    delete p.isBridge;
    delete p.bridgeName;
    delete p.canyonDepth;
    cleaned++;
  }
}
console.log(`Borrados ${cleaned} puntos de puente anteriores.`);

// 2. Aplicar nuevos rangos calibrados
let added = 0;
for (const b of CALIBRATED_BRIDGES) {
  for (let i = b.start; i <= b.end; i++) {
    if (track[i]) {
      track[i].isBridge = true;
      track[i].bridgeName = b.name;
      track[i].canyonDepth = b.depth;
      added++;
    }
  }
}
console.log(`Aplicados ${added} puntos de puente recalibrados en ${CALIBRATED_BRIDGES.length} puentes.`);

fs.writeFileSync(TRACK_PATH, JSON.stringify(track, null, 2), 'utf8');
console.log('real_route_track.json actualizado correctamente.');
