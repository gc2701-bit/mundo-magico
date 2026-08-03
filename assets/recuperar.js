/* Lógica de recuperar.html. No crea su propio cliente de Supabase — usa el
 * que ya arma cuenta.js (window.MMCuenta) para no terminar con dos clientes
 * de Auth compitiendo por el mismo storage.
 */
(function () {
  'use strict';

  function $(sel) { return document.querySelector(sel); }

  var esperando = $('#rec-esperando');
  var invalido = $('#rec-invalido');
  var formWrap = $('#rec-form');
  var listo = $('#rec-listo');
  var passIn = $('#rec-pass');
  var passConfIn = $('#rec-pass-conf');
  var errorP = $('#rec-error');
  var btn = $('#rec-btn');
  var hint = $('#rec-hint');

  function mostrarSolo(el) {
    [esperando, invalido, formWrap, listo].forEach(function (e) { e.hidden = e !== el; });
  }

  function mostrarError(msg) {
    errorP.textContent = msg || '';
    errorP.hidden = !msg;
  }

  function mostrarForm() {
    if (hint && window.MMCuenta.passMin) {
      hint.textContent = 'Al menos ' + window.MMCuenta.passMin + ' caracteres, con una mayúscula y un carácter especial (ej: !@#$%).';
    }
    mostrarSolo(formWrap);
    passIn.focus();
  }

  function guardar() {
    var pass = passIn.value;
    var conf = passConfIn.value;
    var err = window.MMCuenta.validarPass(pass);
    if (err) { mostrarError(err); passIn.focus(); return; }
    if (pass !== conf) { mostrarError('Las contraseñas no coinciden.'); passConfIn.focus(); return; }

    mostrarError('');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    window.MMCuenta.completarRecuperacion(pass).then(function (r) {
      btn.disabled = false;
      btn.textContent = 'Guardar contraseña';
      if (r.error) { mostrarError(r.error.message || 'No se pudo actualizar. Probá de nuevo.'); return; }
      mostrarSolo(listo);
    }, function () {
      btn.disabled = false;
      btn.textContent = 'Guardar contraseña';
      mostrarError('No se pudo actualizar. Probá de nuevo.');
    });
  }

  function iniciar() {
    if (!window.MMCuenta) {
      mostrarSolo(invalido);
      return;
    }

    window.MMCuenta.onRecuperacion(mostrarForm);

    // Si el evento de recuperación no llega en unos segundos, no es un link
    // de recuperación válido (expiró, ya se usó, o se abrió la página
    // directamente sin pasar por el correo).
    setTimeout(function () {
      if (!window.MMCuenta.enRecuperacion()) mostrarSolo(invalido);
    }, 5000);

    btn.addEventListener('click', guardar);
    passConfIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') guardar(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
