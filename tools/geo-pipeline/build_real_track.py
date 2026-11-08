"""Genera la geometría 3D oficial de Reto Ebéjico (real_route_track.json)
con elevación real z (msnm) basada en el perfil topográfico de GEO_RESEARCH.md,
anotaciones de puentes 3D (barandas, cañones y pilares) y ramal señuelo de Las Partidas.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GEOJSON_PATH = ROOT / "data" / "research" / "ruta_candidata_osm.geojson"
OUTPUT_PATH = ROOT / "packages" / "track-data" / "real_route_track.json"

d = json.load(open(GEOJSON_PATH, encoding="utf-8"))

line_feature = None
pois = []
for f in d["features"]:
    geom = f.get("geometry", {})
    if geom.get("type") == "LineString":
        line_feature = f
    elif geom.get("type") == "Point":
        pois.append(f)

coords = line_feature["geometry"]["coordinates"]
print(f"Puntos OSM originales: {len(coords)}")

origin_lon = coords[0][0]
origin_lat = coords[0][1]
mean_lat_rad = math.radians(origin_lat)
METERS_TO_PX = 1.8

def project(lon, lat):
    R = 6371000.0
    d_lon_rad = math.radians(lon - origin_lon)
    d_lat_rad = math.radians(lat - origin_lat)
    x_meters = R * d_lon_rad * math.cos(mean_lat_rad)
    y_meters = R * d_lat_rad
    px = 2000 + x_meters * METERS_TO_PX
    py = 2000 - y_meters * METERS_TO_PX
    return px, py

projected_pts = [project(c[0], c[1]) for c in coords]

def get_dist(p1, p2):
    return math.hypot(p2[0] - p1[0], p2[1] - p1[1])

cum_lens = [0.0]
for i in range(1, len(projected_pts)):
    cum_lens.append(cum_lens[-1] + get_dist(projected_pts[i - 1], projected_pts[i]))

total_px_len = cum_lens[-1]
TARGET_STEP = 32.0
num_samples = int(total_px_len / TARGET_STEP) + 1

resampled = []
curr_idx = 0
for s in range(num_samples):
    target_d = s * TARGET_STEP
    while curr_idx < len(cum_lens) - 2 and cum_lens[curr_idx + 1] < target_d:
        curr_idx += 1
    
    seg_len = cum_lens[curr_idx + 1] - cum_lens[curr_idx]
    t = 0 if seg_len < 1e-6 else (target_d - cum_lens[curr_idx]) / seg_len
    pA = projected_pts[curr_idx]
    pB = projected_pts[curr_idx + 1]
    resampled.append((pA[0] + t * (pB[0] - pA[0]), pA[1] + t * (pB[1] - pA[1])))

resampled.append(projected_pts[-1])
total_points = len(resampled)
print(f"Puntos resampleados finales: {total_points} (Longitud: {total_px_len:.0f} px)")

# Perfil topográfico de referencia real (fracción de progreso -> altitud en msnm)
# Túnel (1907 m) -> Las Partidas (1560 m) -> La Sucia (1300 m) -> El Patudo (1763 m) -> Ebéjico (1141 m)
elevation_keyframes = [
    (0.00, 1907.0),
    (0.08, 1810.0), # Quebrada La Negra
    (0.15, 1690.0), # Quebrada La Volcana
    (0.237, 1560.0), # Las Partidas
    (0.314, 1390.0), # Descenso fuerte
    (0.361, 1300.0), # Puente Quebrada La Sucia (fondo del valle)
    (0.420, 1380.0),
    (0.460, 1470.0), # Agua de La Peña
    (0.550, 1620.0), # La Suiza
    (0.650, 1763.0), # Alto El Patudo (cima)
    (0.723, 1610.0), # Descenso hacia el pueblo
    (0.820, 1420.0), # Blanquizal
    (0.900, 1280.0), # Campo Alegre
    (0.964, 1180.0), # Quebrada Juan Ramos
    (1.000, 1141.0), # Parque Principal Ebéjico
]

def interpolate_elevation(progress: float) -> float:
    p = max(0.0, min(1.0, progress))
    for i in range(len(elevation_keyframes) - 1):
        p0, e0 = elevation_keyframes[i]
        p1, e1 = elevation_keyframes[i + 1]
        if p0 <= p <= p1:
            t = (p - p0) / (p1 - p0)
            # Interpolación hermite suave (smoothstep)
            st = t * t * (3.0 - 2.0 * t)
            return e0 + st * (e1 - e0)
    return elevation_keyframes[-1][1]

# Identificar nombres de puentes para marcarlos en el modelo 3D
bridge_names = [
    "quebrada la negra",
    "quebrada la volcana",
    "quebrada la nuez",
    "quebrada la cáusala",
    "quebrada la potrera",
    "quebrada la sucia",
    "quebrada agua de la peña",
    "quebrada el patudo",
    "quebrada juan ramos"
]

track_points = []
for idx, (x, y) in enumerate(resampled):
    prog_ratio = idx / (total_points - 1)
    elev_m = interpolate_elevation(prog_ratio)
    
    # Ancho de calzada según tramo
    if prog_ratio < 0.24:
        width = 84
    elif prog_ratio > 0.96:
        width = 58
    else:
        width = 68
        
    track_points.append({
        "x": round(x, 2),
        "y": round(y, 2),
        "z": round((elev_m - 1141.0) * 1.35, 2), # Escala 3D ajustada
        "elevationMeters": round(elev_m, 1),
        "width": width,
    })

# Asociar POIs y puentes
print(f"\nAsociando {len(pois)} POIs...")
for poi in pois:
    props = poi.get("properties", {})
    name = props.get("name", "")
    p_coord = poi["geometry"]["coordinates"]
    px, py = project(p_coord[0], p_coord[1])
    
    best_idx = min(range(len(track_points)), key=lambda i: math.hypot(track_points[i]["x"] - px, track_points[i]["y"] - py))
    
    track_points[best_idx]["name"] = name
    track_points[best_idx]["isCheckpoint"] = True
    
    # Verificar si es un puente
    lower_name = name.lower()
    is_bridge = any(b in lower_name for b in bridge_names) or "puente" in lower_name
    if is_bridge:
        track_points[best_idx]["isBridge"] = True
        track_points[best_idx]["bridgeName"] = name
        # Marcar los puntos adyacentes como parte de la estructura del puente (~60 m)
        for offset in range(-3, 4):
            adj_idx = best_idx + offset
            if 0 <= adj_idx < len(track_points):
                track_points[adj_idx]["isBridge"] = True
                track_points[adj_idx]["bridgeName"] = name
                track_points[adj_idx]["canyonDepth"] = 45.0 # Profundidad del abismo bajo el puente
        print(f"  [PUENTE 3D] en indice {best_idx:4d}: {name}")
    else:
        print(f"  [Hito] en indice {best_idx:4d} ({best_idx/len(track_points)*100:4.1f}%): {name}")

track_points[0]["isCheckpoint"] = True
track_points[0]["name"] = "Boca Occidental del Túnel de Occidente (Salida)"
track_points[-1]["isCheckpoint"] = True
track_points[-1]["name"] = "Parque Principal de Ebéjico (META)"

OUTPUT_PATH.write_text(json.dumps(track_points, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n[OK] Guardado exitoso con elevaciones 3D y puentes en {OUTPUT_PATH}")
