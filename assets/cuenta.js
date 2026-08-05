/* Cuenta de cliente (Supabase Auth), requerida para enviar un pedido.
 *
 * Navegar el catálogo y armar el carrito sigue siendo libre, sin cuenta. El
 * único punto que pide iniciar sesión es carrito.js justo antes de mandar el
 * pedido por WhatsApp (ver `enviar()`), y lo hace a través de la API pública
 * de este archivo: `window.MMCuenta`. Si este archivo no llegara a cargar (o
 * el SDK de Supabase no está disponible), `window.MMCuenta` queda sin definir
 * y carrito.js sigue funcionando sin pedir cuenta — nunca deja al cliente sin
 * poder mandar su pedido por un problema de este módulo.
 *
 * No hay contraseñas ni tokens en este archivo: la sesión la maneja el SDK de
 * Supabase (guardada en su propio localStorage), acá sólo se arma el modal y
 * se llama a sus métodos.
 */
(function () {
  'use strict';

  if (!window.supabase || !window.MM_SUPABASE) return;

  var sb;
  try {
    // persistSession + localStorage (no sessionStorage, que se borra al
    // cerrar la pestaña) y autoRefreshToken es el default del SDK — se
    // pasa explícito para que quede documentado acá y no dependa de que un
    // futuro cambio de versión lo cambie en silencio. Si igual a un
    // cliente le sigue pidiendo iniciar sesión antes de lo esperado, no es
    // esto: es "Time-box user sessions" / "Inactivity timeout" en
    // supabase.com → el proyecto → Authentication → Sessions, que fuerza
    // el re-login pasados N días PASE LO QUE PASE acá.
    sb = window.supabase.createClient(window.MM_SUPABASE.url, window.MM_SUPABASE.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage }
    });
  } catch (e) {
    return;
  }

  var SIN_CONFIGURAR = /TU-PROYECTO|TU-ANON-KEY/.test(
    window.MM_SUPABASE.url + window.MM_SUPABASE.anonKey
  );

  // Tiene que coincidir con el mínimo configurado en Supabase (Authentication
  // → Providers → Email → Minimum password length). Si cambiás uno, cambiá
  // el otro.
  var PASS_MIN = 6;

  // --- Turnstile (CAPTCHA en alta/login/recuperar) -------------------------
  // El widget es opcional: si no hay sitekey configurada o el script de
  // Cloudflare no cargó (bloqueador de anuncios, sin red), los formularios
  // siguen funcionando igual, simplemente sin mandar token — por eso hay que
  // dejar "Enable CAPTCHA protection" APAGADO en Supabase hasta que
  // turnstileConfigurado() sea true en producción (ver supabase-config.js).
  function turnstileConfigurado() {
    var k = window.MM_SUPABASE.turnstileSiteKey;
    return !!(k && !/TU-TURNSTILE-SITE-KEY/.test(k));
  }
  var twSignupEl, twLoginEl, twRecuperarEl;
  var twSignupId = null, twLoginId = null, twRecuperarId = null;
  var tokenSignup = '', tokenLogin = '', tokenRecuperar = '';

  function crearTurnstileEl() { return el('div', 'cart-turnstile'); }

  function renderTurnstile(cont, idActual, guardarToken) {
    if (idActual !== null) return idActual; // ya renderizado
    if (!turnstileConfigurado() || !window.turnstile) return null;
    return window.turnstile.render(cont, {
      sitekey: window.MM_SUPABASE.turnstileSiteKey,
      callback: function (t) { guardarToken(t); },
      'expired-callback': function () { guardarToken(''); },
      'error-callback': function () { guardarToken(''); }
    });
  }

  function renderTurnstileWidgets() {
    twSignupId = renderTurnstile(twSignupEl, twSignupId, function (t) { tokenSignup = t; });
    twLoginId = renderTurnstile(twLoginEl, twLoginId, function (t) { tokenLogin = t; });
    twRecuperarId = renderTurnstile(twRecuperarEl, twRecuperarId, function (t) { tokenRecuperar = t; });
  }

  // Cada token de Turnstile se usa una sola vez: hay que resetear el widget
  // después de cada intento (haya salido bien o mal) para que el próximo
  // click junte uno nuevo.
  function resetTurnstile(id, limpiarToken) {
    limpiarToken('');
    if (id !== null && window.turnstile) window.turnstile.reset(id);
  }

  // Si hay sitekey configurada pero todavía no llegó ningún token (widget
  // recién cargando, o el script de Cloudflare no llegó a cargar), frena el
  // envío en vez de mandarlo sin token y que Supabase lo rechace con un error
  // en inglés que el cliente no va a entender.
  function turnstileListo(token) {
    if (!turnstileConfigurado()) return true;
    if (!window.turnstile) { mostrarError('No se pudo cargar la verificación anti-robots. Recargá la página o probá con el bloqueador de anuncios desactivado.'); return false; }
    if (!token) { mostrarError('Esperá un instante (verificación anti-robots) y probá de nuevo.'); return false; }
    return true;
  }

  // window.MMEnvios (assets/envios.js) es la fuente de verdad de este
  // vocabulario; estas quedan como respaldo si ese script no llegó a cargar.
  var ESTADOS_TXT = window.MMEnvios ? window.MMEnvios.ESTADOS_TXT : {
    nuevo: 'Nuevo',
    confirmado: 'Confirmado',
    en_preparacion: 'En preparación',
    listo: 'Listo',
    entregado: 'Entregado',
    cancelado: 'Cancelado'
  };

  // Igual que `fechaLegible` de carrito.js: reformatea "yyyy-mm-dd" a mano
  // para no depender de `new Date(iso)`, que interpreta la fecha en UTC y
  // puede mostrar el día anterior en husos horarios negativos.
  function fechaLegibleAj(iso) {
    if (window.MMEnvios) return window.MMEnvios.fechaLegible(iso);
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  // --- Sesión -------------------------------------------------------------
  var sesion = null;

  function avisar() {
    pintarBotonNav();
    document.dispatchEvent(new CustomEvent('mm:sesion'));
    sesionListaBienvenida = true;
    intentarBienvenida();
    etiquetarAnalytics();
  }

  // GA4: identifica la sesión con el ID interno de la cuenta (uuid de
  // auth.users) — NUNCA el email ni el nombre: mandarle a Analytics algo
  // que identifique a una persona de verdad viola los Términos de Servicio
  // de Google (https://support.google.com/analytics/answer/9019185) y
  // arriesga que suspendan la cuenta de GA4. Para saber qué cuenta es cuál
  // hay que cruzar este id contra Authentication → Users en Supabase, o
  // contra los pedidos (que ya guardan nombre/email por su cuenta).
  //
  // Se manda también si la cuenta es admin (es_admin(), la misma función
  // que ya usa admin-catalogo.js) como "user property", para poder
  // separar en los reportes la actividad de un admin probando el panel de
  // la de un cliente real — hoy analytics.js no distinguía nada de esto.
  //
  // ultimoUid evita repetir el viaje a es_admin() cuando avisar() se llama
  // de nuevo para la MISMA sesión (getSession() y onAuthStateChange
  // suelen disparar los dos al cargar la página).
  var ultimoUid;
  function etiquetarAnalytics() {
    if (!window.gtag) return;
    var uid = sesion && sesion.user && sesion.user.id;
    if (uid === ultimoUid) return;
    ultimoUid = uid;
    // logged_in: para comparar en los reportes cómo navega/convierte una
    // visita con cuenta iniciada contra una de invitado (la mayoría del
    // catálogo se puede mirar y comprar sin cuenta — ver el comentario al
    // principio de este archivo) — antes no había forma de distinguirlas.
    if (!uid) {
      gtag('set', { user_id: null });
      gtag('set', 'user_properties', { is_admin: null, logged_in: false });
      return;
    }
    gtag('set', { user_id: uid });
    gtag('set', 'user_properties', { logged_in: true });
    sb.rpc('es_admin').then(function (r) {
      if (uid !== ultimoUid) return; // cambió de cuenta mientras esperaba la respuesta
      gtag('set', 'user_properties', { is_admin: !r.error && !!r.data });
    }).catch(function () {});
  }

  // --- Recuperación de contraseña (ver recuperar.html/recuperar.js) -------
  // Al abrir el link del correo de resetPasswordForEmail, el SDK procesa el
  // token del hash de la URL y dispara este evento una sola vez, con una
  // sesión temporal que sólo sirve para llamar a updateUser({password}).
  // `enRecuperacion` guarda si ya pasó, por si recuperar.js se registra
  // después de que el evento ya disparó.
  var enRecuperacionFlag = false;
  var recuperacionCb = null;

  sb.auth.onAuthStateChange(function (_event, s) {
    sesion = s;
    if (_event === 'PASSWORD_RECOVERY') {
      enRecuperacionFlag = true;
      if (recuperacionCb) recuperacionCb();
    }
    avisar();
  });
  sb.auth.getSession().then(function (r) {
    sesion = r.data.session;
    avisar();
  });

  function nombreDe(s) {
    return (s && s.user && s.user.user_metadata && s.user.user_metadata.nombre) || '';
  }

  // --- El fondo oscuro es el mismo que usa el carrito (.cart-scrim): el
  //     modal de cuenta sólo se abre con el panel del pedido ya abierto
  //     detrás, así que no hace falta un fondo propio. --------------------
  function scrim() { return $('.cart-scrim'); }
  function mostrarScrim() { var s = scrim(); if (s) s.classList.add('is-on'); }
  function ocultarScrimSiCorresponde() {
    var s = scrim();
    if (!s) return;
    if (!$('.cart-panel.is-on') && !$('.cart-pick.is-on')) s.classList.remove('is-on');
  }

  // --- Armado del modal -----------------------------------------------------
  var modal, tabSignup, tabLogin, cuerpoSignup, cuerpoLogin, cuerpoRecuperar, errorP, okP;
  var nombreIn, emailSignupIn, telIn, passIn, passConfIn, fuerzaEl;
  var emailLoginIn, passLoginIn, emailRecuperarIn;
  var pendiente = null; // callback a reanudar si el login/registro sale bien

  // --- Ajustes de la cuenta (datos, contraseña, email, pedidos) -----------
  var modalAj, tabAjDatos, tabAjPass, tabAjEmail, tabAjPedidos;
  var cuerpoAjDatos, cuerpoAjPass, cuerpoAjEmail, cuerpoAjPedidos, errorAj, okAj;
  var ajNombreIn, ajTelIn, ajDireccionIn;
  var ajPassActualIn, ajPassNuevaIn, ajPassConfIn, ajFuerzaEl;
  var ajEmailPassIn, ajEmailNuevoIn;

  function campo(etiqueta, tipo) {
    var wrap = el('label', 'cart-field');
    wrap.appendChild(el('span', null, etiqueta));
    var input = document.createElement('input');
    input.type = tipo;
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  function armarModal() {
    modal = el('div', 'cart-acc');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Mi cuenta');

    var head = el('div', 'cart-head');
    head.appendChild(el('h2', null, 'Creá tu cuenta'));
    var x = el('button', 'cart-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Cerrar');
    x.addEventListener('click', cancelar);
    head.appendChild(x);

    var tabs = el('div', 'cart-acc-tabs');
    tabSignup = el('button', 'cart-acc-tab is-on', 'Crear cuenta');
    tabLogin = el('button', 'cart-acc-tab', 'Ya tengo cuenta');
    tabSignup.type = 'button';
    tabLogin.type = 'button';
    tabSignup.addEventListener('click', function () { irA('signup'); });
    tabLogin.addEventListener('click', function () { irA('login'); });
    tabs.appendChild(tabSignup);
    tabs.appendChild(tabLogin);

    var body = el('div', 'cart-acc-body');

    // --- Crear cuenta ---
    cuerpoSignup = el('div', 'cart-acc-group');
    var cNombre = campo('Nombre', 'text');
    var cEmail = campo('Email', 'email');
    var cTel = campo('Teléfono (opcional)', 'tel');
    var cPass = campo('Contraseña', 'password');
    cPass.wrap.appendChild(el('small', 'cart-field-hint',
      'Al menos ' + PASS_MIN + ' caracteres, con una mayúscula y un carácter especial (ej: !@#$%).'));
    var cPassConf = campo('Confirmar contraseña', 'password');
    nombreIn = cNombre.input;
    emailSignupIn = cEmail.input;
    telIn = cTel.input;
    passIn = cPass.input;
    passConfIn = cPassConf.input;

    fuerzaEl = crearFuerzaEl();
    passIn.addEventListener('input', function () { pintarFuerza(passIn.value); });

    twSignupEl = crearTurnstileEl();
    var enviarSignup = el('button', 'cart-send', 'Crear cuenta y continuar');
    enviarSignup.type = 'button';
    enviarSignup.addEventListener('click', hacerSignup);
    passConfIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') hacerSignup(); });
    [cNombre, cEmail, cTel, cPass].forEach(function (c) { cuerpoSignup.appendChild(c.wrap); });
    cuerpoSignup.appendChild(fuerzaEl);
    cuerpoSignup.appendChild(cPassConf.wrap);
    cuerpoSignup.appendChild(twSignupEl);
    cuerpoSignup.appendChild(enviarSignup);

    // --- Ya tengo cuenta ---
    cuerpoLogin = el('div', 'cart-acc-group');
    cuerpoLogin.hidden = true;
    var lEmail = campo('Email', 'email');
    var lPass = campo('Contraseña', 'password');
    emailLoginIn = lEmail.input;
    passLoginIn = lPass.input;
    twLoginEl = crearTurnstileEl();
    var enviarLogin = el('button', 'cart-send', 'Iniciar sesión y continuar');
    enviarLogin.type = 'button';
    enviarLogin.addEventListener('click', hacerLogin);
    lPass.input.addEventListener('keydown', function (e) { if (e.key === 'Enter') hacerLogin(); });
    [lEmail, lPass].forEach(function (c) { cuerpoLogin.appendChild(c.wrap); });
    cuerpoLogin.appendChild(twLoginEl);
    cuerpoLogin.appendChild(enviarLogin);
    var olvide = el('button', 'cart-acc-link', '¿Olvidaste tu contraseña?');
    olvide.type = 'button';
    olvide.addEventListener('click', function () { irA('recuperar'); });
    cuerpoLogin.appendChild(olvide);

    // --- Recuperar contraseña (envía el link, ver hacerRecuperar) ---
    cuerpoRecuperar = el('div', 'cart-acc-group');
    cuerpoRecuperar.hidden = true;
    cuerpoRecuperar.appendChild(el('p', 'cart-field-hint',
      'Ingresá tu email y te mandamos un link para elegir una contraseña nueva.'));
    var rEmail = campo('Email', 'email');
    emailRecuperarIn = rEmail.input;
    twRecuperarEl = crearTurnstileEl();
    var enviarRecuperar = el('button', 'cart-send', 'Mandar link');
    enviarRecuperar.type = 'button';
    enviarRecuperar.addEventListener('click', hacerRecuperar);
    rEmail.input.addEventListener('keydown', function (e) { if (e.key === 'Enter') hacerRecuperar(); });
    cuerpoRecuperar.appendChild(rEmail.wrap);
    cuerpoRecuperar.appendChild(twRecuperarEl);
    cuerpoRecuperar.appendChild(enviarRecuperar);
    var volver = el('button', 'cart-acc-link', 'Volver');
    volver.type = 'button';
    volver.addEventListener('click', function () { irA('login'); });
    cuerpoRecuperar.appendChild(volver);

    errorP = el('p', 'cart-acc-error');
    errorP.hidden = true;
    okP = el('p', 'cart-acc-ok');
    okP.hidden = true;

    body.appendChild(cuerpoSignup);
    body.appendChild(cuerpoLogin);
    body.appendChild(cuerpoRecuperar);
    body.appendChild(errorP);
    body.appendChild(okP);

    modal.appendChild(head);
    modal.appendChild(tabs);
    modal.appendChild(body);
    document.body.appendChild(modal);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-on')) {
        e.stopImmediatePropagation();
        cancelar();
      }
    });

    renderTurnstileWidgets();
  }

  function crearFuerzaEl() {
    var cont = el('div', 'cart-pass-fuerza');
    cont.hidden = true;
    var barra = el('div', 'cart-pass-bar');
    var relleno = el('div', 'cart-pass-bar-fill');
    barra.appendChild(relleno);
    var texto = el('small', 'cart-pass-texto');
    cont.appendChild(barra);
    cont.appendChild(texto);
    return cont;
  }

  // Puntaje simple (0-6) sumando: largo básico, largo generoso, minúscula,
  // mayúscula, número, símbolo. Es sólo una guía visual para el cliente — la
  // regla real que bloquea el envío es la de `hacerSignup`/`hacerCambioPass`
  // (mayúscula + símbolo + 6 caracteres), no este puntaje.
  function pintarFuerzaEn(cont, pass) {
    if (!pass) { cont.hidden = true; return; }
    cont.hidden = false;
    var puntos = 0;
    if (pass.length >= 6) puntos++;
    if (pass.length >= 10) puntos++;
    if (/[a-z]/.test(pass)) puntos++;
    if (/[A-Z]/.test(pass)) puntos++;
    if (/[0-9]/.test(pass)) puntos++;
    if (/[^A-Za-z0-9]/.test(pass)) puntos++;

    var nivel = puntos <= 2 ? 'debil' : puntos <= 4 ? 'media' : 'fuerte';
    var etiqueta = nivel === 'debil' ? 'Débil' : nivel === 'media' ? 'Media' : 'Fuerte';
    var relleno = $('.cart-pass-bar-fill', cont);
    relleno.className = 'cart-pass-bar-fill is-' + nivel;
    $('.cart-pass-texto', cont).textContent = etiqueta;
  }

  function pintarFuerza(pass) { pintarFuerzaEn(fuerzaEl, pass); }

  function irA(tab) {
    var esSignup = tab === 'signup';
    var esRecuperar = tab === 'recuperar';
    tabSignup.classList.toggle('is-on', esSignup);
    tabLogin.classList.toggle('is-on', !esSignup);
    cuerpoSignup.hidden = !esSignup;
    cuerpoLogin.hidden = esSignup || esRecuperar;
    cuerpoRecuperar.hidden = !esRecuperar;
    mostrarError('');
    mostrarOk('');
    var grupo = esSignup ? cuerpoSignup : (esRecuperar ? cuerpoRecuperar : cuerpoLogin);
    var primero = $('input', grupo);
    if (primero) primero.focus();
  }

  function mostrarError(msg) {
    errorP.textContent = msg || '';
    errorP.hidden = !msg;
  }

  function mostrarOk(msg) {
    okP.textContent = msg || '';
    okP.hidden = !msg;
  }

  // Reglas de contraseña compartidas entre alta, cambio de contraseña y
  // recuperación — una sola fuente de verdad (antes estaban duplicadas).
  function validarPass(pass) {
    if (pass.length < PASS_MIN) return 'La contraseña tiene que tener al menos ' + PASS_MIN + ' caracteres.';
    if (!/[A-Z]/.test(pass)) return 'La contraseña tiene que tener al menos una mayúscula.';
    if (!/[^A-Za-z0-9]/.test(pass)) return 'La contraseña tiene que tener al menos un carácter especial (ej: !@#$%).';
    return '';
  }

  // Mensajes de Supabase llegan en inglés; se traducen los casos más
  // comunes para no mostrarle inglés técnico al cliente.
  function mensajeDeError(err) {
    var m = (err && err.message) || '';
    if (/new password should be different|different from the old/i.test(m)) return 'La contraseña nueva tiene que ser distinta de la actual.';
    // No confirmamos si el email ya existe (evita que alguien use el alta
    // para averiguar qué direcciones están registradas): mensaje ambiguo en
    // vez de "ese email ya tiene una cuenta".
    if (/already registered|already exists/i.test(m)) return 'No pudimos crear la cuenta con esos datos. Si ya tenés una cuenta con ese email, probá "Ya tengo cuenta".';
    if (/invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos.';
    if (/password.*(least|short|characters)/i.test(m)) return 'La contraseña tiene que tener al menos ' + PASS_MIN + ' caracteres.';
    if (/invalid email/i.test(m)) return 'Revisá el email, no parece válido.';
    if (/rate limit|too many requests/i.test(m)) return 'Demasiados intentos. Esperá un minuto y probá de nuevo.';
    if (m) return m;
    return 'No se pudo completar. Probá de nuevo.';
  }

  function conBotonCargando(boton, texto, fn) {
    var original = boton.textContent;
    boton.disabled = true;
    boton.textContent = texto;
    fn().then(function () {
      boton.disabled = false;
      boton.textContent = original;
    }, function () {
      boton.disabled = false;
      boton.textContent = original;
    });
  }

  // El navegador sólo deja abrir una pestaña nueva mientras dura el "gesto"
  // del clic que la pidió. Crear la cuenta o iniciar sesión implica esperar
  // una respuesta de Supabase — un viaje a un servidor y de vuelta — y para
  // cuando esa respuesta llega, el permiso del clic original ya expiró: si
  // recién ahí se intentara `window.open(...)` para WhatsApp, el navegador lo
  // bloquearía en silencio y el cliente vería que "no pasó nada" después de
  // crear su cuenta. Por eso la pestaña se abre en blanco ACÁ, en el mismo
  // clic (todavía con permiso), y más tarde `carrito.js` sólo la redirige a
  // la URL de WhatsApp en vez de abrir una nueva.
  var ventanaPendiente = null;

  function hacerSignup() {
    if (SIN_CONFIGURAR) { mostrarError('Todavía falta configurar la cuenta de Supabase (assets/supabase-config.js).'); return; }
    var nombre = nombreIn.value.trim();
    var email = emailSignupIn.value.trim();
    var tel = telIn.value.trim();
    var pass = passIn.value;
    var passConf = passConfIn.value;

    var errPass = validarPass(pass);
    if (!nombre) { mostrarError('Falta tu nombre.'); nombreIn.focus(); return; }
    if (!email) { mostrarError('Falta el email.'); emailSignupIn.focus(); return; }
    if (errPass) { mostrarError(errPass); passIn.focus(); return; }
    if (pass !== passConf) { mostrarError('Las contraseñas no coinciden.'); passConfIn.focus(); return; }
    if (!turnstileListo(tokenSignup)) return;

    mostrarError('');
    // Sólo hace falta la pestaña en blanco si hay un pedido esperando para
    // mandarse por WhatsApp al terminar (ver comentario arriba). Si la cuenta
    // se crea desde el ícono del header, sin nada pendiente, no se abre nada.
    if (pendiente) ventanaPendiente = window.open('', '_blank');
    conBotonCargando($('.cart-send', cuerpoSignup), 'Creando cuenta…', function () {
      return sb.auth.signUp({
        email: email,
        password: pass,
        options: { data: { nombre: nombre, telefono: tel }, captchaToken: tokenSignup }
      }).then(function (r) {
        resetTurnstile(twSignupId, function (t) { tokenSignup = t; });
        if (r.error) { cerrarVentanaPendiente(); mostrarError(mensajeDeError(r.error)); return; }
        // Con "Confirm email" activado en Supabase, signUp no devuelve sesión:
        // hay que confirmar el correo antes de poder entrar. Sin esta rama el
        // modal se cerraba y volvía a abrir sin ningún aviso (ver auditoría de
        // seguridad de cuentas).
        if (!r.data || !r.data.session) {
          cerrarVentanaPendiente();
          pendiente = null;
          irA('login');
          mostrarError('Te mandamos un correo a ' + email + ' para confirmar tu cuenta. Confirmalo y volvé a entrar acá con "Ya tengo cuenta".');
          return;
        }
        alExito();
      });
    });
  }

  function hacerLogin() {
    if (SIN_CONFIGURAR) { mostrarError('Todavía falta configurar la cuenta de Supabase (assets/supabase-config.js).'); return; }
    var email = emailLoginIn.value.trim();
    var pass = passLoginIn.value;
    if (!email || !pass) { mostrarError('Completá email y contraseña.'); return; }
    if (!turnstileListo(tokenLogin)) return;

    mostrarError('');
    if (pendiente) ventanaPendiente = window.open('', '_blank');
    conBotonCargando($('.cart-send', cuerpoLogin), 'Ingresando…', function () {
      return sb.auth.signInWithPassword({ email: email, password: pass, options: { captchaToken: tokenLogin } }).then(function (r) {
        resetTurnstile(twLoginId, function (t) { tokenLogin = t; });
        if (r.error) { cerrarVentanaPendiente(); mostrarError(mensajeDeError(r.error)); return; }
        alExito();
      });
    });
  }

  function hacerRecuperar() {
    if (SIN_CONFIGURAR) { mostrarError('Todavía falta configurar la cuenta de Supabase (assets/supabase-config.js).'); return; }
    var email = emailRecuperarIn.value.trim();
    if (!email) { mostrarError('Falta el email.'); emailRecuperarIn.focus(); return; }
    if (!turnstileListo(tokenRecuperar)) return;

    mostrarError('');
    mostrarOk('');
    conBotonCargando($('.cart-send', cuerpoRecuperar), 'Enviando…', function () {
      var redirectTo = window.location.origin + window.location.pathname.replace(/[^/]*$/, 'recuperar.html');
      return sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo, captchaToken: tokenRecuperar }).then(function (r) {
        resetTurnstile(twRecuperarId, function (t) { tokenRecuperar = t; });
        // Mensaje siempre igual, exista o no la cuenta (evita que este
        // formulario sirva para averiguar qué emails están registrados) —
        // salvo el límite de intentos, que sí conviene mostrar tal cual.
        if (r.error && /rate limit|too many requests/i.test(r.error.message || '')) {
          mostrarError(mensajeDeError(r.error));
          return;
        }
        mostrarOk('Si esa dirección tiene una cuenta, te va a llegar un correo con el link para elegir una contraseña nueva.');
      });
    });
  }

  function cerrarVentanaPendiente() {
    if (ventanaPendiente) { try { ventanaPendiente.close(); } catch (e) { /* nada que hacer */ } }
    ventanaPendiente = null;
  }

  function alExito() {
    // Ojo con el orden: `cerrar()` NO toca `ventanaPendiente` (a propósito,
    // ver más abajo) — así llega intacta hasta acá para que `cb()` (que
    // termina en `enviarAhora()` de carrito.js) la encuentre con
    // `MMCuenta.tomarVentana()` y la use en vez de abrir una pestaña nueva.
    var cb = pendiente;
    pendiente = null;
    cerrar();
    if (cb) cb();
  }

  function pedirSesion(cb, tabInicial) {
    pendiente = cb || null;
    irA(tabInicial || 'signup');
    passIn.value = '';
    passConfIn.value = '';
    passLoginIn.value = '';
    emailRecuperarIn.value = '';
    fuerzaEl.hidden = true;
    mostrarScrim();
    modal.classList.add('is-on');
    var primero = $('input', cuerpoSignup);
    if (primero) primero.focus();
  }

  // Sólo esconde el modal — no toca `ventanaPendiente` ni `pendiente`, porque
  // también la usa `alExito()` en el camino de éxito, donde esas dos cosas
  // todavía hacen falta un instante más (ver comentario ahí).
  function cerrar() {
    if (!modal) return;
    modal.classList.remove('is-on');
    ocultarScrimSiCorresponde();
  }

  // El que sí cancela todo de verdad: click en la X o Escape. Si había un
  // registro/login en curso, no queda una pestaña en blanco dando vueltas.
  function cancelar() {
    cerrar();
    pendiente = null;
    cerrarVentanaPendiente();
  }

  // --- Ajustes de la cuenta ------------------------------------------------
  // Un solo modal con pestañas para todo lo que el cliente puede necesitar
  // tocar de su cuenta: datos de contacto/envío, cambiar contraseña, cambiar
  // email y ver sus pedidos anteriores. Cambiar contraseña o email pide de
  // nuevo la contraseña actual antes de aplicar el cambio (reautenticación
  // con `signInWithPassword`): Supabase no lo exige para `updateUser`, pero
  // sin esto cualquiera que encuentre el navegador con la sesión abierta
  // podría cambiarlos sin saber la clave real.
  function armarModalAjustes() {
    modalAj = el('div', 'cart-acc');
    modalAj.setAttribute('role', 'dialog');
    modalAj.setAttribute('aria-modal', 'true');
    modalAj.setAttribute('aria-label', 'Ajustes de la cuenta');

    var head = el('div', 'cart-head');
    head.appendChild(el('h2', null, 'Ajustes de la cuenta'));
    var x = el('button', 'cart-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Cerrar');
    x.addEventListener('click', cerrarAjustes);
    head.appendChild(x);

    var tabs = el('div', 'cart-acc-tabs');
    tabAjDatos = el('button', 'cart-acc-tab is-on', 'Datos');
    tabAjPass = el('button', 'cart-acc-tab', 'Contraseña');
    tabAjEmail = el('button', 'cart-acc-tab', 'Email');
    tabAjPedidos = el('button', 'cart-acc-tab', 'Pedidos');
    [tabAjDatos, tabAjPass, tabAjEmail, tabAjPedidos].forEach(function (t) { t.type = 'button'; });
    tabAjDatos.addEventListener('click', function () { irAAjustes('datos'); });
    tabAjPass.addEventListener('click', function () { irAAjustes('pass'); });
    tabAjEmail.addEventListener('click', function () { irAAjustes('email'); });
    tabAjPedidos.addEventListener('click', function () { irAAjustes('pedidos'); });
    tabs.appendChild(tabAjDatos);
    tabs.appendChild(tabAjPass);
    tabs.appendChild(tabAjEmail);
    tabs.appendChild(tabAjPedidos);

    var body = el('div', 'cart-acc-body');

    // --- Mis datos: nombre, teléfono y dirección de envío ---
    cuerpoAjDatos = el('div', 'cart-acc-group');
    var cNombre = campo('Nombre', 'text');
    var cTel = campo('Teléfono', 'tel');
    var cDireccion = campo('Dirección de envío', 'text');
    ajNombreIn = cNombre.input;
    ajTelIn = cTel.input;
    ajDireccionIn = cDireccion.input;
    var guardarDatosBtn = el('button', 'cart-send', 'Guardar datos');
    guardarDatosBtn.type = 'button';
    guardarDatosBtn.addEventListener('click', hacerGuardarDatos);
    [cNombre, cTel, cDireccion].forEach(function (c) { cuerpoAjDatos.appendChild(c.wrap); });
    cuerpoAjDatos.appendChild(guardarDatosBtn);

    // --- Borrar cuenta: separado del resto, para que no se toque sin querer ---
    var borrarWrap = el('div', 'cart-acc-borrar');
    borrarWrap.appendChild(el('p', 'cart-field-hint',
      'Esto borra tu cuenta para siempre. No se puede deshacer.'));
    var borrarBtn = el('button', 'cart-acc-borrar-btn', 'Borrar mi cuenta');
    borrarBtn.type = 'button';
    borrarBtn.addEventListener('click', hacerBorrarCuenta);
    borrarWrap.appendChild(borrarBtn);
    cuerpoAjDatos.appendChild(borrarWrap);

    // --- Cambiar contraseña ---
    cuerpoAjPass = el('div', 'cart-acc-group');
    cuerpoAjPass.hidden = true;
    var cActual = campo('Contraseña actual', 'password');
    var cNueva = campo('Contraseña nueva', 'password');
    cNueva.wrap.appendChild(el('small', 'cart-field-hint',
      'Al menos ' + PASS_MIN + ' caracteres, con una mayúscula y un carácter especial (ej: !@#$%).'));
    var cNuevaConf = campo('Confirmar contraseña nueva', 'password');
    ajPassActualIn = cActual.input;
    ajPassNuevaIn = cNueva.input;
    ajPassConfIn = cNuevaConf.input;
    ajFuerzaEl = crearFuerzaEl();
    ajPassNuevaIn.addEventListener('input', function () { pintarFuerzaEn(ajFuerzaEl, ajPassNuevaIn.value); });
    var cambiarPassBtn = el('button', 'cart-send', 'Cambiar contraseña');
    cambiarPassBtn.type = 'button';
    cambiarPassBtn.addEventListener('click', hacerCambioPass);
    cuerpoAjPass.appendChild(cActual.wrap);
    cuerpoAjPass.appendChild(cNueva.wrap);
    cuerpoAjPass.appendChild(ajFuerzaEl);
    cuerpoAjPass.appendChild(cNuevaConf.wrap);
    cuerpoAjPass.appendChild(cambiarPassBtn);

    // --- Cambiar email ---
    cuerpoAjEmail = el('div', 'cart-acc-group');
    cuerpoAjEmail.hidden = true;
    var cEmailPass = campo('Contraseña actual', 'password');
    var cEmailNuevo = campo('Nuevo email', 'email');
    ajEmailPassIn = cEmailPass.input;
    ajEmailNuevoIn = cEmailNuevo.input;
    var cambiarEmailBtn = el('button', 'cart-send', 'Cambiar email');
    cambiarEmailBtn.type = 'button';
    cambiarEmailBtn.addEventListener('click', hacerCambioEmail);
    cuerpoAjEmail.appendChild(cEmailPass.wrap);
    cuerpoAjEmail.appendChild(cEmailNuevo.wrap);
    cuerpoAjEmail.appendChild(el('small', 'cart-field-hint',
      'Te va a llegar un correo de confirmación (a la casilla actual y/o a la nueva). El cambio no se aplica hasta que lo confirmes.'));
    cuerpoAjEmail.appendChild(cambiarEmailBtn);

    // --- Mis pedidos: se llena recién al abrir esta pestaña (pintarPedidosAj) ---
    cuerpoAjPedidos = el('div', 'cart-acc-group');
    cuerpoAjPedidos.hidden = true;

    errorAj = el('p', 'cart-acc-error');
    errorAj.hidden = true;
    okAj = el('p', 'cart-acc-ok');
    okAj.hidden = true;

    body.appendChild(cuerpoAjDatos);
    body.appendChild(cuerpoAjPass);
    body.appendChild(cuerpoAjEmail);
    body.appendChild(cuerpoAjPedidos);
    body.appendChild(errorAj);
    body.appendChild(okAj);

    modalAj.appendChild(head);
    modalAj.appendChild(tabs);
    modalAj.appendChild(body);
    document.body.appendChild(modalAj);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalAj.classList.contains('is-on')) {
        e.stopImmediatePropagation();
        cerrarAjustes();
      }
    });
  }

  function irAAjustes(tab) {
    var tabs = { datos: tabAjDatos, pass: tabAjPass, email: tabAjEmail, pedidos: tabAjPedidos };
    var cuerpos = { datos: cuerpoAjDatos, pass: cuerpoAjPass, email: cuerpoAjEmail, pedidos: cuerpoAjPedidos };
    Object.keys(tabs).forEach(function (k) {
      tabs[k].classList.toggle('is-on', k === tab);
      cuerpos[k].hidden = k !== tab;
    });
    mostrarErrorAj('');
    mostrarOkAj('');
    if (tab === 'pedidos') pintarPedidosAj();
    var primero = $('input', cuerpos[tab]);
    if (primero) primero.focus();
  }

  function mostrarErrorAj(msg) {
    errorAj.textContent = msg || '';
    errorAj.hidden = !msg;
  }

  function mostrarOkAj(msg) {
    okAj.textContent = msg || '';
    okAj.hidden = !msg;
  }

  function precargarDatosAj() {
    var meta = (sesion && sesion.user && sesion.user.user_metadata) || {};
    ajNombreIn.value = meta.nombre || '';
    ajTelIn.value = meta.telefono || '';
    ajDireccionIn.value = meta.direccion || '';
    ajPassActualIn.value = '';
    ajPassNuevaIn.value = '';
    ajPassConfIn.value = '';
    ajFuerzaEl.hidden = true;
    ajEmailPassIn.value = '';
    ajEmailNuevoIn.value = '';
  }

  // Vuelve a pedir la contraseña actual antes de tocar contraseña o email.
  function reautenticar(passActual) {
    var email = sesion && sesion.user && sesion.user.email;
    return sb.auth.signInWithPassword({ email: email, password: passActual });
  }

  function hacerGuardarDatos() {
    var nombre = ajNombreIn.value.trim();
    var tel = ajTelIn.value.trim();
    var direccion = ajDireccionIn.value.trim();
    mostrarErrorAj('');
    mostrarOkAj('');
    conBotonCargando($('.cart-send', cuerpoAjDatos), 'Guardando…', function () {
      return sb.auth.updateUser({ data: { nombre: nombre, telefono: tel, direccion: direccion } }).then(function (r) {
        if (r.error) { mostrarErrorAj(mensajeDeError(r.error)); return; }
        mostrarOkAj('Tus datos se guardaron.');
      });
    });
  }

  function hacerCambioPass() {
    var actual = ajPassActualIn.value;
    var nueva = ajPassNuevaIn.value;
    var conf = ajPassConfIn.value;
    var errPass = validarPass(nueva);
    if (!actual) { mostrarErrorAj('Ingresá tu contraseña actual.'); ajPassActualIn.focus(); return; }
    if (errPass) { mostrarErrorAj(errPass); ajPassNuevaIn.focus(); return; }
    if (nueva !== conf) { mostrarErrorAj('Las contraseñas nuevas no coinciden.'); ajPassConfIn.focus(); return; }

    mostrarErrorAj('');
    mostrarOkAj('');
    conBotonCargando($('.cart-send', cuerpoAjPass), 'Cambiando…', function () {
      return reautenticar(actual).then(function (r) {
        if (r.error) { mostrarErrorAj('La contraseña actual no es correcta.'); return null; }
        // current_password: además de la reautenticación manual de arriba,
        // manda la contraseña actual en el pedido mismo — lo pide Supabase
        // si "Require current password when updating" está activado
        // (Authentication → Providers → Email).
        return sb.auth.updateUser({ password: nueva, current_password: actual }).then(function (r2) {
          if (r2.error) { mostrarErrorAj(mensajeDeError(r2.error)); return; }
          ajPassActualIn.value = '';
          ajPassNuevaIn.value = '';
          ajPassConfIn.value = '';
          ajFuerzaEl.hidden = true;
          mostrarOkAj('Listo, tu contraseña se actualizó.');
        });
      });
    });
  }

  function hacerCambioEmail() {
    var actual = ajEmailPassIn.value;
    var nuevo = ajEmailNuevoIn.value.trim();
    if (!actual) { mostrarErrorAj('Ingresá tu contraseña actual.'); ajEmailPassIn.focus(); return; }
    if (!nuevo) { mostrarErrorAj('Ingresá el nuevo email.'); ajEmailNuevoIn.focus(); return; }

    mostrarErrorAj('');
    mostrarOkAj('');
    conBotonCargando($('.cart-send', cuerpoAjEmail), 'Cambiando…', function () {
      return reautenticar(actual).then(function (r) {
        if (r.error) { mostrarErrorAj('La contraseña actual no es correcta.'); return null; }
        return sb.auth.updateUser({ email: nuevo }).then(function (r2) {
          if (r2.error) { mostrarErrorAj(mensajeDeError(r2.error)); return; }
          ajEmailPassIn.value = '';
          ajEmailNuevoIn.value = '';
          mostrarOkAj('Te enviamos un correo de confirmación. El email de tu cuenta cambia recién cuando lo confirmes.');
        });
      });
    });
  }

  // Borra la cuenta vía eliminar_mi_cuenta() (ver
  // supabase/envios_13_borrar_cuenta.sql): esa función sólo puede borrar
  // auth.uid(), nunca otra cuenta. Los pedidos ya hechos NO se borran (esa
  // migración cambió la referencia a `on delete set null`) — sólo pierden el
  // vínculo con la cuenta, para no perder el historial de ventas.
  function hacerBorrarCuenta() {
    if (!window.confirm('¿Borrar tu cuenta para siempre? No se puede deshacer. Vas a tener que crear una cuenta nueva para volver a comprar con inicio de sesión.')) return;

    var btn = $('.cart-acc-borrar-btn', cuerpoAjDatos);
    var original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Borrando…';
    mostrarErrorAj('');
    sb.rpc('eliminar_mi_cuenta').then(function (r) {
      if (r.error) {
        btn.disabled = false;
        btn.textContent = original;
        mostrarErrorAj('No se pudo borrar la cuenta. Probá de nuevo.');
        return;
      }
      cerrarAjustes();
      sb.auth.signOut({ scope: 'global' });
    }, function () {
      btn.disabled = false;
      btn.textContent = original;
      mostrarErrorAj('No se pudo borrar la cuenta. Probá de nuevo.');
    });
  }

  // El historial vive en la tabla `pedidos` de Supabase (ver supabase/pedidos.sql).
  // Si esa tabla todavía no se creó en el proyecto, la consulta llega con
  // error y acá se muestra un aviso en vez de romper el modal.
  function pintarPedidosAj() {
    cuerpoAjPedidos.innerHTML = '';
    cuerpoAjPedidos.appendChild(el('p', 'cart-field-hint', 'Cargando…'));
    if (!sesion) return;
    sb.from('pedidos').select('*').eq('user_id', sesion.user.id).order('created_at', { ascending: false })
      .then(function (r) {
        cuerpoAjPedidos.innerHTML = '';
        if (r.error) {
          cuerpoAjPedidos.appendChild(el('p', 'cart-acc-error', 'No se pudo cargar el historial de pedidos.'));
          return;
        }
        var pedidos = r.data || [];
        if (!pedidos.length) {
          cuerpoAjPedidos.appendChild(el('p', 'cart-empty', 'Todavía no hiciste ningún pedido.'));
          return;
        }
        pedidos.forEach(function (p) {
          var card = el('div', 'ajustes-pedido');
          var fecha = new Date(p.created_at);
          card.appendChild(el('p', 'ajustes-pedido-fecha',
            fecha.toLocaleDateString('es-AR') + ' · ' + fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })));
          var lista = el('ul', 'ajustes-pedido-items');
          (p.items || []).forEach(function (it) {
            lista.appendChild(el('li', null, it.q + 'x ' + it.t + (it.v ? ' — ' + it.v : '')));
          });
          card.appendChild(lista);

          var entregaTxt;
          if (p.metodo_entrega === 'envio') {
            entregaTxt = 'Envío';
            if (p.zona) entregaTxt += ' — ' + p.zona;
            if (p.direccion) entregaTxt += ' (' + p.direccion + ')';
          } else if (p.metodo_entrega) {
            entregaTxt = 'Retiro en el local';
          } else {
            entregaTxt = p.entrega; // pedidos viejos, antes de los campos estructurados
          }
          if (entregaTxt) card.appendChild(el('p', 'ajustes-pedido-meta', 'Entrega: ' + entregaTxt));
          if (p.fecha_entrega) {
            card.appendChild(el('p', 'ajustes-pedido-meta', 'Para: ' + fechaLegibleAj(p.fecha_entrega)));
          }
          if (p.estado) {
            card.appendChild(el('span', 'ajustes-pedido-estado ep-' + p.estado, ESTADOS_TXT[p.estado] || p.estado));
          }

          cuerpoAjPedidos.appendChild(card);
        });
      }, function () {
        cuerpoAjPedidos.innerHTML = '';
        cuerpoAjPedidos.appendChild(el('p', 'cart-acc-error', 'No se pudo cargar el historial de pedidos.'));
      });
  }

  function guardarPedido(pedido) {
    if (!sesion) return Promise.resolve();
    var meta = sesion.user.user_metadata || {};
    return sb.from('pedidos').insert({
      user_id: sesion.user.id,
      items: (pedido && pedido.items) || [],
      nombre: (pedido && pedido.nombre) || null,
      metodo_entrega: (pedido && pedido.metodoEntrega) || 'retiro',
      direccion: (pedido && pedido.direccion) || null,
      zona: (pedido && pedido.zona) || null,
      fecha_entrega: (pedido && pedido.fechaEntrega) || null,
      telefono: (pedido && pedido.telefono) || meta.telefono || null,
      nota: (pedido && pedido.nota) || null,
      zona_id: (pedido && pedido.zonaId) || null,
      sucursal_id: (pedido && pedido.sucursalId) || null,
      franja_id: (pedido && pedido.franjaId) || null,
      entre_calles: (pedido && pedido.entreCalles) || null,
      piso_depto: (pedido && pedido.pisoDepto) || null,
      receptor_nombre: (pedido && pedido.receptorNombre) || null,
      receptor_telefono: (pedido && pedido.receptorTelefono) || null,
      bultos: (pedido && pedido.bultos) || null,
      envio_inmediato: !!(pedido && pedido.envioInmediato)
    });
  }

  function abrirAjustes(tab) {
    if (!sesion) { cerrarPop(); pedirSesion(function () { abrirAjustes(tab); }); return; }
    precargarDatosAj();
    irAAjustes(tab || 'datos');
    mostrarScrim();
    modalAj.classList.add('is-on');
  }

  function cerrarAjustes() {
    if (!modalAj) return;
    modalAj.classList.remove('is-on');
    ocultarScrimSiCorresponde();
  }

  // --- Ícono de cuenta en el header --------------------------------------
  // Independiente del carrito: deja crear una cuenta o entrar a la propia sin
  // haber agregado nada al pedido. Vive en `.nav` (no está en Explorar, que
  // no tiene barra) y se arma una sola vez por página.
  var navBtn, navPop;

  function armarBotonNav() {
    var nav = $('.nav');
    if (!nav || $('.cuenta-nav-wrap')) return;

    var wrap = el('div', 'cuenta-nav-wrap');

    navBtn = el('button', 'cuenta-nav');
    navBtn.type = 'button';
    navBtn.setAttribute('aria-haspopup', 'true');
    navBtn.setAttribute('aria-expanded', 'false');
    navBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="8" r="4"/><path d="M4 20.2c0-4.3 3.6-7.2 8-7.2s8 2.9 8 7.2"/></svg>';
    navBtn.addEventListener('click', function () {
      if (sesion) { navPop.hidden ? abrirPop() : cerrarPop(); }
      else { pedirSesion(); }
    });

    navPop = el('div', 'cuenta-pop');
    navPop.hidden = true;
    navPop.setAttribute('role', 'menu');

    wrap.appendChild(navBtn);
    wrap.appendChild(navPop);

    var toggle = $('.nav-toggle', nav);
    if (toggle) nav.insertBefore(wrap, toggle); else nav.appendChild(wrap);

    document.addEventListener('click', function (e) {
      if (!navPop.hidden && !wrap.contains(e.target)) cerrarPop();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !navPop.hidden) { e.stopImmediatePropagation(); cerrarPop(); }
    });

    pintarBotonNav();
  }

  function abrirPop() {
    pintarPop();
    navPop.hidden = false;
    navBtn.setAttribute('aria-expanded', 'true');
  }

  function cerrarPop() {
    if (!navPop) return;
    navPop.hidden = true;
    navBtn.setAttribute('aria-expanded', 'false');
  }

  function pintarPop() {
    navPop.innerHTML = '';
    var who = el('p', 'cuenta-pop-who');
    who.appendChild(el('b', null, nombreDe(sesion) || 'Tu cuenta'));
    who.appendChild(el('span', null, (sesion && sesion.user && sesion.user.email) || ''));
    navPop.appendChild(who);

    var ajustes = el('button', 'cuenta-pop-item', 'Ajustes');
    ajustes.type = 'button';
    ajustes.addEventListener('click', function () { cerrarPop(); abrirAjustes('datos'); });
    navPop.appendChild(ajustes);

    var pedidos = el('button', 'cuenta-pop-item', 'Mis pedidos');
    pedidos.type = 'button';
    pedidos.addEventListener('click', function () { cerrarPop(); abrirAjustes('pedidos'); });
    navPop.appendChild(pedidos);

    var favoritos = el('button', 'cuenta-pop-item', 'Mis favoritos');
    favoritos.type = 'button';
    favoritos.addEventListener('click', function () { cerrarPop(); if (window.MMFavoritos) MMFavoritos.abrir(); });
    navPop.appendChild(favoritos);

    var salir = el('button', 'cuenta-pop-out', 'Cerrar sesión');
    salir.type = 'button';
    salir.addEventListener('click', function () { cerrarPop(); sb.auth.signOut({ scope: 'global' }); });
    navPop.appendChild(salir);
  }

  // Con sesión el ícono queda "prendido" (mismo lenguaje visual que el
  // carrito con algo cargado) y funciona como acceso al perfil; sin sesión,
  // un clic abre directo el alta. El popover se cierra siempre que cambia el
  // estado, para no dejarlo abierto mostrando datos de la sesión anterior.
  function pintarBotonNav() {
    if (!navBtn) return;
    navBtn.classList.toggle('is-on', !!sesion);
    navBtn.setAttribute('aria-label', sesion ? 'Mi cuenta' : 'Crear cuenta o iniciar sesión');
    cerrarPop();
  }

  window.MMCuenta = {
    // Cliente ya creado acá: lo reusan admin-pedidos.js/admin-envios.js/
    // ruta.js en vez de llamar a createClient() de nuevo (evita el warning
    // de Supabase por dos GoTrueClient compitiendo por el mismo storage).
    cliente: function () { return sb; },
    sesionActiva: function () { return !!sesion; },
    nombre: function () { return nombreDe(sesion); },
    email: function () { return (sesion && sesion.user && sesion.user.email) || ''; },
    direccion: function () {
      return (sesion && sesion.user && sesion.user.user_metadata && sesion.user.user_metadata.direccion) || '';
    },
    telefono: function () {
      return (sesion && sesion.user && sesion.user.user_metadata && sesion.user.user_metadata.telefono) || '';
    },
    pedirSesion: pedirSesion,
    // scope: 'global' invalida la sesión en todos los dispositivos donde esa
    // cuenta esté logueada, no sólo en este navegador.
    cerrarSesion: function () { return sb.auth.signOut({ scope: 'global' }); },
    tomarVentana: function () {
      var w = ventanaPendiente;
      ventanaPendiente = null;
      return w;
    },
    abrirAjustes: abrirAjustes,
    guardarPedido: guardarPedido,
    // --- Usados por recuperar.html/recuperar.js ---------------------------
    passMin: PASS_MIN,
    validarPass: validarPass,
    enRecuperacion: function () { return enRecuperacionFlag; },
    onRecuperacion: function (cb) {
      recuperacionCb = cb;
      if (enRecuperacionFlag) cb();
    },
    completarRecuperacion: function (nuevaPass) { return sb.auth.updateUser({ password: nuevaPass }); }
  };

  // --- Pop-up de bienvenida (primera visita, sin cuenta) -------------------
  // Invita a crear cuenta apenas se entra al sitio, una sola vez por
  // navegador (localStorage). Espera a que estén listos DOS datos async e
  // independientes entre sí — el DOM (para saber si esta página tiene el
  // botón de cuenta, o sea que es una página de cliente y no un panel de
  // admin) y la sesión de Supabase (para no mostrarlo a quien ya tiene
  // cuenta) — porque cualquiera de los dos puede llegar primero.
  //
  // Es un paso intermedio, NO el formulario de alta directo: primero un
  // aviso chico ("Creá tu cuenta para tu primera compra") y sólo si tocan
  // "Crear cuenta" ahí se abre `pedirSesion()` (el modal de siempre, con
  // los campos). Así alguien que sólo quiere mirar el catálogo cierra el
  // aviso con una sola acción, sin toparse con un formulario.
  var bienvenidaModal;
  function armarBienvenidaModal() {
    bienvenidaModal = el('div', 'cart-acc cart-acc-bienvenida');
    bienvenidaModal.setAttribute('role', 'dialog');
    bienvenidaModal.setAttribute('aria-modal', 'true');
    bienvenidaModal.setAttribute('aria-label', 'Creá tu cuenta');

    var head = el('div', 'cart-head');
    head.appendChild(el('h2', null, '¡Bienvenido/a!'));
    var x = el('button', 'cart-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Cerrar');
    x.addEventListener('click', cerrarBienvenidaModal);
    head.appendChild(x);

    var body = el('div', 'cart-acc-body');
    body.appendChild(el('p', null, 'Creá tu cuenta para poder hacer tu primera compra online.'));
    var crear = el('button', 'cart-send', 'Crear cuenta');
    crear.type = 'button';
    crear.addEventListener('click', function () {
      cerrarBienvenidaModal();
      pedirSesion();
    });
    // Para quien ya tiene cuenta (de otra visita, o de otro dispositivo) y
    // simplemente no tiene sesión activa en ESTE navegador — sin esto, el
    // único camino desde acá era "Crear cuenta", que además explota con
    // "ese email ya existe" si lo intenta.
    var entrar = el('button', 'cart-acc-link', 'Ya tengo cuenta — Iniciar sesión');
    entrar.type = 'button';
    entrar.addEventListener('click', function () {
      cerrarBienvenidaModal();
      pedirSesion(null, 'login');
    });
    var luego = el('button', 'cart-acc-link', 'Ahora no');
    luego.type = 'button';
    luego.addEventListener('click', cerrarBienvenidaModal);
    body.appendChild(crear);
    body.appendChild(entrar);
    body.appendChild(luego);

    bienvenidaModal.appendChild(head);
    bienvenidaModal.appendChild(body);
    document.body.appendChild(bienvenidaModal);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && bienvenidaModal.classList.contains('is-on')) {
        e.stopImmediatePropagation();
        cerrarBienvenidaModal();
      }
    });
  }

  function mostrarBienvenidaModal() {
    if (!bienvenidaModal) return;
    mostrarScrim();
    bienvenidaModal.classList.add('is-on');
  }
  function cerrarBienvenidaModal() {
    if (!bienvenidaModal) return;
    bienvenidaModal.classList.remove('is-on');
    ocultarScrimSiCorresponde();
  }

  var BIENVENIDA_KEY = 'mm_bienvenida_v1';
  var bienvenidaMostrada = false;
  var domListoBienvenida = false;
  var sesionListaBienvenida = false;
  function intentarBienvenida() {
    if (bienvenidaMostrada || !domListoBienvenida || !sesionListaBienvenida) return;
    bienvenidaMostrada = true;
    if (sesion || !navBtn) return;
    if (localStorage.getItem(BIENVENIDA_KEY)) return;
    localStorage.setItem(BIENVENIDA_KEY, '1');
    setTimeout(function () { if (!sesion) mostrarBienvenidaModal(); }, 1500);
  }

  // Todo se arma ya al cargar la página (no recién al primer pedido). Para el
  // modal, además, esto importa por orden: su listener de Escape queda
  // registrado ANTES que el del carrito (carrito.js se carga después en el
  // HTML), así que al cerrar el modal de cuenta con Escape,
  // `stopImmediatePropagation` llega a tiempo y no cierra también el panel
  // del pedido que quedó abierto detrás.
  function iniciar() {
    armarModal();
    armarModalAjustes();
    armarBienvenidaModal();
    armarBotonNav();
    domListoBienvenida = true;
    intentarBienvenida();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
