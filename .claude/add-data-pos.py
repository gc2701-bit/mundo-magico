# -*- coding: utf-8 -*-
"""
Inserta data-pos="CODIGO" en cada tarjeta .pcard cuyo primera imagen esté
mapeada en assets/pos-codes.js. El codigo queda pegado a la tarjeta (invisible
para el visitante) y precios.js puede leerlo directo.

Idempotente: si la tarjeta ya tiene data-pos, no la vuelve a tocar.
Uso:  python .claude/add-data-pos.py
"""
import json, re, glob, os, urllib.parse

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --- leer el mapa {ruta imagen: codigo} desde pos-codes.js ---
js = open(os.path.join(BASE, "assets", "pos-codes.js"), encoding="utf-8").read()
obj = js[js.index("{"): js.rindex("}") + 1]
MAPA = json.loads(obj)

# anchor de tarjeta: abre <a ...class="...pcard..."...> y contiene <img src="...">
CARD = re.compile(
    r'<a\b(?![^>]*\bdata-pos=)([^>]*?class="[^"]*pcard[^"]*"[^>]*?)>'
    r'((?:(?!</a>).)*?<img\b[^>]*?\bsrc="([^"]+)")',
    re.DOTALL,
)

def decode(src):
    try:
        return urllib.parse.unquote(src)
    except Exception:
        return src

total = 0
for path in glob.glob(os.path.join(BASE, "*.html")):
    html = open(path, encoding="utf-8").read()
    n = [0]

    def repl(m):
        attrs, rest, src = m.group(1), m.group(2), m.group(3)
        code = MAPA.get(decode(src))
        if not code:
            return m.group(0)  # sin mapeo: dejar igual
        n[0] += 1
        return '<a' + attrs + ' data-pos="' + code + '">' + rest

    nuevo = CARD.sub(repl, html)
    if n[0]:
        open(path, "w", encoding="utf-8").write(nuevo)
        total += n[0]
    print(os.path.basename(path), "->", n[0], "tarjetas")

print("TOTAL:", total, "de", len(MAPA), "codigos en el mapa")
