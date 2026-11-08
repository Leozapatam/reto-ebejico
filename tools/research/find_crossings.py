"""Identifica cruces de quebradas y puentes a lo largo de la ruta candidata.
Genera data/research/crossings_detected.json con los hallazgos verificados en OSM.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "research"

def hav(a, b):
    R = 6371008.8
    la1, lo1, la2, lo2 = map(math.radians, (a[1], a[0], b[1], b[0]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))

route_data = json.loads((RAW / "osrm_route_portalO_to_parque.json").read_text(encoding="utf-8"))
pts = route_data['routes'][0]['geometry']['coordinates']

cum = [0.0]
for i in range(1, len(pts)):
    cum.append(cum[-1] + hav(pts[i - 1], pts[i]))

osm_data = json.loads((RAW / "q2_road_bridges_streams.json").read_text(encoding="utf-8"))
els = osm_data.get('elements', [])

crossings = []
for e in els:
    geom = e.get('geometry', [])
    if not geom:
        continue
    t = e.get('tags', {})
    is_stream = 'waterway' in t and 'name' in t
    is_bridge = 'bridge' in t and t.get('bridge') == 'yes'
    if not (is_stream or is_bridge):
        continue
    
    min_dist = 999999
    best_idx = 0
    for p in geom:
        coord = (p['lon'], p['lat'])
        for idx, rcoord in enumerate(pts):
            d = hav(coord, rcoord)
            if d < min_dist:
                min_dist = d
                best_idx = idx
                
    if min_dist < 35: # dentro de 35 metros de la calzada
        km = cum[best_idx] / 1000.0
        stream_name = t.get('name', 'Puente sin nombre')
        kind = 'bridge' if is_bridge else 'stream'
        crossings.append({
            'km': round(km, 2),
            'dist_m': round(min_dist, 1),
            'osm_id': e['id'],
            'osm_type': e['type'],
            'kind': kind,
            'name': stream_name,
            'tags': t,
            'coord': [pts[best_idx][0], pts[best_idx][1]]
        })

crossings.sort(key=lambda x: x['km'])

# Filtrar duplicados cercanos del mismo objeto
unique_crossings = []
for c in crossings:
    if not unique_crossings or (abs(c['km'] - unique_crossings[-1]['km']) > 0.05 or c['name'] != unique_crossings[-1]['name']):
        unique_crossings.append(c)

print(f"Cruces y puentes detectados ({len(unique_crossings)} únicos):")
for c in unique_crossings:
    print(f"  km {c['km']:5.2f} (a {c['dist_m']:4.1f}m) | {c['kind'].upper():<7} | {c['name']:<30} | OSM {c['osm_id']}")

(OUT / "crossings_detected.json").write_text(json.dumps(unique_crossings, ensure_ascii=False, indent=2), encoding="utf-8")
print("\nGuardado en data/research/crossings_detected.json")
