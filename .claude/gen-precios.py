# -*- coding: utf-8 -*-
"""Genera la plantilla de precios y el respaldo local desde el export del POS.

Entrada:  precios.XLS  (Lista de Precios Minorista, export del POS)
Salida:
  plantilla-precios/1-Precios.csv   -> pestana "Precios" de la Google Sheet
  plantilla-precios/2-Codigos.csv   -> pestana "Codigos" de la Google Sheet
  assets/precios-datos.js           -> respaldo local (si la Sheet no responde)

Se vuelve a correr cada vez que llega un export nuevo del POS:
    python .claude/gen-precios.py

Ojo: el respaldo local queda congelado en el momento de correr esto. La fuente
de verdad en vivo es la Google Sheet; el respaldo solo evita que la web se
quede sin precios si Google no contesta.
"""
import csv
import difflib
import io
import os
import re
import sys
import glob
import unicodedata
import urllib.parse

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RAIZ)

XLS = 'precios.XLS'
SALIDA = 'plantilla-precios'

# Columnas del export del POS (fila 7 es el encabezado, los datos arrancan en 8)
COL_CODIGO, COL_NOMBRE, COL_PRECIO = 3, 4, 7
FILA_DATOS = 8


# ---------------------------------------------------------------- utilidades
def norm(c):
    """Clave sin ceros a la izquierda, SOLO para buscar un alias.

    Cuidado: quitar ceros NO es una forma valida de comparar codigos. En el
    export del POS hay 79 pares distintos que coinciden al quitarlos, y no son
    el mismo producto: '01985' es un globo de $4.000 y '1985' un disfraz de
    $21.000. Por eso el precio se busca primero por codigo EXACTO, y el alias
    sin ceros se usa unicamente cuando le corresponde un solo codigo real
    (ver alias_sin_ceros)."""
    return (str(c).strip().lstrip('0') or '0')


def alias_sin_ceros(precios):
    """Mapa 'codigo sin ceros' -> codigo real, salteando los ambiguos.

    Sirve para cuando el nombre de una foto perdio el cero de adelante
    ('... 4375.jpg' por el articulo '04375'). Si la clave da con dos codigos
    reales distintos, se descarta: mejor sin precio que con el precio de otro
    producto."""
    porclave = {}
    for codigo in precios:
        porclave.setdefault(norm(codigo), set()).add(codigo)
    return {k: next(iter(v)) for k, v in porclave.items()
            if len(v) == 1 and next(iter(v)) != k}


def sin_tildes(s):
    s = unicodedata.normalize('NFD', s)
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


def clave_texto(s):
    """Para comparar un titulo de la web con un nombre del POS."""
    s = sin_tildes(str(s)).upper()
    s = re.sub(r'[^A-Z0-9 ]+', ' ', s)
    return ' '.join(s.split())


def cod_de_imagen(src):
    """Misma regla que assets/carrito.js: el numero va al final del nombre del
    archivo y exige un espacio antes, para no confundirlo con una medida."""
    if not src:
        return ''
    try:
        f = urllib.parse.unquote(src)
    except Exception:
        f = src
    f = f.split('/')[-1]
    f = re.sub(r'\.[a-z0-9]+$', '', f, flags=re.I)
    m = re.search(r'\s(\d{3,8})$', f)
    return m.group(1) if m else ''


# ------------------------------------------------------------- leer el Excel
def leer_pos():
    try:
        import xlrd
    except ImportError:
        sys.exit('Falta xlrd. Instalar con:  pip install xlrd')
    hoja = xlrd.open_workbook(XLS).sheet_by_index(0)
    filas = []
    for r in range(FILA_DATOS, hoja.nrows):
        v = [c.value for c in hoja.row(r)]
        codigo = str(v[COL_CODIGO]).strip()
        if not codigo:
            continue
        # xlrd devuelve los numericos como float ('15909.0')
        if re.fullmatch(r'\d+\.0', codigo):
            codigo = codigo[:-2]
        nombre = str(v[COL_NOMBRE]).strip()
        try:
            precio = float(v[COL_PRECIO])
        except (TypeError, ValueError):
            precio = 0.0
        filas.append((codigo, nombre, precio))
    return filas


# ------------------------------------------- tarjetas de la web sin codigo
RE_CARD = re.compile(r'<a[^>]*class="pcard[^"]*"[\s\S]*?</a>')


def tarjetas_sin_codigo(precios, alias):
    """Una fila por tarjeta del catalogo cuyo precio no se puede resolver hoy.
    La clave es la ruta de la primera foto: ya es unica y estable, asi que
    nadie tiene que tocar el HTML para vincular un codigo."""
    faltan = []
    vistas = set()
    for archivo in sorted(glob.glob('*-v2.html')) + ['index.html']:
        if not os.path.exists(archivo):
            continue
        html = open(archivo, encoding='utf-8').read()
        for c in RE_CARD.findall(html):
            # data-talles="Chico:9283;Grande:4228": un codigo del POS por tamano
            # (o por componente, en los combos). Si alguno tiene precio, la
            # tarjeta ya muestra precio y no hay nada que vincular a mano.
            m = re.search(r'data-talles="([^"]*)"', c)
            if m:
                codigos = [p.split(':', 1)[1].strip()
                           for p in m.group(1).split(';') if ':' in p]
                if any((t in precios) or alias.get(norm(t)) for t in codigos):
                    continue
            m = re.search(r'<a[^>]*?data-pos="([^"]+)"', c)
            base = m.group(1) if m else ''
            imgs = re.findall(r'<img[^>]*>', c)
            if not imgs:
                continue
            m = re.search(r'src="([^"]+)"', imgs[0])
            if not m:
                continue
            foto = urllib.parse.unquote(m.group(1))
            codigo = base or cod_de_imagen(foto)
            resuelto = codigo if codigo in precios else alias.get(norm(codigo), '')
            if resuelto or foto in vistas:
                continue
            vistas.add(foto)
            h = re.search(r'<h3>([^<]*)</h3>', c)
            sub = re.search(r'class="sub">([^<]*)<', c)
            faltan.append({
                'foto': foto,
                'titulo': (h.group(1).strip() if h else ''),
                'detalle': (sub.group(1).strip() if sub else ''),
                'pagina': archivo,
            })
    return faltan


# Palabras del arbol de carpetas que no distinguen nada al comparar.
RUIDO = set('PRODUCTOS LICENCIAS LINEA DE CUMPLEANOS COTILLON Y FIESTAS '
            'REPOSTERIA DISFRACES DECORACION COMBOS ARTICULOS VARIOS'.split())


def sugerir(faltan, filas):
    """Nombre del POS mas parecido, como SUGERENCIA a revisar a mano.

    Nunca escribe en la columna 'Codigo': un match equivocado publicaria un
    precio equivocado. Alguien lo mira y lo copia si esta bien.

    El titulo suelto no alcanza -- en la web se llaman 'Platos Carton' y la
    licencia que los distingue esta en la CARPETA ('Licencias/Stitch/...').
    Por eso la comparacion suma las carpetas de la ruta de la foto.

    Ademas exige que el mejor candidato le saque ventaja al segundo: entre
    cincuenta piñatas casi iguales, la que gana por un pelo es una moneda al
    aire y no una sugerencia util."""
    nombres = [(clave_texto(n), c, n) for c, n, p in filas if p > 0]
    for it in faltan:
        partes = it['foto'].split('/')[:-1]
        carpetas = ' '.join(w for w in clave_texto(' '.join(partes)).split()
                            if w not in RUIDO)
        objetivo = clave_texto(carpetas + ' ' + it['titulo'] + ' ' + it['detalle'])
        puntajes = []
        for clave, codigo, nombre in nombres:
            puntajes.append((difflib.SequenceMatcher(None, objetivo, clave).ratio(),
                             codigo, nombre))
        puntajes.sort(key=lambda x: -x[0])
        mejor = puntajes[0] if puntajes else None
        segundo = puntajes[1][0] if len(puntajes) > 1 else 0.0
        if mejor and mejor[0] >= 0.62 and (mejor[0] - segundo) >= 0.03:
            it['sug_codigo'], it['sug_nombre'] = mejor[1], mejor[2]
            it['sug_puntaje'] = round(mejor[0] * 100)
        else:
            it['sug_codigo'] = it['sug_nombre'] = ''
            it['sug_puntaje'] = ''
    return faltan


# ------------------------------------------------------------------ escribir
def escribir_csv(ruta, encabezado, filas):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    # utf-8-sig: para que Google Sheets y Excel respeten las tildes al importar
    with io.open(ruta, 'w', encoding='utf-8-sig', newline='') as fh:
        w = csv.writer(fh, lineterminator='\r\n')
        w.writerow(encabezado)
        w.writerows(filas)
    print('  %-38s %5d filas' % (ruta, len(filas)))


# No todos los codigos del POS son numericos (hay algunos tipo 'BURBUJA50'),
# asi que el orden pone primero los numericos y despues el resto alfabetico.
def _orden(par):
    c = par[0]
    return (0, int(c), '') if c.isdigit() else (1, 0, c)


def _num(p):
    return ('%d' % p) if float(p).is_integer() else ('%.2f' % p)


def escribir_respaldo(precios, alias):
    cuerpo = ',\n'.join(' "%s": %s' % (c, _num(p))
                        for c, p in sorted(precios.items(), key=_orden))
    cuerpo_alias = ',\n'.join(' "%s": "%s"' % (k, v)
                              for k, v in sorted(alias.items(), key=_orden))
    txt = (
        '/* RESPALDO LOCAL DE PRECIOS - GENERADO, NO EDITAR A MANO.\n'
        '   Lo escribe .claude/gen-precios.py desde precios.XLS (export del POS).\n'
        '\n'
        '   Para cambiar un precio se edita la Google Sheet, no este archivo:\n'
        '   la web lee la Sheet y solo cae aca si Google no contesta.\n'
        '   Ver plantilla-precios/COMO-USAR.md.\n'
        '\n'
        '   __PRECIOS_DATOS__  codigo del POS (EXACTO, con sus ceros) -> precio\n'
        '   __PRECIOS_ALIAS__  el mismo codigo sin ceros adelante -> codigo real,\n'
        '                      para las fotos cuyo nombre perdio el cero. Solo\n'
        '                      estan los que no son ambiguos: hay 79 pares que\n'
        '                      coinciden al quitar ceros y son productos\n'
        '                      distintos, esos quedan afuera a proposito. */\n'
        'window.__PRECIOS_DATOS__ = {\n' + cuerpo + '\n};\n'
        'window.__PRECIOS_ALIAS__ = {\n' + cuerpo_alias + '\n};\n'
    )
    with io.open('assets/precios-datos.js', 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(txt)
    print('  %-38s %5d codigos + %d alias'
          % ('assets/precios-datos.js', len(precios), len(alias)))


def main():
    if not os.path.exists(XLS):
        sys.exit('No encuentro %s en %s' % (XLS, RAIZ))
    filas = leer_pos()
    print('Export del POS: %d filas' % len(filas))

    precios = {}
    for codigo, nombre, precio in filas:
        if precio > 0:
            precios.setdefault(codigo, precio)
    alias = alias_sin_ceros(precios)

    print('\nGenerando:')
    escribir_csv(
        os.path.join(SALIDA, '1-Precios.csv'),
        ['Codigo', 'Producto (POS)', 'Precio'],
        [(c, n, _num(p)) for c, n, p in filas],
    )
    escribir_respaldo(precios, alias)

    faltan = sugerir(tarjetas_sin_codigo(precios, alias), filas)
    escribir_csv(
        os.path.join(SALIDA, '2-Codigos.csv'),
        ['Foto', 'Producto en la web', 'Detalle', 'Pagina', 'Codigo',
         'Sugerencia (revisar)', 'Nombre sugerido', '% parecido'],
        [(i['foto'], i['titulo'], i['detalle'], i['pagina'], '',
          i['sug_codigo'], i['sug_nombre'], i['sug_puntaje']) for i in faltan],
    )

    con_sug = sum(1 for i in faltan if i['sug_codigo'])
    print('\nResumen:')
    print('  codigos con precio cargado : %d' % len(precios))
    print('  alias sin ceros (seguros)  : %d' % len(alias))
    print('  tarjetas sin codigo        : %d  (%d con sugerencia para revisar)'
          % (len(faltan), con_sug))


if __name__ == '__main__':
    main()
