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
})();
