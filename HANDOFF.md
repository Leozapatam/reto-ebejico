# HANDOFF.md — Protocolo de traspaso y continuidad con IA

> **Para el siguiente agente de IA (Claude Code, Antigravity, Cursor, Windsurf, Aider, etc.):**
> Lee este archivo antes de comenzar cualquier tarea. Contiene el estado exacto del proyecto, las decisiones acordadas, la arquitectura y los pasos inmediatos para continuar sin perder contexto ni duplicar trabajo.

---

## 1. Identidad y Misión del Proyecto

* **Proyecto:** Reto Ebéjico: del túnel al pueblo.
* **Organización:** [Mirada Parda — Laboratorio de pensamiento crítico y humanidades digitales](https://www.miradaparda.com).
* **Propósito:** Primer videojuego de la colección abierta de Mirada Parda. Videojuego arcade de contrarreloj que recorre la geografía real desde la salida occidental del Túnel de Occidente hasta el Parque Principal de Ebéjico, Antioquia.
* **Premisa fundamental:** La experiencia debe ser divertida por sí misma (física arcade, ágil, repetible, competitiva). La pedagogía territorial está integrada sin cuestionarios ni interrupciones de texto. Gratuito, abierto, sin publicidad invasiva ni datos personales (cumplimiento estricto de protección de menores).

---

## 2. Estado Actual del Proyecto: Fase 1 Finalizada

| Fase | Estado | Descripción |
|---|---|---|
| **FASE 1: Investigación y Planificación** | **COMPLETA** | Trazado real investigado en OSM, red hídrica identificada, arquitectura definida, licencias registradas y plan maestro documentado. |
| **FASE 2: Prototipo Jugable** | **EN CURSO (Siguiente paso)** | Construir el bucle de juego mínimo: vehículo, física arcade, carretera con curvas, cronómetro, meta y reinicio con pista provisional. |
| **FASE 3: Reconstrucción Geográfica** | Pendiente | Integrar la geometría real de OSM y el modelo digital de elevación GLO-30. |
| **FASE 4: Dirección Visual y Escenarios** | Pendiente | Arte territorial (curvas de nivel, quebradas, cafetales, cabecera municipal). |
| **FASE 5: Clasificación en Línea** | Pendiente | Supabase + Edge Functions con validación de partidas y repetición de entradas. |
| **FASE 6: Pruebas y Publicación** | Pendiente | Optimización móvil, accesibilidad, integración en WordPress vía iframe. |

---

## 3. Decisiones Geográficas y de Diseño Confirmadas

1. **Meta del juego:** Parque Principal de la Cabecera Municipal de Ebéjico (frente a la Alcaldía/Parroquia). El corregimiento de Sevilla queda reservado para futuras expansiones.
2. **Toponimia local confirmada:**
   * **Km 6,19:** El desvío desde la Ruta 62 hacia la vía secundaria a Ebéjico es conocido popularmente como **«Las Partidas»**.
   * **Km 9,43:** El cruce del valle hídrico en el límite entre Medellín (Palmitas) y Ebéjico sobre la Quebrada La Sucia es conocido como **«La Sucia»**.
3. **Perspectiva:** **Arcade 2D con cámara cenital** y seguimiento dinámico (zoom y anticipación hacia el frente).
4. **Motor:** **Phaser 4 + TypeScript + Vite**, con la lógica de física, vehículo y cronómetro en un módulo puro e independiente (`game-core`) sin dependencias de render.
5. **Clasificación:**
   * **Tabla General Competitiva:** controles estándar manuales.
   * **Tabla de Aceleración Asistida:** categoría independiente para jugadores que utilicen ayudas táctiles de accesibilidad.

---

## 4. Estructura de Documentación Clave

* [`PROJECT_PLAN.md`](PROJECT_PLAN.md): Plan maestro, comparativas técnicas, riesgos y roadmap por fases.
* [`SOURCES_AND_LICENSES.md`](SOURCES_AND_LICENSES.md): Licencias de datos (OSM ODbL), relieve (Copernicus DEM), librerías y código (MIT).
* [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): Diagrama del sistema, estructura de carpetas, esquemas de datos y protocolo antitrampas.
* [`docs/GEO_RESEARCH.md`](docs/GEO_RESEARCH.md): Reporte científico de la ruta (26,15 km, 96 curvas, cotas 1.907 m $\rightarrow$ 1.141 m, quebradas y puentes).
* [`data/research/ruta_candidata_osm.geojson`](data/research/ruta_candidata_osm.geojson): Archivo GeoJSON con el trazado continuo y 22 hitos geográficos verificados.

---

## 5. Próxima Tarea: Ejecución de la Fase 2

La siguiente IA o desarrollador debe construir el **Prototipo Jugable (Fase 2)** con la siguiente ruta de implementación:

1. **Setup del Monorepo:**
   * Configurar `package.json` raíz con npm workspaces (`apps/reto-ebejico`, `packages/game-core`, `packages/game-client`, `packages/ui`).
   * Configurar TypeScript (`tsconfig.json`) y bundler Vite con recarga rápida (HMR).
2. **`game-core` (TS puro):**
   * Modelo de vehículo arcade (aceleración progresiva, fricción, giro según velocidad, inercia moderada).
   * Pista de pruebas provisional (rotulada «Pista de pruebas - Fase 2», con curvas suaves, rectas y horquillas cerradas).
   * Sistema de colisión: cálculo de distancia a la polilínea de la carretera (calzada $\rightarrow$ berma $\rightarrow$ fuera de pista con penalización).
   * Cronómetro de precisión basado en pasos de simulación a 60 Hz.
   * Grabador de entradas básico (registro de secuencia para repetición/antitrampas).
3. **`game-client` (Phaser):**
   * Renderizado de la carretera y el vehículo.
   * Cámara cenital suave que sigue al vehículo con anticipación de rumbo.
   * Sistema de entrada desacoplado (flechas del teclado / WASD y soporte básico para toques).
4. **`ui` (Capa DOM sobre el canvas):**
   * HUD con cronómetro visible, velocidad y botón de reinicio inmediato (`R`).
   * Pantalla de meta con tiempo final y botón «Volver a jugar».

---

## 6. Protocolo de Traspaso entre Agentes de IA

Cuando estés trabajando en este proyecto y te acerques al límite de contexto o vayas a cambiar de entorno (por ejemplo, pasar de Antigravity a Claude Code, o viceversa):

### Paso A: Guardar el progreso en el código
Asegúrate de que el código compila y no hay archivos rotos:
```bash
npm run build # o comprobación de TypeScript
```

### Paso B: Actualizar este archivo (`HANDOFF.md`)
Edita la sección **«Última actualización de estado»** al final de este documento indicando:
* Qué acabas de construir.
* Qué archivos creaste o modificaste.
* Cuál es el siguiente paso exacto que debe realizar el nuevo agente.

### Paso C: Hacer commit y push a Git
```bash
git add .
git commit -m "feat(fase-X): descripcion clara de lo avanzado"
git push origin main
```

### Paso D: Prompt para iniciar el nuevo entorno
Copia y pega este mensaje en el nuevo agente de IA:
> *"Estoy continuando el desarrollo del videojuego 'Reto Ebéjico' para Mirada Parda. Por favor lee `HANDOFF.md` y `PROJECT_PLAN.md` para entender el estado actual, y continúa exactamente con la siguiente tarea pendiente indicada en el handoff."*

---

## 7. Registro de Actualizaciones de Estado

### [2026-11-08] — Cierre de Fase 1 e Inicialización del Repositorio
* **Agente:** Antigravity (DeepMind)
* **Logros:**
  * Investigación geográfica completa: ruta real de 26,15 km desde el Túnel de Occidente hasta el Parque Principal de Ebéjico.
  * Verificación de la red hídrica (Quebrada La Sucia, La Frisola, La Potrera, La Negra, Juan Ramos, etc.) y puentes en OSM.
  * Integración de la toponimia oral local («Las Partidas» en el km 6,19 y «La Sucia» en el km 9,43).
  * Arquitectura técnica completa documentada y aprobada.
  * Repositorio Git inicializado con `.gitignore` y documentos maestros.
* **Siguiente paso:** Iniciar la Fase 2 creando la estructura de monorepo npm y el prototipo jugable de conducción.
