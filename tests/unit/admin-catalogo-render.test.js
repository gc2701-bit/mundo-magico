/* admin-catalogo.js — pestaña "Publicado": el render real (toolbar + tabla +
 * detalle) y las escrituras que dispara cada botón. Complementa
 * admin-catalogo-lista.test.js, que cubre las funciones puras
 * (unificarLista/filtrarYOrdenar) sin DOM.
 *
 * El sb de Supabase se reemplaza por un doble mínimo que registra qué tabla,
 * qué columnas y qué claves recibió cada update — la idea no es probar
 * supabase-js, es probar que el panel escribe en catalogo_productos por `id`
 * y en catalogo_tarjetas por (pagina, slug), y que nunca manda precio/stock.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadScript } from '../helpers/loadScript.js';

function montarDOM() {
  document.body.innerHTML =
    '<div class="adm-head"><p id="adm-sesion" class="adm-sesion-info" hidden></p>' +
    '  <button type="button" class="adm-logout-btn" id="adm-logout-btn" hidden>Cerrar sesión</button></div>' +
    '<div id="adm-gate" class="adm-gate"><button id="adm-login-btn"></button></div>' +
    '<div id="adm-panel" class="adm-panel" hidden>' +
    '  <div class="adm-tabs"><button id="adm-tab-publicado" class="adm-tab is-active"></button><button id="adm-tab-espejo" class="adm-tab"></button></div>' +
    '  <div id="adm-panel-publicado" class="adm-tab-panel"></div>' +
    '  <div id="adm-panel-espejo" class="adm-tab-panel" hidden></div>' +
    '</div>';
}

// Un "resultado" de PostgREST: es thenable (Promise real) y además encadena
// .select()/.order()/.eq() devolviéndose a sí mismo, igual que el builder de
// supabase-js.
function resultado(data) {
  const p = Promise.resolve({ data: data, error: null });
  p.select = () => p;
  p.order = () => p;
  p.eq = () => p;
  return p;
}

const DATOS_BASE = () => ({
  catalogo_productos: [
    { id: 'p1', pagina: 'disfraces-v2.html', subcategoria_id: 's1', titulo: 'Capa roja', slug: 'capa-roja', codigo: '111', descripcion: 'Capa de tela', fotos: [{ src: 'capa.webp', cap: '' }], publicado: true },
    { id: 'p2', pagina: 'decoracion-v2.html', subcategoria_id: null, titulo: 'Zapallo', slug: 'zapallo', codigo: '222', descripcion: '', fotos: [], publicado: false }
  ],
  catalogo_tarjetas: [
    { pagina: 'combos-v2.html', slug: 'combo-xl', oculta: false, sin_stock: null, precio_fijo: 9000, titulo_ref: 'Combo XL', nota: 'Hasta 20 chicos', subcategoria_id: null, codigo_override: '333', colores_sin_stock: [] }
  ],
  catalogo_precios: [
    { codigo: '111', precio: 5000, sin_stock: false, stock: 12 },
    { codigo: '222', precio: 3000, sin_stock: true, stock: 0 }
  ],
  catalogo_subcategorias: [
    { id: 's1', pagina: 'disfraces-v2.html', nombre: 'Capas', slug: 'capas', orden: 0 },
    { id: 's2', pagina: 'disfraces-v2.html', nombre: 'Antifaces', slug: 'antifaces', orden: 1 },
    { id: 's3', pagina: 'combos-v2.html', nombre: 'Combos chicos', slug: 'combos-chicos', orden: 0 }
  ],
  catalogo_config: [{ umbral_pocas_unidades: 5 }]
});

// Un error de PostgREST: la promesa RESUELVE con {data:null, error} — no
// rechaza. Es justo la forma que hace fácil comerse un error sin querer.
function resultadoError(mensaje) {
  const p = Promise.resolve({ data: null, error: new Error(mensaje) });
  p.select = () => p;
  p.order = () => p;
  p.eq = () => p;
  return p;
}

let escrituras;
let lecturas;
let rpcPrecios;
let sesionCerrada;

function mockSb(datos, errores) {
  escrituras = [];
  lecturas = [];
  rpcPrecios = [];
  sesionCerrada = 0;
  errores = errores || {};
  const sb = {
    // catalogo_precios_admin(p_codigos): la función security definer de
    // supabase/catalogo_08_stock_privado.sql. Devuelve SÓLO los códigos
    // pedidos — igual que Postgres con `codigo = any(p_codigos)`, que es lo
    // que hace que valga la pena testear que el panel manda la lista corta.
    rpc: (nombre, args) => {
      if (nombre !== 'catalogo_precios_admin') return Promise.resolve({ data: true, error: null });
      const pedidos = (args && args.p_codigos) || [];
      rpcPrecios.push(pedidos);
      if (errores.catalogo_precios_admin) {
        return Promise.resolve({ data: null, error: new Error(errores.catalogo_precios_admin) });
      }
      return Promise.resolve({
        data: (datos.catalogo_precios || []).filter((p) => pedidos.indexOf(p.codigo) !== -1),
        error: null
      });
    },
    from(tabla) {
      return {
        select: () => {
          lecturas.push(tabla);
          return errores[tabla] ? resultadoError(errores[tabla]) : resultado(datos[tabla] || []);
        },
        update(campos) {
          const registro = { tabla, tipo: 'update', campos, eqs: [] };
          escrituras.push(registro);
          const chain = resultado(datos[tabla] && datos[tabla].length ? datos[tabla] : [{ id: 'ok' }]);
          chain.eq = (k, v) => { registro.eqs.push([k, v]); return chain; };
          return chain;
        },
        insert(campos) {
          const registro = { tabla, tipo: 'insert', campos, eqs: [] };
          escrituras.push(registro);
          return resultado([{ id: 'nueva-sub' }]);
        }
      };
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: { path: 'x' }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://cdn/x.webp' } })
      })
    }
  };
  window.MMCuenta = {
    sesionActiva: () => true,
    cliente: () => sb,
    nombre: () => 'Local Mundo Mágico',
    email: () => 'local@mundomagico.test',
    cerrarSesion: () => { sesionCerrada++; return Promise.resolve({}); }
  };
  return sb;
}

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); };

async function arrancar(datos, errores) {
  montarDOM();
  mockSb(datos || DATOS_BASE(), errores);
  loadScript('assets/admin-catalogo.js');
  await flush();
}

const panel = () => document.getElementById('adm-panel-publicado');
const filas = () => Array.from(panel().querySelectorAll('tbody tr'));
const titulos = () => filas().map((tr) => tr.children[1].textContent);

afterEach(() => { delete window.MMCuenta; });

describe('pestaña "Publicado" — lista', () => {
  beforeEach(async () => { await arrancar(); });

  it('pinta una fila por artículo, uniendo productos y tarjetas del HTML', () => {
    expect(panel().querySelector('table.adm-lista-tabla')).toBeTruthy();
    expect(filas()).toHaveLength(3);
    expect(titulos().sort()).toEqual(['Capa roja', 'Combo XL', 'Zapallo']);
  });

  it('cada fila muestra código, mundo con nombre legible, precio y estado', () => {
    const capa = filas().find((tr) => tr.children[1].textContent === 'Capa roja');
    expect(capa.children[0].textContent).toBe('111');
    expect(capa.children[2].textContent).toBe('Disfraces y accesorios');
    expect(capa.children[3].textContent).toContain('5.000');
    expect(capa.children[4].textContent).toContain('Visible');
  });

  it('marca "sin stock" con su badge y el producto despublicado como oculto', () => {
    const zapallo = filas().find((tr) => tr.children[1].textContent === 'Zapallo');
    expect(zapallo.children[4].textContent).toContain('Oculto');
    expect(zapallo.querySelector('.adm-badge-sin-stock')).toBeTruthy();
  });

  it('el buscador filtra sin volver a pedir datos a la red', () => {
    const buscar = document.getElementById('adm-lista-buscar');
    buscar.value = 'combo';
    buscar.dispatchEvent(new Event('input'));
    expect(titulos()).toEqual(['Combo XL']);
    expect(escrituras).toHaveLength(0);
  });

  it('el filtro de estado deja sólo los ocultos', () => {
    const sel = document.getElementById('adm-lista-estado');
    sel.value = 'oculto';
    sel.dispatchEvent(new Event('change'));
    expect(titulos()).toEqual(['Zapallo']);
  });

  it('el filtro de mundo deja sólo ese mundo', () => {
    const sel = document.getElementById('adm-lista-mundo');
    sel.value = 'combos-v2.html';
    sel.dispatchEvent(new Event('change'));
    expect(titulos()).toEqual(['Combo XL']);
  });

  it('clickear la columna "Precio" ordena, y volver a clickearla invierte', () => {
    const th = () => Array.from(panel().querySelectorAll('th')).find((n) => /Precio/.test(n.textContent));
    th().click();
    expect(filas().map((tr) => tr.children[3].textContent.replace(/\D/g, ''))).toEqual(['3000', '5000', '9000']);
    th().click();
    expect(filas().map((tr) => tr.children[3].textContent.replace(/\D/g, ''))).toEqual(['9000', '5000', '3000']);
    expect(th().getAttribute('aria-sort')).toBe('descending');
  });
});

describe('proximoSort()', () => {
  beforeEach(async () => { await arrancar(); });

  it('otra columna → ascendente por esa columna; la misma → invierte', () => {
    const { proximoSort } = window.__MM_ADMIN_CATALOGO_TEST__;
    expect(proximoSort('titulo', 'asc', 'precio')).toEqual({ sortCol: 'precio', sortDir: 'asc' });
    expect(proximoSort('precio', 'asc', 'precio')).toEqual({ sortCol: 'precio', sortDir: 'desc' });
    expect(proximoSort('precio', 'desc', 'precio')).toEqual({ sortCol: 'precio', sortDir: 'asc' });
  });
});

function abrirPorTitulo(titulo) {
  const tr = filas().find((f) => f.children[1].textContent === titulo);
  tr.querySelector('.adm-lista-editar').click();
}

describe('detalle de un producto de catalogo_productos', () => {
  beforeEach(async () => {
    await arrancar();
    abrirPorTitulo('Capa roja');
  });

  it('reemplaza la lista por el detalle, con sus fotos y sus campos editables', () => {
    const det = panel().querySelector('.adm-detalle');
    expect(det).toBeTruthy();
    expect(panel().querySelector('table')).toBeNull();
    expect(det.getAttribute('data-origen')).toBe('producto');
    expect(det.querySelectorAll('.adm-detalle-fotos img')).toHaveLength(1);
    expect(det.querySelector('.adm-detalle-fotos img').src).toContain('capa.webp');
    expect(det.querySelector('input[type="text"]').value).toBe('Capa roja');
    expect(det.querySelector('textarea').value).toBe('Capa de tela');
  });

  it('precio y stock son de sólo lectura: no hay ningún input para editarlos', () => {
    const det = panel().querySelector('.adm-detalle');
    expect(det.querySelector('input[type="number"]')).toBeNull();
    const soloLectura = Array.from(det.querySelectorAll('.adm-detalle-solo-lectura')).map((n) => n.textContent).join(' | ');
    expect(soloLectura).toContain('5.000');
    expect(soloLectura).toContain('12');
  });

  it('el selector de subcategoría trae sólo las del mundo actual, con la opción de crear una nueva', () => {
    const sel = panel().querySelector('.adm-detalle-subcategoria');
    expect(Array.from(sel.options).map((o) => o.textContent))
      .toEqual(['Sin subcategoría', 'Capas', 'Antifaces', '+ Crear subcategoría nueva…']);
    expect(sel.value).toBe('s1');
  });

  it('cambiar de mundo repuebla la subcategoría con las del mundo nuevo', () => {
    const selMundo = panel().querySelector('.adm-detalle-mundo');
    selMundo.value = 'combos-v2.html';
    selMundo.dispatchEvent(new Event('change'));
    const sel = panel().querySelector('.adm-detalle-subcategoria');
    expect(Array.from(sel.options).map((o) => o.textContent))
      .toEqual(['Sin subcategoría', 'Combos chicos', '+ Crear subcategoría nueva…']);
  });

  it('"Guardar" hace un update sobre catalogo_productos por id, sin tocar precio ni stock', async () => {
    const det = panel().querySelector('.adm-detalle');
    det.querySelector('input[type="text"]').value = 'Capa roja larga';
    det.querySelector('.adm-detalle-guardar').click();
    await flush();

    expect(escrituras).toHaveLength(1);
    const w = escrituras[0];
    expect(w.tabla).toBe('catalogo_productos');
    expect(w.tipo).toBe('update');
    expect(w.eqs).toEqual([['id', 'p1']]);
    expect(w.campos).toMatchObject({ titulo: 'Capa roja larga', slug: 'capa-roja-larga', pagina: 'disfraces-v2.html', subcategoria_id: 's1' });
    expect(Object.keys(w.campos)).not.toContain('precio');
    expect(Object.keys(w.campos)).not.toContain('stock');
    expect(det.querySelector('.adm-msg').textContent).toBe('Guardado.');
  });

  it('elegir "+ Crear subcategoría nueva…" inserta en catalogo_subcategorias antes de guardar el producto', async () => {
    const det = panel().querySelector('.adm-detalle');
    const sel = det.querySelector('.adm-detalle-subcategoria');
    sel.value = '__nueva__';
    sel.dispatchEvent(new Event('change'));
    det.querySelector('.adm-detalle-subcategoria-nueva').value = 'Capas de superhéroe';
    det.querySelector('.adm-detalle-guardar').click();
    await flush();

    expect(escrituras.map((w) => w.tabla + ':' + w.tipo))
      .toEqual(['catalogo_subcategorias:insert', 'catalogo_productos:update']);
    expect(escrituras[0].campos).toMatchObject({ pagina: 'disfraces-v2.html', nombre: 'Capas de superhéroe', slug: 'capas-de-superheroe', orden: 2 });
    expect(escrituras[1].campos.subcategoria_id).toBe('nueva-sub');
  });

  it('"Despublicar" es reversible: manda publicado:false y el botón pasa a "Publicar"', async () => {
    const btn = panel().querySelector('.adm-detalle-publicar');
    expect(btn.textContent).toBe('Despublicar');
    btn.click();
    await flush();

    expect(escrituras[0].tabla).toBe('catalogo_productos');
    expect(escrituras[0].campos).toEqual({ publicado: false });
    expect(escrituras[0].eqs).toEqual([['id', 'p1']]);
    expect(btn.textContent).toBe('Publicar');
  });

  it('el input de foto rechaza un archivo que no es imagen y avisa, sin escribir nada', async () => {
    const det = panel().querySelector('.adm-detalle');
    const input = det.querySelector('.adm-detalle-foto-input');
    const archivo = new File(['x'], 'notas.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
    input.dispatchEvent(new Event('change'));
    await flush();

    expect(det.querySelector('.adm-msg').textContent).toBe('Eso no es una imagen.');
    expect(escrituras).toHaveLength(0);
  });

  it('después de guardar, la fila de la lista ya muestra el título nuevo (sin recargar)', async () => {
    const det = panel().querySelector('.adm-detalle');
    det.querySelector('input[type="text"]').value = 'Capa roja larga';
    det.querySelector('.adm-detalle-guardar').click();
    await flush();

    panel().querySelector('.adm-detalle-volver').click();
    expect(titulos()).toContain('Capa roja larga');
    expect(titulos()).not.toContain('Capa roja');
  });

  it('"Volver a la lista" vuelve a pintar la tabla conservando el filtro', () => {
    panel().querySelector('.adm-detalle-volver').click();
    expect(panel().querySelector('table.adm-lista-tabla')).toBeTruthy();
    expect(filas()).toHaveLength(3);
  });
});

describe('detalle de una tarjeta de catalogo_tarjetas', () => {
  beforeEach(async () => {
    await arrancar();
    abrirPorTitulo('Combo XL');
  });

  it('no muestra fotos (viven en el HTML) pero sí nota y precio fijo editables', () => {
    const det = panel().querySelector('.adm-detalle');
    expect(det.getAttribute('data-origen')).toBe('tarjeta');
    expect(det.querySelectorAll('.adm-detalle-fotos img')).toHaveLength(0);
    expect(det.querySelector('textarea').value).toBe('Hasta 20 chicos');
    expect(det.querySelector('.adm-detalle-precio-fijo').value).toBe('9000');
  });

  it('"Guardar" hace un update sobre catalogo_tarjetas por (pagina, slug)', async () => {
    const det = panel().querySelector('.adm-detalle');
    det.querySelector('textarea').value = 'Hasta 30 chicos';
    det.querySelector('.adm-detalle-precio-fijo').value = '12000';
    det.querySelector('.adm-detalle-guardar').click();
    await flush();

    expect(escrituras).toHaveLength(1);
    const w = escrituras[0];
    expect(w.tabla).toBe('catalogo_tarjetas');
    expect(w.eqs).toEqual([['pagina', 'combos-v2.html'], ['slug', 'combo-xl']]);
    expect(w.campos).toEqual({ nota: 'Hasta 30 chicos', precio_fijo: 12000, subcategoria_id: null });
  });

  it('el precio fijo guardado se refleja en la lista al volver', async () => {
    const det = panel().querySelector('.adm-detalle');
    det.querySelector('.adm-detalle-precio-fijo').value = '12000';
    det.querySelector('.adm-detalle-guardar').click();
    await flush();

    panel().querySelector('.adm-detalle-volver').click();
    const combo = filas().find((tr) => tr.children[1].textContent === 'Combo XL');
    expect(combo.children[3].textContent).toContain('12.000');
  });

  it('"Despublicar" una tarjeta manda oculta:true (sentido invertido, nunca un delete)', async () => {
    panel().querySelector('.adm-detalle-publicar').click();
    await flush();

    expect(escrituras[0].tabla).toBe('catalogo_tarjetas');
    expect(escrituras[0].campos).toEqual({ oculta: true });
    expect(escrituras.some((w) => w.tipo === 'delete')).toBe(false);
  });
});

describe('carga degradada y re-entrada', () => {
  it('si falla la lectura de catalogo_subcategorias avisa y NO pinta la lista (nunca se puede guardar con subcategorías vacías)', async () => {
    await arrancar(DATOS_BASE(), { catalogo_subcategorias: 'permission denied' });

    expect(panel().querySelector('table')).toBeNull();
    expect(panel().querySelector('.adm-msg-error').textContent).toContain('permission denied');
    expect(escrituras).toHaveLength(0);
  });

  it('si falla catalogo_config sigue andando con el umbral por default (5)', async () => {
    await arrancar(DATOS_BASE(), { catalogo_config: 'relation does not exist' });

    expect(filas()).toHaveLength(3);
    expect(window.__MM_ADMIN_CATALOGO_TEST__.estado.umbral).toBe(5);
  });

  it('después de un error, un mm:sesion nuevo puede reintentar la carga', async () => {
    await arrancar(DATOS_BASE(), { catalogo_subcategorias: 'network' });
    expect(panel().querySelector('table')).toBeNull();

    // Segunda vuelta, esta vez sin el error: mockSb() nuevo sobre el mismo DOM.
    mockSb(DATOS_BASE());
    document.dispatchEvent(new Event('mm:sesion'));
    await flush();

    expect(filas()).toHaveLength(3);
  });

  it('un mm:sesion posterior (TOKEN_REFRESHED, doble aviso al cargar) NO repinta ni pisa el detalle abierto', async () => {
    await arrancar();
    const lecturasIniciales = lecturas.length;
    abrirPorTitulo('Capa roja');
    panel().querySelector('input[type="text"]').value = 'Edición sin guardar';

    document.dispatchEvent(new Event('mm:sesion'));
    await flush();

    expect(panel().querySelector('.adm-detalle')).toBeTruthy();
    expect(panel().querySelector('input[type="text"]').value).toBe('Edición sin guardar');
    // El único select extra es el es_admin() del gate: ninguna tabla se
    // volvió a leer.
    expect(lecturas.length).toBe(lecturasIniciales);
  });
});

describe('precios: la consulta está acotada a los códigos de la lista', () => {
  it('pide catalogo_precios_admin() SÓLO con los códigos que la lista usa, nunca la tabla entera', async () => {
    await arrancar();
    // '111' y '222' de los productos, '333' del codigo_override de la tarjeta.
    expect(rpcPrecios).toHaveLength(1);
    expect(rpcPrecios[0].sort()).toEqual(['111', '222', '333']);
    // Y nunca por la tabla: `stock` no tiene GRANT de select ni para un admin
    // desde catalogo_08_stock_privado.sql.
    expect(lecturas).not.toContain('catalogo_precios');
  });

  it('una tabla de precios enorme no entra a la lista: sólo se usan los códigos referenciados', async () => {
    // 5000 filas de precios (más que el límite de 1000 de PostgREST, que es
    // justo lo que hacía que el `.select()` pelado devolviera basura sin
    // avisar). Sólo tres códigos están referenciados por productos/tarjetas.
    const datos = DATOS_BASE();
    for (let i = 0; i < 5000; i++) {
      datos.catalogo_precios.push({ codigo: 'X' + i, precio: 100 + i, sin_stock: false, stock: 7 });
    }
    await arrancar(datos);

    expect(rpcPrecios).toHaveLength(1);
    expect(rpcPrecios[0]).not.toContain('X0');
    expect(rpcPrecios[0].length).toBe(3);
    expect(filas()).toHaveLength(3);
    // El precio de la Capa roja (código 111) sigue resolviendo aunque haya
    // 5000 filas de ruido antes que él en la tabla.
    const capa = filas().find((tr) => tr.children[1].textContent === 'Capa roja');
    expect(capa.children[3].textContent).toContain('5.000');
  });

  it('más de 200 códigos se piden en tandas, ninguna cerca del límite de PostgREST', async () => {
    const datos = DATOS_BASE();
    datos.catalogo_productos = [];
    for (let i = 0; i < 450; i++) {
      datos.catalogo_productos.push({
        id: 'p' + i, pagina: 'disfraces-v2.html', subcategoria_id: null,
        titulo: 'Art ' + i, slug: 'art-' + i, codigo: 'C' + i, descripcion: '', fotos: [], publicado: true
      });
      datos.catalogo_precios.push({ codigo: 'C' + i, precio: 1000 + i, sin_stock: false, stock: 3 });
    }
    datos.catalogo_tarjetas = [];
    await arrancar(datos);

    // 450 códigos → 200 + 200 + 50.
    expect(rpcPrecios.map((t) => t.length)).toEqual([200, 200, 50]);
    expect(filas()).toHaveLength(450);
  });

  it('sin ningún código referenciado no se pide nada de precios', async () => {
    const datos = DATOS_BASE();
    datos.catalogo_productos = [{ id: 'p9', pagina: 'combos-v2.html', subcategoria_id: null, titulo: 'Sin código', slug: 'sin-codigo', codigo: '', descripcion: '', fotos: [], publicado: true }];
    datos.catalogo_tarjetas = [];
    await arrancar(datos);

    expect(rpcPrecios).toEqual([]);
    expect(filas()).toHaveLength(1);
  });

  it('si catalogo_precios_admin() falla, el panel avisa en vez de mostrar la lista a medias', async () => {
    await arrancar(DATOS_BASE(), { catalogo_precios_admin: 'permission denied for function' });
    expect(panel().querySelector('table')).toBeNull();
    expect(panel().querySelector('.adm-msg-error')).toBeTruthy();
  });
});

describe('cabecera de sesión (#adm-sesion / #adm-logout-btn)', () => {
  it('con sesión admin muestra quién está conectado y el botón de salir', async () => {
    await arrancar();
    const info = document.getElementById('adm-sesion');
    const btn = document.getElementById('adm-logout-btn');
    expect(info.hidden).toBe(false);
    expect(info.textContent).toBe('Conectado como Local Mundo Mágico');
    expect(btn.hidden).toBe(false);
  });

  it('el botón de salir cierra la sesión de verdad', async () => {
    await arrancar();
    document.getElementById('adm-logout-btn').click();
    expect(sesionCerrada).toBe(1);
  });

  it('sin sesión quedan ocultos, igual que el panel', async () => {
    montarDOM();
    delete window.MMCuenta;
    loadScript('assets/admin-catalogo.js');
    await flush();
    expect(document.getElementById('adm-sesion').hidden).toBe(true);
    expect(document.getElementById('adm-logout-btn').hidden).toBe(true);
    expect(document.getElementById('adm-panel').hidden).toBe(true);
  });
});

describe('pestaña "Sin activar" (espejo)', () => {
  // El render completo del espejo se prueba en admin-catalogo-espejo.test.js;
  // acá sólo que se arranca junto con "Publicado" y que la tabla vacía (el
  // estado esperado hasta que exista el worker) no se muestra como error.
  it('arranca junto con la otra pestaña y muestra el vacío como aviso, no como error', async () => {
    await arrancar();
    const espejo = document.getElementById('adm-panel-espejo');
    expect(espejo.querySelector('table.adm-lista-tabla')).toBeTruthy();
    expect(espejo.textContent).toContain('No hay artículos para activar todavía.');
    expect(espejo.querySelector('.adm-msg-error')).toBeNull();
  });
});
