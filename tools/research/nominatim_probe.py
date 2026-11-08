"""Exploración inicial con Nominatim (datos OSM, ODbL). Respeta 1 req/s y User-Agent propio."""
import json, sys, time, urllib.parse, urllib.request

UA = "MiradaParda-RetoEbejico/0.1 (+https://www.miradaparda.com; investigacion educativa)"

def nominatim(q, **extra):
    params = {"q": q, "format": "jsonv2", "limit": 5, "addressdetails": 0, "countrycodes": "co", **extra}
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

queries = sys.argv[1:] or [
    "Túnel de Occidente, Antioquia",
    "Túnel Fernando Gómez Martínez",
    "La Miserenga, San Jerónimo",
    "Ebéjico, Antioquia",
    "Parque principal Ebéjico",
    "Quebradaseca, Ebéjico",
    "Guayabal, Ebéjico",
]
for q in queries:
    try:
        res = nominatim(q)
    except Exception as e:  # noqa: BLE001
        print("##", q, "ERROR", e); time.sleep(1.2); continue
    print("##", q, f"({len(res)} resultados)")
    for r in res:
        print(f"  {r['osm_type'][0]}{r['osm_id']:<12} {r['lat'][:9]:>9},{r['lon'][:10]:>11}  {r.get('category')}/{r.get('type')}  {r['display_name'][:110]}")
    time.sleep(1.2)
