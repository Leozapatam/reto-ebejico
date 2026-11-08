# SOURCES_AND_LICENSES.md — Reto Ebéjico

> Estado: **Fase 1 (investigación)**. Fecha de consulta de las fuentes: 8 de noviembre de 2026.
> Este documento es **vivo**: cada dato, imagen, sonido, fuente tipográfica o librería que entre al proyecto debe registrarse aquí **antes** de fusionarse.
> No es asesoría legal. Las licencias marcadas **«verificar»** deben confirmarse en la fuente primaria antes de publicar.

## 0. Cómo se clasifica la información

Todo dato del juego lleva una etiqueta de fidelidad (se guardará en los JSON de datos, ver `ARCHITECTURE.md`):

| Etiqueta | Significado | Ejemplo |
|---|---|---|
| `verified` | Comprobado en una fuente primaria o abierta, con identificador citable | Geometría del túnel (OSM way 42785427) |
| `approximate` | Derivado de datos reales pero simplificado, interpolado o asociado por cercanía | Vereda asignada por geocodificación inversa |
| `fictional` | Elemento artístico o de jugabilidad sin pretensión de ser real | Un derrumbe, una chiva, un cañaduzal decorativo |
| `pending` | Hipótesis por verificar. **No se publica como hecho** | Que el cruce se llame «La Miserenga» |

## 1. Fuentes geográficas

| Fuente | Qué aporta | Licencia / condiciones | Atribución exigida | Estado de uso |
|---|---|---|---|---|
| **OpenStreetMap** (datos) | Trazado vial, nombres de vías, quebradas, límites, parques | **ODbL 1.0**. Los *derivados de base de datos* (p. ej. nuestro GeoJSON de la ruta) deben ofrecerse bajo ODbL. Los *productos* (render, juego) pueden tener otra licencia | «© OpenStreetMap contributors» + enlace a <https://www.openstreetmap.org/copyright> | **Usada** en la investigación; fuente principal del trazado |
| **Nominatim** (servicio público de OSM) | Búsqueda de topónimos y geocodificación inversa | Política de uso: ≤1 petición/s, `User-Agent` identificable, sin masividad, resultados cacheados | Ídem OSM | Usada con límite de tasa. **No** se usará en tiempo de ejecución del juego |
| **OSRM demo** (`router.project-osrm.org`) | Ruta de conducción calculada sobre datos OSM, para *orientarnos* | Servidor de demostración, solo uso razonable; **no apto para producción** | Ídem OSM | Solo investigación. La ruta final se reconstruirá con nuestro propio proceso a partir de los *ways* OSM |
| **Overpass API** (OSM) | Extracción de *ways*, puentes, cruces, cursos de agua | Datos ODbL; instancias públicas con cuotas | Ídem OSM | Intentada; las instancias públicas estaban saturadas/expiradas durante la sesión (ver `docs/GEO_RESEARCH.md`). Alternativa: extracto de **Geofabrik** (`colombia-latest.osm.pbf`) procesado localmente |
| **Copernicus DEM GLO-30** | Modelo digital de elevación de 30 m para perfil, pendientes y curvas de nivel | Licencia Copernicus: uso libre (incluso comercial) con atribución. Alojado en el *AWS Open Data Registry* (`copernicus-dem-30m`), sin cuenta | Texto oficial vigente: **verificar** (ver guía del producto). Fórmula orientativa: «Copernicus DEM — © DLR e.V. 2010-2014 y © Airbus Defence and Space GmbH 2014-2018, suministrado bajo licencia de la Unión Europea y la ESA» | **Planificada** para producción (descarga y proceso *offline*, se publican solo derivados) |
| **Open-Meteo Elevation API** | Altitudes puntuales (derivadas de Copernicus) | Datos CC BY 4.0; API gratuita para uso **no comercial** | «Open-Meteo.com» | **Solo investigación** (perfil exploratorio). No se usará en producción: el proyecto admite donaciones y no queremos ambigüedad comercial |
| **SRTM** (NASA/USGS) | DEM alternativo/validación cruzada | Dominio público (EE. UU.) | Cortesía: «NASA/USGS SRTM» | Opcional (validación) |
| **ESA WorldCover 10 m** | Cobertura del suelo (bosque, cultivos, pasto, zona construida) para elegir paisajes por tramo | **CC BY 4.0** | «© ESA WorldCover project / Contains modified Copernicus Sentinel data processed by ESA WorldCover consortium» | **Planificada** (Fase 3). Útil, pero 10 m no distingue cafetal de cañaduzal: eso requerirá fuente local o validación en campo |
| **Sentinel-2** (Copernicus) | Imagen satelital libre, solo como **referencia visual** para dibujar a mano | Libre y abierta con atribución | «Contains modified Copernicus Sentinel data [año]» | Referencia; **no** se incrusta como textura (el estilo es vectorial/ilustrado) |
| **Mapillary** (fotos a nivel de calle) | Referencia visual de señales y paisaje | CC BY-SA 4.0 (imágenes) | Autor + Mapillary | Solo referencia de dibujo. **No** se incorporan imágenes al juego |
| **DANE – Marco Geoestadístico Nacional (MGN)** | Límites oficiales de departamento, municipio, corregimiento y vereda | **Verificar** licencia de cada capa (portal geoportal.dane.gov.co / datos.gov.co) | Según capa | **Prioritaria** para confirmar el límite Medellín–Ebéjico y las veredas por las que pasa la vía |
| **IGAC – Colombia en Mapas / cartografía básica** | Cartografía oficial 1:25.000 / 1:100.000, hidrografía | **Verificar** licencia y términos por conjunto | Según capa | Contraste de quebradas y toponimia |
| **Gobernación de Antioquia / Alcaldía de Ebéjico** (EOT, PBOT/POT, planes de desarrollo) | Documentos territoriales, veredas, corregimientos | Documentos públicos; **verificar** términos de reutilización | Cita del documento | Fuente documental para toponimia y cabecera |
| **Wikipedia** | Solo *verificación cruzada* de datos generales (altitud, coordenadas) | CC BY-SA 4.0 | — | **No se copia texto**; los datos se confirman en fuente primaria |

### Fuentes excluidas explícitamente
* **Google Maps / Google Earth / Street View**: no se descargan imágenes ni se calcan sus trazados como textura (sus condiciones de uso lo impiden). Pueden consultarse a ojo para orientarse, pero **ningún dato entra al proyecto por esa vía**.
* **Resúmenes de buscadores y blogs turísticos** como *prueba* de datos geográficos: se probó que algunos son imprecisos (ver discrepancias en `docs/GEO_RESEARCH.md`). Sirven de pista, nunca de evidencia.

## 2. Datos geográficos ya verificados en la Fase 1

| Dato | Valor | Fuente concreta | Etiqueta |
|---|---|---|---|
| Túnel de Occidente (Fernando Gómez Martínez), longitud | ≈ **4.643 m** (suma de la geometría), 2 carriles, un solo sentido, 60 km/h, asfalto | OSM way **42785427** (vía Nominatim `lookup`) | `verified` |
| Portal occidental | **6,32397 N, −75,68689 O** (extremo del *way*) | OSM way 42785427 | `verified` |
| Portal oriental | 6,29751 N, −75,65441 O | OSM way 42785427 | `verified` |
| Ruta portal occidental → Parque Principal de Ebéjico | **≈ 26,1 km** por carretera | OSRM sobre datos OSM | `approximate` (hay que reconstruirla desde los *ways*) |
| Altitud de Ebéjico (cabecera) | ≈ 1.141 m (DEM 90 m) vs. ≈ 1.150 m (Wikipedia) | Open-Meteo/Copernicus + contraste | `approximate` |
| Quebrada La Miserenga | existe como *waterway* en OSM (way 246531444) | OSM | `verified` (existencia y nombre); cruce con la vía `pending` |
| Quebradas cruzadas en la vía nacional (Ruta 62) | La Negra (km 0,15), La Volcana (km 2,11), La Cola (km 2,43), La Nuez (km 2,61), La Cáusala (km 3,21), La Fonda (km 3,95), La Potrera (km 5,57) con sus respectivos puentes | OSM ways 1342496570, 320100743, 485047288, 485047287, 485046448, 1326412825, 1326412801 y puentes asociados | `verified` |
| Cruce vial hacia Ebéjico | Bifurcación en 6,36107 N, −75,70865 O (km 6,19 desde el portal) | OSM way 1049801659 / maniobra de enrutamiento | `verified` (geometría); nombre popular `pending` |
| Quebradas y puentes en la vía a Ebéjico | Quebrada La Sucia y La Frisola (km 9,43 con puente vehicular OSM 1078082725), Quebrada Agua de La Peña (km 12,04), Quebrada El Patudo (km 17,0), Quebrada Juan Ramos (km 25,17 con puente OSM 470105149) | OSM ways 1417134498, 1066835579, 1326192716, 1417134479, 1417134445 | `verified` |
| Acceso urbano y Parque Principal | Calle 19 / Avenida La República conectando a Parque Principal de la cabecera (OSM way 470105159, n703177193) | OSM | `verified` (existencia); meta formal `pending` confirmación |

La lista completa de puntos candidatos con su nivel de confianza está en `data/research/ruta_candidata_osm.geojson` y en `docs/GEO_RESEARCH.md`.

## 3. Software y servicios (previstos)

| Componente | Versión verificada en npm (8-nov-2026) | Licencia |
|---|---|---|
| Phaser | 4.2.1 (alternativa: rama 3.x) | MIT |
| Vite | 8.3.6 | MIT |
| TypeScript | 7.0.2 | Apache-2.0 |
| Vitest | 5.1.0 | MIT |
| @supabase/supabase-js | 2.119.0 | MIT |
| Supabase (servicio / Postgres) | — | Condiciones del servicio de Supabase; Postgres: PostgreSQL License |
| Cloudflare Turnstile (antibots) | — | Servicio gratuito; **verificar** términos y privacidad (menores). Alternativa autoalojada: **Altcha** (prueba de trabajo, sin rastreo de terceros) |

Se fijarán versiones exactas con *lockfile*; el listado definitivo se generará automáticamente (`npm ls --all` + `license-checker`) en la Fase 6.

## 4. Tipografías (autoalojadas, sin CDN de terceros — privacidad de menores)

| Uso | Fuente | Licencia |
|---|---|---|
| Títulos editoriales (coherente con el portal, que ya usa Cormorant Garamond / Georgia) | Cormorant Garamond | SIL OFL 1.1 |
| HUD, botones, tabla | Una sans legible con cifras tabulares (candidata: *IBM Plex Sans* / *Inter*) | SIL OFL 1.1 |
| Cronómetro | Cifras tabulares monoespaciadas (candidata: *IBM Plex Mono*) | SIL OFL 1.1 |

## 5. Arte, audio y mapas del juego

* El arte se **produce originalmente** (vectorial/ilustrado) o proviene de paquetes **CC0** (p. ej. Kenney, OpenGameArt-CC0).
* El audio se produce originalmente o es CC0; se evita CC BY-NC (incompatible con la posibilidad de donaciones).
* Los mapas del resultado y de la pantalla inicial se **generan desde nuestro GeoJSON** como SVG propio. No se usan teselas de terceros en producción (la política de teselas de OSM no permite uso intensivo y evitamos dependencias).

### Registro de activos (plantilla — rellenar con cada incorporación)

| ID | Tipo | Origen (URL o «original») | Autor | Licencia | Atribución requerida | Modificado | Fecha |
|---|---|---|---|---|---|---|---|
| _(vacío en Fase 1)_ | | | | | | | |

## 6. Licenciamiento propuesto para el proyecto (para decisión de Mirada Parda)

| Parte | Propuesta | Razón |
|---|---|---|
| Código del juego y herramientas | **MIT** (o Apache-2.0) | Permite reutilizar en la colección de juegos y que otras personas aprendan de él |
| Datos geográficos derivados de OSM (`packages/track-data`) | **ODbL 1.0** + atribución | Obligatorio por *share-alike* de OSM |
| Arte, textos y sonidos originales | **CC BY 4.0** o CC BY-SA 4.0 | Abierto y reutilizable en escuelas |
| Marca «Mirada Parda» y logotipo | Reservados | Identidad institucional |

## 7. Texto de créditos del juego (borrador)

> **Un proyecto de Mirada Parda. Videojuegos para conocer, explorar y comprender nuestro territorio.** — <https://www.miradaparda.com>
> Mapa: © contribuidores de OpenStreetMap (ODbL). Relieve: Copernicus DEM. Cobertura: ESA WorldCover (CC BY 4.0). Tipografías: SIL OFL. El juego es gratuito; el apoyo voluntario no desbloquea ventajas.
> El recorrido es una **representación simplificada**; sus elementos decorativos son ficticios. Los datos marcados como aproximados se identifican en la pantalla de fuentes.

## 8. Pendientes de verificación legal y de fuentes

1. Confirmar texto de atribución vigente de Copernicus DEM GLO-30 y WorldCover.
2. Confirmar licencia de las capas DANE/IGAC que se usen (límites municipales y veredales).
3. Confirmar términos de Cloudflare Turnstile para menores o sustituirlo por Altcha.
4. Revisión legal de la política de privacidad frente a la **Ley 1581 de 2012** y su Decreto 1377 de 2013 (datos de niños, niñas y adolescentes): el diseño parte de **no recolectar datos personales**.
5. Decidir licencia del código y del contenido (sección 6).
