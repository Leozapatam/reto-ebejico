"""Fase 1: análisis exploratorio de la ruta OSRM (curvatura, pendiente, topónimos).

- Curvatura: cambio de rumbo acumulado sobre ventanas de ~120 m.
- Elevación: Open-Meteo (Copernicus GLO-90) SOLO para investigación. En producción se
  usará el DEM Copernicus GLO-30 descargado y procesado offline (ver SOURCES_AND_LICENSES.md).
- Topónimos: Nominatim reverse cada ~1.5 km (límites administrativos OSM).
"""
import json, math, time, urllib.parse, urllib.request
from pathlib import Path

RAW = Path(__file__).resolve().parents[2] / "data" / "raw"
UA = "MiradaParda-RetoEbejico/0.1 (+https://www.miradaparda.com; investigacion educativa)"


def get(url, tries=4):
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 + 2 * i)
    raise RuntimeError(f"{url}: {last}")


def hav(a, b):
    R = 6371008.8
    la1, lo1, la2, lo2 = map(math.radians, (a[1], a[0], b[1], b[0]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def bearing(a, b):
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    dl = math.radians(b[0] - a[0])
    y = math.sin(dl) * math.cos(la2)
    x = math.cos(la1) * math.sin(la2) - math.sin(la1) * math.cos(la2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


route = json.loads((RAW / "osrm_route_portalO_to_parque.json").read_text(encoding="utf-8"))
pts = route["routes"][0]["geometry"]["coordinates"]

# resample cada 100 m
cum = [0.0]
for i in range(1, len(pts)):
    cum.append(cum[-1] + hav(pts[i - 1], pts[i]))
total = cum[-1]
step = 100.0
samples = []
j = 0
d = 0.0
while d <= total:
    while j < len(cum) - 2 and cum[j + 1] < d:
        j += 1
    t = (d - cum[j]) / max(cum[j + 1] - cum[j], 1e-9)
    samples.append((d, pts[j][0] + t * (pts[j + 1][0] - pts[j][0]), pts[j][1] + t * (pts[j + 1][1] - pts[j][1])))
    d += step
print(f"Longitud total {total/1000:.2f} km; {len(samples)} muestras a {step:.0f} m")

# rumbo y giro
hd = [bearing((samples[i][1], samples[i][2]), (samples[i + 1][1], samples[i + 1][2])) for i in range(len(samples) - 1)]
turn = [((hd[i + 1] - hd[i] + 540) % 360) - 180 for i in range(len(hd) - 1)]
# curvas: tramos consecutivos con giro del mismo signo
curves = []
cur = None
for i, t in enumerate(turn):
    if abs(t) < 3:
        if cur and cur["end"] is None:
            cur["end"] = i
        if cur and cur["end"] is not None:
            curves.append(cur); cur = None
        continue
    s = 1 if t > 0 else -1
    if cur is None or cur["sign"] != s:
        if cur:
            curves.append(cur)
        cur = {"sign": s, "start": i, "end": None, "angle": 0.0}
    cur["angle"] += t
    cur["end"] = None
if cur:
    cur["end"] = len(turn)
    curves.append(cur)
curves = [{**c, "end": c["end"] if c["end"] is not None else len(turn)} for c in curves if abs(c["angle"]) >= 25]
print(f"Curvas con giro >= 25°: {len(curves)}  (>=60°: {sum(abs(c['angle'])>=60 for c in curves)}, >=120°: {sum(abs(c['angle'])>=120 for c in curves)})")

# elevación (Open-Meteo, lotes de 100)
elev = []
for k in range(0, len(samples), 100):
    chunk = samples[k:k + 100]
    u = ("https://api.open-meteo.com/v1/elevation?latitude=" + ",".join(f"{s[2]:.5f}" for s in chunk)
         + "&longitude=" + ",".join(f"{s[1]:.5f}" for s in chunk))
    elev += get(u)["elevation"]
    time.sleep(0.5)
print(f"Elevación: inicio {elev[0]:.0f} m, fin {elev[-1]:.0f} m, mín {min(elev):.0f}, máx {max(elev):.0f}")
up = sum(max(0, elev[i + 1] - elev[i]) for i in range(len(elev) - 1))
dn = sum(max(0, elev[i] - elev[i + 1]) for i in range(len(elev) - 1))
print(f"Ascenso acumulado {up:.0f} m, descenso acumulado {dn:.0f} m")
grades = [(elev[i + 5] - elev[i]) / 500 * 100 for i in range(len(elev) - 5)]
print(f"Pendiente (ventana 500 m): máx {max(grades):.1f}%  mín {min(grades):.1f}%")

# topónimos
names = []
last = None
for i in range(0, len(samples), 15):
    s = samples[i]
    try:
        rv = get("https://nominatim.openstreetmap.org/reverse?" + urllib.parse.urlencode(
            {"lat": f"{s[2]:.5f}", "lon": f"{s[1]:.5f}", "format": "jsonv2", "zoom": 14, "addressdetails": 1}))
    except Exception as e:  # noqa: BLE001
        names.append((s[0], "ERROR", str(e))); continue
    a = rv.get("address", {})
    lab = " | ".join(f"{k}={a[k]}" for k in ("hamlet", "village", "suburb", "neighbourhood", "city_district", "town", "municipality", "county") if k in a)
    names.append((s[0], lab, rv.get("name")))
    time.sleep(1.1)

out = {
    "total_m": total,
    "samples": [{"d": round(s[0]), "lon": round(s[1], 6), "lat": round(s[2], 6), "elev": e} for s, e in zip(samples, elev)],
    "curves": curves,
    "toponyms": names,
}
(RAW / "route_analysis.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")

print("\nPerfil (cada 1 km):")
for i in range(0, len(samples), 10):
    print(f"  km {samples[i][0]/1000:5.1f}  elev {elev[i]:6.0f} m  ({samples[i][2]:.4f},{samples[i][1]:.4f})")
print("\nTopónimos (km | contexto administrativo OSM):")
for n in names:
    print(f"  km {n[0]/1000:5.1f} | {n[1]} | {n[2]}")
