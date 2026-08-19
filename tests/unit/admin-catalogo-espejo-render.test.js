/* admin-catalogo.js — pestaña "Sin activar" (espejo de Búho): el render real
 * (buscador + tabla + formulario de activación) y las escrituras que dispara
 * "Confirmar activación". Complementa admin-catalogo-espejo.test.js, que
 * cubre las funciones puras (armarFilaActivacion/activarCodigo) sin DOM.
 *
 * Mismo criterio que admin-catalogo-render.test.js: el sb de Supabase es un
 * doble mínimo que registra qué tabla y qué columnas recibió cada escritura.
 * Lo que se prueba es el cableado del panel, no supabase-js.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { loadScript } from '../helpers/loadScript.js';

function montarDOM() {
  document.body.innerHTML =
    '<div id="adm-gate" class="adm-gate"><button id="adm-login-btn"></button></div>' +
    '<div id="adm-panel" class="adm-panel" hidden>' +
    '  <div class="adm-tabs"><button id="adm-tab-publicado" class="adm-tab is-active"></button><button id="adm-tab-espejo" class="adm-tab"></button></div>' +
    '  <div id="adm-panel-publicado" class="adm-tab-panel"></div>' +
    '  <div id="adm-panel-espejo" class="adm-tab-panel" hidden></div>' +
    '</div>';
}

// Un "resultado" de PostgREST: thenable y encadenable, igual que el builder
// de supabase-js (que devuelve el mismo objeto en cada .select()/.eq()/…).
function resultado(data) {
  const p = Promise.resolve({ data, error: null });
  p.select = () => p;
  p.order = () => p;
  p.eq = () => p;
  return p;
}

function resultadoError(mensaje) {
  const p = Promise.resolve({ data: null, error: new Error(mensaje) });
  p.select = () => p;
  p.order = () => p;
  p.eq = () => p;
  return p;
}

const ESPEJO_BASE = () => [
  { codigo: '58231', nombre: 'Sombrero de mago', familia: 'Disfraces', precio: 4500, stock: 20, es_combo: false, publicado: false },
  { codigo: '77012', nombre: 'Combo cumple 20 chicos', familia: 'Combos', precio: 32000, stock: null, es_combo: true, publicado: false },
  { codigo: '90004', nombre: 'Vela numero 5', familia: 'Repostería', precio: 900, stock: 0, es_combo: false, publicado: false }
];

const PUBLICADO_BASE = () => ({
  catalogo_productos: [],
  catalogo_tarjetas: [],
  catalogo_precios: [],
  catalogo_subcategorias: [
    { id: 's1', pagina: 'disfraces-v2.html', nombre: 'Sombreros', slug: 'sombreros', orden: 0 },
    { id: 's2', pagina: 'disfraces-v2.html', nombre: 'Capas', slug: 'capas', orden: 1 }
  ],
  catalogo_config: [{ umbral_pocas_unidades: 5 }]
});

let escrituras;
let consultasEspejo;
let subidas;
let filasEspejo;

// El .or() que arma cargarEspejo() es `nombre.ilike.%X%,codigo.ilike.%X%,…`:
// se extrae el término y se filtra el fixture como lo haría Postgres, así el
// test del buscador prueba que el texto tipeado llega de verdad a la query.
function terminoDe(orFiltro) {
  const m = /nombre\.ilike\.%(.*?)%/.exec(orFiltro || '');
  return m ? m[1] : '';
}

function filasVisibles(orFiltro) {
  const term = terminoDe(orFiltro).toLowerCase();
  return filasEspejo.filter((f) => {
    if (f.publicado) return false;
    if (!term) return true;
    return [f.nombre, f.codigo, f.familia].some((v) => String(v || '').toLowerCase().includes(term));
  });
}

function mockSb(opts) {
  opts = opts || {};
  const fallas = opts.fallas || {};
  escrituras = [];
  consultasEspejo = [];
  subidas = [];
  filasEspejo = opts.espejo || ESPEJO_BASE();
  const datos = PUBLICADO_BASE();

  function chainEspejo() {
    const registro = { or: null };
    consultasEspejo.push(registro);
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      or: (filtro) => { registro.or = filtro; return chain; },
      then: (res, rej) => Promise.resolve(
        fallas.espejoLectura
          ? { data: null, error: new Error(fallas.espejoLectura) }
          : { data: filasVisibles(registro.or), error: null }
      ).then(res, rej)
    };
    return chain;
  }

  const sb = {
    rpc: () => Promise.resolve({ data: true, error: null }),
    from(tabla) {
      return {
        select: () => {
          if (tabla !== 'catalogo_buho_espejo') return resultado(datos[tabla] || []);
          if (fallas.espejoBuilder) throw new Error(fallas.espejoBuilder);
          return chainEspejo();
        },
        insert(campos) {
          escrituras.push({ tabla, tipo: 'insert', campos, eqs: [] });
          if (fallas[tabla]) return resultadoError(fallas[tabla]);
          return resultado([{ id: tabla === 'catalogo_subcategorias' ? 'nueva-sub' : 'prod-nuevo' }]);
        },
        upsert(campos) {
          escrituras.push({ tabla, tipo: 'upsert', campos, eqs: [] });
          if (fallas[tabla]) return Promise.resolve({ data: null, error: new Error(fallas[tabla]) });
          return Promise.resolve({ data: [campos], error: null });
        },
        update(campos) {
          const registro = { tabla, tipo: 'update', campos, eqs: [] };
          escrituras.push(registro);
          const p = fallas[tabla] ? resultadoError(fallas[tabla]) : resultado([{ ok: 1 }]);
          p.eq = (k, v) => {
            registro.eqs.push([k, v]);
            // El espejo se comporta como la tabla real: marcar publicado=true
            // saca la fila de la próxima lectura (cargarEspejo filtra
            // publicado=false).
            if (tabla === 'catalogo_buho_espejo' && !fallas[tabla]) {
              filasEspejo.forEach((f) => { if (f[k] === v) Object.assign(f, campos); });
            }
            return p;
          };
          return p;
        }
      };
    },
    storage: {
      from: () => ({
        upload: (nombre) => {
          subidas.push(nombre);
          return Promise.resolve({ data: { path: nombre }, error: null });
        },
        getPublicUrl: (nombre) => ({ data: { publicUrl: 'https://cdn/' + nombre } })
      })
    }
  };
  window.MMCuenta = { sesionActiva: () => true, cliente: () => sb };
  return sb;
}

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};

async function arrancar(opts) {
  montarDOM();
  mockSb(opts);
  loadScript('assets/admin-catalogo.js');
  await flush();
}

const panel = () => document.getElementById('adm-panel-espejo');
const filas = () => Array.from(panel().querySelectorAll('tbody tr'));
const nombres = () => filas().map((tr) => tr.children[1].textContent);
const detalle = () => panel().querySelector('.adm-detalle');
const soloLectura = () => Array.from(panel().querySelectorAll('.adm-detalle-solo-lectura')).map((n) => n.textContent).join(' | ');

function abrirPorNombre(nombre) {
  const tr = filas().find((f) => f.children[1].textContent === nombre);
  tr.querySelector('.adm-espejo-activar').click();
}

// procesarFoto() usa createImageBitmap + <canvas>, que jsdom no implementa.
// Se stubean las dos APIs del navegador (no el código bajo test) para poder
// ejercitar el camino real de procesarFoto()/subirFoto() desde el formulario.
function stubCanvas() {
  window.createImageBitmap = () => Promise.resolve({ width: 800, height: 600 });
  HTMLCanvasElement.prototype.getContext = () => ({ fillStyle: '', fillRect() {}, drawImage() {} });
  HTMLCanvasElement.prototype.toBlob = (cb) => cb(new Blob(['x'], { type: 'image/webp' }));
}

async function subirUnaFoto() {
  stubCanvas();
  const input = detalle().querySelector('.adm-detalle-foto-input');
  const archivo = new File(['x'], 'sombrero.png', { type: 'image/png' });
  Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
  input.dispatchEvent(new Event('change'));
  await flush();
}

function elegirMundo(pagina) {
  const sel = detalle().querySelector('.adm-detalle-mundo');
  sel.value = pagina;
  sel.dispatchEvent(new Event('change'));
}

afterEach(() => { delete window.MMCuenta; });

describe('pestaña "Sin activar" — lista', () => {
  it('pinta una fila por código del espejo, con código, familia, precio, stock y tipo', async () => {
    await arrancar();
    expect(panel().querySelector('table.adm-lista-tabla')).toBeTruthy();
    expect(filas()).toHaveLength(3);

    const sombrero = filas().find((tr) => tr.children[1].textContent === 'Sombrero de mago');
    expect(sombrero.children[0].textContent).toBe('58231');
    expect(sombrero.children[2].textContent).toBe('Disfraces');
    expect(sombrero.children[3].textContent).toContain('4.500');
    expect(sombrero.children[4].textContent).toBe('20');
    expect(sombrero.children[5].textContent).toBe('Artículo');
  });

  it('un combo se marca como tal y su stock nulo se muestra como "—"', async () => {
    await arrancar();
    const combo = filas().find((tr) => tr.children[1].textContent === 'Combo cumple 20 chicos');
    expect(combo.children[4].textContent).toBe('—');
    expect(combo.children[5].textContent).toBe('Combo');
  });

  it('espejo vacío: mensaje amable, no un error (es el estado esperado hasta que exista el worker)', async () => {
    await arrancar({ espejo: [] });
    expect(panel().textContent).toContain('No hay artículos para activar todavía.');
    expect(panel().querySelector('.adm-msg-error')).toBeNull();
  });

  it('si la lectura del espejo falla, avisa del error y se puede reintentar en el próximo mm:sesion', async () => {
    await arrancar({ fallas: { espejoLectura: 'permission denied' } });
    expect(panel().querySelector('.adm-msg-error').textContent).toContain('permission denied');

    mockSb();
    document.dispatchEvent(new Event('mm:sesion'));
    await flush();
    expect(filas()).toHaveLength(3);
  });

  // La tabla catalogo_buho_espejo todavía no está aplicada en la base real:
  // si la consulta se rompe de entrada, el error tiene que quedar contenido
  // en esta pestaña — no puede tirar al admin de vuelta al gate de login ni
  // dejar la pestaña "Publicado" sin cargar.
  it('un error sincrónico armando la consulta queda contenido en la pestaña, sin volver al gate', async () => {
    await arrancar({ fallas: { espejoBuilder: 'relation does not exist' } });

    expect(document.getElementById('adm-gate').hidden).toBe(true);
    expect(document.getElementById('adm-panel').hidden).toBe(false);
    expect(panel().querySelector('.adm-msg-error').textContent).toContain('relation does not exist');
    expect(document.getElementById('adm-panel-publicado').querySelector('table')).toBeTruthy();
  });

  it('el buscador vuelve a consultar el espejo con el término tipeado y repinta las filas', async () => {
    await arrancar();
    const consultasIniciales = consultasEspejo.length;

    const buscar = document.getElementById('adm-espejo-buscar');
    buscar.value = 'combo';
    buscar.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 320));
    await flush();

    expect(consultasEspejo.length).toBe(consultasIniciales + 1);
    expect(consultasEspejo[consultasEspejo.length - 1].or).toContain('nombre.ilike.%combo%');
    expect(nombres()).toEqual(['Combo cumple 20 chicos']);
  });

  it('la búsqueda tiene debounce: tipear varias letras seguidas dispara una sola consulta', async () => {
    await arrancar();
    const consultasIniciales = consultasEspejo.length;

    const buscar = document.getElementById('adm-espejo-buscar');
    ['v', 've', 'vel', 'vela'].forEach((t) => {
      buscar.value = t;
      buscar.dispatchEvent(new Event('input'));
    });
    await new Promise((r) => setTimeout(r, 320));
    await flush();

    expect(consultasEspejo.length).toBe(consultasIniciales + 1);
    expect(nombres()).toEqual(['Vela numero 5']);
  });

  it('una búsqueda sin resultados avisa que no hay coincidencias, sin romper la tabla', async () => {
    await arrancar();
    const buscar = document.getElementById('adm-espejo-buscar');
    buscar.value = 'zzzz';
    buscar.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 320));
    await flush();

    expect(panel().textContent).toContain('No hay artículos sin activar que coincidan');
  });
});

describe('limpiarBusquedaEspejo()', () => {
  it('saca los caracteres que romperían el filtro .or() de PostgREST', async () => {
    await arrancar();
    const { limpiarBusquedaEspejo } = window.__MM_ADMIN_CATALOGO_TEST__;
    expect(limpiarBusquedaEspejo('  vela  roja ')).toBe('vela roja');
    expect(limpiarBusquedaEspejo('globo,codigo.ilike.%')).toBe('globo codigo.ilike.');
    expect(limpiarBusquedaEspejo('(a)*b')).toBe('a b');
  });
});

describe('formulario de activación', () => {
  it('muestra los datos que manda Búho como sólo lectura, sin ningún input para editarlos', async () => {
    await arrancar();
    abrirPorNombre('Sombrero de mago');

    expect(detalle()).toBeTruthy();
    expect(panel().querySelector('table')).toBeNull();
    expect(detalle().getAttribute('data-codigo')).toBe('58231');
    expect(detalle().querySelector('h2').textContent).toBe('Sombrero de mago');

    const texto = soloLectura();
    expect(texto).toContain('Sombrero de mago');
    expect(texto).toContain('58231');
    expect(texto).toContain('Disfraces');
    expect(texto).toContain('4.500');
    expect(texto).toContain('20');
    // Ni precio ni stock ni nombre son editables: los resincroniza el worker.
    // El único input de texto del formulario es el nombre de una
    // subcategoría nueva (parte del selector reusado de "Publicado").
    expect(detalle().querySelector('input[type="number"]')).toBeNull();
    expect(Array.from(detalle().querySelectorAll('input[type="text"]')).map((n) => n.className))
      .toEqual(['adm-detalle-subcategoria-nueva']);
  });

  it('el mundo arranca sin elegir y la subcategoría se repuebla con las de ese mundo', async () => {
    await arrancar();
    abrirPorNombre('Sombrero de mago');

    const selMundo = detalle().querySelector('.adm-detalle-mundo');
    expect(selMundo.value).toBe('');
    expect(selMundo.options[0].textContent).toBe('Elegí a qué mundo va…');

    elegirMundo('disfraces-v2.html');
    const sub = detalle().querySelector('.adm-detalle-subcategoria');
    expect(Array.from(sub.options).map((o) => o.textContent))
      .toEqual(['Sin subcategoría', 'Sombreros', 'Capas', '+ Crear subcategoría nueva…']);
  });

  it('sin mundo elegido no deja subir la foto (terminaría fuera de su carpeta en Storage)', async () => {
    await arrancar();
    abrirPorNombre('Sombrero de mago');
    await subirUnaFoto();

    expect(detalle().querySelector('.adm-msg-error').textContent).toContain('Elegí primero a qué mundo va');
    expect(subidas).toHaveLength(0);
  });

  it('la foto pasa por procesarFoto()/subirFoto(): se sube al bucket bajo la carpeta del mundo', async () => {
    await arrancar();
    abrirPorNombre('Sombrero de mago');
    elegirMundo('disfraces-v2.html');
    await subirUnaFoto();

    expect(subidas).toHaveLength(1);
    expect(subidas[0]).toMatch(/^disfraces-v2\/sombrero-de-mago-\d+-1\.webp$/);
    expect(detalle().querySelectorAll('.adm-detalle-fotos img')).toHaveLength(1);
  });

  it('confirmar sin mundo o sin foto avisa y no escribe nada', async () => {
    await arrancar();
    abrirPorNombre('Sombrero de mago');

    detalle().querySelector('.adm-espejo-confirmar').click();
    await flush();
    expect(detalle().querySelector('.adm-msg-error').textContent).toContain('mundo');
    expect(escrituras).toHaveLength(0);

    elegirMundo('disfraces-v2.html');
    detalle().querySelector('.adm-espejo-confirmar').click();
    await flush();
    expect(detalle().querySelector('.adm-msg-error').textContent).toContain('foto');
    expect(escrituras).toHaveLength(0);
  });

  it('"Cancelar" vuelve a la lista sin escribir nada', async () => {
    await arrancar();
    abrirPorNombre('Sombrero de mago');
    detalle().querySelector('.adm-espejo-cancelar').click();

    expect(panel().querySelector('table.adm-lista-tabla')).toBeTruthy();
    expect(filas()).toHaveLength(3);
    expect(escrituras).toHaveLength(0);
  });

  it('un mm:sesion posterior (TOKEN_REFRESHED) NO pisa el formulario abierto', async () => {
    await arrancar();
    abrirPorNombre('Sombrero de mago');
    elegirMundo('disfraces-v2.html');
    await subirUnaFoto();

    document.dispatchEvent(new Event('mm:sesion'));
    await flush();

    expect(detalle()).toBeTruthy();
    expect(detalle().querySelector('.adm-detalle-mundo').value).toBe('disfraces-v2.html');
    expect(detalle().querySelectorAll('.adm-detalle-fotos img')).toHaveLength(1);
  });
});

describe('"Confirmar activación"', () => {
  it('escribe el producto, el precio/stock y marca el espejo, con el mundo y la subcategoría elegidos', async () => {
    await arrancar();
    abrirPorNombre('Sombrero de mago');
    elegirMundo('disfraces-v2.html');
    const sub = detalle().querySelector('.adm-detalle-subcategoria');
    sub.value = 's1';
    await subirUnaFoto();

    detalle().querySelector('.adm-espejo-confirmar').click();
    await flush();

    expect(escrituras.map((w) => w.tabla + ':' + w.tipo)).toEqual([
      'catalogo_productos:insert',
      'catalogo_precios:upsert',
      'catalogo_buho_espejo:update'
    ]);
    expect(escrituras[0].campos).toMatchObject({
      pagina: 'disfraces-v2.html',
      subcategoria_id: 's1',
      titulo: 'Sombrero de mago',
      slug: 'sombrero-de-mago',
      codigo: '58231',
      publicado: true
    });
    expect(escrituras[0].campos.fotos[0].src).toContain('https://cdn/disfraces-v2/sombrero-de-mago-');
    expect(escrituras[1].campos).toMatchObject({ codigo: '58231', precio: 4500, stock: 20, sin_stock: false });
    expect(escrituras[2].campos).toEqual({ publicado: true });
    expect(escrituras[2].eqs).toEqual([['codigo', '58231']]);
  });

  it('crea la subcategoría nueva antes de insertar el producto si se eligió "+ Crear…"', async () => {
    await arrancar();
    abrirPorNombre('Sombrero de mago');
    elegirMundo('disfraces-v2.html');
    const sub = detalle().querySelector('.adm-detalle-subcategoria');
    sub.value = '__nueva__';
    sub.dispatchEvent(new Event('change'));
    detalle().querySelector('.adm-detalle-subcategoria-nueva').value = 'Galeras';
    await subirUnaFoto();

    detalle().querySelector('.adm-espejo-confirmar').click();
    await flush();

    expect(escrituras.map((w) => w.tabla + ':' + w.tipo)).toEqual([
      'catalogo_subcategorias:insert',
      'catalogo_productos:insert',
      'catalogo_precios:upsert',
      'catalogo_buho_espejo:update'
    ]);
    expect(escrituras[1].campos.subcategoria_id).toBe('nueva-sub');
  });

  it('al salir bien vuelve a la lista, confirma, y el código activado ya no aparece', async () => {
    await arrancar();
    abrirPorNombre('Sombrero de mago');
    elegirMundo('disfraces-v2.html');
    await subirUnaFoto();

    detalle().querySelector('.adm-espejo-confirmar').click();
    await flush();

    expect(panel().querySelector('.adm-detalle')).toBeNull();
    expect(panel().querySelector('table.adm-lista-tabla')).toBeTruthy();
    expect(panel().querySelector('.adm-msg-ok').textContent).toContain('quedó activado');
    expect(nombres()).toEqual(['Combo cumple 20 chicos', 'Vela numero 5']);
  });

  it('si falla una escritura, el formulario sigue abierto con el mundo y la foto ya elegidos', async () => {
    await arrancar({ fallas: { catalogo_precios: 'permission denied' } });
    abrirPorNombre('Sombrero de mago');
    elegirMundo('disfraces-v2.html');
    await subirUnaFoto();

    detalle().querySelector('.adm-espejo-confirmar').click();
    await flush();

    expect(detalle()).toBeTruthy();
    expect(detalle().querySelector('.adm-msg-error').textContent).toContain('permission denied');
    expect(detalle().querySelector('.adm-detalle-mundo').value).toBe('disfraces-v2.html');
    expect(detalle().querySelectorAll('.adm-detalle-fotos img')).toHaveLength(1);
    // Y se puede reintentar sin volver a cargar nada: el botón vuelve a estar activo.
    expect(detalle().querySelector('.adm-espejo-confirmar').disabled).toBe(false);
  });
});
