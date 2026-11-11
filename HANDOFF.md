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
* **Terreno de respaldo bajo la ortofoto:** se implementó `drawSatelliteFallback()` en `packages/game-client/src/renderer.ts`. Dibuja relieve montañoso determinista, manchas de cañadas/bosque, curvas de nivel sutiles y el desmonte/corte/terraplén de la vía en coordenadas de mundo antes de pintar las teselas satelitales. Elimina el fondo verde liso mientras las teselas descargan o en bordes de cobertura.
* **UI:** inicio con sobrevuelo y perfil real, pausa, resultados con parciales, mejor marca y fantasma en `localStorage` (`apps/reto-ebejico/src/records.ts`).
* **Teclas:** ↑↓←→/WASD · Espacio derrape · F volver a la vía · R reiniciar · P/Esc pausa · C vista · M mapa.
* **Prueba sin navegador:** `node tools/test_core.mjs` verificado (5 suites del núcleo aprobadas).
* **Verificación exhaustiva en navegador (Edge headless + CDP):**
  - **Pantalla de meta:** completada con tiempo final (`00:43.13`), insignia `Nueva marca personal`, estadísticas de carrera, tabla de parciales e interacción del botón «Copiar resultado» al portapapeles.
  - **Carro fantasma y deltas:** segunda bajada (`00:39.98`) con fantasma renderizado durante toda la carrera, cálculo y renderizado del indicador delta en cada hito y delta final en meta (`−3.15 s`).
  - **Alternancia de vista:** tecla `M` alterna fielmente entre ortofoto satelital y mapa vectorial ilustrado; tecla `C` alterna entre cámara `chase` y orientación norte `north`.
  - **Responsividad y táctil:** verificado en anchos menores a 900 px (panel de elevación oculto, velocímetro reposicionado) y menores a 620 px (encabezado en 2 filas, cronómetro centrado, barra de progreso desplazada a 108 px). Con puntero táctil (`pointer: coarse`), controles táctiles visibles e interactivos y HUD inferior reposicionado a 124 px para evitar solapamientos.
  - **Sonido y fluidez:** Web Audio context activo con nodos osciladores/ruido, 60 FPS estables con tiempo de render de 0.5 ms por cuadro.
  - **Física y gravedad:** velocidad máxima en bajada comprobada a 109 km/h y derrape responsivo en horquillas y curvas cerradas.
* **Ampliación sustancial de la vía y encuadre estable del carro:** se aumentó el zoom base de mundo a `2.1` para que la carretera y el entorno sean grandes y legibles en pantalla (calzada > 92 px), con el carro escalado a `CART_SCALE = 0.28` (~12.5 px de ancho en mundo, ~26 px en pantalla), ocupando menos de una tercera parte de la calzada para permitir amplia maniobra. Se corrigió el problema donde el carro se perdía de vista por abajo al acelerar: el encuadre se centró en `anchorY = H * 0.58` y la anticipación de velocidad se acotó en píxeles de pantalla (`maxScreenShift = 50`), garantizando que el carro permanezca siempre visible entre el 58% y el 64% de la altura de la pantalla a cualquier velocidad.
* **Recalibración de puentes y viaductos sobre ortofoto satelital:** auditoría visual exhaustiva de los 11 puentes en `packages/track-data/real_route_track.json` y `tools/geo-pipeline/build_real_track.py`. La generación anterior aplicaba un desplazamiento simétrico tosco (`range(-3, 4)`) alrededor de coordenadas POI aproximadas de OSM, dejando puentes dibujados sobre laderas secas o cortados a la mitad de los viaductos. Se ajustaron con exactitud los 11 vanos a las estructuras físicas y cauces visibles en Google Satellite:
  - *Puente 0 (Puente Quebrada La Negra, km 0.3):* vano ampliado de [6..12] a **[5..14]** (cubre estribos completos desde la boca del túnel hasta la curva).
  - *Puente 1 (Puente Quebrada La Volcana, km 2.0):* ajustado de [112..118] a **[115..121]** (alineado con la cañada rocosa de la quebrada).
  - *Puente 2 (Puente Quebrada La Nuez, km 2.6):* vano ampliado de [140..146] a **[142..151]** (alineado simétricamente con el viaducto paralelo adyacente).
  - *Puente 3 (Puente Quebrada La Cáusala, km 3.0):* corregido de [167..173] a **[168..175]** sobre el abismo de la quebrada.
  - *Puente 4 (Puente Quebrada La Potrera, km 5.5):* vano ampliado de [306..312] a **[307..316]** (recorre toda la curva del viaducto).
  - *Puente 5 (Puente vehicular Ebéjico - Ruta 62, km 8.8):* desplazado de [494..500] a **[497..504]** directamente sobre el cauce del río.
  - *Puente 6 (Puente Quebrada La Sucia / La Frisola, km 9.4):* ajustado de [560..566] a **[563..568]** sobre el paso fluvial.
  - *Puente 7 (Quebrada Agua de La Peña, km 12.0):* reubicado de [673..679] (recta previa) a **[676..683]** (vértice de la horquilla donde cruza el torrente).
  - *Puente 8 (Paso Quebrada El Patudo, km 17.0):* ajustado de [955..961] a **[958..962]** en el pontón del alto de montaña.
  - *Puente 9 (Puente vehicular Ebéjico - Ruta 62, km 18.9):* ajustado de [1010..1016] a **[1012..1017]** sobre la cañada antes de la curva.
  - *Puente 10 (Puente Quebrada Juan Ramos, km 25.2):* ajustado de [1428..1434] a **[1430..1436]** en el paso del río a la entrada urbana de Ebéjico.
* **Capa satelital y avisos de interfaz:** se confirmó que las 722 teselas y el subsistema satelital funcionan al 100%. Para evitar confusiones cuando el jugador alterna la capa con la tecla `M` o el botón de la cabecera, se incorporó un aviso flotante (toast) inmediato en pantalla (`🛰️ Ortofoto satelital activa` / `🗺️ Mapa ilustrado`) e indicación de vista (`🧭 Vista norte` / `🏎️ Vista hacia adelante`).
* **Módulo de Turismo y Pedagogía Territorial:** se implementó el modo **Turismo** en el menú de inicio (`optTour`) junto a *Ruta real* y *Práctica*. Permite recorrer la ruta real de 26,15 km descubriendo el patrimonio territorial y cultural de la antigua vía a Ebéjico:
  - *Base de datos de 14 hitos turísticos:* [`packages/game-core/src/tourist_spots.ts`](packages/game-core/src/tourist_spots.ts) con coordenadas GPS reales (lat/lon), altitud (msnm), categoría patrimonial, reseña histórica/territorial detallada y enlaces directos a Google Maps.
  - *Sugerencia interactiva en carrera:* al aproximarse a cualquier hito (a ~150 m), el HUD despliega una tarjeta flotante animada (`hud-tour-card`) con el nombre, distancia, altitud, botón directo a Google Maps y acceso a la ficha completa con tecla `[T]` o clic.
  - *Ficha Patrimonial y Guía Territorial:* modal dialog accesible en cualquier momento que pausa el juego y presenta la historia del lugar, coordenadas geográficas exactas, botón de apertura en Google Maps (`https://www.google.com/maps/search/?api=1&query=lat,lon`) y un desplegable con los 14 lugares de la ruta indicando los hitos visitados.
  - *Persistencia de descubrimientos:* los lugares visitados se guardan localmente en `localStorage` (`reto-ebejico:tourism:visited:v1`), actualizando el contador de progreso en el HUD y en el menú principal (`X/14 hitos descubiertos`).
* **Pendiente de decisión:** las teselas son de Google Satellite y `SOURCES_AND_LICENSES.md` excluye esa fuente; las tipografías se cargan desde Google Fonts aunque el mismo documento pide autoalojarlas.

---

## 5. Próximos Pasos Recomendados

**Reglas de trabajo sobre esta versión**
- El estilo vive en `apps/reto-ebejico/src/style.css`. `packages/ui/src/styles.css` no se importa (código muerto).
- `packages/game-client/src/three_renderer.ts` y las dependencias `three`/`phaser` no se usan.
- La interfaz se comunica con la simulación por `snapshot.events`; no compares snapshots para adivinar sucesos.
- `Simulation.step()` ya no devuelve snapshot: usa `getSnapshot()` (entrega y vacía los sucesos).
- Antes de cada commit: `npx.cmd tsc --noEmit`, `node tools/test_core.mjs` y `npm.cmd run build`.

**0.1 Deuda técnica y licencias**
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
