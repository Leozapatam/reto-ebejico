# HANDOFF.md — Protocolo de traspaso y continuidad con IA

> **Para el siguiente agente de IA (Claude Code, Antigravity, Cursor, Windsurf, Aider, etc.):**
> Lee este archivo antes de comenzar cualquier tarea. Contiene el estado exacto del proyecto, las decisiones acordadas, la arquitectura implementada y los pasos inmediatos para continuar sin perder contexto ni duplicar trabajo.

> **Estado al 11-nov-2026:** la versión vigente está en la rama **`feat/pulido-fable`** ([PR #1](https://github.com/Leozapatam/reto-ebejico/pull/1) hacia `main`). Trabaja sobre esa rama. Lee primero la **sección 4.1** (qué cambió) y la **sección 5** (qué falta); donde la tabla de la sección 2 contradiga a la 4.1, manda la 4.1.

---

## 1. Identidad y Misión del Proyecto

* **Proyecto:** Reto Ebéjico: del túnel al pueblo.
* **Organización:** [Mirada Parda — Laboratorio de pensamiento crítico y humanidades digitales](https://www.miradaparda.com).
* **Propósito:** Primer videojuego de la colección abierta de Mirada Parda. Videojuego arcade de contrarreloj que recorre la geografía real desde la salida occidental del Túnel de Occidente hasta el Parque Principal de Ebéjico, Antioquia (26,15 km).
* **Vehículo Cultural:** **Carro de Rodillos tradicional de Ebéjico** (chasis de tablones de cedro, 4 balineras de acero, timón de lazo móvil, palanca de freno manual con zapata de caucho y piloto campesino con casco).
* **Premisa fundamental:** Experiencia divertida y ágil (física arcade, repetible, competitiva, sin frustraciones). Pedagogía territorial integrada por observación del paisaje y curvas reales, sin cuestionarios ni interrupciones. Gratuito, abierto, sin publicidad ni recolección de datos personales.

---

## 2. Estado Actual del Proyecto: Hito Fase 2 y 3 Consolidado

| Componente | Estado | Descripción |
|---|---|---|
| **Investigación Geográfica (OSM + Copernicus DEM)** | **COMPLETA** | 26,15 km reales, 1.473 waypoints, cotas 1.907 m $\rightarrow$ 1.141 m, 9 puentes viaductos y desvío de Las Partidas. Tubo de salida del túnel alineado al flujo real de tráfico vehicular hacia Ebéjico. |
| **Monorepo y Arquitectura Modular** | **COMPLETO** | Vite + TypeScript monorepo (`packages/game-core`, `packages/game-client`, `packages/ui`, `apps/reto-ebejico`, `tools/`). |
| **Simulación y Física de Balineras (`game-core`)** | **COMPLETO** | Inercia, derrape, aceleración gravitacional por pendiente Copernicus DEM, rebote elástico contra defensas viales ($e = 0.35$), fricción y chispas de acero. |
| **Defensas Viales y Anti-Trampas (`game-core`)** | **COMPLETO** | **1.334 defensas viales bionda** en curvas y puentes. Búsqueda secuencial estricta `[-5, +8]`. **Caída al barranco:** Desvío $> 28\text{ px}$ reincorpora a pista (+3.0s). **Salto de curva:** Reingreso saltando $> 4$ segmentos reubica al punto previo (+4.0s). Checkpoints secuenciales obligatorios. |
| **Dirección Visual 2D/2.5D Estilizada (`game-client`)** | **COMPLETO** | Canvas 2.5D con inclinación dinámica por pendiente (*tilt*), sombreado cartográfico de laderas (*hillshading*), sombras de precipicio (*caídas*), chispas de balineras y barandas metálicas reflectivas (delineadores rojo/amarillo). Zoom inmersivo 1.45x y escala reducida del carro de rodillos (0.85x). |
| **Capa Satelital Real (Google Satellite Zoom 18)** | **COMPLETO** | Ortofoto aérea 100% libre de nubes a lo largo de los 26,15 km (722 teselas locales Z16–Z18 en `public/assets/satellite/`). Calzada continua sin bordillo artificial estridente. Alternable con tecla `[M]` o botón en el HUD. |
| **HUD Institucional y Altimetría en Vivo (`ui`)** | **COMPLETO** | **Widget izquierdo:** Perfil de relieve en tiempo real (Copernicus DEM) con silueta de cordillera, balinera del jugador e indicador de pendiente (`▼ Bajada %` / `▲ Subida %`). **Widget derecho:** Mapa territorial 26 km. **Top:** Cronómetro, altitud msnm y velocímetro. Conteo gigante `3-2-1-¡ARRANCA!`. |
| **Backend de Clasificación / Ranking (Fase 4/5)** | **Siguiente Paso** | Integración con base de datos pública y validación de repetición de entradas. |
| **Soporte de Sprites e Imágenes PNG/SVG** | **Listo para enriquecer** | Estructura en `apps/reto-ebejico/public/assets/` con fallback vectorial seguro. |

---

## 3. Decisiones Geográficas y de Diseño Confirmadas

1. **Meta del juego:** Parque Principal de la Cabecera Municipal de Ebéjico (1.141 msnm).
2. **Toponimia local confirmada:**
   * **Km 0,00:** Boca Occidental del Túnel de Occidente (1.907 msnm).
   * **Km 6,19:** Desvío **«Las Partidas»** (1.540 msnm), con ramal señuelo cerrado con barricada hacia San Jerónimo.
   * **Km 9,43:** Cruce del valle hídrico **«La Sucia»** (1.300 msnm), límite entre Medellín y Ebéjico.
   * **Km 18,70:** Cumbre de montaña **«Alto de El Patudo»** (1.763 msnm).
   * **Km 26,15:** **Parque Principal de Ebéjico** (1.141 msnm).
3. **Perspectiva Oficial:** **Vista: Adelante (Sur a Norte hacia adelante)** con inclinación dinámica según la pendiente de bajada/subida (tilt 2.5D), zoom inmersivo 1.45x (con soporte de zoom libre con rueda del ratón), y alternancia a *Vista: Norte* con tecla `[C]`.
4. **Vehículo Oficial:** Carro de Rodillos tradicional de balineras (escala calibrada a 0.85x) con chispas de acero sobre el asfalto.
5. **Defensas Viales y Anti-Trampas:**
   * **Defensas metálicas:** Bionda W-beam en curvas y viaductos que rebotan físicamente al carro hacia el centro de la vía.
   * **Caída al abismo:** Salirse más de 28 px de la calzada provoca `⚠️ ¡CAÍDA AL BARRANCO! (+3.0s)` y auto-respawn inmediato.
   * **Salto de curvas:** Saltar entre horquillas cruzando la ladera provoca `🚫 ¡SALTO DE CURVA DETECTADO! (+4.0s)` y reposición al punto previo.
   * **Checkpoints:** Validación secuencial obligatoria para registrar tiempos de paso y cruzar la meta.

---

## 4. Estructura del Código

```text
reto-ebejico/
├── apps/
│   └── reto-ebejico/           # Aplicación principal Vite + HTML5 + CSS institucional
│       ├── public/assets/      # Carpeta para futuros sprites PNG, texturas y assets
│       └── src/
│           ├── main.ts         # Loop a 60 Hz con interpolación, pausa, récord y sobrevuelo del menú
│           ├── records.ts      # Mejor marca, fantasma y ajustes en localStorage
│           └── style.css       # Paleta institucional de Ebéjico
├── packages/
│   ├── game-core/              # Lógica pura TypeScript (sin DOM)
│   │   ├── vehicle.ts          # Física del Carro de Rodillos (gravedad, derrape, fricción)
│   │   ├── track.ts            # Trazado, defensas, curvatura (getCurveAhead), pendiente real, PX_PER_METER
│   │   ├── simulation.ts       # Pasos, sucesos (GameEvent), pausa, defensas, berma/barranco, hitos y meta
│   │   ├── timer.ts            # Cronómetro de alta precisión
│   │   └── types.ts            # Interfaces y snapshots de estado
│   ├── game-client/            # Renderizado gráfico
│   │   ├── renderer.ts         # Canvas 2.5D: vía, defensas, carro, señales, partículas, atmósfera
│   │   ├── satellite_layer.ts  # Ortofoto por teselas (solo la más nítida, carga por cercanía, liberación)
│   │   ├── audio.ts            # Web Audio: balineras, viento, derrape, golpes, avisos
│   │   └── input_manager.ts    # Conducción: teclado, táctil y mando (los atajos de interfaz viven en hud.ts)
│   ├── track-data/             # Geometría real generada
│   │   ├── real_route_track.json # 1.472 waypoints (X, Y, Z, elevación, puentes)
│   │   └── test_circuit.json   # Circuito corto de prueba
│   └── ui/                     # Capa visual DOM (HUD)
│       └── hud.ts              # HUD, pantallas (inicio, pausa, meta), atajos de interfaz, minimapa y perfil
└── tools/                      # test_core.mjs (núcleo sin navegador) + scripts CDP antiguos
```

---

## 4.1 Cambios de la rama `feat/pulido-fable` (11-nov-2026)

* **Corregido:** la meta era inalcanzable (el detector nunca devuelve el último índice; ahora se mide por distancia); `S` frenaba y alternaba el satélite; caídas falsas rodando por la berma; calzada dibujada a 44 px fijos frente a 36/32 px de la física; ramal de Las Partidas tapado por la defensa vial; apoyarse en la bionda no costaba velocidad.
* **Simulación:** sucesos (`GameEvent`) en el snapshot, pausa, pendiente real (`gradePercent`) con gravedad, derrape que cierra el giro, avisos de curva (`Track.getCurveAhead`).
* **Cliente:** renderizador con culling y DPR correcto, carro redibujado, señales viales, partículas, sombras de nubes, sonido de balineras, mando, eventos de puntero táctiles.
* **UI:** inicio con sobrevuelo y perfil real, pausa, resultados con parciales, mejor marca y fantasma en `localStorage` (`apps/reto-ebejico/src/records.ts`).
* **Teclas:** ↑↓←→/WASD · Espacio derrape · F volver a la vía · R reiniciar · P/Esc pausa · C vista · M mapa.
* **Prueba sin navegador:** `node tools/test_core.mjs` (las herramientas CDP de `tools/*.cjs` usan la API anterior).
* **Sin verificar en navegador:** pantalla de meta, fantasma, mapa ilustrado y controles táctiles.
* **Pendiente de decisión:** las teselas son de Google Satellite y `SOURCES_AND_LICENSES.md` excluye esa fuente; las tipografías se cargan desde Google Fonts aunque el mismo documento pide autoalojarlas.

---

## 5. Próximos Pasos Recomendados

**Reglas de trabajo sobre esta versión**
- El estilo vive en `apps/reto-ebejico/src/style.css`. `packages/ui/src/styles.css` no se importa (código muerto).
- `packages/game-client/src/three_renderer.ts` y las dependencias `three`/`phaser` no se usan.
- La interfaz se comunica con la simulación por `snapshot.events`; no compares snapshots para adivinar sucesos.
- `Simulation.step()` ya no devuelve snapshot: usa `getSnapshot()` (entrega y vacía los sucesos).
- Antes de cada commit: `npx.cmd tsc --noEmit`, `node tools/test_core.mjs` y `npm.cmd run build`.

**0. Verificación pendiente en navegador (prioridad)**
   - Pantalla de meta: tiempo, insignia de marca, estadísticas, parciales, «Copiar resultado».
   - Fantasma del mejor tiempo en la segunda bajada y diferencias por hito.
   - Mapa ilustrado (`M`) y vista norte (`C`).
   - Controles táctiles y disposición en pantallas de menos de 900 px y 620 px.
   - Sonido (balineras, golpes, caída, meta) y fluidez real a 60 Hz.
   - Jugabilidad con la gravedad nueva: velocidad máxima en bajada (~109 km/h mostrados) y derrape en horquillas.

**0.1 Deuda conocida**
   - Si las teselas tardan en cargar el fondo queda verde liso: falta un terreno de respaldo bajo la ortofoto.
   - `tools/*.cjs` (CDP) usan la API anterior de `Simulation` y campos privados que ya no existen.
   - Licencias: reemplazar o autorizar las teselas de Google Satellite y autoalojar Cormorant Garamond (ver `SOURCES_AND_LICENSES.md`).

1. **Enriquecimiento Visual con Sprites/Texturas:**
   - Cargar imágenes PNG/WebP transparentes para el Carro de Rodillos, casas campesinas y vegetación desde `apps/reto-ebejico/public/assets/sprites/`.
   - Utilizar `ctx.drawImage()` en `packages/game-client/src/renderer.ts` con el fallback vectorial existente.
2. **Sistema de Clasificación / Leaderboard Online (Fase 4/5):**
   - Conectar con Supabase (`database/schema.sql`).
   - Implementar validación de repetición de entradas (`input_recorder.ts`) en el servidor para evitar trampas en las tablas de récords.
3. **Publicación y Despliegue:**
   - Compilación con `npm run build`.
   - Despliegue estático gratuito (Vercel, GitHub Pages, Netlify o Cloudflare Pages).
   - Inserción en [miradaparda.com](https://www.miradaparda.com) vía iframe responsivo.

---

## 6. Comandos para Ejecución y Respaldo

```bash
# Iniciar servidor local de desarrollo
npm run dev

# Comprobar tipos TypeScript
npx tsc --noEmit

# Probar el núcleo sin navegador
node tools/test_core.mjs

# Compilar para producción
npm run build
```
