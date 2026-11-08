"""Fase 1: reconoce el trazado real con servicios públicos basados en OSM.

1. Geometría del túnel (Nominatim lookup, way 42785427) -> portales E y O.
2. Ruta OSRM (demo pública, SOLO investigación) portal occidental -> parque de Ebéjico.
Guarda resultados en data/raw/ y imprime la secuencia de vías con nombre/ref.
Datos © colaboradores de OpenStreetMap (ODbL).
"""
import json, math, sys, time, urllib.parse, urllib.request
from pathlib import Path

RAW = Path(__file__).resolve().parents[2] / "data" / "raw"
UA = "MiradaParda-RetoEbejico/0.1 (+https://www.miradaparda.com; investigacion educativa)"


def get(url, tries=4):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 + i * 2)
    raise RuntimeError(f"{url}: {last}")


def hav(a, b):
    R = 6371008.8
    la1, lo1, la2, lo2 = map(math.radians, (a[1], a[0], b[1], b[0]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


# 1. Túnel
tun = get("https://nominatim.openstreetmap.org/lookup?osm_ids=W42785427&format=jsonv2&polygon_geojson=1&extratags=1")
(RAW / "tunnel_nominatim.json").write_text(json.dumps(tun, ensure_ascii=False), encoding="utf-8")
geom = tun[0]["geometry"] if "geometry" in tun[0] else tun[0]["geojson"]
coords = geom["coordinates"]
if geom["type"] == "MultiLineString":
    coords = [c for part in coords for c in part]
print("Túnel: tipo", geom["type"], "puntos", len(coords), "tags:", tun[0].get("extratags"))
print("extremo 0 :", coords[0][::-1], " extremo -1:", coords[-1][::-1])
length = sum(hav(coords[i], coords[i + 1]) for i in range(len(coords) - 1))
print(f"longitud geométrica ≈ {length:.0f} m")
west = min((coords[0], coords[-1]), key=lambda c: c[0])
east = max((coords[0], coords[-1]), key=lambda c: c[0])
print("Portal occidental (lat,lon):", west[1], west[0])
print("Portal oriental   (lat,lon):", east[1], east[0])

# 2. Ruta OSRM
park = (-75.768502, 6.3264186)  # candidato: Parque Principal (Fatima/El Zarzal) -- A VERIFICAR
url = (f"https://router.project-osrm.org/route/v1/driving/{west[0]},{west[1]};{park[0]},{park[1]}"
       "?overview=full&geometries=geojson&steps=true&annotations=false&alternatives=false")
route = get(url)
(RAW / "osrm_route_portalO_to_parque.json").write_text(json.dumps(route, ensure_ascii=False), encoding="utf-8")
r = route["routes"][0]
print(f"\nOSRM: {r['distance']/1000:.2f} km, {r['duration']/60:.1f} min (duración orientativa), puntos={len(r['geometry']['coordinates'])}")
print("Secuencia de pasos (acum_km | maniobra | nombre | ref):")
acc = 0
for leg in r["legs"]:
    for s in leg["steps"]:
        acc += s["distance"]
        loc = s["maneuver"]["location"]
        print(f"{acc/1000:6.2f} | {s['maneuver']['type']:<14} {s['maneuver'].get('modifier',''):<12} | {s.get('name') or '-':<38} | {s.get('ref','')} | {loc[1]:.5f},{loc[0]:.5f}")
