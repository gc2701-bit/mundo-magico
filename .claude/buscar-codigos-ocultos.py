# -*- coding: utf-8 -*-
"""Encuentra tarjetas con el mismo problema de 'Plato celeste estrella':
el nombre de la foto SI tiene un codigo de POS, pero no esta pegado al final
(va seguido de una palabra como 'detalle', 'frente', etc.), asi que la regla
estricta que usan assets/precios.js y assets/carrito.js no lo encuentra.

Compara dos formas de leer el codigo del nombre de archivo:
  ESTRICTA - la que usa la web de verdad: el numero tiene que ser
             literalmente lo ultimo antes de la extension.
  AMPLIA   - cualquier numero de 3 a 8 digitos que aparezca como palabra
             suelta en el nombre, este donde este.

Si para una tarjeta la estricta no encuentra nada pero la amplia si, Y ese
codigo tiene precio en la lista, es el mismo bug: se pierde no por falta de
codigo sino por donde esta parado dentro del nombre.

No corrige nada solo. Imprime candidatos para revisar antes de tocar el HTML,
porque un numero de 3-8 digitos en el medio de un nombre puede ser una medida
("Cortina 2 x 3 metros") y no un codigo.
"""
import csv
import glob
import io
import os
import re
import urllib.parse

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RAIZ)

RE_CARD = re.compile(r'<a[^>]*class="pcard[^"]*"[\s\S]*?</a>')
RE_IMG = re.compile(r'<img\b[^>]*>')
RE_SRC = re.compile(r'src="([^"]+)"')
RE_DATAPOS = re.compile(r'data-pos="([^"]+)"')

RE_ESTRICTA = re.compile(r'\s(\d{3,8})$')
RE_AMPLIA = re.compile(r'(?:^|\s)(\d{3,8})(?:\s|$)')


def cargar_precios():
    precios = {}
    for r in list(csv.reader(io.open('plantilla-precios/1-Precios.csv', encoding='utf-8-sig')))[1:]:
        if len(r) >= 3 and r[0].strip() and r[2] not in ('0', '0.0', '0.00', ''):
            precios.setdefault(r[0].strip(), r[1])
    alias = {}
    for k in precios:
        n = k.lstrip('0') or '0'
        alias.setdefault(n, set()).add(k)
    alias = {k: next(iter(v)) for k, v in alias.items() if len(v) == 1}
    return precios, alias


def resuelve(cod, precios, alias):
    if not cod:
        return None
    if cod in precios:
        return cod
    real = alias.get(cod.lstrip('0') or '0')
    return real if real and real in precios else None


def stem(ruta):
    f = urllib.parse.unquote(ruta).split('/')[-1]
    return re.sub(r'\.[a-z0-9]+$', '', f, flags=re.I)


def main():
    precios, alias = cargar_precios()
    print('codigos con precio: %d\n' % len(precios))

    hallazgos = []
    for archivo in sorted(glob.glob('*-v2.html')) + ['index.html']:
        html = open(archivo, encoding='utf-8').read()
        for card in RE_CARD.findall(html):
            m = re.search(r'<a[^>]*?data-pos="([^"]+)"', card)
            base = m.group(1) if m else ''
            imgs = RE_IMG.findall(card)
            if not imgs:
                continue

            # Que codigo usa HOY la web para esta tarjeta (misma prioridad que
            # precios.js: data-pos de la imagen, data-pos de la tarjeta, y
            # despues el nombre de cada foto con la regla ESTRICTA).
            resuelto_hoy = None
            if base:
                resuelto_hoy = resuelve(base, precios, alias)
            candidatos_ocultos = []
            for img in imgs:
                mp = RE_DATAPOS.search(img)
                if mp:
                    r = resuelve(mp.group(1), precios, alias)
                    if r and not resuelto_hoy:
                        resuelto_hoy = r
                    continue
                ms = RE_SRC.search(img)
                if not ms:
                    continue
                st = stem(ms.group(1))
                me = RE_ESTRICTA.search(st)
                if me:
                    r = resuelve(me.group(1), precios, alias)
                    if r and not resuelto_hoy:
                        resuelto_hoy = r
                    continue
                # No matchea estricta: buscar con la regla amplia
                for ma in RE_AMPLIA.finditer(st):
                    cod = ma.group(1)
                    r = resuelve(cod, precios, alias)
                    if r:
                        candidatos_ocultos.append((r, precios[r], st))

            if candidatos_ocultos:
                h = re.search(r'<h3>([^<]*)</h3>', card)
                sub = re.search(r'class="(?:sub|pdesc)">([^<]*)<', card)
                vistos = set()
                cods = []
                for r, p, st in candidatos_ocultos:
                    if r in vistos:
                        continue
                    vistos.add(r)
                    cods.append((r, p, st))
                hallazgos.append({
                    'archivo': archivo,
                    'titulo': h.group(1).strip() if h else '?',
                    'detalle': sub.group(1).strip() if sub else '',
                    'tarjeta_sin_precio': not resuelto_hoy,
                    'codigos': cods,
                })

    sinPrecio = [h for h in hallazgos if h['tarjeta_sin_precio']]
    conPrecio = [h for h in hallazgos if not h['tarjeta_sin_precio']]

    print('Tarjetas SIN NINGUN precio, con un codigo escondido en el nombre: %d' % len(sinPrecio))
    for h in sinPrecio:
        print('%-22s %-34s %s' % (h['archivo'], h['titulo'][:34], h['detalle'][:40]))
        for cod, precio, st in h['codigos']:
            print('     -> %-8s $%-8s  (%s)' % (cod, precio, st))

    print('\nTarjetas que YA muestran precio (por otra foto/variante), pero tienen')
    print('OTRA foto con codigo escondido -- esa variante puntual queda sin precio: %d' % len(conPrecio))
    for h in conPrecio:
        print('%-22s %-34s %s' % (h['archivo'], h['titulo'][:34], h['detalle'][:40]))
        for cod, precio, st in h['codigos']:
            print('     -> %-8s $%-8s  (%s)' % (cod, precio, st))
    return hallazgos


if __name__ == '__main__':
    main()
