# Reto Ebéjico: del túnel al pueblo

Videojuego geográfico de contrarreloj de **Mirada Parda** — <https://www.miradaparda.com>  
*«Un proyecto de Mirada Parda. Videojuegos para conocer, explorar y comprender nuestro territorio».*

**Estado:** Prototipo jugable completo (Física de balineras, altimetría Copernicus DEM 3D, ortofoto aérea Google Satellite Zoom 18 libre de nubes, defensas viales bionda y sistema anti-trampas).

---

## 🚀 Inicio Rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor local
npm run dev
# Abrir en el navegador: http://localhost:5173/

# 3. Comprobar tipos TypeScript
npx tsc --noEmit

# 4. Compilar para producción
npm run build
```

---

## 🤖 Continuidad con IA y traspaso de entornos

Si estás abriendo este proyecto en un nuevo entorno de IA (**Claude Code, Antigravity, Cursor, Windsurf, Aider, etc.**):

👉 **Lee primero [`HANDOFF.md`](HANDOFF.md)** para conocer el estado exacto, las decisiones acordadas y la siguiente tarea técnica sin pérdida de contexto ni tokens.

---

## 📚 Documentación de referencia

| Documento | Contenido |
|---|---|
| [`HANDOFF.md`](HANDOFF.md) | **Protocolo de traspaso entre agentes de IA y estado del proyecto** |
| [`PROJECT_PLAN.md`](PROJECT_PLAN.md) | Plan maestro, comparativas técnicas, riesgos, fases y criterios de salida |
| [`SOURCES_AND_LICENSES.md`](SOURCES_AND_LICENSES.md) | Fuentes cartográficas, licencias (ODbL, Copernicus, MIT) y registro de activos |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura modular, monorepo, clasificación antitrampas e integración web |
| [`docs/GEO_RESEARCH.md`](docs/GEO_RESEARCH.md) | Reporte territorial de la ruta (curvatura, perfil, quebradas y toponimia verificada) |

---

## 🗺️ Datos cartográficos verificados

* Visualización de la ruta: [`data/research/ruta_candidata_osm.geojson`](data/research/ruta_candidata_osm.geojson) (puede abrirse en [geojson.io](https://geojson.io) o en QGIS).
* Herramientas de extracción reproducible: [`tools/research/`](tools/research/).

Datos derivados de OpenStreetMap © colaboradores de OpenStreetMap (licencia ODbL 1.0).
