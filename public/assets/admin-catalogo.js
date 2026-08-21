/* assets/admin-catalogo.js — panel de administración de catálogo
 * (admin-catalogo.html). Reemplaza al editor in-page viejo (lápices sobre
 * las tarjetas de las páginas de categoría + barra "Modo edición") — ver
 * SPEC-catalogo-admin.md. Gate de UI con es_admin() (NO es la barrera de
 * seguridad real — esa la ponen las políticas RLS y los GRANT de columna
 * en Supabase, ver supabase/catalogo_*.sql).
 */
(function () {
  'use strict';

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  var fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

  function slug(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  var gate = $('#adm-gate');
  var loginBtn = $('#adm-login-btn');
  var panel = $('#adm-panel');
  // Mismos dos elementos que ya tienen admin-pedidos.html/admin-envios.html
  // en su .adm-head (y que admin-catalogo.html copió): quién está conectado y
  // el botón de salir. Se cablean igual que en admin-pedidos.js — sin esto el
  // markup estaba en la página pero muerto.
  var sesionInfo = $('#adm-sesion');
  var logoutBtn = $('#adm-logout-btn');
  var tabPublicado = $('#adm-tab-publicado');
  var tabEspejo = $('#adm-tab-espejo');
  var panelPublicado = $('#adm-panel-publicado');
  var panelEspejo = $('#adm-panel-espejo');

  var sb; // seteado en chequear(), cuando hay sesión — igual que admin-pedidos.js

  function cambiarTab(nombre) {
    var aEspejo = nombre === 'espejo';
    tabEspejo.classList.toggle('is-active', aEspejo);
    tabEspejo.setAttribute('aria-selected', String(aEspejo));
    tabPublicado.classList.toggle('is-active', !aEspejo);
    tabPublicado.setAttribute('aria-selected', String(!aEspejo));
    panelEspejo.hidden = !aEspejo;
    panelPublicado.hidden = aEspejo;
  }
  tabPublicado.addEventListener('click', function () { cambiarTab('publicado'); });
  tabEspejo.addEventListener('click', function () { cambiarTab('espejo'); });

  // "Publicado" es la pestaña por default sólo la PRIMERA vez que se abre el
  // panel. mostrarPanel() vuelve a correr en cada mm:sesion (el doble aviso
  // al cargar, y después un TOKEN_REFRESHED por hora): sin este flag, un
  // refresh de token silencioso pateaba al admin de "Sin activar" de vuelta a
  // "Publicado" en la mitad de una activación — el formulario seguía vivo en
  // el DOM, pero abajo de un panel oculto (los flags pubIniciado/espIniciado
  // protegen los DATOS de cada pestaña, no cuál se está viendo).
  var tabsIniciados = false;

  function mostrarPanel() {
    gate.hidden = true;
    panel.hidden = false;
    if (sesionInfo) {
      sesionInfo.hidden = false;
      sesionInfo.textContent = 'Conectado como ' +
        ((window.MMCuenta && (MMCuenta.nombre() || MMCuenta.email())) || '');
    }
    if (logoutBtn) logoutBtn.hidden = false;
    if (!tabsIniciados) {
      tabsIniciados = true;
      cambiarTab('publicado');
    }
    iniciarPublicado(sb);
    iniciarEspejo(sb);
  }

  function mostrarGate() {
    gate.hidden = false;
    panel.hidden = true;
    if (sesionInfo) sesionInfo.hidden = true;
    if (logoutBtn) logoutBtn.hidden = true;
  }

  function chequear() {
    if (!window.MMCuenta || !MMCuenta.sesionActiva()) { mostrarGate(); return; }
    sb = MMCuenta.cliente();
    if (!sb) { mostrarGate(); return; }
    sb.rpc('es_admin').then(function (r) {
      if (!r.error && r.data) mostrarPanel(); else mostrarGate();
    }).catch(function () { mostrarGate(); });
  }

  // MMCuenta no expone abrirLogin() — el modal se abre con pedirSesion()
  // (mismo método que usa admin-pedidos.js para este mismo botón). Sin este
  // fix el botón "Iniciar sesión" de este panel no hacía nada.
  if (loginBtn) loginBtn.addEventListener('click', function () {
    if (window.MMCuenta) MMCuenta.pedirSesion(function () {});
  });

  if (logoutBtn) logoutBtn.addEventListener('click', function () {
    if (window.MMCuenta) MMCuenta.cerrarSesion();
  });

  document.addEventListener('mm:sesion', chequear);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', chequear);
  else chequear();

  // Expuesto para Tasks 11-13 (mismo archivo, secciones separadas por
  // comentario "== PUBLICADO ==" / "== ESPEJO ==" más abajo en este mismo
  // IIFE — no un módulo separado, mismo estilo que admin-pedidos.js).
  window.MMAdminCatalogoUtil = { el: el, $: $, $$: $$, fmt: fmt, slug: slug };

  // == PUBLICADO ============================================================
  // Unifica catalogo_productos (productos 100% en DB) y catalogo_tarjetas
  // (tarjetas escritas a mano en el HTML con overrides — ver
  // supabase/catalogo_00_base.sql) en una sola lista para la tabla del panel.
  // Es lo único que el editor viejo hacía en dos lugares separados
  // (montarLapices() sobre .pcard vs. el panel de "ocultos") y este panel
  // muestra junto, porque desde el punto de vista de un admin es "todo lo
  // que ya está en el sitio", sin que importe dónde vive el dato.
  function mapaPrecios(precios) {
    var m = {};
    (precios || []).forEach(function (p) { m[p.codigo] = p; });
    return m;
  }

  function unificarLista(productos, tarjetas, precios) {
    var pMap = mapaPrecios(precios);
    var out = [];

    (productos || []).forEach(function (p) {
      var precioRow = p.codigo ? pMap[p.codigo] : null;
      out.push({
        id: p.id,
        origen: 'producto',
        titulo: p.titulo,
        descripcion: p.descripcion || '',
        codigo: p.codigo || '',
        mundo: p.pagina,
        subcategoriaId: p.subcategoria_id,
        precio: precioRow ? precioRow.precio : null,
        stock: precioRow ? precioRow.stock : null,
        sinStock: precioRow ? !!precioRow.sin_stock : false,
        fotos: p.fotos || [],
        publicadoOOculta: !!p.publicado
      });
    });

    (tarjetas || []).forEach(function (t) {
      out.push({
        id: t.pagina + '~' + t.slug,
        origen: 'tarjeta',
        titulo: t.titulo_ref || '(sin título registrado)',
        nota: t.nota || '',
        codigo: t.codigo_override || '',
        mundo: t.pagina,
        subcategoriaId: t.subcategoria_id || null,
        precio: t.precio_fijo != null ? t.precio_fijo : null,
        stock: null, // las tarjetas del HTML no tienen columna de stock propia
        sinStock: t.sin_stock === true,
        fotos: [],
        publicadoOOculta: !t.oculta
      });
    });

    return out;
  }

  function normalizarBusqueda(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function filtrarYOrdenar(lista, opts) {
    opts = opts || {};
    var busq = normalizarBusqueda(opts.busqueda);
    var out = lista.filter(function (item) {
      if (opts.mundo && item.mundo !== opts.mundo) return false;
      if (opts.estado === 'oculto' && item.publicadoOOculta) return false;
      if (opts.estado === 'visible' && !item.publicadoOOculta) return false;
      if (busq) {
        var titulo = normalizarBusqueda(item.titulo);
        var codigo = (item.codigo || '').toLowerCase();
        if (titulo.indexOf(busq) === -1 && codigo.indexOf(busq.toLowerCase()) === -1) return false;
      }
      return true;
    });
    if (opts.sortCol) {
      var col = opts.sortCol, dir = opts.sortDir === 'desc' ? -1 : 1;
      out.sort(function (a, b) {
        var av = a[col], bv = b[col];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'string') return av.localeCompare(bv) * dir;
        return (av - bv) * dir;
      });
    }
    return out;
  }

  // Separa una selección de ids de fila en ids de catalogo_productos vs.
  // claves compuestas {pagina,slug} de catalogo_tarjetas — necesario porque
  // una acción en lote (despublicar/ocultar) pega a tablas y columnas
  // distintas según el origen de cada fila (ver unificarLista() más arriba).
  function agruparPorOrigen(ids, lista) {
    var porId = {};
    lista.forEach(function (item) { porId[item.id] = item; });
    var productos = [], tarjetas = [];
    ids.forEach(function (id) {
      var item = porId[id];
      if (!item) return;
      if (item.origen === 'producto') productos.push(id);
      else {
        // slice(1).join('~') en vez de partes[1]: un slug puede a su vez
        // contener '~', igual que actualizarTarjeta() más abajo asume
        // split('~') de dos partes nomás — acá se es explícito porque el id
        // viene de una selección arbitraria de filas, no de un solo item.
        var partes = id.split('~');
        tarjetas.push({ pagina: partes[0], slug: partes.slice(1).join('~') });
      }
    });
    return { productos: productos, tarjetas: tarjetas };
  }

  // Los códigos que esta lista realmente usa: el de cada producto de
  // catalogo_productos y el codigo_override de cada tarjeta. Sin repetir y
  // sin vacíos — es la clave para no pedir la tabla de precios entera (ver
  // cargarPrecios() abajo). Object.create(null) y no {}: un código es texto
  // arbitrario y '__proto__'/'constructor' como clave de un objeto normal
  // haría cualquier cosa menos marcar "ya lo vi".
  function codigosDe(productos, tarjetas) {
    var vistos = Object.create(null);
    var out = [];
    function sumar(c) {
      var k = (c == null ? '' : String(c)).trim();
      if (!k || vistos[k]) return;
      vistos[k] = true;
      out.push(k);
    }
    (productos || []).forEach(function (p) { sumar(p.codigo); });
    (tarjetas || []).forEach(function (t) { sumar(t.codigo_override); });
    return out;
  }

  // De a 200 códigos por viaje: catalogo_precios tiene ~3713 filas y un
  // `.select()` pelado corta en el límite de PostgREST (1000 por default) SIN
  // NINGÚN ERROR — el panel mostraba precio y stock en blanco para la mayoría
  // del catálogo real y no había forma de darse cuenta (está escrito en el
  // comentario de cabecera de supabase/catalogo_00_base.sql). Tandas chicas
  // acotan también el largo de la URL.
  var PRECIOS_POR_TANDA = 200;

  // No es `.from('catalogo_precios')`: desde catalogo_08_stock_privado.sql la
  // columna `stock` no tiene GRANT de select para anon NI para authenticated
  // (el número real de stock no es público — regla dura del spec), y los
  // GRANT son por ROL, así que la sesión de un admin tampoco la tiene. El
  // acceso de admin va por esta función security definer, que se chequea
  // es_admin() adentro y devuelve cero filas a cualquier otro.
  function cargarPrecios(sbCliente, codigos) {
    if (!codigos.length) return Promise.resolve([]);
    var tandas = [];
    for (var i = 0; i < codigos.length; i += PRECIOS_POR_TANDA) {
      tandas.push(codigos.slice(i, i + PRECIOS_POR_TANDA));
    }
    return Promise.all(tandas.map(function (tanda) {
      return sbCliente.rpc('catalogo_precios_admin', { p_codigos: tanda }).then(function (r) {
        if (r.error) throw r.error;
        return r.data || [];
      });
    })).then(function (partes) {
      return partes.reduce(function (acc, p) { return acc.concat(p); }, []);
    });
  }

  // Fetch real — RLS exige sesión admin, mismo criterio que
  // admin-pedidos.js (sb viene ya autenticado desde chequear() de Task 10).
  // Los precios se piden DESPUÉS (no en el mismo Promise.all) porque hace
  // falta saber primero qué códigos pedir.
  function cargarPublicado(sbCliente) {
    return Promise.all([
      sbCliente.from('catalogo_productos').select('id, pagina, subcategoria_id, titulo, slug, codigo, specs, descripcion, fotos, publicado').order('titulo'),
      sbCliente.from('catalogo_tarjetas').select('pagina, slug, oculta, sin_stock, precio_fijo, titulo_ref, nota, subcategoria_id, codigo_override, colores_sin_stock')
    ]).then(function (r) {
      var errs = r.filter(function (x) { return x.error; });
      if (errs.length) throw errs[0].error;
      return cargarPrecios(sbCliente, codigosDe(r[0].data, r[1].data)).then(function (precios) {
        return unificarLista(r[0].data, r[1].data, precios);
      });
    });
  }

  // == PUBLICADO: render de la lista y del detalle ==========================
  // Los 7 mundos reales del sitio — misma lista que tenía el editor viejo
  // (y que .claude/gen-catalogo-sql.js): sirve para mostrar un nombre
  // legible en la tabla y para el selector de mundo del detalle.
  var MUNDOS = [
    { pagina: 'globos-fiesta-v2.html', nombre: 'Cotillón' },
    { pagina: 'cumpleanos-v2.html', nombre: 'Cumpleaños' },
    { pagina: 'decoracion-v2.html', nombre: 'Decoración' },
    { pagina: 'disfraces-v2.html', nombre: 'Disfraces y accesorios' },
    { pagina: 'reposteria-v2.html', nombre: 'Repostería' },
    { pagina: 'combos-v2.html', nombre: 'Combos' },
    { pagina: 'especiales-v2.html', nombre: 'Especiales' }
  ];

  function nombreMundo(pagina) {
    for (var i = 0; i < MUNDOS.length; i++) if (MUNDOS[i].pagina === pagina) return MUNDOS[i].nombre;
    return pagina || '';
  }

  // Estado de la pestaña. La lista cruda se trae UNA vez y todo el
  // filtro/orden se recalcula en memoria con filtrarYOrdenar() — escribir en
  // el buscador nunca vuelve a pegarle a la red.
  var pub = {
    lista: [], subcats: [], umbral: 5,
    busqueda: '', mundo: '', estado: '',
    sortCol: 'titulo', sortDir: 'asc'
  };

  // Click en una columna: si es otra, ordena ascendente por ella; si es la
  // misma, invierte. Pura a propósito para poder testearla sin DOM.
  function proximoSort(sortCol, sortDir, col) {
    if (sortCol !== col) return { sortCol: col, sortDir: 'asc' };
    return { sortCol: col, sortDir: sortDir === 'asc' ? 'desc' : 'asc' };
  }

  function visibles() {
    return filtrarYOrdenar(pub.lista, {
      busqueda: pub.busqueda, mundo: pub.mundo, estado: pub.estado,
      sortCol: pub.sortCol, sortDir: pub.sortDir
    });
  }

  function plata(n) { return n == null ? '—' : fmt.format(n); }

  // mostrarPanel() corre en cada evento mm:sesion, y esos son varios: cuenta.js
  // avisa tanto por getSession() como por onAuthStateChange (suelen disparar
  // los dos al cargar), y Supabase manda TOKEN_REFRESHED cada tanto mientras
  // la pestaña sigue abierta. Sin este flag, cada uno de esos eventos volvía a
  // pedir todo y repintaba #adm-panel-publicado de cero — pisando el detalle
  // abierto con las ediciones sin guardar, incluida una foto ya subida a
  // Storage cuya URL todavía sólo vive en el estado local del formulario.
  var pubIniciado = false;

  function iniciarPublicado(sbCliente) {
    if (!panelPublicado || pubIniciado) return Promise.resolve();
    pubIniciado = true;
    panelPublicado.textContent = '';
    panelPublicado.appendChild(el('p', 'adm-detalle-solo-lectura', 'Cargando catálogo…'));
    return Promise.all([
      cargarPublicado(sbCliente),
      // Subcategorías: el selector del detalle las necesita agrupadas por
      // mundo. Se leen acá directo de la tabla (esta página no carga
      // assets/catalogo.js, así que no hay MMCatalogo.datos() del que colgarse).
      sbCliente.from('catalogo_subcategorias').select('id, pagina, nombre, slug, orden'),
      sbCliente.from('catalogo_config').select('umbral_pocas_unidades')
    ]).then(function (r) {
      // Si las subcategorías no se pudieron leer hay que cortar acá, igual que
      // hace cargarPublicado() con sus tres selects: quedarse con la lista
      // vacía dejaría el <select> del detalle en "Sin subcategoría" y el
      // siguiente "Guardar" de CUALQUIER fila escribiría subcategoria_id:null,
      // desasignando la subcategoría real sin que el admin se entere.
      if (r[1] && r[1].error) throw r[1].error;
      pub.lista = r[0] || [];
      pub.subcats = (r[1] && r[1].data) || [];
      // El umbral sí es degradable: si catalogo_config no se puede leer se
      // sigue con el default (5) y lo único que pasa es que el badge "quedan
      // pocas" use otro número. No se escribe nada a partir de este dato.
      var cfg = (r[2] && r[2].data && r[2].data[0]) || null;
      if (cfg && cfg.umbral_pocas_unidades != null) pub.umbral = cfg.umbral_pocas_unidades;
      renderLista();
    }).catch(function (err) {
      // Falló la carga: no hay formulario abierto que proteger, así que se
      // libera el flag para que el próximo mm:sesion pueda reintentar.
      pubIniciado = false;
      panelPublicado.textContent = '';
      panelPublicado.appendChild(el('p', 'adm-msg-error',
        'No se pudo cargar el catálogo: ' + ((err && err.message) || 'error desconocido')));
    });
  }

  /* --- Lista ------------------------------------------------------------- */

  var tbodyLista = null;

  function renderLista() {
    panelPublicado.textContent = '';
    tbodyLista = null;

    var toolbar = el('div', 'adm-lista-toolbar');

    var buscar = document.createElement('input');
    buscar.type = 'search';
    buscar.placeholder = 'Buscar por título o código';
    buscar.setAttribute('aria-label', 'Buscar en el catálogo');
    buscar.id = 'adm-lista-buscar';
    buscar.value = pub.busqueda;
    buscar.addEventListener('input', function () { pub.busqueda = buscar.value; renderFilas(); });
    toolbar.appendChild(buscar);

    var selMundo = document.createElement('select');
    selMundo.id = 'adm-lista-mundo';
    selMundo.setAttribute('aria-label', 'Filtrar por mundo');
    agregarOpcion(selMundo, '', 'Todos los mundos');
    MUNDOS.forEach(function (m) { agregarOpcion(selMundo, m.pagina, m.nombre); });
    selMundo.value = pub.mundo;
    selMundo.addEventListener('change', function () { pub.mundo = selMundo.value; renderFilas(); });
    toolbar.appendChild(selMundo);

    var selEstado = document.createElement('select');
    selEstado.id = 'adm-lista-estado';
    selEstado.setAttribute('aria-label', 'Filtrar por estado');
    agregarOpcion(selEstado, '', 'Todos');
    agregarOpcion(selEstado, 'visible', 'Visible');
    agregarOpcion(selEstado, 'oculto', 'Oculto');
    selEstado.value = pub.estado;
    selEstado.addEventListener('change', function () { pub.estado = selEstado.value; renderFilas(); });
    toolbar.appendChild(selEstado);

    panelPublicado.appendChild(toolbar);

    // Una sola <table>: el @media de admin-catalogo.css la reflowea a cards
    // en mobile (thead oculto, tr/td en block) — no hay un DOM alternativo
    // para pantalla chica que mantener en paralelo.
    var tabla = el('table', 'adm-lista-tabla');
    var thead = document.createElement('thead');
    var trh = document.createElement('tr');
    [
      { col: 'codigo', txt: 'Código' },
      { col: 'titulo', txt: 'Título' },
      { col: 'mundo', txt: 'Mundo' },
      { col: 'precio', txt: 'Precio' },
      { col: 'publicadoOOculta', txt: 'Estado' },
      { col: null, txt: '' }
    ].forEach(function (c) {
      var th = el('th', null, c.txt);
      if (c.col) {
        th.setAttribute('data-col', c.col);
        th.tabIndex = 0;
        if (pub.sortCol === c.col) {
          th.setAttribute('aria-sort', pub.sortDir === 'asc' ? 'ascending' : 'descending');
          th.textContent = c.txt + (pub.sortDir === 'asc' ? ' ▲' : ' ▼');
        }
        th.addEventListener('click', function () { ordenarPor(c.col); });
        th.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ordenarPor(c.col); }
        });
      }
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    tabla.appendChild(thead);

    tbodyLista = document.createElement('tbody');
    tabla.appendChild(tbodyLista);
    panelPublicado.appendChild(tabla);

    renderFilas();
  }

  function agregarOpcion(select, valor, texto) {
    var o = document.createElement('option');
    o.value = valor;
    o.textContent = texto;
    select.appendChild(o);
    return o;
  }

  function ordenarPor(col) {
    var s = proximoSort(pub.sortCol, pub.sortDir, col);
    pub.sortCol = s.sortCol;
    pub.sortDir = s.sortDir;
    // Re-render completo: el encabezado también cambia (flechita/aria-sort).
    renderLista();
  }

  function renderFilas() {
    if (!tbodyLista) return;
    tbodyLista.textContent = '';
    var filas = visibles();

    if (!filas.length) {
      var trVacio = document.createElement('tr');
      var tdVacio = el('td', 'adm-detalle-solo-lectura', 'No hay artículos que coincidan.');
      tdVacio.colSpan = 6;
      trVacio.appendChild(tdVacio);
      tbodyLista.appendChild(trVacio);
      return;
    }

    filas.forEach(function (item) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-id', item.id);
      tr.appendChild(el('td', null, item.codigo || '—'));
      tr.appendChild(el('td', null, item.titulo || ''));
      tr.appendChild(el('td', null, nombreMundo(item.mundo)));
      tr.appendChild(el('td', null, plata(item.precio)));

      var tdEstado = el('td', null, item.publicadoOOculta ? 'Visible' : 'Oculto');
      if (item.sinStock) tdEstado.appendChild(el('div', 'adm-badge-sin-stock', 'sin stock'));
      else if (item.stock != null && item.stock <= pub.umbral) {
        tdEstado.appendChild(el('div', 'adm-badge-pocas', 'quedan ' + item.stock));
      }
      tr.appendChild(tdEstado);

      var tdBtn = document.createElement('td');
      var btn = el('button', 'btn btn-ghost adm-lista-editar', 'Editar');
      btn.type = 'button';
      btn.addEventListener('click', function () { abrirDetalle(item); });
      tdBtn.appendChild(btn);
      tr.appendChild(tdBtn);

      tbodyLista.appendChild(tr);
    });
  }

  /* --- Detalle ----------------------------------------------------------- */

  function campoTexto(etiqueta, valor, multilinea) {
    var wrap = el('div', 'adm-detalle-campo');
    var input = document.createElement(multilinea ? 'textarea' : 'input');
    if (!multilinea) input.type = 'text';
    input.value = valor == null ? '' : valor;
    var lab = el('label', null, etiqueta);
    lab.appendChild(input);
    wrap.appendChild(lab);
    return { wrap: wrap, input: input };
  }

  function campoSoloLectura(etiqueta, valor) {
    var wrap = el('div', 'adm-detalle-campo');
    wrap.appendChild(el('label', null, etiqueta));
    wrap.appendChild(el('div', 'adm-detalle-solo-lectura', valor));
    return wrap;
  }

  // --- Resumen del detalle ------------------------------------------------
  // El dueño pidió que precio/stock/código/familia se vean "de un vistazo"
  // al entrar a editar un artículo, con jerarquía real (precio grande, stock
  // con color) en vez de una fila más idéntica a las demás. Reusa la misma
  // clase .adm-detalle-solo-lectura de campoSoloLectura() para el valor (los
  // tests de render buscan esa clase), pero con un wrapper y un contenedor
  // propios que admin-catalogo.css pinta distinto.
  function campoResumenItem(claseExtra, etiqueta, valor) {
    var wrap = el('div', 'adm-detalle-resumen-item' + (claseExtra ? ' ' + claseExtra : ''));
    wrap.appendChild(el('label', null, etiqueta));
    wrap.appendChild(el('div', 'adm-detalle-solo-lectura', valor));
    return wrap;
  }

  function armarResumen(items, nota) {
    var caja = el('div', 'adm-detalle-resumen');
    var grilla = el('div', 'adm-detalle-resumen-grilla');
    items.forEach(function (it) { grilla.appendChild(it); });
    caja.appendChild(grilla);
    if (nota) caja.appendChild(el('p', 'adm-detalle-resumen-nota', nota));
    return caja;
  }

  // Mismo criterio que el badge de la lista (renderFilas): sin_stock manda,
  // después el umbral de catalogo_config, "ok" en cualquier otro caso
  // (incluido stock desconocido — no todos los orígenes lo tienen).
  function estadoStock(sinStock, stock, umbral) {
    if (sinStock) return 'sin-stock';
    if (stock == null) return 'na';
    if (stock <= umbral) return 'pocas';
    return 'ok';
  }

  function abrirDetalle(item) {
    panelPublicado.textContent = '';
    tbodyLista = null;

    var caja = el('div', 'adm-detalle');
    caja.setAttribute('data-origen', item.origen);
    caja.appendChild(el('h2', null, item.titulo || '(sin título)'));

    var aviso = el('p', 'adm-msg');
    aviso.hidden = true;
    function mostrar(texto, esError) {
      aviso.textContent = texto || '';
      aviso.className = 'adm-msg ' + (esError ? 'adm-msg-error' : 'adm-msg-ok');
      aviso.hidden = !texto;
    }

    var volver = el('button', 'btn btn-ghost adm-detalle-volver', 'Volver a la lista');
    volver.type = 'button';
    volver.addEventListener('click', renderLista);

    if (item.origen === 'producto') armarDetalleProducto(caja, item, mostrar);
    else armarDetalleTarjeta(caja, item, mostrar);

    caja.appendChild(aviso);
    caja.appendChild(volver);
    panelPublicado.appendChild(caja);
  }

  // Botón reversible de publicar/despublicar — nunca borra nada (ver
  // "Sacar de la web" del panel viejo y SPEC-catalogo-admin.md, sección 7).
  function botonPublicar(item, mostrar) {
    var btn = el('button', 'btn adm-detalle-publicar', item.publicadoOOculta ? 'Despublicar' : 'Publicar');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      btn.disabled = true;
      var nuevo = !item.publicadoOOculta;
      var p = item.origen === 'producto'
        ? actualizarProducto(item, { publicado: nuevo })
        : actualizarTarjeta(item, { oculta: !nuevo });
      p.then(function () {
        item.publicadoOOculta = nuevo;
        btn.disabled = false;
        btn.textContent = nuevo ? 'Despublicar' : 'Publicar';
        mostrar(nuevo ? 'Publicado.' : 'Sacado de la web (reversible).', false);
      }).catch(function (err) {
        btn.disabled = false;
        mostrar((err && err.message) || 'No se pudo cambiar el estado.', true);
      });
    });
    return btn;
  }

  function armarDetalleProducto(caja, item, mostrar) {
    // Resumen — código/precio/stock de un vistazo, antes que nada más.
    // Precio y stock NO se editan acá: los sincroniza el worker de Búho
    // contra el ERP del local (ver SPEC-catalogo-admin.md, sección 1).
    var estado = estadoStock(item.sinStock, item.stock, pub.umbral);
    caja.appendChild(armarResumen([
      campoResumenItem('adm-detalle-resumen-codigo', 'Código', item.codigo || '—'),
      campoResumenItem('adm-detalle-resumen-precio', 'Precio', plata(item.precio)),
      campoResumenItem('adm-detalle-resumen-stock es-' + estado, 'Stock', item.stock == null ? '—' : String(item.stock))
    ], 'Precio y stock los sincroniza el POS del local — no se editan acá.'));

    // Fotos: viven en la columna jsonb `fotos` de catalogo_productos, así que
    // se pueden agregar/quitar desde acá (a diferencia de una tarjeta del
    // HTML, cuyas fotos están en el markup).
    var fotos = (item.fotos || []).map(function (f) { return { src: f.src, cap: f.cap || '', codigo: f.codigo }; });

    var tira = el('div', 'adm-detalle-fotos');
    function pintarFotos() {
      tira.textContent = '';
      fotos.forEach(function (f, idx) {
        var fig = document.createElement('figure');
        var img = document.createElement('img');
        img.src = f.src;
        img.alt = f.cap || item.titulo || '';
        img.loading = 'lazy';
        fig.appendChild(img);
        var quitar = el('button', 'adm-detalle-quitar-foto', 'Quitar');
        quitar.type = 'button';
        quitar.addEventListener('click', function () { fotos.splice(idx, 1); pintarFotos(); });
        fig.appendChild(quitar);
        tira.appendChild(fig);
      });
    }
    pintarFotos();
    caja.appendChild(tira);

    var subir = el('div', 'adm-detalle-campo');
    var labSubir = el('label', null, 'Agregar foto (se ajusta sola a 1080×1080 con fondo blanco)');
    var file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.className = 'adm-detalle-foto-input';
    labSubir.appendChild(file);
    subir.appendChild(labSubir);
    caja.appendChild(subir);

    var camposEditables = el('div', 'adm-detalle-campos-editables');
    var titulo = campoTexto('Título', item.titulo);
    camposEditables.appendChild(titulo.wrap);
    var descripcion = campoTexto('Descripción', item.descripcion, true);
    camposEditables.appendChild(descripcion.wrap);

    var wrapMundo = el('div', 'adm-detalle-campo');
    var labMundo = el('label', null, 'Mundo');
    var selMundo = document.createElement('select');
    selMundo.className = 'adm-detalle-mundo';
    MUNDOS.forEach(function (m) { agregarOpcion(selMundo, m.pagina, m.nombre); });
    selMundo.value = item.mundo;
    labMundo.appendChild(selMundo);
    wrapMundo.appendChild(labMundo);
    camposEditables.appendChild(wrapMundo);

    var sub = armarSelectorSubcategoria(function () { return selMundo.value; }, item.subcategoriaId);
    // Cambiar de mundo invalida la subcategoría elegida (es de otro mundo).
    selMundo.addEventListener('change', function () { sub.repoblar(null); });
    camposEditables.appendChild(sub.wrap);
    camposEditables.appendChild(sub.nuevoWrap);
    caja.appendChild(camposEditables);

    file.addEventListener('change', function () {
      var elegido = file.files && file.files[0];
      if (!elegido) return;
      file.disabled = true;
      mostrar('Procesando la foto…', false);
      procesarFoto(elegido).then(function (blob) {
        return subirFoto(blob, selMundo.value, slug(titulo.input.value) || 'producto', fotos.length + 1);
      }).then(function (url) {
        fotos.push({ src: url, cap: '' });
        pintarFotos();
        file.value = '';
        file.disabled = false;
        mostrar('Foto lista — apretá "Guardar" para dejarla en el producto.', false);
      }).catch(function (err) {
        file.disabled = false;
        mostrar((err && err.message) || 'No se pudo subir la foto.', true);
      });
    });

    var guardar = el('button', 'btn btn-primary adm-detalle-guardar', 'Guardar');
    guardar.type = 'button';
    guardar.addEventListener('click', function () {
      var t = titulo.input.value.trim();
      if (!t) { mostrar('Poné un título.', true); return; }
      guardar.disabled = true;
      var campos = null;
      sub.resolver(selMundo.value).then(function (subcategoriaId) {
        campos = {
          titulo: t,
          slug: slug(t),
          descripcion: descripcion.input.value.trim() || null,
          pagina: selMundo.value,
          subcategoria_id: subcategoriaId || null,
          fotos: fotos
        };
        return actualizarProducto(item, campos);
      }).then(function () {
        // La lista sigue viva en memoria (pub.lista): sin esto, volver atrás
        // mostraría los datos viejos hasta recargar la página.
        item.titulo = t;
        item.descripcion = campos.descripcion || '';
        item.mundo = campos.pagina;
        item.subcategoriaId = campos.subcategoria_id;
        item.fotos = fotos.slice();
        guardar.disabled = false;
        mostrar('Guardado.', false);
      }).catch(function (err) {
        guardar.disabled = false;
        mostrar(mensajeError(err, 'No se pudo guardar.'), true);
      });
    });
    caja.appendChild(guardar);
    caja.appendChild(botonPublicar(item, mostrar));
  }

  function armarDetalleTarjeta(caja, item, mostrar) {
    var partes = String(item.id).split('~');
    caja.appendChild(el('p', 'adm-detalle-solo-lectura',
      'Tarjeta escrita a mano en el HTML: título, foto y mundo viven en el código de la página, no en la base. Desde acá se editan los datos que sí guarda la base.'));

    // Resumen — sólo el código: una tarjeta del HTML no trae precio/stock
    // propios acá (el precio es el fijo editable de abajo, o el del código).
    caja.appendChild(armarResumen([
      campoResumenItem('adm-detalle-resumen-codigo', 'Código', item.codigo || '(el del HTML)')
    ]));
    caja.appendChild(campoSoloLectura('Mundo', nombreMundo(partes[0])));

    var camposEditables = el('div', 'adm-detalle-campos-editables');
    var nota = campoTexto('Nota (se muestra en la tarjeta)', item.nota, true);
    camposEditables.appendChild(nota.wrap);

    var wrapPrecio = el('div', 'adm-detalle-campo');
    var labPrecio = el('label', null, 'Precio fijo (vacío = usa el precio del código)');
    var precioIn = document.createElement('input');
    precioIn.type = 'number';
    precioIn.min = '0';
    precioIn.step = '1';
    precioIn.className = 'adm-detalle-precio-fijo';
    precioIn.value = item.precio == null ? '' : String(item.precio);
    labPrecio.appendChild(precioIn);
    wrapPrecio.appendChild(labPrecio);
    camposEditables.appendChild(wrapPrecio);

    var sub = armarSelectorSubcategoria(function () { return partes[0]; }, item.subcategoriaId);
    camposEditables.appendChild(sub.wrap);
    camposEditables.appendChild(sub.nuevoWrap);
    caja.appendChild(camposEditables);

    var guardar = el('button', 'btn btn-primary adm-detalle-guardar', 'Guardar');
    guardar.type = 'button';
    guardar.addEventListener('click', function () {
      guardar.disabled = true;
      var precio = precioIn.value.trim();
      var campos = null;
      sub.resolver(partes[0]).then(function (subcategoriaId) {
        campos = {
          nota: nota.input.value.trim() || null,
          precio_fijo: precio === '' ? null : Number(precio),
          subcategoria_id: subcategoriaId || null
        };
        return actualizarTarjeta(item, campos);
      }).then(function () {
        item.nota = campos.nota || '';
        item.precio = campos.precio_fijo;
        item.subcategoriaId = campos.subcategoria_id;
        guardar.disabled = false;
        mostrar('Guardado.', false);
      }).catch(function (err) {
        guardar.disabled = false;
        mostrar(mensajeError(err, 'No se pudo guardar.'), true);
      });
    });
    caja.appendChild(guardar);
    caja.appendChild(botonPublicar(item, mostrar));
  }

  function mensajeError(err, porDefecto) {
    var msg = (err && err.message) || '';
    if (/duplicate key|unique/i.test(msg)) return 'Ya hay otro artículo con ese nombre en ese mundo.';
    return msg || porDefecto;
  }

  /* --- Escrituras -------------------------------------------------------- */

  // .select() + chequear filas: si el RLS de admin filtra la fila (sesión
  // vencida, por ejemplo) Postgres no tira error — el update "sale bien" sin
  // tocar nada. Mismo chequeo que hacía el editor viejo al guardar.
  function actualizarProducto(item, campos) {
    return sb.from('catalogo_productos').update(campos).eq('id', item.id).select('id')
      .then(function (r) {
        if (r.error) throw r.error;
        if (!r.data || !r.data.length) throw new Error('No se guardó — probablemente se cerró la sesión de admin. Recargá la página.');
      });
  }

  function actualizarTarjeta(item, campos) {
    var partes = String(item.id).split('~');
    return sb.from('catalogo_tarjetas').update(campos)
      .eq('pagina', partes[0]).eq('slug', partes[1]).select('slug')
      .then(function (r) {
        if (r.error) throw r.error;
        if (!r.data || !r.data.length) throw new Error('No se guardó — probablemente se cerró la sesión de admin. Recargá la página.');
      });
  }

  // Despublicar/ocultar en lote — SIEMPRE reversible (ver Global
  // Constraints: nunca borrado definitivo desde este panel). Un producto
  // se despublica con publicado=false (misma columna que ya usa
  // "sacar de la web" del editor viejo); una tarjeta con oculta=true.
  function despublicarLote(sbCliente, ids, lista) {
    var grupo = agruparPorOrigen(ids, lista);
    var pasos = [];
    if (grupo.productos.length) {
      pasos.push(sbCliente.from('catalogo_productos').update({ publicado: false }).in('id', grupo.productos));
    }
    grupo.tarjetas.forEach(function (t) {
      pasos.push(sbCliente.from('catalogo_tarjetas').update({ oculta: true }).eq('pagina', t.pagina).eq('slug', t.slug));
    });
    return Promise.all(pasos);
  }

  /* --- Subcategorías ------------------------------------------------------ */
  // Adaptado de armarSelectorSubcategoria()/resolverSubcategoriaSelector()/
  // guardarSubcategoriaNueva() del editor viejo (popover sobre una tarjeta):
  // misma lógica de Supabase, pero contra pub.subcats en vez de
  // MMCatalogo.datos() y en un formulario de página completa.

  function subcatsDe(pagina) {
    return pub.subcats.filter(function (s) { return s.pagina === pagina; })
      .sort(function (a, b) { return (a.orden - b.orden) || a.nombre.localeCompare(b.nombre); });
  }

  // Una subcategoría nueva no debe nacer empatada en "orden" con la primera
  // del mundo (con las dos en 0, "Subir"/"Bajar" no movía nada).
  function proximoOrden(pagina) {
    var max = -1;
    subcatsDe(pagina).forEach(function (s) { if (s.orden > max) max = s.orden; });
    return max + 1;
  }

  function guardarSubcategoriaNueva(pagina, nombre) {
    var slugNueva = slug(nombre);
    // Si ya existe una con ese nombre en el mundo se reusa, en vez de chocar
    // contra unique(pagina, slug) de catalogo_subcategorias.
    var existente = pub.subcats.filter(function (s) {
      return s.pagina === pagina && s.slug === slugNueva;
    })[0];
    if (existente) return Promise.resolve(existente.id);

    var orden = proximoOrden(pagina);
    return sb.from('catalogo_subcategorias')
      .insert({ pagina: pagina, nombre: nombre, slug: slugNueva, orden: orden })
      .select('id')
      .then(function (r) {
        if (r.error) throw r.error;
        var id = r.data && r.data[0] && r.data[0].id;
        if (id) pub.subcats.push({ id: id, pagina: pagina, nombre: nombre, slug: slugNueva, orden: orden });
        return id;
      });
  }

  // paginaDe(): función, porque el mundo puede cambiar mientras el detalle
  // está abierto (el <select> de mundo de un producto).
  function armarSelectorSubcategoria(paginaDe, actualId) {
    var wrap = el('div', 'adm-detalle-campo');
    var lab = el('label', null, 'Subcategoría');
    var select = document.createElement('select');
    select.className = 'adm-detalle-subcategoria';
    lab.appendChild(select);
    wrap.appendChild(lab);

    var nuevoWrap = el('div', 'adm-detalle-campo');
    var labNuevo = el('label', null, 'Nombre de la subcategoría nueva');
    var nuevoInput = document.createElement('input');
    nuevoInput.type = 'text';
    nuevoInput.className = 'adm-detalle-subcategoria-nueva';
    labNuevo.appendChild(nuevoInput);
    nuevoWrap.appendChild(labNuevo);
    nuevoWrap.hidden = true;

    function repoblar(preseleccion) {
      select.textContent = '';
      agregarOpcion(select, '', 'Sin subcategoría');
      subcatsDe(paginaDe()).forEach(function (s) {
        var o = agregarOpcion(select, s.id, s.nombre);
        if (preseleccion && s.id === preseleccion) o.selected = true;
      });
      agregarOpcion(select, '__nueva__', '+ Crear subcategoría nueva…');
      nuevoWrap.hidden = true;
    }

    select.addEventListener('change', function () {
      nuevoWrap.hidden = select.value !== '__nueva__';
    });
    repoblar(actualId);

    // undefined nunca: null = "sin subcategoría", string = el id elegido o
    // el de la que se acaba de crear.
    function resolver(pagina) {
      if (select.value === '__nueva__') {
        var nombre = nuevoInput.value.trim();
        if (!nombre) return Promise.resolve(null);
        return guardarSubcategoriaNueva(pagina, nombre);
      }
      return Promise.resolve(select.value || null);
    }

    return { wrap: wrap, nuevoWrap: nuevoWrap, select: select, nuevoInput: nuevoInput, repoblar: repoblar, resolver: resolver };
  }

  /* --- Fotos ------------------------------------------------------------- */
  // Portado tal cual del editor viejo (procesarFoto/subirFoto).

  // Ajusta a 1080×1080 con fondo blanco (contain, nunca recorta el
  // producto) y comprime a webp — mismo criterio que el resto del catálogo
  // (ver .claude/normalize-products.js para el equivalente de escritorio).
  function procesarFoto(file) {
    if (!file) return Promise.reject(new Error('Elegí una foto.'));
    if (!/^image\//.test(file.type)) return Promise.reject(new Error('Eso no es una imagen.'));
    if (file.size > 8 * 1024 * 1024) return Promise.reject(new Error('La foto pesa más de 8 MB — probá con otra.'));
    if (!window.createImageBitmap) return Promise.reject(new Error('Este navegador no puede procesar la foto. Probá desde otro.'));

    return createImageBitmap(file).then(function (bitmap) {
      var lado = 1080;
      // Math.min(…, 1): nunca agranda una foto chica más allá de su tamaño
      // real — agrandarla sólo la haría ver borrosa sin ganar nada.
      var escala = Math.min(lado / bitmap.width, lado / bitmap.height, 1);
      var w = Math.round(bitmap.width * escala), h = Math.round(bitmap.height * escala);
      var x = Math.round((lado - w) / 2), y = Math.round((lado - h) / 2);
      var canvas = document.createElement('canvas');
      canvas.width = lado; canvas.height = lado;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, lado, lado);
      ctx.drawImage(bitmap, x, y, w, h);
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob); else reject(new Error('No se pudo procesar la foto.'));
        }, 'image/webp', 0.84);
      });
    }).catch(function (err) {
      throw new Error((err && err.message) || 'No se pudo leer la foto.');
    });
  }

  // sufijo: para que dos fotos de la misma galería, subidas en el mismo
  // milisegundo, no choquen de nombre (Date.now() solo no alcanza ahí).
  function subirFoto(blob, paginaDestino, slugProducto, sufijo) {
    var carpeta = paginaDestino.replace(/\.html$/, '');
    var nombre = carpeta + '/' + slugProducto + '-' + Date.now() + '-' + sufijo + '.webp';
    return sb.storage.from('catalogo').upload(nombre, blob, { contentType: 'image/webp', upsert: false })
      .then(function (r) {
        if (r.error) throw r.error;
        var pub2 = sb.storage.from('catalogo').getPublicUrl(nombre);
        if (!pub2.data || !pub2.data.publicUrl) throw new Error('No se pudo obtener la URL de la foto.');
        return pub2.data.publicUrl;
      });
  }

  // == ESPEJO ================================================================
  // Pestaña "Sin activar": códigos que ya llegaron del ERP del local vía el
  // espejo de Búho (catalogo_buho_espejo, Task 1) pero todavía no tienen
  // producto propio en el catálogo. Primero las funciones de datos
  // (cargarEspejo/armarFilaActivacion/activarCodigo) y después el render de
  // la lista y del formulario de activación.
  function cargarEspejo(sbCliente, opts) {
    opts = opts || {};
    var q = sbCliente.from('catalogo_buho_espejo').select('*').eq('publicado', false).order('nombre');
    if (opts.busqueda) q = q.or('nombre.ilike.%' + opts.busqueda + '%,codigo.ilike.%' + opts.busqueda + '%,familia.ilike.%' + opts.busqueda + '%');
    return q.then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  }

  // Arma lo necesario para activar un código del espejo: la fila nueva de
  // catalogo_productos, el precio/stock inicial de catalogo_precios, y deja
  // afuera (lo hace activarCodigo() más abajo) el update de
  // catalogo_buho_espejo.publicado=true — ese es un paso de red separado,
  // esto es sólo el armado, que es lo testeable sin mockear Supabase.
  function armarFilaActivacion(codigoEspejo, opts) {
    opts = opts || {};
    if (!opts.mundo) throw new Error('Elegí a qué mundo va este artículo.');
    if (!opts.fotos || !opts.fotos.length) throw new Error('Subí al menos una foto antes de activar.');

    var tituloSlug = slug(codigoEspejo.nombre);
    return {
      producto: {
        pagina: opts.mundo,
        subcategoria_id: opts.subcategoriaId || null,
        titulo: codigoEspejo.nombre,
        slug: tituloSlug,
        codigo: codigoEspejo.codigo,
        fotos: opts.fotos,
        orden: 0,
        publicado: true
      },
      precio: {
        codigo: codigoEspejo.codigo,
        precio: codigoEspejo.precio,
        stock: codigoEspejo.stock,
        sin_stock: codigoEspejo.stock != null && codigoEspejo.stock <= 0
      }
    };
  }

  // Efecto de red completo de "Activar": producto + precio + marcar el
  // espejo. Tres escrituras separadas porque son tres tablas — si la
  // segunda o tercera fallan después de que la primera tuvo éxito, el
  // producto ya quedó visible pero sin precio/sin marcar en el espejo; se
  // deja loggeado en consola para que el admin reintente manualmente (no
  // hay transacción cross-tabla posible desde el cliente vía PostgREST).
  function activarCodigo(sbCliente, codigoEspejo, opts) {
    var armado = armarFilaActivacion(codigoEspejo, opts);
    return sbCliente.from('catalogo_productos').insert(armado.producto).select('id').then(function (r) {
      if (r.error) throw r.error;
      return sbCliente.from('catalogo_precios').upsert(armado.precio).then(function (r2) {
        if (r2.error) throw r2.error;
        return sbCliente.from('catalogo_buho_espejo').update({ publicado: true }).eq('codigo', codigoEspejo.codigo)
          .then(function (r3) {
            if (r3.error) throw r3.error;
            return r3;
          });
      });
    });
  }

  /* --- Espejo: lista ------------------------------------------------------ */

  // A diferencia de "Publicado" (que se trae todo una vez y filtra en
  // memoria), acá la búsqueda vuelve a pegarle a la red: el espejo completo
  // de Búho va a ser mucho más grande que el catálogo publicado y no tiene
  // sentido bajarlo entero al browser (ver SPEC-catalogo-admin.md, 2.1/2.4 —
  // los índices trgm existen justo para que esta búsqueda sea server-side).
  var esp = { lista: [], busqueda: '' };
  var tbodyEspejo = null;
  var espAviso = null;
  var espTimer = null;
  var espToken = 0;
  var ESPEJO_DEBOUNCE_MS = 250;

  // Mismo motivo que pubIniciado (ver arriba): mostrarPanel() corre en cada
  // mm:sesion — al cargar suelen ser dos, y después uno por cada
  // TOKEN_REFRESHED. Sin el flag, cada uno repintaría #adm-panel-espejo y
  // pisaría un formulario de activación abierto (con su foto ya subida a
  // Storage y todavía no guardada en ninguna tabla).
  var espIniciado = false;

  function iniciarEspejo(sbCliente) {
    if (!panelEspejo || espIniciado) return Promise.resolve();
    espIniciado = true;
    panelEspejo.textContent = '';
    panelEspejo.appendChild(el('p', 'adm-detalle-solo-lectura', 'Cargando el espejo de Búho…'));
    // Promise.resolve().then(): que cargarEspejo() tire sincrónicamente (por
    // ejemplo si la tabla todavía no existe en el proyecto y el builder se
    // rompe) tiene que terminar en el aviso de abajo, no propagarse hasta el
    // .catch() de chequear() — ahí mandaría al admin de vuelta a la pantalla
    // de login por un problema de UNA pestaña.
    return Promise.resolve().then(function () {
      return cargarEspejo(sbCliente);
    }).then(function (filas) {
      esp.lista = filas || [];
      renderEspejo();
    }).catch(function (err) {
      // Igual que iniciarPublicado(): al fallar no hay formulario que
      // proteger, así que se libera el flag para poder reintentar.
      espIniciado = false;
      panelEspejo.textContent = '';
      panelEspejo.appendChild(el('p', 'adm-msg adm-msg-error',
        'No se pudo cargar el espejo de Búho: ' + ((err && err.message) || 'error desconocido')));
    });
  }

  // El texto de búsqueda va interpolado dentro del filtro .or() de PostgREST
  // (`nombre.ilike.%X%,codigo.ilike.%X%,...`). Una coma o un paréntesis ahí
  // no es un problema de datos —esta tabla es solo-admin por RLS— pero rompe
  // el parseo del filtro y devuelve un 400 en vez de resultados.
  function limpiarBusquedaEspejo(s) {
    return (s || '').replace(/[(),*%\\]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Devuelve true si la respuesta que llegó es la de la última búsqueda
  // pedida; false si quedó vieja (el admin siguió tipeando y hay otra en
  // vuelo) — así una respuesta lenta no pisa una lista más nueva.
  function refrescarEspejo() {
    var mio = ++espToken;
    return cargarEspejo(sb, { busqueda: esp.busqueda }).then(function (filas) {
      if (mio !== espToken) return false;
      esp.lista = filas || [];
      return true;
    });
  }

  function avisoEspejo(texto, esError) {
    if (!espAviso) return;
    espAviso.textContent = texto || '';
    espAviso.className = 'adm-msg ' + (esError ? 'adm-msg-error' : 'adm-msg-ok');
    espAviso.hidden = !texto;
  }

  function buscarEnEspejo(texto) {
    esp.busqueda = limpiarBusquedaEspejo(texto);
    if (espTimer) clearTimeout(espTimer);
    espTimer = setTimeout(function () {
      espTimer = null;
      refrescarEspejo().then(function (aplicada) {
        if (aplicada) { avisoEspejo('', false); renderFilasEspejo(); }
      }).catch(function (err) {
        avisoEspejo('No se pudo buscar: ' + ((err && err.message) || 'error desconocido'), true);
      });
    }, ESPEJO_DEBOUNCE_MS);
  }

  // El buscador y el <table> se arman una sola vez; cada resultado de
  // búsqueda repinta sólo el <tbody> (si se repintara todo, el input
  // perdería el foco en la mitad de una palabra).
  function renderEspejo(mensajeOk) {
    panelEspejo.textContent = '';
    tbodyEspejo = null;

    var toolbar = el('div', 'adm-lista-toolbar');
    var buscar = document.createElement('input');
    buscar.type = 'search';
    buscar.id = 'adm-espejo-buscar';
    buscar.placeholder = 'Buscar por nombre, código o familia';
    buscar.setAttribute('aria-label', 'Buscar en el espejo de Búho');
    buscar.value = esp.busqueda;
    buscar.addEventListener('input', function () { buscarEnEspejo(buscar.value); });
    toolbar.appendChild(buscar);
    panelEspejo.appendChild(toolbar);

    espAviso = el('p', 'adm-msg');
    espAviso.hidden = true;
    panelEspejo.appendChild(espAviso);
    if (mensajeOk) avisoEspejo(mensajeOk, false);

    var tabla = el('table', 'adm-lista-tabla');
    var thead = document.createElement('thead');
    var trh = document.createElement('tr');
    // Sin orden por columna: el orden lo fija la consulta (por nombre) y la
    // lista se pagina/filtra del lado del servidor.
    ['Código', 'Nombre', 'Familia', 'Precio', 'Stock', 'Tipo', ''].forEach(function (txt) {
      trh.appendChild(el('th', null, txt));
    });
    thead.appendChild(trh);
    tabla.appendChild(thead);
    tbodyEspejo = document.createElement('tbody');
    tabla.appendChild(tbodyEspejo);
    panelEspejo.appendChild(tabla);

    renderFilasEspejo();
  }

  function renderFilasEspejo() {
    if (!tbodyEspejo) return;
    tbodyEspejo.textContent = '';

    if (!esp.lista.length) {
      // Vacío NO es un error: hasta que el worker de Búho exista y corra su
      // primer ciclo, esta tabla está vacía a propósito (SPEC, sección 1).
      var trVacio = document.createElement('tr');
      var tdVacio = el('td', 'adm-detalle-solo-lectura', esp.busqueda
        ? 'No hay artículos sin activar que coincidan con la búsqueda.'
        : 'No hay artículos para activar todavía.');
      tdVacio.colSpan = 7;
      trVacio.appendChild(tdVacio);
      tbodyEspejo.appendChild(trVacio);
      return;
    }

    esp.lista.forEach(function (fila) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-codigo', fila.codigo);
      tr.appendChild(el('td', null, fila.codigo || '—'));
      tr.appendChild(el('td', null, fila.nombre || ''));
      tr.appendChild(el('td', null, fila.familia || '—'));
      tr.appendChild(el('td', null, plata(fila.precio)));
      // El stock sí se muestra acá: es una pantalla de admin, no algo que
      // llegue a un visitante (la prohibición del SPEC es sobre
      // catalogo_publico(), no sobre este panel).
      tr.appendChild(el('td', null, fila.stock == null ? '—' : String(fila.stock)));
      tr.appendChild(el('td', null, fila.es_combo ? 'Combo' : 'Artículo'));

      var tdBtn = document.createElement('td');
      var btn = el('button', 'btn btn-primary adm-espejo-activar', 'Activar');
      btn.type = 'button';
      btn.addEventListener('click', function () { abrirActivacion(fila); });
      tdBtn.appendChild(btn);
      tr.appendChild(tdBtn);

      tbodyEspejo.appendChild(tr);
    });
  }

  /* --- Espejo: formulario de activación ----------------------------------- */

  // Lo único que el admin decide al activar es dónde va (mundo +
  // subcategoría) y con qué foto: nombre, precio, stock y familia los manda
  // Búho y son de sólo lectura acá. Reusa el mismo selector de subcategoría
  // y las mismas procesarFoto()/subirFoto() del detalle de "Publicado".
  function abrirActivacion(fila) {
    panelEspejo.textContent = '';
    tbodyEspejo = null;

    var caja = el('div', 'adm-detalle');
    caja.setAttribute('data-origen', 'espejo');
    caja.setAttribute('data-codigo', fila.codigo);
    caja.appendChild(el('h2', null, fila.nombre || '(sin nombre)'));

    var aviso = el('p', 'adm-msg');
    aviso.hidden = true;
    function mostrar(texto, esError) {
      aviso.textContent = texto || '';
      aviso.className = 'adm-msg ' + (esError ? 'adm-msg-error' : 'adm-msg-ok');
      aviso.hidden = !texto;
    }

    // Datos que manda Búho — no se editan desde acá (el worker los
    // resincroniza y pisaría cualquier cambio local). El nombre ya está en
    // el <h2> de arriba; código/familia/precio/stock/tipo van agrupados en
    // el resumen, de un vistazo y antes que nada editable.
    caja.appendChild(campoSoloLectura('Nombre (lo manda Búho)', fila.nombre || '—'));

    var estadoEsp = estadoStock(fila.stock === 0, fila.stock, pub.umbral);
    var resumenEsp = [
      campoResumenItem('adm-detalle-resumen-codigo', 'Código', fila.codigo || '—'),
      campoResumenItem('adm-detalle-resumen-familia', 'Familia', fila.familia || '—'),
      campoResumenItem('adm-detalle-resumen-precio', 'Precio', plata(fila.precio)),
      campoResumenItem('adm-detalle-resumen-stock es-' + estadoEsp, 'Stock', fila.stock == null ? '—' : String(fila.stock))
    ];
    if (fila.es_combo) resumenEsp.push(campoResumenItem('adm-detalle-resumen-tipo', 'Tipo', 'Combo'));
    caja.appendChild(armarResumen(resumenEsp, 'Lo manda Búho y lo sincroniza el POS — no se edita acá.'));

    var fotos = [];
    var tira = el('div', 'adm-detalle-fotos');
    function pintarFotos() {
      tira.textContent = '';
      fotos.forEach(function (f, idx) {
        var fig = document.createElement('figure');
        var img = document.createElement('img');
        img.src = f.src;
        img.alt = f.cap || fila.nombre || '';
        img.loading = 'lazy';
        fig.appendChild(img);
        var quitar = el('button', 'adm-detalle-quitar-foto', 'Quitar');
        quitar.type = 'button';
        quitar.addEventListener('click', function () { fotos.splice(idx, 1); pintarFotos(); });
        fig.appendChild(quitar);
        tira.appendChild(fig);
      });
    }
    caja.appendChild(tira);

    var camposEditables = el('div', 'adm-detalle-campos-editables');

    var subir = el('div', 'adm-detalle-campo');
    var labSubir = el('label', null, 'Foto (se ajusta sola a 1080×1080 con fondo blanco)');
    var file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.className = 'adm-detalle-foto-input';
    labSubir.appendChild(file);
    subir.appendChild(labSubir);
    camposEditables.appendChild(subir);

    var wrapMundo = el('div', 'adm-detalle-campo');
    var labMundo = el('label', null, 'Mundo');
    var selMundo = document.createElement('select');
    selMundo.className = 'adm-detalle-mundo';
    // Sin preselección: activar en el mundo equivocado publica el artículo
    // en una página que no le corresponde, así que es una elección
    // explícita, no un default.
    agregarOpcion(selMundo, '', 'Elegí a qué mundo va…');
    MUNDOS.forEach(function (m) { agregarOpcion(selMundo, m.pagina, m.nombre); });
    selMundo.value = '';
    labMundo.appendChild(selMundo);
    wrapMundo.appendChild(labMundo);
    camposEditables.appendChild(wrapMundo);

    var sub = armarSelectorSubcategoria(function () { return selMundo.value; }, null);
    selMundo.addEventListener('change', function () { sub.repoblar(null); });
    camposEditables.appendChild(sub.wrap);
    camposEditables.appendChild(sub.nuevoWrap);
    caja.appendChild(camposEditables);

    file.addEventListener('change', function () {
      var elegido = file.files && file.files[0];
      if (!elegido) return;
      // subirFoto() arma la ruta en Storage a partir del mundo destino; sin
      // mundo elegido la foto terminaría en la raíz del bucket.
      if (!selMundo.value) { file.value = ''; mostrar('Elegí primero a qué mundo va, así la foto se guarda en su carpeta.', true); return; }
      file.disabled = true;
      mostrar('Procesando la foto…', false);
      procesarFoto(elegido).then(function (blob) {
        return subirFoto(blob, selMundo.value, slug(fila.nombre) || 'producto', fotos.length + 1);
      }).then(function (url) {
        fotos.push({ src: url, cap: '' });
        pintarFotos();
        file.value = '';
        file.disabled = false;
        mostrar('Foto lista — apretá "Confirmar activación".', false);
      }).catch(function (err) {
        file.disabled = false;
        mostrar((err && err.message) || 'No se pudo subir la foto.', true);
      });
    });

    var confirmar = el('button', 'btn btn-primary adm-espejo-confirmar', 'Confirmar activación');
    confirmar.type = 'button';
    confirmar.addEventListener('click', function () {
      // Los mismos dos chequeos los vuelve a hacer armarFilaActivacion()
      // dentro de activarCodigo(); acá adelante el mensaje sin gastar un
      // viaje a la red ni crear una subcategoría nueva al pedo.
      if (!selMundo.value) { mostrar('Elegí a qué mundo va este artículo.', true); return; }
      if (!fotos.length) { mostrar('Subí al menos una foto antes de activar.', true); return; }
      confirmar.disabled = true;
      mostrar('Activando…', false);
      var mundoElegido = selMundo.value;
      sub.resolver(mundoElegido).then(function (subcategoriaId) {
        return activarCodigo(sb, fila, { mundo: mundoElegido, subcategoriaId: subcategoriaId, fotos: fotos });
      }).then(function () {
        // Ya está activado: de acá en más nada puede "desactivarlo", así que
        // si el refresco de la lista falla igual se vuelve a la lista (con
        // la fila sacada a mano) en vez de mostrar un error que haría pensar
        // que la activación no salió.
        return refrescarEspejo().catch(function () {
          esp.lista = esp.lista.filter(function (f) { return f.codigo !== fila.codigo; });
          return true;
        });
      }).then(function () {
        renderEspejo('«' + (fila.nombre || fila.codigo) + '» quedó activado y visible en ' + nombreMundo(mundoElegido) + '.');
      }).catch(function (err) {
        // Falló la activación: se deja el formulario como está (mundo,
        // subcategoría y fotos ya subidas incluidas) para poder reintentar
        // sin volver a cargar todo.
        confirmar.disabled = false;
        mostrar(mensajeError(err, 'No se pudo activar.'), true);
      });
    });
    var cancelar = el('button', 'btn btn-ghost adm-espejo-cancelar', 'Cancelar');
    cancelar.type = 'button';
    cancelar.addEventListener('click', function () { renderEspejo(); });

    caja.appendChild(aviso);
    caja.appendChild(confirmar);
    caja.appendChild(cancelar);
    panelEspejo.appendChild(caja);
  }

  // Ganchos SOLO para tests unitarios — no se usan en producción. Mismo
  // patrón sería "exportar" en un módulo ES real; este repo no usa ESM en
  // runtime (ver mundo-magico/CLAUDE.md), así que se expone acotado detrás
  // de un nombre que deja claro que es de test.
  window.__MM_ADMIN_CATALOGO_TEST__ = {
    unificarLista: unificarLista,
    codigosDe: codigosDe,
    filtrarYOrdenar: filtrarYOrdenar,
    proximoSort: proximoSort,
    nombreMundo: nombreMundo,
    agruparPorOrigen: agruparPorOrigen,
    despublicarLote: despublicarLote,
    armarFilaActivacion: armarFilaActivacion,
    activarCodigo: activarCodigo,
    limpiarBusquedaEspejo: limpiarBusquedaEspejo,
    estado: pub,
    estadoEspejo: esp
  };
})();
