"""Genera data/research/ruta_candidata_osm.geojson (ACTUALIZADO CON RED HÍDRICA Y PUENTES).

Combina la ruta OSRM sobre datos OSM con puntos candidatos y su nivel de verificación.
Se puede abrir en https://geojson.io o QGIS para revisión visual.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "research"
OUT.mkdir(parents=True, exist_ok=True)

route = json.loads((RAW / "osrm_route_portalO_to_parque.json").read_text(encoding="utf-8"))["routes"][0]
pts = route["geometry"]["coordinates"]

def hav(a, b):
    R = 6371008.8
    la1, lo1, la2, lo2 = map(math.radians, (a[1], a[0], b[1], b[0]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))

cum = [0.0]
for i in range(1, len(pts)):
    cum.append(cum[-1] + hav(pts[i - 1], pts[i]))

def project(p):
    best = min(range(len(pts)), key=lambda i: hav(p, pts[i]))
    return cum[best] / 1000, hav(p, pts[best])

# POIS: (nombre, lon, lat, nivel, fuente/nota, tipo)
POIS = [
    ("Portal occidental del Túnel de Occidente", -75.6868873, 6.3239702, "A-verificado-OSM",
     "Extremo del way OSM 42785427 (túnel, 4.643 m, oneway, Troncal de Urabá).", "portal"),
    ("Puente Quebrada La Negra", -75.68761, 6.32488, "A-verificado-OSM",
     "Puente OSM way 320100749 sobre Quebrada La Negra (OSM 1342496570).", "bridge"),
    ("Puente Quebrada La Volcana", -75.69041, 6.33758, "A-verificado-OSM",
     "Puente OSM way 987576665 sobre Quebrada La Volcana (OSM 320100743).", "bridge"),
    ("Puente Quebrada La Nuez", -75.69234, 6.34005, "A-verificado-OSM",
     "Puente OSM way 987576675 sobre Quebrada La Nuez (OSM 485047287).", "bridge"),
    ("Puente Quebrada La Cáusala", -75.69681, 6.34009, "A-verificado-OSM",
     "Puente OSM way 987576673 sobre Quebrada La Cáusala (OSM 485046448).", "bridge"),
    ("Paso Quebrada La Fonda", -75.70321, 6.34520, "A-verificado-OSM",
     "Quebrada La Fonda (OSM 1326412825).", "stream"),
    ("Puente Quebrada La Potrera", -75.70889, 6.35560, "A-verificado-OSM",
     "Puente OSM way 1094398965 sobre Quebrada La Potrera (OSM 1326412801).", "bridge"),
    ("Sector Quebrada La Miserenga (a 1.7km al este)", -75.69243, 6.360389, "B-nombre-verificado-cruce-pendiente",
     "OSM way 246531444 (waterway=stream). Reserva Volcana Miserenga OSM 557206350.", "reference"),
    ("Cruce hacia Ebéjico (desvío de Vía Medellín–San Jerónimo, Ruta 62)", -75.70865, 6.36107, "B-bifurcación-verificada-nombre-popular-pendiente",
     "Maniobra OSRM / OSM way 1049801659; la vía secundaria se llama «Ebéjico - Ruta 62» en OSM.", "junction"),
    ("Puente vehicular Ebéjico - Ruta 62 (km 8.2)", -75.71302, 6.35142, "A-verificado-OSM",
     "Puente OSM way 1078082723 en curvas de descenso.", "bridge"),
    ("Puente Quebrada La Sucia / La Frisola (km 9.4)", -75.71615, 6.35128, "A-verificado-OSM",
     "Puente OSM way 1078082725 sobre Quebrada La Sucia (OSM 1417134498) y La Frisola (OSM 1066835579). Punto bajo de la cuenca.", "bridge"),
    ("Quebrada Agua de La Peña (km 12.0)", -75.72512, 6.36072, "A-verificado-OSM",
     "Quebrada OSM 1326192716 en ascenso a La Renta.", "stream"),
    ("Vereda La Renta (Ebéjico)", -75.7298, 6.3651, "C-aproximado-vereda-por-vecindad",
     "Localidad OSM 10817144677.", "locality"),
    ("La Suiza / El Brasil (Ebéjico)", -75.7323, 6.3509, "C-aproximado-vereda-por-vecindad",
     "Localidad OSM 703178813 / 703178818.", "locality"),
    ("Paso Quebrada El Patudo (km 17.0, alto de montaña)", -75.7318, 6.3353, "A-verificado-OSM",
     "Quebrada OSM 1417134479 y 1326192737 en cota ≈1.760m.", "stream"),
    ("Puente vehicular Ebéjico - Ruta 62 (km 18.9)", -75.7393, 6.3335, "A-verificado-OSM",
     "Puente OSM way 1095049382.", "bridge"),
    ("Blanquizal (Ebéjico)", -75.7490, 6.3419, "C-aproximado-vereda-por-vecindad",
     "Localidad OSM 10817144678.", "locality"),
    ("Campo Alegre (Ebéjico)", -75.7628, 6.3407, "C-aproximado-vereda-por-vecindad",
     "Localidad OSM 703178640.", "locality"),
    ("Fátima (Ebéjico)", -75.7640, 6.3298, "C-aproximado-vereda-por-vecindad",
     "Localidad OSM 703177191.", "locality"),
    ("Puente Quebrada Juan Ramos (km 25.2)", -75.7637, 6.3280, "A-verificado-OSM",
     "Puente OSM way 470105149 sobre Quebrada Juan Ramos (OSM 1417134445). Entrada a la cabecera.", "bridge"),
    ("Entrada urbana: Calle 19 (Avenida La República)", -75.76475, 6.32642, "B-calle-verificada-OSM",
     "Acceso urbano principal a la cabecera.", "street"),
    ("Parque Principal de Ebéjico (Meta)", -75.768502, 6.3264186, "B-candidato-confirmar-con-comunidad",
     "OSM way 470105159 (leisure=park); nodo place=town en 6.326531,-75.76850.", "destination"),
]

features = [{
    "type": "Feature",
    "properties": {
        "name": "Ruta portal occidental Túnel de Occidente -> Parque Principal de Ebéjico",
        "source": "OpenStreetMap (ODbL) + OSRM routing",
        "length_km": round(cum[-1] / 1000, 2),
        "status": "candidata_verificada"
    },
    "geometry": {"type": "LineString", "coordinates": pts},
}]

print(f"{'km':>6} {'dist_m':>7}  nivel / tipo / nombre")
for name, lon, lat, lvl, note, kind in POIS:
    km, dist = project((lon, lat))
    features.append({
        "type": "Feature",
        "properties": {
            "name": name,
            "type": kind,
            "confidence": lvl,
            "note": note,
            "route_km": round(km, 2),
            "off_route_m": round(dist)
        },
        "geometry": {"type": "Point", "coordinates": [lon, lat]}
    })
    print(f"{km:6.2f} {dist:7.0f}  {lvl[:1]} [{kind:^8}] {name}")

(OUT / "ruta_candidata_osm.geojson").write_text(
    json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, indent=2), encoding="utf-8")
print("\nOK ->", OUT / "ruta_candidata_osm.geojson")
