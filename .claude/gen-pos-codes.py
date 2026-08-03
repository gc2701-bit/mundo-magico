# Genera assets/pos-codes.js desde revision-precios.xlsx.
#
# Flujo: completás la columna "CÓDIGO ELEGIDO" del Excel (con el código del
# POS que corresponde a cada producto de la web; las columnas "sugerido 1/2/3"
# son candidatos para ayudarte, pueden estar mal). Después corrés:
#
#     python .claude/gen-pos-codes.py
#
# y se regenera assets/pos-codes.js. Las filas sin código quedan sin precio en
# la web (se ven igual que siempre). Requiere: pip install pandas openpyxl
import json
import os

import pandas as pd

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
df = pd.read_excel(os.path.join(BASE, "revision-precios.xlsx"), dtype=str).fillna("")

mapa = {}
for _, fila in df.iterrows():
    codigo = str(fila["CÓDIGO ELEGIDO"]).strip()
    clave = str(fila["Imagen (clave)"]).strip()
    if codigo and clave:
        mapa[clave] = codigo

out = os.path.join(BASE, "assets", "pos-codes.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("/* Generado por .claude/gen-pos-codes.py desde revision-precios.xlsx — no editar a mano.\n")
    f.write("   Mapea la primera imagen de cada tarjeta al código de producto del POS. */\n")
    f.write("window.__POS_CODES__ = ")
    json.dump(mapa, f, ensure_ascii=False, indent=1)
    f.write(";\n")
print(f"pos-codes.js: {len(mapa)} productos mapeados")
