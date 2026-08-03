# -*- coding: utf-8 -*-
"""Para cada tarjeta sin precio, busca a que se debe y propone candidatos.

Tres causas posibles, que se arreglan en lugares distintos:

  A. El codigo de la foto tiene un digito mal (06251 en vez de 06521). Se
     arregla renombrando la foto o poniendo el codigo bueno en la pestana
     Codigos. El precio YA esta en la lista.
  B. La foto no trae codigo, pero el articulo SI esta en la lista de precios.
     Se arregla escribiendo el codigo en la pestana Codigos.
  C. El articulo no aparece en la lista de precios de ninguna forma. No se
     arregla desde la web: le falta el precio minorista en el POS.

Uso:  python .claude/diagnostico-sin-precio.py
Salida: plantilla-precios/3-Diagnostico.csv
"""
import csv
import io
import os
import re
import unicodedata
import urllib.parse
import collections

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RAIZ)

LISTA = 'plantilla-precios/1-Precios.csv'
FALTAN = 'plantilla-precios/2-Codigos.csv'
SALIDA = 'plantilla-precios/3-Diagnostico.csv'

# Palabras que no distinguen nada al buscar por nombre.
RUIDO = set('DE DEL LA EL LOS LAS Y CON PARA POR X UN UNA EN SET TODOS TODO '
            'COLOR COLORES PRODUCTOS LICENCIAS LINEA CUMPLEANOS COTILLON '
            'FIESTAS REPOSTERIA DISFRACES DECORACION COMBOS VARIOS GRANDE '
            'CHICO CHICA MEDIANO SURTIDO'.split())


def sin_tildes(s):
    s = unicodedata.normalize('NFD', str(s))
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


def tokens(s):
    """Palabras significativas, en singular. El singular importa: la web dice
    'muffins' y el POS 'MUFFIN', y sin esto no se cruzan."""
    s = re.sub(r'[^A-Z0-9 ]+', ' ', sin_tildes(s).upper())
    out = set()
    for w in s.split():
        if len(w) > 2 and w not in RUIDO:
            out.add(w[:-1] if len(w) > 4 and w.endswith('S') else w)
    return out


def nucleo(nombre):
    """La primera palabra significativa del titulo en la web: el sustantivo que
    dice QUE es la cosa ('Topper', 'Molde', 'Anteojo'). Un candidato que no la
    comparte no es el mismo producto, por mas que coincidan los adjetivos:
    'Topper glitter' y 'SOMBRERO COWBOY CON GLITTER' comparten 'glitter' y no
    tienen nada que ver."""
    t = [w for w in re.sub(r'[^A-Z0-9 ]+', ' ', sin_tildes(nombre).upper()).split()
         if len(w) > 2 and w not in RUIDO]
    if not t:
        return ''
    w = t[0]
    return w[:-1] if len(w) > 4 and w.endswith('S') else w


def cod_de_foto(ruta):
    f = re.sub(r'\.[a-z0-9]+$', '', ruta.split('/')[-1], flags=re.I)
    m = re.search(r'\s(\d{3,8})$', f)
    return m.group(1) if m else ''


def variantes(cod):
    """Codigos a un solo error de distancia: un digito cambiado o dos
    adyacentes intercambiados. Es exactamente el tipo de error que se comete
    al tipear un codigo en el nombre de un archivo."""
    out = set()
    for i in range(len(cod)):
        for d in '0123456789':
            if d != cod[i]:
                out.add(cod[:i] + d + cod[i + 1:])
    for i in range(len(cod) - 1):
        out.add(cod[:i] + cod[i + 1] + cod[i] + cod[i + 2:])
    out.discard(cod)
    return out


def main():
    lista = {}
    for r in list(csv.reader(io.open(LISTA, encoding='utf-8-sig')))[1:]:
        if len(r) >= 3 and r[0].strip():
            lista.setdefault(r[0].strip(), (r[1], r[2]))
    porToken = [(c, n, p, tokens(n)) for c, (n, p) in lista.items()]

    filas = list(csv.DictReader(io.open(FALTAN, encoding='utf-8-sig')))
    salida = []
    cuenta = collections.Counter()

    for r in filas:
        foto = r['Foto']
        cod = cod_de_foto(foto)
        nombre = r['Producto en la web']
        detalle = r['Detalle']
        carpetas = ' '.join(foto.split('/')[:-1])
        objetivo = tokens(nombre + ' ' + detalle + ' ' + carpetas)
        nuc = nucleo(nombre)

        # A) el codigo de la foto, con un digito mal
        cercanos = []
        if cod:
            for v in sorted(variantes(cod)):
                if v in lista:
                    n, p = lista[v]
                    tk = tokens(n)
                    if nuc and nuc not in tk:
                        continue          # comparten adjetivos, no el producto
                    cercanos.append((len(objetivo & tk), v, n, p))
            cercanos.sort(reverse=True)

        # B) por nombre
        porNombre = []
        for c, n, p, tk in porToken:
            if nuc and nuc not in tk:
                continue
            comunes = len(objetivo & tk)
            if comunes >= 2:
                porNombre.append((comunes, c, n, p))
        porNombre.sort(reverse=True)

        # El mejor candidato por codigo cercano solo cuenta si ADEMAS el nombre
        # se parece: '33419' -> '33416' vale si los dos son moldes de muffins.
        mejorCod = cercanos[0] if cercanos and cercanos[0][0] >= 2 else None
        mejorNom = porNombre[0] if porNombre else None

        if mejorCod:
            causa = 'A. codigo de la foto con un digito mal'
            sug, nsug, psug = mejorCod[1], mejorCod[2], mejorCod[3]
        elif mejorNom and mejorNom[0] >= 3:
            causa = 'B. esta en la lista, falta vincularlo'
            sug, nsug, psug = mejorNom[1], mejorNom[2], mejorNom[3]
        else:
            causa = 'C. no esta en la lista de precios (cargar precio en el POS)'
            sug = nsug = psug = ''

        cuenta[causa[0]] += 1
        otros = '; '.join('%s %s ($%s)' % (c, n[:34], p) for _, c, n, p in porNombre[1:4])
        salida.append([nombre, detalle, r['Pagina'], cod, causa, sug, nsug, psug, otros])

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with io.open(SALIDA, 'w', encoding='utf-8-sig', newline='') as fh:
        w = csv.writer(fh, lineterminator='\r\n')
        w.writerow(['Producto en la web', 'Detalle', 'Pagina', 'Codigo en la foto',
                    'Causa probable', 'Codigo sugerido', 'Nombre en el POS',
                    'Precio', 'Otros candidatos'])
        w.writerows(salida)

    print('%s  (%d tarjetas)\n' % (SALIDA, len(salida)))
    for k in sorted(cuenta):
        print('  %s: %d' % (k, cuenta[k]))
    print()
    for row in salida:
        if row[4].startswith('C'):
            continue
        print('  %-34s foto:%-7s -> %-7s %s ($%s)'
              % (row[0][:34], row[3] or '-', row[5], row[6][:34], row[7]))


if __name__ == '__main__':
    main()
