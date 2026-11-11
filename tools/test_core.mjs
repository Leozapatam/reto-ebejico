// Prueba del núcleo sin navegador: compila packages/game-core con esbuild y
// corre la simulación a 60 Hz con un piloto automático sobre los 26 km.
//
//   node tools/test_core.mjs
//
// Comprueba que la meta es alcanzable, que rodar por la berma no dispara caídas
// falsas, que salirse al barranco sí penaliza y que el ramal de Las Partidas existe.

import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'node_modules', '.cache', 'reto-core-test.mjs');
fs.mkdirSync(path.dirname(outFile), { recursive: true });

await build({
  stdin: {
    contents: `
      export { Simulation, SPEED_TO_KMH } from './packages/game-core/src/simulation';
      export { Track, PX_PER_METER } from './packages/game-core/src/track';
    `,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
});

const { Simulation, Track } = await import(pathToFileURL(outFile).href + `?t=${Date.now()}`);

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FALLA'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}

const DT = 1 / 60;
const norm = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

function startRace(sim) {
  sim.reset();
  sim.startCountdown();
  for (let i = 0; i < 200 && sim.phase !== 'racing'; i++) sim.step({ steer: 0, throttle: 0, brake: 0, handbrake: false }, DT);
  sim.getSnapshot();
}

/** Piloto prudente: mira adelante, frena antes de las curvas y cruza la cola en las horquillas. */
function autopilot(sim, skill = 1) {
  const track = sim.track;
  const pts = track.points;
  const v = sim.vehicle.state;
  const snap = sim.getSnapshot();
  const seg = snap.segmentIndex;
  const speed = Math.abs(v.speed);

  const look = 2 + Math.floor(speed / 150);
  const target = pts[Math.min(pts.length - 1, seg + look)];
  const err = norm(Math.atan2(target.y - v.y, target.x - v.x) - v.angle);
  const steer = Math.max(-1, Math.min(1, err * 3.2));

  // Velocidad segura según la curva más cerrada dentro de la distancia de frenado
  let safe = 999;
  const horizon = Math.min(pts.length - 1, seg + 3 + Math.floor(speed / 45));
  for (let i = seg; i <= horizon; i++) {
    const t = Math.abs(track.turn[i]);
    const s = t < 0.25 ? 999 : (95 / t) * skill;
    const dist = Math.max(0, track.cumulativeDistances[i] - track.cumulativeDistances[seg]);
    safe = Math.min(safe, Math.sqrt(s * s + 2 * 520 * dist));
  }

  const brake = speed > safe * 1.05 ? 1 : 0;
  const throttle = brake || speed > safe ? 0 : 1;
  const handbrake = Math.abs(err) > 0.5 && speed > 110;
  return { input: { steer, throttle, brake, handbrake }, snap };
}

// ───────────────────────── 1. Recorrido completo ─────────────────────────
for (const trackType of ['test', 'real']) {
  const sim = new Simulation(new Track(trackType));
  startRace(sim);
  const counts = {};
  let steps = 0;
  let lastSnap = null;
  const MAX = 60 * 60 * 15;
  while (sim.phase === 'racing' && steps < MAX) {
    const { input, snap } = autopilot(sim);
    for (const e of snap.events) counts[e.type] = (counts[e.type] || 0) + 1;
    lastSnap = snap;
    sim.step(input, DT);
    steps++;
  }
  const end = sim.getSnapshot();
  for (const e of end.events) counts[e.type] = (counts[e.type] || 0) + 1;
  check(
    `[${trackType}] el piloto automático cruza la meta`,
    end.phase === 'finished',
    `tiempo ${end.formattedTime}, progreso ${lastSnap?.progressPercent}%, hitos ${end.currentCheckpoint}/${end.totalCheckpoints}`
  );
  check(`[${trackType}] todos los parciales registrados`, end.splits.length === end.totalCheckpoints - 1, `${end.splits.length} parciales`);
  console.log(
    `        vel. máx ${end.stats.topSpeedKmh.toFixed(0)} km/h · penalizaciones ${end.stats.penaltyCount} (${end.stats.penaltyMs} ms) · golpes ${end.stats.railHits} · sucesos ${JSON.stringify(counts)}`
  );
}

// ───────────────────────── 2. Rodar por la berma ─────────────────────────
{
  const track = new Track('test');
  const sim = new Simulation(track);
  startRace(sim);
  const v = sim.vehicle.state;
  // Carro paralelo a la vía, 8 px por fuera del borde (zona de berma: fuera de calzada pero no en el barranco)
  const i0 = 2;
  const info0 = track.getNearestTrackInfo(track.points[i0], i0);
  const nx = -Math.sin(info0.tangentAngle);
  const ny = Math.cos(info0.tangentAngle);
  const off = info0.roadWidth / 2 + 20;
  v.x = track.points[i0].x + nx * off;
  v.y = track.points[i0].y + ny * off;
  v.angle = info0.tangentAngle;
  let falls = 0;
  let maxSeg = 0;
  for (let s = 0; s < 150; s++) {
    // Mantiene el desfase lateral constante mientras avanza
    const snap = sim.getSnapshot();
    for (const e of snap.events) if (e.type === 'fall') falls++;
    maxSeg = Math.max(maxSeg, snap.segmentIndex);
    const info = track.getNearestTrackInfo({ x: v.x, y: v.y }, snap.segmentIndex);
    const lateralErr = off - info.lateralOffset;
    const headingErr = norm(info.tangentAngle - v.angle);
    sim.step({ steer: Math.max(-1, Math.min(1, headingErr * 3 + lateralErr * 0.05)), throttle: 1, brake: 0, handbrake: false }, DT);
  }
  check('rodar 2,5 s por la berma no cuenta como caída', falls === 0, `avanzó hasta el segmento ${maxSeg}`);
  check('el detector sigue al carro por la berma', maxSeg >= i0 + 3, `segmento ${maxSeg}`);
}

// ───────────────────────── 3. Caída al barranco ─────────────────────────
{
  const track = new Track('test');
  const sim = new Simulation(track);
  startRace(sim);
  const v = sim.vehicle.state;
  v.angle += Math.PI / 2; // de frente al vacío
  let fell = false;
  let penalty = 0;
  for (let s = 0; s < 400 && !fell; s++) {
    sim.step({ steer: 0, throttle: 1, brake: 0, handbrake: false }, DT);
    const snap = sim.getSnapshot();
    fell = snap.events.some((e) => e.type === 'fall');
    penalty = snap.stats.penaltyMs;
  }
  check('salirse de frente provoca caída con penalización', fell && penalty === 3000, `penalización ${penalty} ms`);
}

// ───────────────────────── 4. Ramal señuelo de Las Partidas ─────────────────────────
{
  const track = new Track('real');
  const sim = new Simulation(track);
  startRace(sim);
  const v = sim.vehicle.state;
  const fork = track.points.findIndex((p) => p.x === track.decoyBranch.points[0].x && p.y === track.decoyBranch.points[0].y);
  const start = fork - 6;
  const a = Math.atan2(track.points[start + 1].y - track.points[start].y, track.points[start + 1].x - track.points[start].x);
  sim.vehicle.respawn(track.points[start].x, track.points[start].y, a, 0, 1540);
  sim['searchIndex'] = start;
  const bar = track.decoyBranch.barricade;
  let hit = false;
  let fell = false;
  for (let s = 0; s < 900 && !hit && !fell; s++) {
    // Sigue recto hacia la barricada, como quien se pasa el desvío
    const err = norm(Math.atan2(bar.y - v.y, bar.x - v.x) - v.angle);
    sim.step({ steer: Math.max(-1, Math.min(1, err * 3)), throttle: Math.abs(v.speed) < 200 ? 1 : 0, brake: 0, handbrake: false }, DT);
    const snap = sim.getSnapshot();
    hit = snap.events.some((e) => e.type === 'barricade');
    fell = snap.events.some((e) => e.type === 'fall' || e.type === 'offroad_reset');
  }
  check('el ramal cerrado a San Jerónimo es alcanzable y tiene barricada', hit && !fell, hit ? 'barricada golpeada' : 'no llegó a la barricada');
}

// ───────────────────────── 5. Notas de copiloto ─────────────────────────
{
  const track = new Track('real');
  let warned = 0;
  let hairpins = 0;
  for (let i = 0; i < track.points.length - 1; i += 1) {
    const c = track.getCurveAhead(i, track.cumulativeDistances[i], 360);
    if (c && c.severity >= 2) warned++;
    if (c && c.severity === 3) hairpins++;
  }
  const pct = (warned / track.points.length) * 100;
  check('los avisos de curva cerrada/horquilla dejan respirar', pct > 5 && pct < 60, `${pct.toFixed(0)} % del trazado con aviso (a 200 m), ${hairpins} puntos ante horquilla`);
}

console.log(failures === 0 ? '\nNúcleo verificado.' : `\n${failures} comprobación(es) fallida(s).`);
process.exit(failures === 0 ? 0 : 1);
