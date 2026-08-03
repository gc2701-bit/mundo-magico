/* Ruta del repartidor (ruta.html) — pantalla de celular, para la calle.
 *
 * No decide nada de seguridad: llama a mi_ruta_hoy() y repartidor_marcar()
 * (supabase/envios_10_repartidor.sql), que son las que filtran por la cuenta
 * logueada y limitan las transiciones. Si alguien abre esta URL sin ser
 * repartidor, mi_ruta_hoy() le devuelve cero filas — no hay nada que
 * esconder del lado del navegador.
 *
 * Diseño pensado para una mano y sol de frente: una tarjeta por parada,
 * botones grandes, y los datos que el repartidor mira de verdad (dirección,
 * referencia entre calles, teléfono para tocar y llamar) arriba de todo. El
 * precio y los items NO viajan hasta acá a propósito: no hacen falta para
 * entregar y mi_ruta_hoy() no los devuelve.
 */
(function () {
  'use strict';

  // Reusa el cliente que ya crea cuenta.js (mismo storage key): crear otro
  // acá disparaba el warning de Supabase por dos GoTrueClient concurrentes.
  if (!window.MMCuenta) return;
  var sb = window.MMCuenta.cliente();
  if (!sb) return;

  var MOTIVOS = window.MMEnvios ? window.MMEnvios.MOTIVOS_AUSENTE : [
    'nadie_en_domicilio', 'direccion_inexistente', 'cliente_reprogramo',
    'zona_inundada', 'vehiculo', 'otro'
  ];
  var MOTIVOS_TXT = (window.MMEnvios && window.MMEnvios.MOTIVOS_AUSENTE_TXT) || {
    nadie_en_domicilio: 'No había nadie en el domicilio',
    direccion_inexistente: 'La dirección no existe o no se encontró',
    cliente_reprogramo: 'El cliente pidió reprogramar',
    zona_inundada: 'Zona inundada / no se pudo llegar',
    vehiculo: 'Problema con el vehículo',
    otro: 'Otro motivo'
  };
  var ESTADOS_TXT = (window.MMEnvios && window.MMEnvios.ESTADOS_TXT) || {};

  var gate = document.getElementById('ruta-gate');
  var noRep = document.getElementById('ruta-norep');
  var loginBtn = document.getElementById('ruta-login-btn');
  var panel = document.getElementById('ruta-panel');
  var sesionInfo = document.getElementById('ruta-sesion');
  var logoutBtn = document.getElementById('ruta-logout-btn');
  var resumenEl = document.getElementById('ruta-resumen');
  var listaEl = document.getElementById('ruta-lista');

  var paradas = [];

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function telLimpio(t) {
    if (!t) return '';
    return window.MMEnvios ? MMEnvios.telWa(t) : t.replace(/\D/g, '');
  }

  // Mismo link de búsqueda que usa el panel: no hay clave de Google Maps en
  // este proyecto, así que no se geocodifica nada — se arma la consulta de
  // texto y que Maps resuelva.
  function linkMaps(p) {
    var q = (p.direccion || '') +
      (p.entre_calles ? ' entre ' + p.entre_calles : '') +
      (p.zona_nombre ? ', ' + p.zona_nombre : '') + ', Tucumán, Argentina';
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  }

  function marcar(p, estado, motivo, botones) {
    botones.forEach(function (b) { b.disabled = true; });
    sb.rpc('repartidor_marcar', {
      p_pedido_id: p.id,
      p_estado: estado,
      p_motivo: motivo || null
    }).then(function (r) {
      if (r.error) {
        botones.forEach(function (b) { b.disabled = false; });
        alert(r.error.message || 'No se pudo guardar. Probá de nuevo.');
        return;
      }
      cargar();
    }, function () {
      botones.forEach(function (b) { b.disabled = false; });
      alert('No se pudo guardar (¿sin señal?). Probá de nuevo.');
    });
  }

  // El motivo del ausente se elige acá mismo, desplegando la lista bajo el
  // botón: en la calle, un prompt de texto libre no se completa nunca.
  function panelAusente(p, card, botones) {
    var caja = el('div', 'ruta-motivos');
    caja.appendChild(el('p', 'ruta-motivos-t', '¿Por qué no se pudo entregar?'));
    MOTIVOS.forEach(function (m) {
      var b = el('button', 'ruta-motivo', MOTIVOS_TXT[m] || m);
      b.type = 'button';
      b.addEventListener('click', function () { marcar(p, 'ausente', m, botones); });
      caja.appendChild(b);
    });
    var volver = el('button', 'ruta-motivo-volver', 'Volver');
    volver.type = 'button';
    volver.addEventListener('click', function () {
      caja.remove();
      botones.forEach(function (b) { b.disabled = false; });
    });
    caja.appendChild(volver);
    botones.forEach(function (b) { b.disabled = true; });
    card.appendChild(caja);
  }

  function tarjeta(p, i) {
    var card = el('div', 'ruta-card' + (p.estado === 'ausente' ? ' is-ausente' : ''));

    var top = el('div', 'ruta-card-top');
    top.appendChild(el('span', 'ruta-num', String(i + 1)));
    var quien = el('div', 'ruta-quien');
    quien.appendChild(el('b', null, p.nombre || 'Sin nombre'));
    var meta = [];
    if (p.numero != null) meta.push('#' + p.numero);
    if (p.metodo_entrega === 'retiro') meta.push('TRASLADO a sucursal');
    if (p.bultos) meta.push('bulto ' + p.bultos);
    if (p.intentos_entrega > 0) meta.push(p.intentos_entrega + '° intento');
    if (meta.length) quien.appendChild(el('span', 'ruta-meta', meta.join(' · ')));
    top.appendChild(quien);
    if (p.estado !== 'listo') {
      top.appendChild(el('span', 'ruta-estado', ESTADOS_TXT[p.estado] || p.estado));
    }
    card.appendChild(top);

    if (p.direccion) {
      card.appendChild(el('p', 'ruta-dir', p.direccion));
      var sub = [];
      if (p.entre_calles) sub.push('entre ' + p.entre_calles);
      if (p.piso_depto) sub.push(p.piso_depto);
      if (p.zona_nombre) sub.push(p.zona_nombre);
      if (sub.length) card.appendChild(el('p', 'ruta-dir-sub', sub.join(' · ')));
    }
    if (p.receptor_nombre) {
      card.appendChild(el('p', 'ruta-dir-sub', 'Lo recibe: ' + p.receptor_nombre +
        (p.receptor_telefono ? ' (' + p.receptor_telefono + ')' : '')));
    }
    if (p.nota) card.appendChild(el('p', 'ruta-nota', p.nota));

    // Fila de contacto: tocar y llamar / abrir el mapa, sin copiar nada.
    var links = el('div', 'ruta-links');
    var tel = p.receptor_telefono || p.telefono;
    if (tel) {
      var llamar = el('a', 'ruta-link', 'Llamar');
      llamar.href = 'tel:' + tel.replace(/[^\d+]/g, '');
      links.appendChild(llamar);
      var wa = el('a', 'ruta-link', 'WhatsApp');
      wa.href = 'https://wa.me/' + telLimpio(tel);
      wa.target = '_blank';
      wa.rel = 'noopener';
      links.appendChild(wa);
    }
    if (p.direccion) {
      var mapa = el('a', 'ruta-link', 'Mapa');
      mapa.href = linkMaps(p);
      mapa.target = '_blank';
      mapa.rel = 'noopener';
      links.appendChild(mapa);
    }
    if (links.childNodes.length) card.appendChild(links);

    // Acciones: sólo las tres que puede hacer un repartidor (las mismas que
    // acepta repartidor_marcar). Un pedido ya marcado ausente sólo se puede
    // reintentar como entregado; reprogramarlo es del local.
    var acciones = el('div', 'ruta-acciones');
    var botones = [];

    if (p.estado === 'listo') {
      var salir = el('button', 'ruta-btn ruta-btn-sec', 'Salí con este');
      salir.type = 'button';
      botones.push(salir);
      salir.addEventListener('click', function () { marcar(p, 'en_reparto', null, botones); });
      acciones.appendChild(salir);
    }

    var entregado = el('button', 'ruta-btn ruta-btn-ok', 'Entregado');
    entregado.type = 'button';
    botones.push(entregado);
    entregado.addEventListener('click', function () { marcar(p, 'entregado', null, botones); });
    acciones.appendChild(entregado);

    if (p.estado === 'listo' || p.estado === 'en_reparto') {
      var fallo = el('button', 'ruta-btn ruta-btn-no', 'No se pudo');
      fallo.type = 'button';
      botones.push(fallo);
      fallo.addEventListener('click', function () { panelAusente(p, card, botones); });
      acciones.appendChild(fallo);
    }

    card.appendChild(acciones);
    return card;
  }

  function pintar() {
    listaEl.innerHTML = '';
    if (!paradas.length) {
      resumenEl.textContent = 'No tenés entregas pendientes para hoy.';
      return;
    }
    var enReparto = paradas.filter(function (p) { return p.estado === 'en_reparto'; }).length;
    var ausentes = paradas.filter(function (p) { return p.estado === 'ausente'; }).length;
    var partes = [paradas.length + ' parada' + (paradas.length > 1 ? 's' : '') + ' pendiente' + (paradas.length > 1 ? 's' : '')];
    if (enReparto) partes.push(enReparto + ' en el auto');
    if (ausentes) partes.push(ausentes + ' sin entregar');
    resumenEl.textContent = partes.join(' · ');
    paradas.forEach(function (p, i) { listaEl.appendChild(tarjeta(p, i)); });
  }

  function cargar() {
    resumenEl.textContent = 'Cargando…';
    sb.rpc('mi_ruta_hoy').then(function (r) {
      if (r.error) {
        resumenEl.textContent = 'No se pudo cargar la ruta: ' + r.error.message;
        return;
      }
      paradas = r.data || [];
      // Cero filas es ambiguo: puede ser "no sos repartidor" o "hoy no te
      // toca nada". mi_repartidor_id() desambigua, y así no le mostramos un
      // "no tenés entregas" tranquilizador a alguien que en realidad no
      // tiene la cuenta habilitada.
      if (!paradas.length) {
        sb.rpc('mi_repartidor_id').then(function (r2) {
          var esRep = !r2.error && r2.data;
          noRep.hidden = !!esRep;
          panel.hidden = !esRep;
          if (esRep) pintar();
        }, function () { pintar(); });
        return;
      }
      noRep.hidden = true;
      panel.hidden = false;
      pintar();
    }, function () {
      resumenEl.textContent = 'No se pudo cargar la ruta (¿sin señal?).';
    });
  }

  function pintarSesion() {
    if (!window.MMCuenta || !MMCuenta.sesionActiva()) {
      gate.hidden = false;
      panel.hidden = true;
      noRep.hidden = true;
      sesionInfo.hidden = true;
      logoutBtn.hidden = true;
      return;
    }
    gate.hidden = true;
    sesionInfo.hidden = false;
    sesionInfo.textContent = (MMCuenta.nombre() || MMCuenta.email());
    logoutBtn.hidden = false;
    cargar();
  }

  loginBtn.addEventListener('click', function () {
    if (window.MMCuenta) MMCuenta.pedirSesion(function () {});
  });

  logoutBtn.addEventListener('click', function () {
    if (window.MMCuenta) MMCuenta.cerrarSesion();
  });

  // cuenta.js resuelve la sesión de forma asíncrona: el evento puede llegar
  // después de este script, así que se escucha Y se pregunta una vez.
  document.addEventListener('mm:sesion', pintarSesion);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pintarSesion);
  else pintarSesion();
})();
