const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const geojsonPath = path.join(ROOT, 'data/research/ruta_candidata_osm.geojson');

const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

// 1. Trazado exacto de la Autopista al Mar 1 (Ruta 62) desde la boca del túnel y cruzando Puente Quebrada La Negra
const trueHighwayPoints = [
  [-75.687733, 6.323808], // Portal occidental Túnel de Occidente
  [-75.688020, 6.324100], // Explanada y salida de peaje
  [-75.688344, 6.324427], // Vía principal frente a báscula
  [-75.688680, 6.324740], // Aproximación al viaducto
  [-75.688988, 6.324938], // Estribo sur Puente Quebrada La Negra
  [-75.689154, 6.325472], // Centro del Puente Quebrada La Negra (sobre la quebrada)
  [-75.689320, 6.325900], // Vuelo del viaducto
  [-75.689449, 6.326165], // Estribo norte Puente Quebrada La Negra
  [-75.689530, 6.326500], // Calzada de la autopista
  [-75.689580, 6.326850], // Curva suave hacia el cañón
];

const line = data.features.find(f => f.geometry.type === 'LineString');
const oldCoords = line.geometry.coordinates;

// Reemplazar los puntos 0 a 27 (que iban por el camino viejo de montaña) con la autopista real
const remainingCoords = oldCoords.slice(28); // Comienza en [-75.689622, 6.327363]
line.geometry.coordinates = [...trueHighwayPoints, ...remainingCoords];

// 2. Actualizar POIs correspondientes
for (const f of data.features) {
  if (f.geometry.type === 'Point') {
    if (f.properties.name.toLowerCase().includes('túnel de occidente')) {
      f.geometry.coordinates = [-75.687733, 6.323808];
    }
    if (f.properties.name.toLowerCase().includes('quebrada la negra')) {
      f.geometry.coordinates = [-75.689154, 6.325472];
    }
  }
}

fs.writeFileSync(geojsonPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`[OK] Actualizada ruta_candidata_osm.geojson con calzada real: ${line.geometry.coordinates.length} puntos`);
