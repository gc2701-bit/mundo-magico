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

  function mostrarPanel() {
    gate.hidden = true;
    panel.hidden = false;
    cambiarTab('publicado');
    if (window.MMAdminCatalogoPublicado) MMAdminCatalogoPublicado.iniciar(sb);
    if (window.MMAdminCatalogoEspejo) MMAdminCatalogoEspejo.iniciar(sb);
  }

  function mostrarGate() {
    gate.hidden = false;
    panel.hidden = true;
  }

  function chequear() {
    if (!window.MMCuenta || !MMCuenta.sesionActiva()) { mostrarGate(); return; }
    sb = MMCuenta.cliente();
    if (!sb) { mostrarGate(); return; }
    sb.rpc('es_admin').then(function (r) {
      if (!r.error && r.data) mostrarPanel(); else mostrarGate();
    }).catch(function () { mostrarGate(); });
  }

  if (loginBtn) loginBtn.addEventListener('click', function () {
    if (window.MMCuenta && MMCuenta.abrirLogin) MMCuenta.abrirLogin();
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

  // Fetch real — RLS exige sesión admin, mismo criterio que
  // admin-pedidos.js (sb viene ya autenticado desde chequear() de Task 10).
  function cargarPublicado(sbCliente) {
    return Promise.all([
      sbCliente.from('catalogo_productos').select('id, pagina, subcategoria_id, titulo, slug, codigo, specs, descripcion, fotos, publicado').order('titulo'),
      sbCliente.from('catalogo_tarjetas').select('pagina, slug, oculta, sin_stock, precio_fijo, titulo_ref, nota, subcategoria_id, codigo_override, colores_sin_stock'),
      sbCliente.from('catalogo_precios').select('codigo, precio, sin_stock, stock')
    ]).then(function (r) {
      var errs = r.filter(function (x) { return x.error; });
      if (errs.length) throw errs[0].error;
      return unificarLista(r[0].data, r[1].data, r[2].data);
    });
  }

  // Ganchos SOLO para tests unitarios — no se usan en producción. Mismo
  // patrón sería "exportar" en un módulo ES real; este repo no usa ESM en
  // runtime (ver mundo-magico/CLAUDE.md), así que se expone acotado detrás
  // de un nombre que deja claro que es de test.
  window.__MM_ADMIN_CATALOGO_TEST__ = { unificarLista: unificarLista, filtrarYOrdenar: filtrarYOrdenar };
})();
