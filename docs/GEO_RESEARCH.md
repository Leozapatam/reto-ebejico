# GEO_RESEARCH.md — Reconstrucción geográfica de la ruta (Fase 1)

> **Qué es esto:** los resultados de la investigación geográfica de la Fase 1, con lo comprobado, lo aproximado y lo pendiente.
> **Qué no es:** el trazado final. Todo lo de aquí es **candidato** hasta completar la validación de la Fase 3.
> Reproducible: scripts en `tools/research/`; salidas crudas en `data/raw/`; resultado visualizable en `data/research/ruta_candidata_osm.geojson` (ábrelo en <https://geojson.io> o QGIS).

## 1. Método

1. Se buscaron topónimos con **Nominatim** (OSM) y se obtuvo la geometría exacta del túnel (`way 42785427`).
2. Se calculó una ruta de conducción con **OSRM** (datos OSM) desde el portal occidental hasta el *Parque Principal* de la cabecera. OSRM sirve para **descubrir la secuencia real de vías**, no como producto final.
3. Se remuestreó la ruta cada 100 m para estimar **curvatura** y se consultó la **elevación** (Open-Meteo/Copernicus 90 m) y los **topónimos administrativos** cercanos (Nominatim, geocodificación inversa).
4. Se contrastó con resúmenes web. **Varios resultaron imprecisos o contradictorios** (sección 4); por eso no se usan como evidencia.

## 2. Secuencia verificada de la ruta (candidata)

| km desde portal | Evento / Hito | Coordenadas / Datos | Confianza |
|---|---|---|---|
| 0,00 | **Salida occidental del Túnel de Occidente** | 6,32397 N, −75,68689 O. Túnel: 4.643 m, Troncal de Urabá, calzada única hacia el occidente. Sector Ventiadero, San Sebastián de Palmitas | `verified` (OSM way 42785427) |
| 0,15 | Puente y cruce sobre **Quebrada La Negra** | Puente OSM way 320100749; Quebrada OSM 1342496570 | `verified` |
| 2,11 | Puente y cruce sobre **Quebrada La Volcana** | Puente OSM way 987576665; Quebrada OSM 320100743 | `verified` |
| 2,43 – 2,61 | Puentes sobre **Quebrada La Cola** y **Quebrada La Nuez** | Puentes OSM 987576669, 987576675; Quebradas OSM 485047288, 485047287 | `verified` |
| 3,21 | Puente sobre **Quebrada La Cáusala** | Puente OSM way 987576673; Quebrada OSM 485046448 | `verified` |
| 3,95 | Paso junto a **Quebrada La Fonda** | Quebrada OSM 1326412825 | `verified` |
| 5,57 | Puente sobre **Quebrada La Potrera** | Puente OSM way 1094398965; Quebrada OSM 1326412801 | `verified` |
| ≈ 5,60 | Sector Quebrada y Reserva **La Miserenga** (a 1,7 km al E) | Reserva Volcana Miserenga (OSM 557206350) y Quebrada La Miserenga (OSM 246531444) | nombre `verified` cartografía |
| **6,19** | **Las Partidas (Desvío hacia Ebéjico)**: bifurcación tradicional desde la Vía Medellín–San Jerónimo (Ruta 62) hacia la vía secundaria «Ebéjico - Ruta 62» | 6,36107 N, −75,70865 O (OSM way 1049801659). Conocido localmente por la comunidad como **«Las Partidas»** | `verified` (cartografía + tradición oral local) |
| 8,23 | Puente vial en sector de curvas pronunciadas | Puente OSM way 1078082723 sobre vía Ebéjico - Ruta 62 | `verified` |
| **9,43** | **Cruce La Sucia**: valle hídrico y límite con Medellín/Palmitas. Quebrada La Sucia y Quebrada La Frisola (cota ≈ 1.300 m) | Puente OSM way 1078082725; Quebrada La Sucia OSM 1417134498. Punto geográfico y toponímico clave conocido como **«La Sucia»** | `verified` (cartografía + tradición oral local) |
| ≈ 10,0 – 10,5 | Límite municipal Medellín – Ebéjico | Entrada plena al territorio ebejicano por El Brasil / La Suiza | `verified` |
| 11,72 – 12,04 | Cruce de **Quebrada La Quebradita** y **Quebrada Agua de La Peña** | Quebradas OSM 1326192714, 1326192716; ascenso hacia La Renta | `verified` |
| 12,0 – 15,0 | Veredas **La Renta** y **La Suiza** | Sector rural montañoso, cota 1.470 m – 1.680 m | `approximate` |
| 16,95 – 17,20 | Paso sobre **Quebrada El Patudo** (alto de montaña, cota ≈ 1.760 m) | Quebrada OSM 1417134479 y 1326192737; divisoria de aguas | `verified` |
| 18,0 – 22,0 | Veredas **Las Brisas**, **Blanquizal** y **Campo Alegre** | Veredas reconocidas por ecoturismo y agricultura | `approximate` |
| 18,92 | Puente vial en descenso montañoso | Puente OSM way 1095049382 | `verified` |
| 24,0 – 25,0 | Vereda **La Holanda** y vereda **Fátima** | Descenso hacia la cabecera municipal | `approximate` |
| **25,17** | **Puente sobre Quebrada Juan Ramos** | Puente OSM way 470105149; Quebrada Juan Ramos OSM 1417134445 (afluente directo de la cabecera) | `verified` |
| 25,65 | Entrada urbana por **Calle 19** (Avenida La República) → Calle 20 → Carrera 20 | Trama vial urbana de Ebéjico | `verified` |
| **26,15** | **Llegada: Parque Principal de Ebéjico (Cabecera Municipal)** | ≈ 6,32642 N, −75,76850 O (OSM way 470105159; nodo town n703177193). Meta oficial confirmada frente a la iglesia y la alcaldía. *(Sevilla queda reservado para expansiones)* | `verified` (meta oficial) |

**Total:** ≈ **26,1 km** y un descenso neto de ≈ **766 m** (de ≈ 1.907 m a ≈ 1.141 m).

### Perfil de elevación (exploratorio, DEM 90 m, cada 2 km)
```
m   1900 ┤█ ·
         │ █  ·
    1700 ┤  ██▄·            ▄▄▄▄█▄ (km 15-17, alto ≈ 1.763 m)
         │    ▀██▄        ▄█▀   ▀█▄
    1500 ┤       ▀█▄    ▄▀         ▀█▄
         │         ▀██▄▀              ▀█▄
    1300 ┤          ·  (valle ≈ 1.300 m, km 9-11)  ▀█▄
    1141 ┤                                            ▀▄ Ebéjico
         └────────────────────────────────────────────
           0     5     10     15     20     25  km
```
Lectura: **bajada fuerte** (km 0–9) → **valle** (≈ 1.300 m, km 9–11; candidato a cruce de río/quebrada, `pending`) → **subida** (≈ +460 m hasta el alto de km 15–17) → **bajada final** a la cabecera. Es un perfil con carácter propio, ideal para el diseño (frenadas en bajada, tramo de esfuerzo en subida, final rápido).

> Limitación: el DEM de 90 m **suaviza** cortes y rellenos de carretera; los 2.435 m de ascenso y 3.197 m de descenso acumulados calculados están **inflados por ruido** de muestreo. Para pendientes locales se usará GLO-30 y suavizado.

## 3. Curvatura (exploratoria)

Con remuestreo a 100 m: **96 curvas** con giro acumulado ≥ 25°, de ellas **46 ≥ 60°** y **17 ≥ 120° (tipo horquilla)** en 26 km (≈ 3,7 curvas relevantes/km).
Implicación de diseño: la ruta es **muy sinuosa**; no hace falta inventar curvas, hay que **seleccionar y jerarquizar** (ver «compresión» en `PROJECT_PLAN.md`). Cifras sujetas a la resolución del remuestreo (100 m puede fusionar curvas cortas).

## 4. Discrepancias detectadas (por qué no se usan resúmenes web como prueba)

| Afirmación en resúmenes web | Lo que muestran los datos OSM | Decisión |
|---|---|---|
| El cruce a Ebéjico/La Miserenga estaría «a 13–15 km de la salida del túnel, km 17–19 de la concesión» | El desvío está a **≈ 6,2 km** de la salida del túnel | Se descarta; se usa OSM |
| «Parque Principal» de Ebéjico en 6,2939 N, −75,7850 O | Esas coordenadas corresponden al parque de **Sevilla** (otro corregimiento, «Balconcito de Occidente»). El de la **cabecera** está en ≈ 6,3264 N, −75,7685 O | Se usa el de la cabecera; **confirmar con Mirada Parda** |
| Que el cruce se llama «La Miserenga» | OSM nombra una **quebrada** y una **reserva** «La Miserenga», pero no un cruce; la quebrada está a ≈ 1,7 km de la vía | Se trata como `pending` hasta verificar por fuente local/oficial |

## 5. Lo que SÍ quedó verificado y lo que queda PENDIENTE

### Elementos verificados con fuentes primarias (OSM / ODbL)
1. **Trazado vial continuo** desde la salida del túnel hasta el casco urbano de Ebéjico (OSM ways 42785427, 1049801659, 1078082722–1078082725, 234939350, 1095049381–1095049382, 470105148–470105149).
2. **Red de quebradas y puentes verificada:**
   - Tramo nacional: Quebrada La Negra (km 0,15), La Volcana (km 2,11), La Cola (km 2,43), La Nuez (km 2,61), La Cáusala (km 3,21), La Fonda (km 3,95), La Potrera (km 5,57).
   - Tramo ebejicano: Quebrada La Frisola y La Sucia (km 9,43 con puente vehicular), Quebrada La Quebradita (km 11,72), Agua de La Peña (km 12,04), El Patudo (km 16,95–17,20), y Quebrada Juan Ramos (km 25,17 con puente en la antesala de la cabecera).
3. **Malla de acceso urbano:** Calle 19 (Avenida La República) conectando con el Parque Principal.

### Lo que aún NO se pudo verificar (y no se inventa)
1. **Nombre popular exacto del cruce** de la Ruta 62 hacia la vía de Ebéjico (¿la comunidad lo llama localmente «El Desvío», «La Miserenga», o «El Empalme»?). Requiere confirmación con habitantes de Ebéjico.
2. **Límites veredales oficiales de alta precisión** (polígonos SIG del DANE/IGAC para delimitar con exactitud milimétrica el paso de una vereda a otra).
3. **Cobertura de cultivos específica por finca** (diferenciación exacta entre cafetales, cañaduzales y pastos a nivel de parcela; se abordará en la Fase 3 con ayuda de la comunidad).
4. **Construcciones y fondas tradicionales específicas** a la orilla del camino. No se colocará ninguna fonda con nombre propio ficticio.

## 6. Plan de validación geográfica (se ejecuta en la Fase 3)

1. Descargar extracto OSM de Colombia (Geofabrik) → recortar caja de la ruta → reconstruir la cadena de *ways* **sin depender de OSRM**.
2. Comparar con la ruta OSRM (distancia máxima entre trazados < 15 m en > 98 % de la longitud).
3. Intersectar con *waterways* y puentes → tabla de cruces (`crossings.json`).
4. Cruzar con límites DANE/IGAC → veredas y límite municipal reales.
5. Calcular elevación/pendiente con GLO-30 suavizado.
6. **Revisión comunitaria:** enviar el GeoJSON + lista de POIs a docentes/estudiantes de Ebéjico para corregir nombres. Registrar cada corrección y su fuente en `SOURCES_AND_LICENSES.md`.
