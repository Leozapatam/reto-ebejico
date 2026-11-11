# HANDOFF.md — Protocolo de traspaso y continuidad con IA

> **Para el siguiente agente de IA (Claude Code, Antigravity, Cursor, Windsurf, Aider, etc.):**
> Lee este archivo antes de comenzar cualquier tarea. Contiene el estado exacto del proyecto, las decisiones acordadas, la arquitectura implementada y los pasos inmediatos para continuar sin perder contexto ni duplicar trabajo.

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
| **Capa Satelital Real (Google Satellite Zoom 18)** | **COMPLETO** | Ortofoto aérea 100% libre de nubes a lo largo de los 26,15 km (722 teselas locales nítidas en Zoom 18). Calzada continua sin bordillo artificial estridente. Alternable con tecla `[S]` o botón en el HUD. |
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
│           ├── main.ts         # Loop de juego a 60 Hz desacoplado
│           └── style.css       # Paleta institucional de Ebéjico
├── packages/
│   ├── game-core/              # Lógica pura TypeScript (sin DOM)
│   │   ├── vehicle.ts          # Física del Carro de Rodillos (gravedad, derrape, fricción)
│   │   ├── track.ts            # Trazado 3D, splines e interpolación altimétrica
│   │   ├── simulation.ts       # Bucle de juego, antitrampas (3s fuera de pista), penalizaciones
│   │   ├── timer.ts            # Cronómetro de alta precisión
│   │   └── types.ts            # Interfaces y snapshots de estado
│   ├── game-client/            # Renderizado gráfico
│   │   ├── renderer.ts         # Renderizador Canvas 2D/2.5D con hillshading, caídas y chispas
│   │   ├── audio.ts            # Sintetizador Web Audio API (rodamiento de balineras, chispas, viento)
│   │   └── input_manager.ts    # Teclado (Flechas/WASD/Espacio/C/R) y controles táctiles
│   ├── track-data/             # Geometría real generada
│   │   ├── real_route_track.json # 1.472 waypoints (X, Y, Z, elevación, puentes)
│   │   └── test_circuit.json   # Circuito corto de prueba
│   └── ui/                     # Capa visual DOM (HUD)
│       └── hud.ts              # Widget de perfil de relieve, minimapa, cronómetro y alertas
└── tools/                      # Scripts de automatización y pruebas CDP
```

---

## 5. Próximos Pasos Recomendados

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
npm run typecheck # o npx tsc --noEmit

# Compilar para producción
npm run build
```
