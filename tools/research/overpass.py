"""Pequeño cliente de Overpass para la investigación de la ruta (Fase 1).

Uso:  python overpass.py consulta.overpassql salida.json
Datos © colaboradores de OpenStreetMap, licencia ODbL 1.0.
"""
import json
import sys
import time
import urllib.parse
import urllib.request

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
UA = "MiradaParda-RetoEbejico/0.1 (+https://www.miradaparda.com; investigacion educativa)"


def run(query: str, retries: int = 2):
    body = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for ep in ENDPOINTS:
        for _ in range(retries):
            try:
                req = urllib.request.Request(
                    ep, data=body,
                    headers={"User-Agent": UA, "Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=120) as r:
                    return json.load(r)
            except Exception as e:  # noqa: BLE001
                last = e
                time.sleep(2)
    raise RuntimeError(f"Overpass falló: {last}")


if __name__ == "__main__":
    q = open(sys.argv[1], encoding="utf-8").read()
    out = run(q)
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print(len(out.get("elements", [])), "elementos")
