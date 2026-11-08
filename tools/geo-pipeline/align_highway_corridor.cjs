const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const geojsonPath = path.join(ROOT, 'data/research/ruta_candidata_osm.geojson');

const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

// Trazado exacto de la boca de salida occidental del Túnel de Occidente
// Lado con tráfico real (tubo derecho de salida hacia Santa Fe de Antioquia / Ebéjico)
const trueTunnelExitPoints = [
  [-75.686874, 6.324053], // Boca de salida real del Túnel de Occidente (con tráfico)
  [-75.687025, 6.324267], // Doble calzada con demarcación amarilla continua
  [-75.687239, 6.324533], // Curva de salida frente a la sede administrativa
  [-75.687400, 6.324747], // Aproximación al viaducto de Quebrada La Negra
  [-75.687507, 6.324853], // Entrada al viaducto con defensas amarillas
  [-75.687650, 6.325200], // Tablero del puente volando sobre el cañón
  [-75.687795, 6.325942], // Empalme con la calzada continua hacia Las Partidas
];

const line = data.features.find(f => f.geometry.type === 'LineString');
const oldCoords = line.geometry.coordinates;

// Buscar el punto donde se empalma en [-75.687795, 6.325942] o cercano
let mergeIdx = oldCoords.findIndex(c => Math.hypot(c[0] - (-75.687795), c[1] - 6.325942) < 0.0003);
if (mergeIdx === -1) mergeIdx = 7;

const remainingCoords = oldCoords.slice(mergeIdx + 1);
line.geometry.coordinates = [...trueTunnelExitPoints, ...remainingCoords];

// Actualizar POIs
for (const f of data.features) {
  if (f.geometry.type === 'Point') {
    if (f.properties.name.toLowerCase().includes('túnel de occidente')) {
      f.geometry.coordinates = [-75.686874, 6.324053];
    }
    if (f.properties.name.toLowerCase().includes('quebrada la negra')) {
      f.geometry.coordinates = [-75.687650, 6.325200];
    }
  }
}

fs.writeFileSync(geojsonPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`[OK] Actualizada ruta_candidata_osm.geojson con salida de túnel real: ${line.geometry.coordinates.length} puntos`);
console.log('Punto 0 (Boca Túnel de Occidente):', line.geometry.coordinates[0]);
console.log('Punto 1:', line.geometry.coordinates[1]);
console.log('Punto 2:', line.geometry.coordinates[2]);
