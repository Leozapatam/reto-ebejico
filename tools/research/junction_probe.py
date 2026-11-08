"""Sonda final Fase 1: topónimos en el cruce Ruta 62 -> Ebéjico y reintento de Overpass."""
import json, sys, time, urllib.parse, urllib.request

UA = "MiradaParda-RetoEbejico/0.1 (+https://www.miradaparda.com; investigacion educativa)"

def get(url, data=None, timeout=40):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)

def safe(label, fn):
    try:
        return fn()
    except Exception as e:  # noqa: BLE001
        print(f"[{label}] ERROR {e}")

print("== Nominatim: búsqueda libre 'Miserenga'")
r = safe("search", lambda: get("https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
    {"q": "Miserenga", "format": "jsonv2", "limit": 10, "viewbox": "-75.85,6.45,-75.55,6.20", "bounded": 1})))
for x in r or []:
    print(f"  {x['osm_type'][0]}{x['osm_id']} {x['lat'][:8]},{x['lon'][:9]} {x['category']}/{x['type']} {x['display_name'][:100]}")
time.sleep(1.2)

print("== Nominatim reverse en el cruce (6.36107,-75.70865), zooms 16-18")
for z in (18, 16):
    r = safe("rev", lambda: get("https://nominatim.openstreetmap.org/reverse?" + urllib.parse.urlencode(
        {"lat": 6.36107, "lon": -75.70865, "format": "jsonv2", "zoom": z, "addressdetails": 1})))
    if r: print(f"  z{z}: {r.get('name')} | {r.get('display_name','')[:140]}")
    time.sleep(1.2)

print("== Nominatim: Ebéjico (cabecera)")
r = safe("search", lambda: get("https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
    {"q": "Ebéjico", "format": "jsonv2", "limit": 6, "viewbox": "-75.9,6.5,-75.6,6.2", "bounded": 1})))
for x in r or []:
    print(f"  {x['osm_type'][0]}{x['osm_id']} {x['lat'][:8]},{x['lon'][:9]} {x['category']}/{x['type']} {x['display_name'][:100]}")

print("== Overpass (reintento, consulta mínima)")
q = '[out:json][timeout:20];node["place"](around:4000,6.3611,-75.7087);out tags center 30;'
r = safe("overpass", lambda: get("https://overpass-api.de/api/interpreter", data=urllib.parse.urlencode({"data": q}).encode(), timeout=30))
for e in (r or {}).get("elements", []):
    print("  ", e["type"], e["id"], e.get("lat"), e.get("lon"), e["tags"].get("name"), e["tags"].get("place"))
