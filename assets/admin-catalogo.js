/* Edición del catálogo en el lugar (precio, stock, ocultar), sólo para
 * cuentas de admin. Se carga al final de las 7 páginas de categoría,
 * después de carrito.js.
 *
 * Mismo patrón de detección que assets/admin-envios.js: reusa el cliente de
 * Supabase de assets/cuenta.js (nunca uno propio) y decide si DIBUJA la
 * barra de edición llamando a `es_admin()` — la barrera real la ponen las
 * políticas RLS y los GRANT de columna de supabase/catalogo_00_base.sql, no
 * este archivo. Si `window.MMCuenta` no existe (cuenta.js no cargó, o el
 * SDK de Supabase no está disponible), este módulo no hace nada: el
 * catálogo sigue funcionando exactamente igual para cualquier visitante.
 */
(function () {
  'use strict';

  if (!window.MMCuenta) return;
  var sb = window.MMCuenta.cliente();
  if (!sb) return;

  // SIEMPRE con ".html" al final — si Netlify sirve las URLs sin extensión
  // ("Pretty URLs" en Post processing), location.pathname da "disfraces-v2"
  // en vez de "disfraces-v2.html", que es como está guardado (pagina, slug)
  // en catalogo_tarjetas/catalogo_productos — nunca coincidirían y ocultar/
  // mover/agregar un producto en esta página no aplicaría nunca, en silencio.
  function paginaDeUrl() {
    var partes = location.pathname.split('/').filter(Boolean);
    var seg = partes.length ? partes[partes.length - 1] : 'index';
    return /\.html?$/i.test(seg) ? seg : seg + '.html';
  }
  var pagina = paginaDeUrl();

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  var fmt = window.MMPrecios ? null : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  function plata(n) { return window.MMPrecios ? MMPrecios.formato(n) : fmt.format(n); }

  // Los 7 mundos reales del sitio (.claude/gen-catalogo-sql.js trae la misma
  // lista) — para el selector de "mover a otro mundo".
  var MUNDOS = [
    { pagina: 'globos-fiesta-v2.html', nombre: 'Cotillón' },
    { pagina: 'cumpleanos-v2.html', nombre: 'Cumpleaños' },
    { pagina: 'decoracion-v2.html', nombre: 'Decoración' },
    { pagina: 'disfraces-v2.html', nombre: 'Disfraces y accesorios' },
    { pagina: 'reposteria-v2.html', nombre: 'Repostería' },
    { pagina: 'combos-v2.html', nombre: 'Combos' },
    { pagina: 'especiales-v2.html', nombre: 'Especiales' }
  ];

  // Mismo slug que assets/site.js/explorar.js/precios.js: tiene que dar el
  // mismo resultado en los cuatro para que la clave (pagina, slug) sea la
  // misma fila en todos lados.
  function slug(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function claveDe(card) {
    var h3 = $('.pcard-body h3', card);
    return { pagina: paginaDeUrl(), slug: slug(h3 ? h3.textContent.trim() : '') };
  }

  function rutaPrincipal(card) {
    var img = $('.pcard-ph img', card);
    if (!img) return '';
    try { return decodeURIComponent(img.getAttribute('src') || ''); }
    catch (e) { return img.getAttribute('src') || ''; }
  }

  /* --------------------------------------------------------- admin gate */

  var esAdmin = false;

  function chequear() {
    if (!MMCuenta.sesionActiva()) { apagar(); return; }
    // Sólo pega este viaje si hay sesión: para el resto de los visitantes
    // esto no cuesta nada.
    sb.rpc('es_admin').then(function (r) {
      if (r.error || !r.data) { apagar(); return; }
      prender();
    }).catch(function () { apagar(); });
  }

  function apagar() {
    if (!esAdmin && !barra) return;
    esAdmin = false;
    document.body.classList.remove('mm-admin', 'mm-admin-edit');
    if (barra) barra.hidden = true;
    cerrarPopover();
    cerrarAlta();
    cerrarSubcatAlta();
  }

  function prender() {
    esAdmin = true;
    document.body.classList.add('mm-admin');
    if (!barra) armarBarra();
    barra.hidden = false;
    montarLapices();
    montarLapicesSecciones();
  }

  /* --------------------------------------------------- barra flotante */

  var barra, switchBtn;
  var EDICION_KEY = 'mm_admin_edicion';

  function armarBarra() {
    barra = el('div', 'mm-admin-bar');
    barra.appendChild(el('span', 'mm-admin-bar-label', 'Modo edición'));
    switchBtn = el('button', 'mm-admin-switch');
    switchBtn.type = 'button';
    switchBtn.setAttribute('role', 'switch');
    switchBtn.setAttribute('aria-checked', 'false');
    switchBtn.setAttribute('aria-label', 'Modo edición del catálogo');
    switchBtn.addEventListener('click', function () {
      var on = !switchBtn.classList.contains('is-on');
      switchBtn.classList.toggle('is-on', on);
      switchBtn.setAttribute('aria-checked', on ? 'true' : 'false');
      document.body.classList.toggle('mm-admin-edit', on);
      // sessionStorage y no localStorage: es un modo de trabajo de esta
      // visita, no una preferencia que tenga sentido arrastrar para
      // siempre — sobre todo en una compu compartida del local.
      try { sessionStorage.setItem(EDICION_KEY, on ? '1' : '0'); } catch (e) {}
    });
    barra.appendChild(switchBtn);

    // Sólo visible con el modo edición prendido (mismo criterio que el
    // lápiz de cada tarjeta): agregar es una acción de edición, no algo que
    // un admin que sólo entró a mirar deba ver.
    var addBtn = el('button', 'mm-admin-add', '+ Agregar producto');
    addBtn.type = 'button';
    addBtn.addEventListener('click', abrirAlta);
    barra.appendChild(addBtn);

    var addSubcatBtn = el('button', 'mm-admin-add mm-admin-add-subcat', '+ Agregar subcategoría');
    addSubcatBtn.type = 'button';
    addSubcatBtn.addEventListener('click', abrirSubcatAlta);
    barra.appendChild(addSubcatBtn);

    // "Sacar de la web" en un producto de catalogo_productos (a diferencia
    // de una tarjeta del HTML) lo saca de catalogo_publico() — la función
    // que usa TODO el sitio, admin incluido, para leer el catálogo (ver
    // assets/catalogo.js) — así que sin esto no había NINGÚN lugar donde
    // volver a encontrarlo.
    var ocultosBtn = el('button', 'mm-admin-add mm-admin-add-ocultos', 'Productos ocultos');
    ocultosBtn.type = 'button';
    ocultosBtn.addEventListener('click', abrirOcultos);
    barra.appendChild(ocultosBtn);

    document.body.appendChild(barra);

    try {
      if (sessionStorage.getItem(EDICION_KEY) === '1') {
        switchBtn.classList.add('is-on');
        switchBtn.setAttribute('aria-checked', 'true');
        document.body.classList.add('mm-admin-edit');
      }
    } catch (e) {}
  }

  /* --------------------------------------------------- lápiz por tarjeta */

  function montarLapices() {
    $$('.pcard').forEach(function (card) {
      var ph = $('.pcard-ph', card);
      if (!ph || $('.pcard-edit', ph)) return;
      var boton = el('button', 'pcard-edit');
      boton.type = 'button';
      boton.setAttribute('aria-label', 'Editar precio y stock');
      boton.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
      boton.addEventListener('click', function (ev) {
        // La tarjeta es un <a href="#">: sin esto el clic abre la ficha del
        // producto en vez del editor — mismo motivo que el corazón de
        // favoritos (carrito.js).
        ev.preventDefault();
        ev.stopPropagation();
        abrirPopover(card);
      });
      ph.appendChild(boton);
    });
  }

  /* --------------------------------------------------------- el popover */

  var scrimEl, pop, popHead, popBody, popError, popOk, guardarBtn, ocultaChk, notaSpan;
  var cardActual = null;

  function armarPopover() {
    scrimEl = el('div', 'mm-admin-scrim');
    scrimEl.addEventListener('click', cerrarPopover);
    document.body.appendChild(scrimEl);

    pop = el('div', 'mm-pop');
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'true');

    popHead = el('div', 'mm-pop-head');
    popHead.appendChild(el('h3', null, 'Editar producto'));
    var x = el('button', 'mm-pop-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Cerrar');
    x.addEventListener('click', cerrarPopover);
    popHead.appendChild(x);

    popBody = el('div', 'mm-pop-body');

    var foot = el('div', 'mm-pop-foot');
    popError = el('p', 'mm-pop-error');
    popError.hidden = true;
    popOk = el('p', 'mm-pop-ok');
    popOk.hidden = true;
    var ocultaLabel = el('label', 'mm-check');
    ocultaChk = document.createElement('input');
    ocultaChk.type = 'checkbox';
    ocultaLabel.appendChild(ocultaChk);
    ocultaLabel.appendChild(el('span', null, 'Sacar de la web (se puede volver a mostrar cuando quieras)'));
    notaSpan = el('p', 'mm-pop-clave');
    guardarBtn = el('button', 'mm-pop-guardar', 'Guardar');
    guardarBtn.type = 'button';
    guardarBtn.addEventListener('click', guardar);

    foot.appendChild(popError);
    foot.appendChild(popOk);
    foot.appendChild(ocultaLabel);
    foot.appendChild(notaSpan);
    foot.appendChild(guardarBtn);

    pop.appendChild(popHead);
    pop.appendChild(popBody);
    pop.appendChild(foot);
    document.body.appendChild(pop);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && pop.classList.contains('is-on')) cerrarPopover();
    });
  }

  function mostrarError(msg) { popError.textContent = msg || ''; popError.hidden = !msg; }
  function mostrarOk(msg) { popOk.textContent = msg || ''; popOk.hidden = !msg; }

  function cerrarPopover() {
    if (!pop) return;
    pop.classList.remove('is-on');
    scrimEl.classList.remove('is-on');
    cardActual = null;
  }

  // Descripción corta de por qué se resolvió este código, para que el admin
  // no dude si está editando el producto correcto. No es exhaustivo (no
  // repite toda la cascada de precios.js), es sólo una pista.
  function origenCodigo(card, codigo) {
    if (!codigo) return '';
    if (card.getAttribute('data-pos') === codigo) return 'del atributo data-pos de la tarjeta';
    var img = $('.pcard-ph img', card);
    if (img && img.getAttribute('data-pos') === codigo) return 'del atributo data-pos de la foto';
    if (window.MMProducto && MMProducto.codigoDeImagen(img && img.getAttribute('src')) === codigo) {
      return 'del número al final del nombre de la foto';
    }
    return 'de la tabla de fotos / el mapa viejo (assets/pos-codes.js)';
  }

  // Arma según lo que la tarjeta ES — MMProducto.leer() ya sabe distinguir
  // combo / talles / galería / simple, no hace falta repetir esa lógica acá.
  function analizar(card) {
    var modelo = window.MMProducto ? MMProducto.leer(card) : null;
    if (!modelo) return null;
    if (modelo.incluye && modelo.incluye.length) {
      return { tipo: 'combo', titulo: modelo.title, componentes: modelo.incluye };
    }
    if (modelo.dimension && modelo.dimension.fuente === 'talles') {
      return { tipo: 'talles', titulo: modelo.title, opciones: modelo.dimension.opciones };
    }
    var esGaleria = modelo.dimension && modelo.dimension.fuente === 'fotos';
    // Galería SIN data-pos compartido: cada color resolvió su propio código
    // por su cuenta (filename, catalogo_fotos…) — no es "sin código", es
    // "varios códigos distintos". Tratarla como una sola tarjeta con un
    // campo de código (más abajo) mentía: entrar un código ahí sólo hubiera
    // tocado la foto principal y dejado los otros 5 colores intactos.
    if (esGaleria && !modelo.base) {
      return { tipo: 'galeria-multi', titulo: modelo.title, opciones: modelo.dimension.opciones };
    }
    var codigo = (esGaleria ? modelo.base : (modelo.code || modelo.base)) || '';
    return { tipo: 'simple', titulo: modelo.title, codigo: codigo, esGaleria: esGaleria };
  }

  function abrirPopover(card) {
    // Una tarjeta insertada por assets/catalogo-productos.js no tiene fila
    // en catalogo_tarjetas — es su PROPIA fila en catalogo_productos. El
    // popover de abajo está pensado para (pagina, slug) del HTML; editar un
    // producto usa el mismo formulario que "+ Agregar producto" (ver
    // abrirEditarProducto), que además permite convertir de tipo y
    // agregar/sacar fotos o talles — cosas que este popover no sabe hacer.
    if (card.hasAttribute('data-mm-producto-id')) { abrirEditarProducto(card); return; }

    if (!pop) armarPopover();
    mostrarError(''); mostrarOk('');
    cardActual = card;
    guardarBtn.disabled = false;

    MMCatalogo.cargar(function (datos) {
      if (cardActual !== card) return; // cerraron y abrieron otra antes de que llegue
      construir(card, datos);
      scrimEl.classList.add('is-on');
      pop.classList.add('is-on');
    });
  }

  function construir(card, datos) {
    var info = analizar(card);
    var clave = claveDe(card);
    var tarjetaOv = datos.tarjetas[clave.pagina + '~' + clave.slug] || {};

    $('h3', popHead).textContent = info ? info.titulo : 'Editar producto';
    popBody.innerHTML = '';
    ocultaChk.checked = !!tarjetaOv.oculta;
    notaSpan.textContent = clave.pagina + ' ~ ' + clave.slug;

    if (!info) {
      popBody.appendChild(el('p', 'mm-pop-nota', 'No pude leer esta tarjeta (falta assets/producto.js).'));
      guardarBtn.disabled = true;
      return;
    }

    // Cada construir_X sólo resetea SU propio campo — sin esto, cerrar un
    // combo y abrir enseguida una tarjeta simple dejaba campoComboPrecio
    // apuntando a un <input> ya desmontado del popover anterior, y guardar()
    // (que revisa los tres sin importar el tipo actual) podía escribirle un
    // precio_fijo fantasma a la tarjeta nueva.
    camposSimple = null;
    filasTalles = null;
    campoComboPrecio = null;
    camposColores = null;
    camposGaleriaMulti = null;

    if (info.tipo === 'combo') construirCombo(info, datos, clave);
    else if (info.tipo === 'talles') construirTalles(info, datos);
    else if (info.tipo === 'galeria-multi') construirGaleriaMulti(card, info, datos);
    else construirSimple(info, card, datos, tarjetaOv);

    construirSubcategoria(datos, clave, tarjetaOv);
    // Mover de mundo sólo para el caso simple/galería: combos son varios
    // códigos con cantidades (data-incluye) y convertirlos en una sola fila
    // de catalogo_productos (un código, un precio) perdería esa estructura.
    if (info.tipo === 'simple') construirMoverMundo(info, card, clave);
    // Convertir en editable también sirve para la galería multi (falta
    // poder sumar un color con su propio código) y para talles (falta poder
    // editarle el nombre o el código a cada talle/tamaño — el popover de
    // arriba, construirTalles(), sólo deja tocar precio y stock). Combos
    // quedan afuera por lo mismo que "Mover a otro mundo": catalogo_productos
    // no tiene dónde guardar cantidades por componente.
    if (info.tipo === 'simple' || info.tipo === 'galeria-multi' || info.tipo === 'talles') {
      construirConvertir(info, card, clave, tarjetaOv);
    }
  }

  /* --------------------------------------- productos ocultos de este mundo
   * catalogo_publico() (assets/catalogo.js) sólo trae productos con
   * publicado=true — es la única fuente de datos que usa el resto del
   * panel, admin incluido. Un producto despublicado (con "Sacar de la web"
   * en el editor) desaparece de ahí y de cualquier lápiz que dependa de esa
   * lista. Esta consulta va directo a la tabla — el RLS "Admin gestiona
   * productos" (for all, catalogo_03_subcategorias.sql) sí deja leer
   * publicado=false — para poder encontrarlo y volver a mostrarlo.
   */
  var ocultosScrim, ocultosPop, ocultosBody, ocultosError;

  function armarOcultos() {
    ocultosScrim = el('div', 'mm-admin-scrim');
    ocultosScrim.addEventListener('click', cerrarOcultos);
    document.body.appendChild(ocultosScrim);

    ocultosPop = el('div', 'mm-pop');
    ocultosPop.setAttribute('role', 'dialog');
    ocultosPop.setAttribute('aria-modal', 'true');

    var head = el('div', 'mm-pop-head');
    head.appendChild(el('h3', null, 'Productos ocultos de este mundo'));
    var x = el('button', 'mm-pop-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Cerrar');
    x.addEventListener('click', cerrarOcultos);
    head.appendChild(x);

    ocultosBody = el('div', 'mm-pop-body');
    ocultosError = el('p', 'mm-pop-error');
    ocultosError.hidden = true;
    ocultosBody.appendChild(ocultosError);

    ocultosPop.appendChild(head);
    ocultosPop.appendChild(ocultosBody);
    document.body.appendChild(ocultosPop);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ocultosPop.classList.contains('is-on')) cerrarOcultos();
    });
  }

  function cerrarOcultos() {
    if (!ocultosPop) return;
    ocultosPop.classList.remove('is-on');
    ocultosScrim.classList.remove('is-on');
  }

  function mostrarErrorOcultos(msg) {
    ocultosError.textContent = msg || '';
    ocultosError.hidden = !msg;
  }

  // Sacar la fila y, si con eso su grupo ("Productos" / "Tarjetas del
  // HTML") se quedó sin filas, sacar también el título del grupo — sin
  // esto un grupo vaciado dejaba un encabezado colgado sin nada debajo.
  // Si no queda NINGÚN grupo, mostrar el aviso de "no hay nada oculto".
  function sacarFilaOculta(fila) {
    var grupo = fila.closest('.mm-ocultos-grupo-wrap');
    fila.remove();
    if (grupo && !grupo.querySelector('.mm-fila')) grupo.remove();
    if (!ocultosBody.querySelector('.mm-fila')) {
      ocultosBody.appendChild(el('p', 'mm-pop-nota mm-ocultos-vacio', 'No queda nada oculto en este mundo.'));
    }
  }

  function mostrarProducto(producto, fila, boton) {
    boton.disabled = true;
    sb.from('catalogo_productos').update({ publicado: true }).eq('id', producto.id).select().then(function (r) {
      if (r.error) throw r.error;
      if (!r.data || !r.data.length) throw new Error('No se guardó — probablemente se cerró la sesión de admin. Recargá la página.');
      sacarFilaOculta(fila);
      MMCatalogo.refrescar(function () {
        if (window.MMCatalogoProductos && MMCatalogoProductos.repintar) MMCatalogoProductos.repintar();
        if (window.MMPrecios && MMPrecios.repintar) MMPrecios.repintar();
        montarLapices();
      });
    }).catch(function (err) {
      mostrarErrorOcultos((err && err.message) || 'No se pudo. Probá de nuevo.');
      boton.disabled = false;
    });
  }

  // Misma idea que mostrarProducto() pero para una tarjeta del HTML: acá
  // "volver a mostrar" es destildar oculta en catalogo_tarjetas (guardarTarjeta,
  // la misma función que usa el popover de la tarjeta) — no hay fila en
  // catalogo_productos para esto.
  function mostrarTarjeta(tarjeta, fila, boton) {
    boton.disabled = true;
    guardarTarjeta(tarjeta.pagina, tarjeta.slug, { oculta: false }).then(function () {
      sacarFilaOculta(fila);
      MMCatalogo.refrescar(function () {
        if (window.MMPrecios && MMPrecios.repintar) MMPrecios.repintar();
        montarLapices();
      });
    }).catch(function (err) {
      mostrarErrorOcultos((err && err.message) || 'No se pudo. Probá de nuevo.');
      boton.disabled = false;
    });
  }

  // Agrega un grupo con título ("Productos" / "Tarjetas del HTML") y una
  // fila por item, con su botón "Volver a mostrar" — mismo armado para los
  // dos orígenes, sólo cambia qué texto mostrar y qué pasa al click.
  function agregarGrupoOcultos(titulo, items, nombreDe, onMostrar) {
    if (!items.length) return;
    var grupo = el('div', 'mm-ocultos-grupo-wrap');
    grupo.appendChild(el('p', 'mm-pop-nota mm-ocultos-grupo', titulo));
    items.forEach(function (item) {
      // Sin la clase mm-fila-nombre (que en la lista de talles ocupa las dos
      // columnas del grid a propósito): acá sí quiero nombre y botón lado a
      // lado en la misma fila.
      var fila = el('div', 'mm-fila');
      fila.appendChild(el('span', 'mm-ocultos-nombre', nombreDe(item)));
      var btn = el('button', 'mm-ocultos-btn', 'Volver a mostrar');
      btn.type = 'button';
      btn.addEventListener('click', function () { onMostrar(item, fila, btn); });
      fila.appendChild(btn);
      grupo.appendChild(fila);
    });
    ocultosBody.appendChild(grupo);
  }

  function abrirOcultos() {
    if (!ocultosPop) armarOcultos();
    mostrarErrorOcultos('');
    ocultosBody.innerHTML = '';
    ocultosBody.appendChild(ocultosError);
    ocultosBody.appendChild(el('p', 'mm-pop-nota', 'Cargando…'));
    ocultosScrim.classList.add('is-on');
    ocultosPop.classList.add('is-on');

    // Dos tablas, dos consultas: "Sacar de la web" en un producto cargado
    // desde el panel es catalogo_productos.publicado=false; en una tarjeta
    // escrita a mano en el HTML es catalogo_tarjetas.oculta=true — no hay
    // una sola tabla que traiga las dos cosas. Sin esto último, una tarjeta
    // del HTML ocultada quedaba invisible en TODA la web (ver marcarEstado()
    // en precios.js: card.hidden no distingue admin de visita) y sin ningún
    // lugar del panel para volver a encontrarla.
    Promise.all([
      sb.from('catalogo_productos').select('id,titulo,codigo,actualizado_en')
        .eq('pagina', pagina).eq('publicado', false)
        .order('actualizado_en', { ascending: false }),
      sb.from('catalogo_tarjetas').select('pagina,slug,titulo_ref,actualizado_en')
        .eq('pagina', pagina).eq('oculta', true)
        .order('actualizado_en', { ascending: false })
    ]).then(function (rs) {
      ocultosBody.innerHTML = '';
      ocultosBody.appendChild(ocultosError);
      var rProductos = rs[0], rTarjetas = rs[1];
      if (rProductos.error) { mostrarErrorOcultos(rProductos.error.message); return; }
      if (rTarjetas.error) { mostrarErrorOcultos(rTarjetas.error.message); return; }

      var productos = rProductos.data || [];
      var tarjetas = rTarjetas.data || [];
      if (!productos.length && !tarjetas.length) {
        ocultosBody.appendChild(el('p', 'mm-pop-nota mm-ocultos-vacio', 'No hay nada oculto en este mundo.'));
        return;
      }

      agregarGrupoOcultos('Productos', productos, function (p) {
        return p.titulo + (p.codigo ? ' · ' + p.codigo : '');
      }, mostrarProducto);

      // titulo_ref sólo queda cargado si esa tarjeta se guardó DESPUÉS de
      // que admin-catalogo.js empezó a mandarlo (ver guardarTarjeta) — para
      // una fila vieja que no lo tiene, el slug sigue siendo legible (sale
      // del título del producto) así que alcanza como respaldo.
      agregarGrupoOcultos('Tarjetas del HTML', tarjetas, function (t) {
        return t.titulo_ref || t.slug;
      }, mostrarTarjeta);
    });
  }

  /* --- Caso: producto simple o galería de colores (un solo código) ------- */

  var camposSimple = null; // { codigo, codigoIn, precioIn, stockChk } o { codigoIn, precioIn, stockChk, sinCodigo:true } si no hay código

  function construirSimple(info, card, datos, tarjetaOv) {
    camposSimple = null;
    if (info.esGaleria && info.codigo) {
      popBody.appendChild(el('p', 'mm-pop-nota',
        'Esta tarjeta tiene varios colores pero un solo código del POS — el precio y el stock son para todos.'));
    }

    if (info.codigo) {
      popBody.appendChild(el('p', 'mm-pop-nota', 'Código resuelto: ' + info.codigo + ' (' + origenCodigo(card, info.codigo) + ')'));
      // Editable aunque ya haya un código resuelto: corrige un data-pos mal
      // cargado en el HTML sin tocar el HTML — se guarda como
      // codigo_override y gana en la cascada de precios.js (candidato de
      // más prioridad). Si lo dejan igual, no se escribe nada.
      var codigoIn3 = campoTexto('Código del POS (corregir si está mal)', info.codigo);
      var precioIn = campoNumero('Precio', datos.precios[info.codigo] || '');
      var stockChk = campoCheck('Sin stock', !!datos.sinStock[info.codigo]);
      popBody.appendChild(codigoIn3.wrap);
      popBody.appendChild(precioIn.wrap);
      popBody.appendChild(stockChk.wrap);
      camposSimple = { codigo: info.codigo, codigoIn: codigoIn3.input, precioIn: precioIn.input, stockChk: stockChk.input };
    } else {
      popBody.appendChild(el('p', 'mm-pop-nota mm-alerta',
        'Esta tarjeta no está vinculada a ningún código del POS todavía. Cargalo para poder ponerle precio.'));
      var codigoIn = campoTexto('Código del POS', '');
      var precioIn2 = campoNumero('Precio (opcional, se puede cargar después)', '');
      var stockChk2 = campoCheck('Sin stock', !!tarjetaOvSinStock(datos, card));
      popBody.appendChild(codigoIn.wrap);
      popBody.appendChild(precioIn2.wrap);
      popBody.appendChild(stockChk2.wrap);
      camposSimple = { codigoIn: codigoIn.input, precioIn: precioIn2.input, stockChk: stockChk2.input, sinCodigo: true };
    }

    if (info.esGaleria) construirColoresSinStock(card, tarjetaOv);
  }

  function tarjetaOvSinStock(datos, card) {
    var clave = claveDe(card);
    var ov = datos.tarjetas[clave.pagina + '~' + clave.slug];
    return ov && ov.sinStock;
  }

  /* --- Sin stock de un color puntual, dentro de una galería con un solo
     código compartido (catalogo_tarjetas.colores_sin_stock) ---------------- */
  // "Sin stock" de arriba (stockChk) es del CÓDIGO entero — apaga todos los
  // colores a la vez. Esto es lo que permite decir "no queda amarillo pero
  // sí las demás" cuando el POS ni siquiera distingue un color de otro.

  var camposColores = null; // [{ nombre, input }]

  function construirColoresSinStock(card, tarjetaOv) {
    camposColores = null;
    var caps = [];
    $$('.gtrack img[data-cap]', card).forEach(function (img) {
      var cap = (img.getAttribute('data-cap') || '').trim();
      // "Todos los colores" es la foto del set completo, no un color pedible
      // — mismo filtro que usa assets/producto.js (variantePedible).
      if (cap && !/^todos\b/i.test(cap) && caps.indexOf(cap) === -1) caps.push(cap);
    });
    if (caps.length < 2) return; // un solo color no es una elección

    var actuales = {};
    ((tarjetaOv && tarjetaOv.coloresSinStock) || []).forEach(function (c) {
      actuales[String(c || '').trim().toLowerCase()] = true;
    });

    popBody.appendChild(el('p', 'mm-pop-nota', 'Sin stock por color (el precio y el código siguen siendo los mismos para todos):'));
    var wrap = el('div', 'mm-colores');
    var checks = [];
    caps.forEach(function (nombre) {
      var campo = campoCheck(nombre, !!actuales[nombre.toLowerCase()]);
      wrap.appendChild(campo.wrap);
      checks.push({ nombre: nombre, input: campo.input });
    });
    popBody.appendChild(wrap);
    camposColores = checks;
  }

  /* --- Subcategoría dentro del mismo mundo --------------------------------- */
  // Aplica a los tres tipos de tarjeta (simple, talles, combo): mover de
  // subcategoría no toca ningún código ni precio, sólo dónde vive el nodo
  // en la página — ver reubicar() en assets/precios.js.

  var campoSubcategoria = null; // { select, nuevoInput }

  function construirSubcategoria(datos, clave, tarjetaOv) {
    campoSubcategoria = null;
    var wrap = el('label', 'mm-field');
    wrap.appendChild(el('span', null, 'Subcategoría en este mundo'));
    var select = document.createElement('select');

    var optNone = document.createElement('option');
    optNone.value = '';
    optNone.textContent = 'Sin subcategoría (queda donde está)';
    select.appendChild(optNone);

    var propias = [];
    Object.keys(datos.subcategorias).forEach(function (id) {
      var s = datos.subcategorias[id];
      if (s.pagina === clave.pagina) propias.push(Object.assign({ id: id }, s));
    });
    propias.sort(function (a, b) { return (a.orden - b.orden) || a.nombre.localeCompare(b.nombre); });
    propias.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.nombre;
      select.appendChild(o);
    });

    var optNueva = document.createElement('option');
    optNueva.value = '__nueva__';
    optNueva.textContent = '+ Crear subcategoría nueva…';
    select.appendChild(optNueva);

    var actual = tarjetaOv.subcategoriaId || '';
    select.value = propias.some(function (s) { return s.id === actual; }) ? actual : '';

    var nuevoWrap = el('label', 'mm-field');
    nuevoWrap.appendChild(el('span', null, 'Nombre de la subcategoría nueva'));
    var nuevoInput = document.createElement('input');
    nuevoInput.type = 'text';
    nuevoWrap.appendChild(nuevoInput);
    nuevoWrap.hidden = true;

    select.addEventListener('change', function () {
      nuevoWrap.hidden = select.value !== '__nueva__';
    });

    wrap.appendChild(select);
    popBody.appendChild(wrap);
    popBody.appendChild(nuevoWrap);

    campoSubcategoria = { select: select, nuevoInput: nuevoInput };
  }

  // undefined = "no tocar" (no debería pasar, campoSubcategoria siempre se
  // arma), null = "sin subcategoría", string = el id elegido o el de la
  // subcategoría recién creada.
  function resolverSubcategoriaId(pagina) {
    if (!campoSubcategoria) return Promise.resolve(undefined);
    var val = campoSubcategoria.select.value;
    if (val === '__nueva__') {
      var nombre = campoSubcategoria.nuevoInput.value.trim();
      if (!nombre) return Promise.resolve(null);
      return guardarSubcategoriaNueva(pagina, nombre);
    }
    return Promise.resolve(val || null);
  }

  function guardarSubcategoriaNueva(pagina, nombre) {
    var datos = MMCatalogo.datos();
    var slugNueva = slug(nombre);
    // Ya existe una con ese nombre en este mundo: se reusa en vez de chocar
    // contra unique(pagina, slug) de catalogo_subcategorias.
    var existenteId = null;
    if (datos) {
      Object.keys(datos.subcategorias).some(function (id) {
        var s = datos.subcategorias[id];
        if (s.pagina === pagina && s.slug === slugNueva) { existenteId = id; return true; }
        return false;
      });
    }
    if (existenteId) return Promise.resolve(existenteId);

    var orden = proximoOrden(pagina);
    return sb.from('catalogo_subcategorias')
      .insert({ pagina: pagina, nombre: nombre, slug: slugNueva, orden: orden })
      .select('id')
      .then(function (r) {
        if (r.error) throw r.error;
        var id = r.data && r.data[0] && r.data[0].id;
        if (id) {
          var parche = { subcategorias: {} };
          parche.subcategorias[id] = { pagina: pagina, nombre: nombre, slug: slugNueva, orden: orden };
          MMCatalogo.parche(parche);
        }
        return id;
      });
  }

  // Versión genérica de lo de arriba, para los otros tres lugares donde se
  // elige subcategoría pero el mundo NO es fijo (clave.pagina de una
  // tarjeta): editar un producto ya creado, "Mover a otro mundo" y
  // "Agregar producto" — los tres necesitan poder crear una subcategoría
  // nueva en CUALQUIER mundo, no sólo en el de la página actual.
  //
  // mundoSel: el <select> de mundo ya armado en cada popover — se repuebla
  // solo cuando cambia. actualId(): función que devuelve el id ya elegido
  // (para dejarlo preseleccionado), o null/undefined si no aplica.
  function armarSelectorSubcategoria(mundoSel, actualId) {
    var wrap = el('label', 'mm-field');
    wrap.appendChild(el('span', null, 'Subcategoría'));
    var select = document.createElement('select');
    wrap.appendChild(select);

    var nuevoWrap = el('label', 'mm-field');
    nuevoWrap.appendChild(el('span', null, 'Nombre de la subcategoría nueva'));
    var nuevoInput = document.createElement('input');
    nuevoInput.type = 'text';
    nuevoWrap.appendChild(nuevoInput);
    nuevoWrap.hidden = true;

    function repoblar() {
      select.innerHTML = '';
      var optNone = document.createElement('option');
      optNone.value = '';
      optNone.textContent = 'Sin subcategoría';
      select.appendChild(optNone);

      var datos = MMCatalogo.datos();
      var propias = [];
      if (datos) {
        Object.keys(datos.subcategorias).forEach(function (id) {
          var s = datos.subcategorias[id];
          if (s.pagina === mundoSel.value) propias.push(Object.assign({ id: id }, s));
        });
      }
      propias.sort(function (a, b) { return (a.orden - b.orden) || a.nombre.localeCompare(b.nombre); });
      var actual = actualId ? actualId() : null;
      propias.forEach(function (s) {
        var o = document.createElement('option');
        o.value = s.id;
        o.textContent = s.nombre;
        if (actual && s.id === actual) o.selected = true;
        select.appendChild(o);
      });

      var optNueva = document.createElement('option');
      optNueva.value = '__nueva__';
      optNueva.textContent = '+ Crear subcategoría nueva…';
      select.appendChild(optNueva);
    }

    select.addEventListener('change', function () {
      nuevoWrap.hidden = select.value !== '__nueva__';
    });
    // Cambiar de mundo invalida lo elegido: las subcategorías son de OTRO
    // mundo ahora. Se repuebla desde cero en "sin subcategoría".
    mundoSel.addEventListener('change', function () { nuevoWrap.hidden = true; repoblar(); });
    repoblar();

    return { wrap: wrap, nuevoWrap: nuevoWrap, select: select, nuevoInput: nuevoInput };
  }

  // undefined = "no tocar", null = "sin subcategoría", string = el id
  // elegido o el de la subcategoría recién creada — mismo contrato que
  // resolverSubcategoriaId(), pero recibe el campo en vez de asumir uno fijo.
  function resolverSubcategoriaSelector(campo, pagina) {
    if (!campo) return Promise.resolve(undefined);
    var val = campo.select.value;
    if (val === '__nueva__') {
      var nombre = campo.nuevoInput.value.trim();
      if (!nombre) return Promise.resolve(null);
      return guardarSubcategoriaNueva(pagina, nombre);
    }
    return Promise.resolve(val || null);
  }

  /* --- Mover a otro mundo (sólo tipo simple/galería) ----------------------- */
  // No hay forma de "traer" una tarjeta escrita a mano al HTML de otra
  // página: se convierte en una fila de catalogo_productos en el mundo
  // destino (assets/catalogo-productos.js la renderiza ahí) y la original
  // se oculta acá — decisión tomada a propósito, ver el comentario largo en
  // supabase/catalogo_03_subcategorias.sql.

  function construirMoverMundo(info, card, clave) {
    var toggle = el('button', 'mm-mover-toggle', 'Mover a otro mundo…');
    toggle.type = 'button';
    var panel = el('div', 'mm-mover-panel');
    panel.hidden = true;

    var selMundo = document.createElement('select');
    MUNDOS.filter(function (m) { return m.pagina !== clave.pagina; }).forEach(function (m) {
      var o = document.createElement('option');
      o.value = m.pagina;
      o.textContent = m.nombre;
      selMundo.appendChild(o);
    });
    var wrapMundo = el('label', 'mm-field');
    wrapMundo.appendChild(el('span', null, 'Mundo destino'));
    wrapMundo.appendChild(selMundo);

    var subCampo = armarSelectorSubcategoria(selMundo, null);

    var aviso = el('p', 'mm-pop-nota mm-alerta',
      'Esto oculta la tarjeta acá y la crea como producto editable en el mundo elegido. No hay vuelta atrás con un clic — se puede volver a mostrar la original y borrar la copia a mano si hace falta.');

    var moverBtn = el('button', 'mm-pop-guardar mm-mover-btn', 'Mover');
    moverBtn.type = 'button';
    moverBtn.addEventListener('click', function () {
      moverAMundo(card, clave, selMundo.value, subCampo, moverBtn);
    });

    panel.appendChild(wrapMundo);
    panel.appendChild(subCampo.wrap);
    panel.appendChild(subCampo.nuevoWrap);
    panel.appendChild(aviso);
    panel.appendChild(moverBtn);

    toggle.addEventListener('click', function () { panel.hidden = !panel.hidden; });

    popBody.appendChild(toggle);
    popBody.appendChild(panel);
  }

  function moverAMundo(card, clave, paginaDestino, subCampo, boton) {
    var info = analizar(card);
    if (!info) return;
    mostrarError(''); mostrarOk('');
    boton.disabled = true;

    var specsAttr = card.getAttribute('data-specs') || '';
    var specs = specsAttr ? specsAttr.split('|').map(function (s) { return s.trim(); }).filter(Boolean) : null;
    var ruta = rutaPrincipal(card);

    // La subcategoría puede necesitar crear la fila nueva primero (si
    // eligieron "+ Crear subcategoría nueva…" en el mundo destino).
    resolverSubcategoriaSelector(subCampo, paginaDestino).then(function (subcategoriaId) {
      var nuevo = {
        pagina: paginaDestino,
        subcategoria_id: subcategoriaId || null,
        titulo: info.titulo,
        slug: slug(info.titulo),
        codigo: info.codigo || null,
        specs: specs,
        // {src, cap} — mismo shape que catalogo-productos.js espera para
        // cualquier fila, aunque acá sea una sola foto sin color (cap vacío).
        fotos: ruta ? [{ src: ruta, cap: '' }] : [],
        orden: 0,
        publicado: true
      };
      return sb.from('catalogo_productos').insert(nuevo).select('id');
    }).then(function (r) {
      if (r.error) throw r.error;
      return guardarTarjeta(clave.pagina, clave.slug, { oculta: true }, { titulo_ref: info.titulo });
    }).then(function () {
      MMCatalogo.refrescar(function () {
        if (window.MMPrecios && window.MMPrecios.repintar) MMPrecios.repintar();
      });
      mostrarOk('Movido. La tarjeta original quedó oculta acá.');
      boton.disabled = false;
      setTimeout(cerrarPopover, 900);
    }).catch(function (err) {
      var msg = (err && err.message) || '';
      if (/duplicate key|unique/i.test(msg)) msg = 'Ya hay un producto con ese nombre en el mundo destino.';
      mostrarError(msg || 'No se pudo mover. Probá de nuevo.');
      boton.disabled = false;
    });
  }

  /* --- Convertir en producto editable (sin sacarla de su mundo) ----------
   * El popover de una tarjeta del HTML sabe tocar precio, stock, código y
   * subcategoría, pero no puede agregarle una foto: las fotos de una tarjeta
   * escrita a mano viven en el HTML, no en la base. Esto la pasa a
   * catalogo_productos — el mismo camino que "Mover a otro mundo", pero
   * dejándola donde está — y a partir de ahí se edita con el formulario de
   * "+ Agregar producto" (abrirEditarProducto), que sí sabe sumar colores con
   * su propio código, pasarla a talles y sacar fotos.
   *
   * A diferencia de moverAMundo se lleva TODAS las fotos de la galería, con
   * su color y su código: convertir una galería de seis colores y que
   * aparecieran cinco menos sería una pérdida silenciosa.
   */

  function codigoDeFoto(im) {
    // Mismo orden de prioridad que producto.js: el data-pos escrito a mano
    // manda, y si no está vale el que resolvió precios.js (en las galerías
    // multi sale casi siempre del número al final del nombre del archivo).
    return (im.getAttribute('data-pos') || im.getAttribute('data-pos-ok') || '').trim();
  }

  function fotosDeTarjeta(card, conCodigoPropio) {
    function rutaDe(im) {
      try { return decodeURIComponent(im.getAttribute('src') || ''); }
      catch (e) { return im.getAttribute('src') || ''; }
    }
    var imgs = $$('.gtrack img', card);
    if (!imgs.length) {
      var ruta = rutaPrincipal(card);
      return ruta ? [{ src: ruta, cap: '' }] : [];
    }
    return imgs.map(function (im) {
      var foto = { src: rutaDe(im), cap: (im.getAttribute('data-cap') || '').trim() };
      // El código propio por foto es lo que distingue una galería multi de
      // una de código compartido. Repetirlo acá en una compartida la dejaría
      // cargada como multi, y editar el precio pasaría a ser seis ediciones
      // en vez de una.
      if (conCodigoPropio) foto.codigo = codigoDeFoto(im);
      return foto;
    });
  }

  function subcategoriaDeTarjeta(card, clave, tarjetaOv) {
    // Lo guardado en catalogo_tarjetas manda: es donde la dejó un admin.
    if (tarjetaOv && tarjetaOv.subcategoriaId) return tarjetaOv.subcategoriaId;
    // Si nunca se tocó, la sección del HTML donde está parada. El id del
    // <section class="catsec"> es el mismo slug que se migró a
    // catalogo_subcategorias (.claude/gen-subcategorias-sql.js), así que
    // alcanza con buscarla por (pagina, slug).
    var sec = card.closest ? card.closest('.catsec') : null;
    if (!sec || !sec.id) return null;
    var datos = MMCatalogo.datos();
    if (!datos || !datos.subcategorias) return null;
    var hallada = null;
    Object.keys(datos.subcategorias).forEach(function (id) {
      var s = datos.subcategorias[id];
      if (s.pagina === clave.pagina && s.slug === sec.id) hallada = id;
    });
    return hallada;
  }

  function construirConvertir(info, card, clave, tarjetaOv) {
    var esTalles = info.tipo === 'talles';
    var multi = info.tipo === 'galeria-multi';
    var fotos = fotosDeTarjeta(card, multi);
    if (!fotos.length) return; // sin foto no hay nada que convertir

    var toggle = el('button', 'mm-mover-toggle', 'Convertir en producto editable…');
    toggle.type = 'button';
    var panel = el('div', 'mm-mover-panel');
    panel.hidden = true;

    panel.appendChild(el('p', 'mm-pop-nota',
      (esTalles
        ? 'Para poder editarle el nombre o el código a cada talle/tamaño, o agregarle fotos. '
        : 'Para poder agregarle fotos de otros colores, ponerle un código a cada uno o pasarla a talles. ') +
      'Queda en este mismo mundo y en su subcategoría, con ' +
      (fotos.length === 1 ? 'su foto.' : 'sus ' + fotos.length + ' fotos.')));

    panel.appendChild(el('p', 'mm-pop-nota mm-alerta',
      'Después de convertirla se edita desde su propio lápiz y deja de leerse del HTML. ' +
      'La original queda oculta, no borrada: se puede volver a mostrar y borrar la copia si hace falta.'));

    var btn = el('button', 'mm-pop-guardar mm-mover-btn', 'Convertir');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      convertirEnProducto(info, card, clave, tarjetaOv, fotos, multi, btn);
    });
    panel.appendChild(btn);

    toggle.addEventListener('click', function () { panel.hidden = !panel.hidden; });
    popBody.appendChild(toggle);
    popBody.appendChild(panel);
  }

  function convertirEnProducto(info, card, clave, tarjetaOv, fotos, multi, boton) {
    mostrarError(''); mostrarOk('');
    boton.disabled = true;

    var esTalles = info.tipo === 'talles';
    var specsAttr = card.getAttribute('data-specs') || '';
    var specs = specsAttr ? specsAttr.split('|').map(function (s) { return s.trim(); }).filter(Boolean) : null;

    var nuevo = {
      pagina: clave.pagina,
      subcategoria_id: subcategoriaDeTarjeta(card, clave, tarjetaOv),
      titulo: info.titulo,
      slug: slug(info.titulo),
      // En una galería multi el código vive en cada foto y en talles vive uno
      // por opción (ver abajo) — ninguno de los dos tiene un único código de
      // tarjeta (mismo criterio que usa el formulario "+ Agregar producto").
      codigo: (multi || esTalles) ? null : (info.codigo || null),
      // [{nombre, codigo}] por opción — se traduce 1 a 1 al mismo
      // data-talles="Nombre:codigo;…" que ya sabe leer producto.js (ver
      // catalogo-productos.js). El precio de cada código ya está cargado en
      // catalogo_precios (es el mismo código que usaba la tarjeta del HTML),
      // así que no hace falta volver a guardarlo acá.
      talles: esTalles ? info.opciones.map(function (op) { return { nombre: op.name, codigo: op.code }; }) : null,
      specs: specs,
      fotos: fotos,
      orden: 0,
      publicado: true
    };

    sb.from('catalogo_productos').insert(nuevo).select('id').then(function (r) {
      if (r.error) throw r.error;
      return guardarTarjeta(clave.pagina, clave.slug, { oculta: true }, { titulo_ref: info.titulo });
    }).then(function () {
      // A diferencia de moverAMundo, el producto nuevo va EN ESTA página:
      // hay que redibujarlo acá o desaparece hasta recargar.
      MMCatalogo.refrescar(function () {
        if (window.MMCatalogoProductos && MMCatalogoProductos.repintar) MMCatalogoProductos.repintar();
        if (window.MMPrecios && MMPrecios.repintar) MMPrecios.repintar();
      });
      mostrarOk('Convertida. Abrí su lápiz para agregarle fotos y códigos.');
      boton.disabled = false;
      setTimeout(cerrarPopover, 1200);
    }).catch(function (err) {
      var msg = (err && err.message) || '';
      if (/duplicate key|unique/i.test(msg)) msg = 'Ya hay un producto cargado con ese nombre en este mundo.';
      mostrarError(msg || 'No se pudo convertir. Probá de nuevo.');
      boton.disabled = false;
    });
  }

  /* --- Agregar producto nuevo, y editar uno ya cargado (mismo formulario) -
   * Popover propio, aparte del de editar una tarjeta del HTML: no depende
   * de cardActual/clave, y sus fotos no vienen del HTML sino de <input
   * type=file> procesados acá mismo (recorte a cuadrado con fondo blanco +
   * compresión a webp) y subidos al bucket 'catalogo' de Storage
   * (supabase/catalogo_02_storage.sql).
   *
   * altaEditando en null es "Agregar producto" (insert). Si tiene algo —
   * { id, producto, paginaOriginal } — es "Editar producto" (update) sobre
   * esa fila: MISMO formulario, precargado con lo que ya tenía, así se puede
   * agregar una foto/color/talle más a algo ya publicado, sacar uno que
   * sobra, o directamente convertirlo a otro "Tipo de producto" (ej. de
   * "Simple" a "Varios colores") sin tener que borrarlo y cargarlo de cero.
   * Ver abrirEditarProducto().
   */

  var altaScrim, altaPop, altaTitulo, altaBody, altaError, altaOk, altaOcultaWrap, altaOcultaChk, altaBtn;
  var altaCampos = null; // { titulo, precio, codigo, mundo, subcategoria, specs, tipo }
  // { blob, previewUrl, cap, codigo, precio, esNueva, src } — esNueva:true
  // = recién elegida acá (blob sin subir todavía); esNueva:false = ya
  // publicada (viene de editar), se deja con su src de siempre salvo que la
  // saquen con el "×". cap para "galeria"/"galeria-multi"; codigo/precio
  // sólo se leen para "galeria-multi" (en "galeria" van en
  // altaCampos.codigo/precio, compartidos por todas las fotos).
  var altaFotos = [];
  var altaFilasTalles = [];   // [{ nombreIn, codigoIn, precioIn, wrap }]
  var altaEditando = null;    // null = alta nueva; { id, producto, paginaOriginal } = editando

  var TIPOS_ALTA = [
    { value: 'simple', label: 'Simple (una foto)' },
    { value: 'galeria', label: 'Varios colores (una foto por color, mismo precio)' },
    { value: 'galeria-multi', label: 'Varios colores (una foto por color, cada uno con su propio código y precio)' },
    { value: 'talles', label: 'Varios talles o tamaños (cada uno con su código y precio)' }
  ];

  // A qué tipo de los de arriba corresponde un producto YA cargado — para
  // preseleccionarlo al abrir el editor. Mismo criterio que ya usaba el
  // editor viejo (construirProducto(), hoy reemplazado por este formulario).
  function detectarTipoProducto(producto) {
    if (producto.talles && producto.talles.length > 1) return 'talles';
    var fotos = producto.fotos || [];
    if (fotos.length > 1) return producto.codigo ? 'galeria' : 'galeria-multi';
    return 'simple';
  }

  function armarAltaPopover() {
    altaScrim = el('div', 'mm-admin-scrim');
    altaScrim.addEventListener('click', cerrarAlta);
    document.body.appendChild(altaScrim);

    altaPop = el('div', 'mm-pop');
    altaPop.setAttribute('role', 'dialog');
    altaPop.setAttribute('aria-modal', 'true');

    var head = el('div', 'mm-pop-head');
    altaTitulo = el('h3', null, 'Agregar producto');
    head.appendChild(altaTitulo);
    var x = el('button', 'mm-pop-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Cerrar');
    x.addEventListener('click', cerrarAlta);
    head.appendChild(x);

    altaBody = el('div', 'mm-pop-body');

    var foot = el('div', 'mm-pop-foot');
    altaError = el('p', 'mm-pop-error');
    altaError.hidden = true;
    altaOk = el('p', 'mm-pop-ok');
    altaOk.hidden = true;
    // Sólo tiene sentido editando (un alta nueva no puede nacer oculta).
    altaOcultaWrap = el('label', 'mm-check');
    altaOcultaChk = document.createElement('input');
    altaOcultaChk.type = 'checkbox';
    altaOcultaWrap.appendChild(altaOcultaChk);
    altaOcultaWrap.appendChild(el('span', null, 'Sacar de la web (se puede volver a mostrar cuando quieras)'));
    altaBtn = el('button', 'mm-pop-guardar', 'Agregar');
    altaBtn.type = 'button';
    altaBtn.addEventListener('click', guardarAlta);
    foot.appendChild(altaError);
    foot.appendChild(altaOk);
    foot.appendChild(altaOcultaWrap);
    foot.appendChild(altaBtn);

    altaPop.appendChild(head);
    altaPop.appendChild(altaBody);
    altaPop.appendChild(foot);
    document.body.appendChild(altaPop);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && altaPop.classList.contains('is-on')) cerrarAlta();
    });
  }

  function mostrarErrorAlta(msg) { altaError.textContent = msg || ''; altaError.hidden = !msg; }
  function mostrarOkAlta(msg) { altaOk.textContent = msg || ''; altaOk.hidden = !msg; }

  // Sólo revoca las URL de blobs locales (createObjectURL) — una foto ya
  // publicada (esNueva:false, precargada al editar) usa su URL real de
  // Storage como previewUrl, y revocar ESA rompería la vista previa sin
  // razón (no es un blob de este navegador, no hay nada que liberar).
  function limpiarAltaFotos() {
    altaFotos.forEach(function (f) { if (f.esNueva && f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
    altaFotos = [];
  }

  function construirAlta() {
    altaBody.innerHTML = '';
    limpiarAltaFotos();
    altaFilasTalles = [];

    var editando = !!altaEditando;
    var producto = editando ? altaEditando.producto : null;
    // MMCatalogo.datos() ya está resuelto acá: abrirEditarProducto() esperó
    // a MMCatalogo.cargar() antes de llamar a construirAlta() — igual que
    // abrirAlta() (alta nueva) no necesita precios de nada, así que no
    // hace falta esperar ahí.
    var datos = editando ? MMCatalogo.datos() : null;

    altaOcultaWrap.hidden = !editando;
    altaOcultaChk.checked = editando ? !producto.publicado : false;

    var tipoWrap = el('label', 'mm-field');
    tipoWrap.appendChild(el('span', null, 'Tipo de producto'));
    var tipoSel = document.createElement('select');
    TIPOS_ALTA.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t.value;
      o.textContent = t.label;
      tipoSel.appendChild(o);
    });
    tipoSel.value = editando ? detectarTipoProducto(producto) : 'simple';
    tipoWrap.appendChild(tipoSel);
    altaBody.appendChild(tipoWrap);
    altaBody.appendChild(el('p', 'mm-pop-nota',
      'Si tiene colores Y talles a la vez, avisame en el chat — este formulario no combina los dos.'));
    if (editando) {
      altaBody.appendChild(el('p', 'mm-pop-nota mm-alerta',
        'Si cambiás el tipo de producto acá, las fotos/talles que ya tenía cargados no se copian solos — hay que volver a cargarlos.'));
    }

    // --- Foto(s) ---
    var fotoWrap = el('label', 'mm-field');
    var fotoLabel = el('span', null, 'Foto (fondo claro — se ajusta sola a cuadrado)');
    fotoWrap.appendChild(fotoLabel);
    var fotoInput = document.createElement('input');
    fotoInput.type = 'file';
    fotoInput.accept = 'image/*';
    fotoWrap.appendChild(fotoInput);
    altaBody.appendChild(fotoWrap);
    var fotosPreview = el('div', 'mm-alta-fotos');
    altaBody.appendChild(fotosPreview);

    function renderAltaFotos() {
      fotosPreview.innerHTML = '';
      altaFotos.forEach(function (f, idx) {
        var item = el('div', 'mm-alta-foto-item');
        var img = document.createElement('img');
        img.className = 'mm-alta-preview';
        img.src = f.previewUrl;
        item.appendChild(img);
        if (tipoSel.value === 'galeria' || tipoSel.value === 'galeria-multi') {
          var capIn = document.createElement('input');
          capIn.type = 'text';
          capIn.placeholder = 'Nombre del color (ej. rosa)';
          capIn.value = f.cap || '';
          capIn.addEventListener('input', function () { f.cap = capIn.value; });
          item.appendChild(capIn);
        }
        if (tipoSel.value === 'galeria-multi') {
          var codigoInF = document.createElement('input');
          codigoInF.type = 'text';
          codigoInF.placeholder = 'Código de este color';
          codigoInF.value = f.codigo || '';
          codigoInF.addEventListener('input', function () { f.codigo = codigoInF.value; });
          item.appendChild(codigoInF);
          var precioInF = document.createElement('input');
          precioInF.type = 'number'; precioInF.min = '1';
          precioInF.placeholder = 'Precio de este color';
          precioInF.value = f.precio || '';
          precioInF.addEventListener('input', function () { f.precio = precioInF.value; });
          item.appendChild(precioInF);
        }
        var quitar = el('button', 'mm-pop-x', '×');
        quitar.type = 'button';
        quitar.setAttribute('aria-label', 'Quitar esta foto');
        quitar.addEventListener('click', function () {
          if (f.esNueva) URL.revokeObjectURL(f.previewUrl);
          altaFotos.splice(idx, 1);
          renderAltaFotos();
        });
        item.appendChild(quitar);
        fotosPreview.appendChild(item);
      });
    }

    fotoInput.addEventListener('change', function () {
      var elegidas = Array.prototype.slice.call(fotoInput.files || []);
      if (!elegidas.length) return;
      // Fuera de las galerías sólo importa una foto — si eligieron varias, se
      // toma la primera y se avisa, en vez de fallar en silencio.
      var esGaleriaTipo = tipoSel.value === 'galeria' || tipoSel.value === 'galeria-multi';
      if (!esGaleriaTipo && elegidas.length > 1) elegidas = [elegidas[0]];
      mostrarErrorAlta('');
      Promise.all(elegidas.map(function (file) {
        return procesarFoto(file).then(function (blob) {
          return { blob: blob, previewUrl: URL.createObjectURL(blob), cap: '', codigo: '', precio: '', esNueva: true };
        });
      })).then(function (nuevas) {
        if (esGaleriaTipo) altaFotos = altaFotos.concat(nuevas);
        else { limpiarAltaFotos(); altaFotos = nuevas; }
        renderAltaFotos();
        fotoInput.value = ''; // libera el input para poder sumar más fotos a la galería
      }).catch(function (err) {
        mostrarErrorAlta((err && err.message) || 'No se pudo procesar la foto.');
      });
    });

    var tituloIn = campoTexto('Título', '');
    altaBody.appendChild(tituloIn.wrap);

    // --- Precio/código: sólo para simple y galería (talles trae el suyo por fila) ---
    var precioCodigoWrap = el('div');
    var precioIn = campoNumero('Precio (opcional, se puede cargar después)', '');
    precioCodigoWrap.appendChild(precioIn.wrap);
    var codigoIn = campoTexto('Código del POS (opcional)', '');
    precioCodigoWrap.appendChild(codigoIn.wrap);
    precioCodigoWrap.appendChild(el('p', 'mm-pop-nota',
      'Si el código ya existe, este producto va a compartir su precio — no hay chequeo de duplicados.'));
    altaBody.appendChild(precioCodigoWrap);

    // --- Talles: filas dinámicas nombre + código + precio ---
    var tallesWrap = el('div');
    tallesWrap.appendChild(el('p', 'mm-pop-nota', 'Cada talle o tamaño con su propio código del POS y su propio precio.'));
    var tallesLista = el('div', 'mm-alta-talles');
    tallesWrap.appendChild(tallesLista);
    var addTalleBtn = el('button', 'mm-mover-toggle', '+ Agregar talle');
    addTalleBtn.type = 'button';
    addTalleBtn.addEventListener('click', function () { agregarFilaTalle(tallesLista); });
    tallesWrap.appendChild(addTalleBtn);
    altaBody.appendChild(tallesWrap);

    function aplicarVisibilidadTipo() {
      var t = tipoSel.value;
      fotoInput.multiple = (t === 'galeria' || t === 'galeria-multi');
      tallesWrap.hidden = (t !== 'talles');
      // El precio/código global no aplica cuando cada fila/foto trae el suyo.
      precioCodigoWrap.hidden = (t === 'talles' || t === 'galeria-multi');
    }

    // A diferencia de aplicarVisibilidadTipo(), esto SÍ borra fotos/talles —
    // sólo corre cuando el admin cambia el tipo a mano (nunca en el primer
    // render): cambiar de tipo a mitad de camino (ej. de "galería" con 3
    // fotos a "simple") deja combinaciones raras — más simple pedir que
    // vuelvan a elegir/cargar de nuevo que tratar de adivinar qué conservar.
    function alCambiarTipoAMano() {
      limpiarAltaFotos();
      renderAltaFotos();
      fotoInput.value = '';
      altaFilasTalles = [];
      tallesLista.innerHTML = '';
      aplicarVisibilidadTipo();
      if (tipoSel.value === 'talles') {
        agregarFilaTalle(tallesLista);
        agregarFilaTalle(tallesLista);
      }
    }
    tipoSel.addEventListener('change', alCambiarTipoAMano);
    aplicarVisibilidadTipo();

    // --- Precarga al editar: mismo tipoSel.value ya elegido arriba, así
    // que cada rama de abajo pinta exactamente los campos que corresponden
    // (no hace falta "adivinar" nada distinto de lo que ya hace el resto
    // del formulario para una alta nueva). ---
    if (editando) {
      if (tipoSel.value === 'talles') {
        (producto.talles || []).forEach(function (t) {
          agregarFilaTalle(tallesLista);
          var f = altaFilasTalles[altaFilasTalles.length - 1];
          f.nombreIn.value = t.nombre;
          f.codigoIn.value = t.codigo;
          f.precioIn.value = datos.precios[t.codigo] || '';
        });
      } else {
        if (tipoSel.value !== 'galeria-multi') {
          codigoIn.input.value = producto.codigo || '';
          precioIn.input.value = (producto.codigo && datos.precios[producto.codigo]) || '';
        }
        // simple: 1 sola foto; galeria/galeria-multi: todas — misma fuente
        // (producto.fotos) para las tres, ya viene con la forma correcta.
        altaFotos = (producto.fotos || []).map(function (f) {
          return {
            blob: null, esNueva: false, src: f.src, previewUrl: f.src,
            cap: f.cap || '', codigo: f.codigo || '',
            precio: (f.codigo && datos.precios[f.codigo]) || ''
          };
        });
      }
    } else if (tipoSel.value === 'talles') {
      agregarFilaTalle(tallesLista);
      agregarFilaTalle(tallesLista);
    }
    renderAltaFotos();

    var mundoWrap = el('label', 'mm-field');
    mundoWrap.appendChild(el('span', null, 'Mundo'));
    var mundoSel = document.createElement('select');
    MUNDOS.forEach(function (m) {
      var o = document.createElement('option');
      o.value = m.pagina;
      o.textContent = m.nombre;
      if (m.pagina === (editando ? producto.pagina : pagina)) o.selected = true;
      mundoSel.appendChild(o);
    });
    mundoWrap.appendChild(mundoSel);
    altaBody.appendChild(mundoWrap);

    var subCampo = armarSelectorSubcategoria(mundoSel, function () { return editando ? producto.subcategoriaId : null; });
    altaBody.appendChild(subCampo.wrap);
    altaBody.appendChild(subCampo.nuevoWrap);

    var specsIn = document.createElement('textarea');
    specsIn.rows = 3;
    specsIn.placeholder = 'Una característica por línea, ej:\nColores: rosa, celeste\nTamaño: 20cm';
    if (editando && producto.specs && producto.specs.length) specsIn.value = producto.specs.join('\n');
    var specsWrap = el('label', 'mm-field');
    specsWrap.appendChild(el('span', null, 'Ficha técnica (opcional)'));
    specsWrap.appendChild(specsIn);
    altaBody.appendChild(specsWrap);

    if (editando) {
      altaBody.appendChild(el('p', 'mm-pop-clave', 'catalogo_productos · ' + altaEditando.id));
      altaBody.appendChild(el('p', 'mm-pop-nota mm-alerta',
        'Borrar es PERMANENTE (distinto de "Sacar de la web", que se puede deshacer): saca el registro y la referencia a las fotos para siempre.'));
      var borrarBtn = el('button', 'mm-borrar-btn', 'Borrar este producto');
      borrarBtn.type = 'button';
      borrarBtn.addEventListener('click', borrarProducto);
      altaBody.appendChild(borrarBtn);
    }

    altaCampos = {
      titulo: tituloIn.input, precio: precioIn.input, codigo: codigoIn.input,
      mundo: mundoSel, subcategoria: subCampo, specs: specsIn, tipo: tipoSel
    };
  }

  function agregarFilaTalle(tallesLista) {
    var fila = el('div', 'mm-alta-talle-fila');
    var nombreIn = document.createElement('input');
    nombreIn.type = 'text'; nombreIn.placeholder = 'Nombre (ej. Chico)';
    var codigoIn = document.createElement('input');
    codigoIn.type = 'text'; codigoIn.placeholder = 'Código';
    var precioIn = document.createElement('input');
    precioIn.type = 'number'; precioIn.min = '1'; precioIn.placeholder = 'Precio';
    var quitar = el('button', 'mm-pop-x', '×');
    quitar.type = 'button';
    quitar.setAttribute('aria-label', 'Quitar este talle');
    quitar.addEventListener('click', function () {
      fila.remove();
      altaFilasTalles = altaFilasTalles.filter(function (f) { return f.wrap !== fila; });
    });
    fila.appendChild(nombreIn);
    fila.appendChild(codigoIn);
    fila.appendChild(precioIn);
    fila.appendChild(quitar);
    tallesLista.appendChild(fila);
    altaFilasTalles.push({ nombreIn: nombreIn, codigoIn: codigoIn, precioIn: precioIn, wrap: fila });
  }

  function abrirAlta() {
    altaEditando = null;
    altaCargandoId = null; // por si había un abrirEditarProducto() todavía esperando datos
    if (!altaPop) armarAltaPopover();
    altaTitulo.textContent = 'Agregar producto';
    altaBtn.textContent = 'Agregar';
    mostrarErrorAlta(''); mostrarOkAlta('');
    altaBtn.disabled = false;
    construirAlta();
    altaScrim.classList.add('is-on');
    altaPop.classList.add('is-on');
  }

  // El lápiz de una tarjeta insertada por assets/catalogo-productos.js
  // (data-mm-producto-id) abre esto en vez del popover de tarjetas del HTML
  // — mismo formulario que "+ Agregar producto", precargado (ver
  // construirAlta()), así que además de precio/código se puede convertir de
  // tipo o agregar/sacar fotos y talles sin recrear el producto de cero.
  var altaCargandoId = null; // id del producto que se está por editar, mientras se espera MMCatalogo.cargar()

  function abrirEditarProducto(card) {
    var productoId = card.getAttribute('data-mm-producto-id');
    altaCargandoId = productoId;
    if (!altaPop) armarAltaPopover();
    mostrarErrorAlta(''); mostrarOkAlta('');
    altaTitulo.textContent = 'Editar producto';
    altaBtn.textContent = 'Guardar';
    altaBtn.disabled = false;
    altaBody.innerHTML = '';
    altaBody.appendChild(el('p', 'mm-pop-nota', 'Cargando…'));
    altaScrim.classList.add('is-on');
    altaPop.classList.add('is-on');

    MMCatalogo.cargar(function (datos) {
      if (altaCargandoId !== productoId) return; // cerraron/abrieron otra cosa antes de que llegue
      var producto = (datos.productos || []).filter(function (p) { return p.id === productoId; })[0];
      if (!producto) {
        altaEditando = null;
        altaBody.innerHTML = '';
        altaBody.appendChild(el('p', 'mm-pop-nota mm-alerta',
          'No encontré este producto en la base — puede que ya lo hayan borrado desde otro lado. Recargá la página.'));
        altaBtn.disabled = true;
        return;
      }
      altaEditando = { id: productoId, producto: producto, paginaOriginal: producto.pagina };
      construirAlta();
    });
  }

  function borrarProducto() {
    if (!altaEditando) return;
    if (!window.confirm('¿Borrar este producto para siempre? No se puede deshacer.')) return;
    mostrarErrorAlta(''); mostrarOkAlta('');
    altaBtn.disabled = true;
    var productoId = altaEditando.id;
    sb.from('catalogo_productos').delete().eq('id', productoId).then(function (r) {
      if (r.error) throw r.error;
      var card = document.querySelector('[data-mm-producto-id="' + productoId + '"]');
      if (card) card.remove();
      MMCatalogo.refrescar(function () {});
      cerrarAlta();
    }).catch(function (err) {
      mostrarErrorAlta((err && err.message) || 'No se pudo borrar. Probá de nuevo.');
      altaBtn.disabled = false;
    });
  }

  function cerrarAlta() {
    if (!altaPop) return;
    altaPop.classList.remove('is-on');
    altaScrim.classList.remove('is-on');
    altaEditando = null;
    altaCargandoId = null;
  }

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
        var pub = sb.storage.from('catalogo').getPublicUrl(nombre);
        if (!pub.data || !pub.data.publicUrl) throw new Error('No se pudo obtener la URL de la foto.');
        return pub.data.publicUrl;
      });
  }

  function guardarAlta() {
    mostrarErrorAlta(''); mostrarOkAlta('');
    var editando = !!altaEditando;
    var titulo = altaCampos.titulo.value.trim();
    if (!titulo) { mostrarErrorAlta('Poné un título.'); return; }
    if (!altaFotos.length) { mostrarErrorAlta('Elegí al menos una foto (esperá a que termine de procesarla).'); return; }

    var tipo = altaCampos.tipo.value;
    var filas = null;
    if (tipo === 'talles') {
      filas = altaFilasTalles.map(function (f) {
        return { nombre: f.nombreIn.value.trim(), codigo: f.codigoIn.value.trim(), precio: Number(f.precioIn.value || 0) };
      }).filter(function (f) { return f.nombre && f.codigo; });
      if (filas.length < 2) { mostrarErrorAlta('Cargá al menos dos talles con nombre y código.'); return; }
    }
    if (tipo === 'galeria') {
      if (altaFotos.length < 2) { mostrarErrorAlta('Para "varios colores" hace falta más de una foto — o elegí "Simple".'); return; }
      if (altaFotos.some(function (f) { return !(f.cap || '').trim(); })) { mostrarErrorAlta('Ponele nombre a cada color.'); return; }
    }
    if (tipo === 'galeria-multi') {
      if (altaFotos.length < 2) { mostrarErrorAlta('Para "varios colores" hace falta más de una foto — o elegí "Simple".'); return; }
      if (altaFotos.some(function (f) { return !(f.cap || '').trim() || !(f.codigo || '').trim(); })) {
        mostrarErrorAlta('Ponele nombre y código a cada color.'); return;
      }
    }

    altaBtn.disabled = true;
    var paginaDestino = altaCampos.mundo.value;
    var slugProducto = slug(titulo);
    var precio = Number(altaCampos.precio.value || 0);
    var codigo = altaCampos.codigo.value.trim() || null;
    var specs = altaCampos.specs.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);

    // La subcategoría puede necesitar crear la fila nueva primero (si
    // eligieron "+ Crear subcategoría nueva…" — en cualquiera de los 7
    // mundos, no sólo en el de la página donde están parados).
    Promise.all([
      resolverSubcategoriaSelector(altaCampos.subcategoria, paginaDestino),
      Promise.all(altaFotos.map(function (f, idx) {
        // Una foto ya publicada (viene de editar, esNueva:false) se deja
        // con su src de siempre — no hace falta volver a subirla, sólo
        // puede haber cambiado su nombre de color/código/precio.
        if (!f.esNueva) {
          var fotoExistente = { src: f.src, cap: (tipo === 'galeria' || tipo === 'galeria-multi') ? (f.cap || '').trim() : '' };
          if (tipo === 'galeria-multi') fotoExistente.codigo = (f.codigo || '').trim();
          return Promise.resolve(fotoExistente);
        }
        return subirFoto(f.blob, paginaDestino, slugProducto, idx + 1)
          .then(function (url) {
            var foto = { src: url, cap: (tipo === 'galeria' || tipo === 'galeria-multi') ? (f.cap || '').trim() : '' };
            // codigo por foto: precios.js ya sabe leer un data-pos puesto en
            // la <img> como candidato de más prioridad que el de la tarjeta
            // (mismo mecanismo que una galería del HTML con código por
            // color) — ver el data-pos que tarjetaDe() le pone a cada <img>
            // en assets/catalogo-productos.js.
            if (tipo === 'galeria-multi') foto.codigo = (f.codigo || '').trim();
            return foto;
          });
      }))
    ]).then(function (r) {
      var subcategoriaId = r[0];
      var fotosFinales = r[1];
      var fila = {
        pagina: paginaDestino,
        subcategoria_id: subcategoriaId || null,
        titulo: titulo,
        slug: slugProducto,
        // Sin código compartido de tarjeta ni en "talles" (cada opción trae
        // el suyo) ni en "galeria-multi" (cada foto trae el suyo).
        codigo: (tipo === 'talles' || tipo === 'galeria-multi') ? null : codigo,
        specs: specs.length ? specs : null,
        talles: filas,
        fotos: fotosFinales,
        orden: 0
      };
      if (editando) {
        fila.publicado = !altaOcultaChk.checked;
        // .select() + chequear filas: si el RLS de "Admin gestiona
        // productos" (supabase/catalogo_03_subcategorias.sql) filtra la fila
        // por lo que sea (sesión de admin vencida, etc.), Postgres no tira
        // error — el update "tiene éxito" sin tocar nada. Sin esto se
        // mostraba "Guardado." aunque no se hubiera guardado nada.
        return sb.from('catalogo_productos').update(fila).eq('id', altaEditando.id).select().then(function (r2) {
          if (r2.error) throw r2.error;
          if (!r2.data || !r2.data.length) throw new Error('No se guardó — probablemente se cerró la sesión de admin. Recargá la página.');
        });
      }
      fila.publicado = true;
      return sb.from('catalogo_productos').insert(fila).select('id');
    }).then(function (r) {
      if (r && r.error) throw r.error;
      if (tipo === 'talles') {
        var pasos = filas.filter(function (f) { return f.precio > 0; })
          .map(function (f) { return guardarPrecio(f.codigo, f.precio, false); });
        return Promise.all(pasos);
      }
      if (tipo === 'galeria-multi') {
        var pasosG = altaFotos.filter(function (f) { return Number(f.precio || 0) > 0 && (f.codigo || '').trim(); })
          .map(function (f) { return guardarPrecio((f.codigo || '').trim(), Number(f.precio || 0), false); });
        return Promise.all(pasosG);
      }
      // El precio es opcional: si no cargaron ni precio ni código, el
      // producto queda visible sin precio, como cualquier tarjeta a la que
      // todavía no le cargaron el código — no es un error.
      if (precio > 0 && codigo) return guardarPrecio(codigo, precio, false);
    }).then(function () {
      var idEditado = editando ? altaEditando.id : null;
      MMCatalogo.refrescar(function () {
        if (editando) {
          // Blow-away-and-redraw: más simple y más confiable que tratar de
          // mutar en el lugar un carrusel/selector de talles ya armado,
          // sobre todo si cambió de tipo — ver MMCatalogoProductos.actualizar()
          // en assets/catalogo-productos.js.
          if (window.MMCatalogoProductos && MMCatalogoProductos.actualizar) MMCatalogoProductos.actualizar(idEditado);
        } else if (window.MMCatalogoProductos) {
          MMCatalogoProductos.repintar();
        }
        if (window.MMPrecios && window.MMPrecios.repintar) MMPrecios.repintar();
        // Sin esto, la tarjeta recién insertada/redibujada queda sin lápiz
        // hasta recargar la página — montarLapices() ya se salta las que ya
        // lo tienen, así que llamarlo de nuevo es seguro.
        montarLapices();
      });
      mostrarOkAlta(editando ? 'Guardado.' : 'Agregado.');
      altaBtn.disabled = false;
      setTimeout(cerrarAlta, editando ? 700 : 900);
    }).catch(function (err) {
      var msg = (err && err.message) || '';
      if (/duplicate key|unique/i.test(msg)) msg = 'Ya hay un producto con ese nombre en ese mundo.';
      mostrarErrorAlta(msg || ('No se pudo ' + (editando ? 'guardar' : 'agregar') + '. Probá de nuevo.'));
      altaBtn.disabled = false;
    });
  }

  // Para que una subcategoría nueva no nazca empatada en "orden" con la
  // primera que ya existía en ese mundo: por default arrancaban las dos en
  // 0, y "Subir"/"Bajar" (intercambiarOrdenSubcat) contra una vecina con el
  // mismo número no mueve nada visible — cambia 0 por 0 — así que el botón
  // parecía roto. Empezar después de la última deja lugar para acomodarla
  // con Subir/Bajar sin ese empate.
  function proximoOrden(pagina) {
    var datos = MMCatalogo.datos();
    if (!datos) return 0;
    var max = -1;
    Object.keys(datos.subcategorias).forEach(function (id) {
      var s = datos.subcategorias[id];
      if (s.pagina === pagina && s.orden > max) max = s.orden;
    });
    return max + 1;
  }

  /* --- Agregar subcategoría nueva, sin pasar por un producto --------------
   * Antes la única forma de crear una subcategoría era de paso, mientras se
   * editaba una tarjeta o se cargaba un producto ("+ Crear subcategoría
   * nueva…" dentro de esos selectores). Este botón la separa: sirve para
   * dejar armada de antemano la lista de subcategorías de un mundo, antes
   * de tener ningún producto para meter ahí.
   */

  var subcatScrim, subcatPop, subcatTitulo, subcatBody, subcatError, subcatOk, subcatBtn;
  var subcatCampos = null; // { mundo, nombre, orden } — mundo es null en modo edición (no se cambia acá)
  // Si no es null, el popover está EDITANDO esta subcategoría en vez de
  // creando una — { id, section, h2 } (section/h2: el <section> y el <h2>
  // de esta misma página, para actualizar el texto en el momento sin
  // esperar un refresh).
  var subcatEditando = null;

  function armarSubcatAltaPopover() {
    subcatScrim = el('div', 'mm-admin-scrim');
    subcatScrim.addEventListener('click', cerrarSubcatAlta);
    document.body.appendChild(subcatScrim);

    subcatPop = el('div', 'mm-pop');
    subcatPop.setAttribute('role', 'dialog');
    subcatPop.setAttribute('aria-modal', 'true');

    var head = el('div', 'mm-pop-head');
    subcatTitulo = el('h3', null, 'Agregar subcategoría');
    head.appendChild(subcatTitulo);
    var x = el('button', 'mm-pop-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Cerrar');
    x.addEventListener('click', cerrarSubcatAlta);
    head.appendChild(x);

    subcatBody = el('div', 'mm-pop-body');

    var foot = el('div', 'mm-pop-foot');
    subcatError = el('p', 'mm-pop-error');
    subcatError.hidden = true;
    subcatOk = el('p', 'mm-pop-ok');
    subcatOk.hidden = true;
    subcatBtn = el('button', 'mm-pop-guardar', 'Agregar');
    subcatBtn.type = 'button';
    subcatBtn.addEventListener('click', guardarSubcatAlta);
    foot.appendChild(subcatError);
    foot.appendChild(subcatOk);
    foot.appendChild(subcatBtn);

    subcatPop.appendChild(head);
    subcatPop.appendChild(subcatBody);
    subcatPop.appendChild(foot);
    document.body.appendChild(subcatPop);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && subcatPop.classList.contains('is-on')) cerrarSubcatAlta();
    });
  }

  function mostrarErrorSubcat(msg) { subcatError.textContent = msg || ''; subcatError.hidden = !msg; }
  function mostrarOkSubcat(msg) { subcatOk.textContent = msg || ''; subcatOk.hidden = !msg; }

  function construirSubcatAlta() {
    subcatBody.innerHTML = '';
    var datos = MMCatalogo.datos();
    var actual = subcatEditando && datos ? datos.subcategorias[subcatEditando.id] : null;

    var mundoSel = null;
    if (subcatEditando) {
      // El mundo no se cambia desde acá (para eso ya existe "Mover a otro
      // mundo" en cada producto) — sólo se muestra de referencia.
      subcatBody.appendChild(el('p', 'mm-pop-nota',
        'Mundo: ' + ((MUNDOS.filter(function (m) { return m.pagina === (actual && actual.pagina); })[0] || {}).nombre || (actual && actual.pagina))));
    } else {
      var mundoWrap = el('label', 'mm-field');
      mundoWrap.appendChild(el('span', null, 'Mundo'));
      mundoSel = document.createElement('select');
      MUNDOS.forEach(function (m) {
        var o = document.createElement('option');
        o.value = m.pagina;
        o.textContent = m.nombre;
        if (m.pagina === pagina) o.selected = true;
        mundoSel.appendChild(o);
      });
      mundoWrap.appendChild(mundoSel);
      subcatBody.appendChild(mundoWrap);

      // Entrada directa a editar/borrar una que YA existe, sin depender de
      // que su sección esté renderizada en la página (una subcategoría que
      // nunca tuvo ningún producto no tiene sección ni lápiz — sin esto no
      // habría forma de llegar a ella para corregirla o borrarla).
      var existenteWrap = el('label', 'mm-field');
      existenteWrap.appendChild(el('span', null, 'O elegí una existente para editarla o borrarla'));
      var existenteSel = document.createElement('select');
      function repoblarExistentes() {
        existenteSel.innerHTML = '';
        var optNueva = document.createElement('option');
        optNueva.value = '';
        optNueva.textContent = '— Nueva —';
        existenteSel.appendChild(optNueva);
        var datosAhora = MMCatalogo.datos();
        if (!datosAhora) return;
        var propias = [];
        Object.keys(datosAhora.subcategorias).forEach(function (id) {
          var s = datosAhora.subcategorias[id];
          if (s.pagina === mundoSel.value) propias.push(Object.assign({ id: id }, s));
        });
        propias.sort(function (a, b) { return (a.orden - b.orden) || a.nombre.localeCompare(b.nombre); });
        propias.forEach(function (s) {
          var o = document.createElement('option');
          o.value = s.id;
          o.textContent = s.nombre;
          existenteSel.appendChild(o);
        });
      }
      mundoSel.addEventListener('change', repoblarExistentes);
      repoblarExistentes();
      existenteSel.addEventListener('change', function () {
        // Sin section/h2: esta entrada no viene de un lápiz sobre una
        // sección — abrirSubcatEditar() ya sabe convivir sin ellos (sólo
        // los usa para actualizar el texto al toque, si están).
        if (existenteSel.value) abrirSubcatEditar(existenteSel.value, null, null);
      });
      existenteWrap.appendChild(existenteSel);
      subcatBody.appendChild(existenteWrap);
    }

    var nombreIn = campoTexto('Nombre', actual ? actual.nombre : '');
    subcatBody.appendChild(nombreIn.wrap);

    // Al crear una nueva, se sugiere el número que la deja al final de la
    // lista de ese mundo (proximoOrden) en vez de dejar el campo en blanco
    // (que el form mandaba como 0) — así no nace empatada con la primera
    // que ya existía, y Subir/Bajar (más abajo) tiene desde dónde moverla.
    var ordenIn = campoNumero('Orden (más chico aparece primero)', actual ? actual.orden : proximoOrden(mundoSel ? mundoSel.value : pagina));
    ordenIn.input.min = '0';
    subcatBody.appendChild(ordenIn.wrap);
    // Si cambian de mundo antes de guardar, el "final de la lista" es
    // distinto en cada uno — recalcular para seguir sugiriendo un lugar sin
    // empates.
    if (mundoSel) {
      mundoSel.addEventListener('change', function () {
        ordenIn.input.value = proximoOrden(mundoSel.value);
      });
    }

    // Subir/bajar: más simple que pedirle a alguien que calcule a mano en
    // qué número de "orden" queda justo entre otras dos. Intercambia el
    // valor con el vecino inmediato en la misma página — mismo dato que
    // ahora sí lee la página para ordenar de verdad (ver ordenarSecciones()
    // en assets/precios.js).
    if (subcatEditando && actual) {
      var hermanas = [];
      if (datos) {
        Object.keys(datos.subcategorias).forEach(function (id) {
          var s = datos.subcategorias[id];
          if (s.pagina === actual.pagina) hermanas.push(Object.assign({ id: id }, s));
        });
      }
      hermanas.sort(function (a, b) { return (a.orden - b.orden) || a.nombre.localeCompare(b.nombre); });
      var idx = -1;
      for (var i = 0; i < hermanas.length; i++) if (hermanas[i].id === subcatEditando.id) { idx = i; break; }

      var moverWrap = el('div', 'mm-subcat-mover');
      var subirBtn = el('button', 'mm-mover-toggle', '↑ Subir');
      subirBtn.type = 'button';
      subirBtn.disabled = idx <= 0;
      subirBtn.addEventListener('click', function () { intercambiarOrdenSubcat(hermanas, idx, idx - 1); });
      var bajarBtn = el('button', 'mm-mover-toggle', '↓ Bajar');
      bajarBtn.type = 'button';
      bajarBtn.disabled = idx < 0 || idx >= hermanas.length - 1;
      bajarBtn.addEventListener('click', function () { intercambiarOrdenSubcat(hermanas, idx, idx + 1); });
      moverWrap.appendChild(subirBtn);
      moverWrap.appendChild(bajarBtn);
      subcatBody.appendChild(moverWrap);

      subcatBody.appendChild(el('p', 'mm-pop-nota mm-alerta',
        'Borrar es permanente. Sólo se puede si ya no le queda ningún producto adentro — movelos primero a otra subcategoría (o a "Sin subcategoría") si hace falta.'));
      var borrarBtn = el('button', 'mm-borrar-btn', 'Borrar esta subcategoría');
      borrarBtn.type = 'button';
      borrarBtn.addEventListener('click', borrarSubcat);
      subcatBody.appendChild(borrarBtn);
    }

    subcatCampos = { mundo: mundoSel, nombre: nombreIn.input, orden: ordenIn.input };
  }

  function borrarSubcat() {
    if (!subcatEditando) return;
    mostrarErrorSubcat(''); mostrarOkSubcat('');
    subcatBtn.disabled = true;
    var id = subcatEditando.id;

    Promise.all([
      sb.from('catalogo_tarjetas').select('pagina', { count: 'exact', head: true }).eq('subcategoria_id', id),
      sb.from('catalogo_productos').select('id', { count: 'exact', head: true }).eq('subcategoria_id', id)
    ]).then(function (rs) {
      rs.forEach(function (r) { if (r.error) throw r.error; });
      var total = (rs[0].count || 0) + (rs[1].count || 0);
      if (total > 0) {
        mostrarErrorSubcat('Todavía tiene ' + total + ' producto(s) adentro — cambiales la subcategoría antes de borrar esta.');
        subcatBtn.disabled = false;
        return null;
      }
      if (!window.confirm('¿Borrar esta subcategoría? No se puede deshacer.')) {
        subcatBtn.disabled = false;
        return null;
      }
      return sb.from('catalogo_subcategorias').delete().eq('id', id);
    }).then(function (r) {
      if (!r) return; // se canceló arriba (no vacía, o no confirmó)
      if (r.error) throw r.error;
      // Vacía por el chequeo de arriba: si tenía sección, ya estaba oculta
      // (ocultarSeccionesVacias) — se saca del todo, no tiene sentido
      // dejarla apuntando a un id que ya no existe en la base.
      if (subcatEditando.section) subcatEditando.section.remove();
      MMCatalogo.refrescar(function () {
        if (window.MMPrecios && window.MMPrecios.repintar) MMPrecios.repintar();
      });
      mostrarOkSubcat('Borrada.');
      subcatBtn.disabled = false;
      setTimeout(cerrarSubcatAlta, 700);
    }).catch(function (err) {
      mostrarErrorSubcat((err && err.message) || 'No se pudo borrar. Probá de nuevo.');
      subcatBtn.disabled = false;
    });
  }

  function intercambiarOrdenSubcat(hermanas, idxA, idxB) {
    if (idxA < 0 || idxB < 0 || idxA >= hermanas.length || idxB >= hermanas.length) return;
    var a = hermanas[idxA], b = hermanas[idxB];
    mostrarErrorSubcat(''); mostrarOkSubcat('');
    subcatBtn.disabled = true;
    Promise.all([
      sb.from('catalogo_subcategorias').update({ orden: b.orden }).eq('id', a.id),
      sb.from('catalogo_subcategorias').update({ orden: a.orden }).eq('id', b.id)
    ]).then(function (rs) {
      rs.forEach(function (r) { if (r.error) throw r.error; });
      var parche = { subcategorias: {} };
      parche.subcategorias[a.id] = Object.assign({}, a, { orden: b.orden });
      parche.subcategorias[b.id] = Object.assign({}, b, { orden: a.orden });
      MMCatalogo.parche(parche);
      MMCatalogo.refrescar(function () {
        if (window.MMPrecios && window.MMPrecios.repintar) MMPrecios.repintar();
      });
      mostrarOkSubcat('Guardado.');
      subcatBtn.disabled = false;
      // Rearma el popover para que subir/bajar reflejen la posición nueva.
      construirSubcatAlta();
    }).catch(function (err) {
      mostrarErrorSubcat((err && err.message) || 'No se pudo guardar. Probá de nuevo.');
      subcatBtn.disabled = false;
    });
  }

  function abrirSubcatAlta() {
    subcatEditando = null;
    if (!subcatPop) armarSubcatAltaPopover();
    subcatTitulo.textContent = 'Agregar subcategoría';
    subcatBtn.textContent = 'Agregar';
    mostrarErrorSubcat(''); mostrarOkSubcat('');
    subcatBtn.disabled = false;
    construirSubcatAlta();
    subcatScrim.classList.add('is-on');
    subcatPop.classList.add('is-on');
  }

  // section/h2: el <section class="catsec"> y su <h2> EN ESTA página —
  // para poder actualizar el título en el momento al guardar, sin esperar
  // el refresh de MMCatalogo.
  function abrirSubcatEditar(subId, section, h2) {
    subcatEditando = { id: subId, section: section, h2: h2 };
    if (!subcatPop) armarSubcatAltaPopover();
    subcatTitulo.textContent = 'Editar subcategoría';
    subcatBtn.textContent = 'Guardar';
    mostrarErrorSubcat(''); mostrarOkSubcat('');
    subcatBtn.disabled = false;
    construirSubcatAlta();
    subcatScrim.classList.add('is-on');
    subcatPop.classList.add('is-on');
  }

  function cerrarSubcatAlta() {
    if (!subcatPop) return;
    subcatPop.classList.remove('is-on');
    subcatScrim.classList.remove('is-on');
  }

  function guardarSubcatAlta() {
    mostrarErrorSubcat(''); mostrarOkSubcat('');
    var nombre = subcatCampos.nombre.value.trim();
    if (!nombre) { mostrarErrorSubcat('Poné un nombre.'); return; }
    var orden = Number(subcatCampos.orden.value || 0);
    subcatBtn.disabled = true;

    if (subcatEditando) {
      var cambios = { nombre: nombre, orden: orden };
      sb.from('catalogo_subcategorias').update(cambios).eq('id', subcatEditando.id).then(function (r) {
        if (r.error) throw r.error;
        var datos = MMCatalogo.datos();
        var actual = datos && datos.subcategorias[subcatEditando.id];
        var parche = { subcategorias: {} };
        parche.subcategorias[subcatEditando.id] = Object.assign({}, actual, cambios);
        MMCatalogo.parche(parche);
        // Al toque, sin esperar el refresh: es la razón de tener section/h2 a mano.
        if (subcatEditando.h2) subcatEditando.h2.textContent = nombre;
        MMCatalogo.refrescar(function () {
          if (window.MMPrecios && window.MMPrecios.repintar) MMPrecios.repintar();
        });
        mostrarOkSubcat('Guardado.');
        subcatBtn.disabled = false;
        setTimeout(cerrarSubcatAlta, 700);
      }).catch(function (err) {
        mostrarErrorSubcat((err && err.message) || 'No se pudo guardar. Probá de nuevo.');
        subcatBtn.disabled = false;
      });
      return;
    }

    var mundoDestino = subcatCampos.mundo.value;
    var slugNueva = slug(nombre);
    var datos2 = MMCatalogo.datos();
    var yaExiste = datos2 && Object.keys(datos2.subcategorias).some(function (id) {
      var s = datos2.subcategorias[id];
      return s.pagina === mundoDestino && s.slug === slugNueva;
    });
    if (yaExiste) { mostrarErrorSubcat('Ya hay una subcategoría con ese nombre en ese mundo.'); subcatBtn.disabled = false; return; }

    sb.from('catalogo_subcategorias')
      .insert({ pagina: mundoDestino, nombre: nombre, slug: slugNueva, orden: orden })
      .select('id')
      .then(function (r) {
        if (r.error) throw r.error;
        var id = r.data && r.data[0] && r.data[0].id;
        if (id) {
          var parche = { subcategorias: {} };
          parche.subcategorias[id] = { pagina: mundoDestino, nombre: nombre, slug: slugNueva, orden: orden };
          MMCatalogo.parche(parche);
        }
        MMCatalogo.refrescar(function () {
          if (window.MMPrecios && window.MMPrecios.repintar) MMPrecios.repintar();
          montarLapicesSecciones();
        });
        mostrarOkSubcat('Agregada. Ya la podés elegir en cualquier producto de ese mundo.');
        subcatBtn.disabled = false;
        setTimeout(cerrarSubcatAlta, 900);
      })
      .catch(function (err) {
        mostrarErrorSubcat((err && err.message) || 'No se pudo agregar. Probá de nuevo.');
        subcatBtn.disabled = false;
      });
  }

  /* --- Lápiz junto al título de cada subcategoría, en la propia página ----
   * Sólo en las secciones que corresponden a una fila real de
   * catalogo_subcategorias (todas las <section class="catsec"> migradas o
   * creadas desde acá) — "Novedades"/mm-nuevos (catalogo-productos.js, sin
   * subcategoría) no tiene fila, así que no lleva lápiz.
   */
  function subcategoriaDeSeccion(section, datos) {
    var domId = section.id;
    var match = null;
    Object.keys(datos.subcategorias).some(function (subId) {
      var s = datos.subcategorias[subId];
      if (s.pagina !== pagina) return false;
      if (s.slug === domId || ('cat-' + s.slug) === domId) { match = subId; return true; }
      return false;
    });
    return match;
  }

  function montarLapicesSecciones() {
    var datos = MMCatalogo.datos();
    if (!datos) return;
    $$('.catsec').forEach(function (section) {
      var head = $('.catsec-head', section);
      var h2 = head && $('h2', head);
      if (!h2 || $('.mm-seccion-edit', head)) return;
      var subId = subcategoriaDeSeccion(section, datos);
      if (!subId) return;
      var boton = el('button', 'mm-seccion-edit');
      boton.type = 'button';
      boton.setAttribute('aria-label', 'Editar esta subcategoría');
      boton.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
      boton.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        abrirSubcatEditar(subId, section, h2);
      });
      head.appendChild(boton);
    });
  }

  /* --- Caso: data-talles (un código por opción) --------------------------- */

  var filasTalles = null;

  function construirTalles(info, datos) {
    filasTalles = [];
    popBody.appendChild(el('p', 'mm-pop-nota', 'Cada talle/tamaño tiene su propio código y su propio precio.'));
    var wrap = el('div', 'mm-filas');
    info.opciones.forEach(function (op) {
      var fila = el('div', 'mm-fila');
      fila.appendChild(el('span', 'mm-fila-nombre', op.name));
      fila.appendChild(el('span', 'mm-fila-codigo', op.code));
      var precioIn = campoNumero('Precio', datos.precios[op.code] || '');
      var stockChk = campoCheck('Sin stock', !!datos.sinStock[op.code]);
      fila.appendChild(precioIn.wrap);
      fila.appendChild(stockChk.wrap);
      wrap.appendChild(fila);
      filasTalles.push({ codigo: op.code, precioIn: precioIn.input, stockChk: stockChk.input });
    });
    popBody.appendChild(wrap);
  }

  /* --- Caso: galería sin código compartido (cada color el suyo) ----------- */
  // Distinto de una galería normal (un data-pos para todos): acá cada color
  // ya resolvió un código DISTINTO por su cuenta (típicamente el número al
  // final del nombre del archivo). El código se muestra editable — si lo
  // cambian, se guarda como catalogo_fotos de LA FOTO DE ESE COLOR puntual
  // (no de la tarjeta entera), así corregir uno no toca a los demás.

  var camposGaleriaMulti = null;

  function construirGaleriaMulti(card, info, datos) {
    camposGaleriaMulti = null;
    popBody.appendChild(el('p', 'mm-pop-nota',
      'Esta galería no tiene un código único compartido: cada color resolvió el suyo por separado (por el nombre del archivo, por ejemplo). El precio ya se ve bien en la tarjeta — acá podés corregir el código o el precio de un color puntual sin tocar los demás.'));
    var imgs = $$('.gtrack img', card);
    var wrap = el('div', 'mm-filas');
    camposGaleriaMulti = info.opciones.map(function (op) {
      var imgNodo = imgs.filter(function (im) { return (im.getAttribute('data-cap') || '').trim() === op.name; })[0];
      var ruta = '';
      if (imgNodo) {
        try { ruta = decodeURIComponent(imgNodo.getAttribute('src') || ''); }
        catch (e) { ruta = imgNodo.getAttribute('src') || ''; }
      }
      var fila = el('div', 'mm-fila');
      fila.appendChild(el('span', 'mm-fila-nombre', op.name));
      var codigoIn = campoTexto('Código', op.code || '');
      var precioIn = campoNumero('Precio', (op.code && datos.precios[op.code]) || '');
      var stockChk = campoCheck('Sin stock', !!(op.code && datos.sinStock[op.code]));
      fila.appendChild(codigoIn.wrap);
      fila.appendChild(precioIn.wrap);
      fila.appendChild(stockChk.wrap);
      wrap.appendChild(fila);
      return { nombre: op.name, ruta: ruta, codigoOriginal: op.code || '', codigoIn: codigoIn.input, precioIn: precioIn.input, stockChk: stockChk.input };
    });
    popBody.appendChild(wrap);
  }

  /* --- Caso: data-incluye (combo) ----------------------------------------- */

  var campoComboPrecio = null;

  function construirCombo(info, datos, clave) {
    campoComboPrecio = null;
    var lista = el('div');
    var suma = 0, faltan = 0;
    info.componentes.forEach(function (c) {
      var p = datos.precios[c.code] || 0;
      if (p > 0) suma += p; else faltan++;
      var fila = el('div', 'mm-combo-comp');
      fila.appendChild(el('span', null, c.label + ' (' + c.code + ')'));
      fila.appendChild(el('b', null, p > 0 ? plata(p) : 'sin precio'));
      lista.appendChild(fila);
    });
    popBody.appendChild(lista);
    popBody.appendChild(el('p', 'mm-combo-suma',
      'Suma de las partes: ' + plata(suma) + (faltan ? ' (falta el precio de ' + faltan + ')' : '')));

    var tarjetaOv = datos.tarjetas[clave.pagina + '~' + clave.slug] || {};
    var precioIn = campoNumero('Precio del combo', tarjetaOv.precioFijo || '');
    popBody.appendChild(precioIn.wrap);
    campoComboPrecio = precioIn.input;
  }

  /* ------------------------------------------------------ campos chicos */

  function campoNumero(etiqueta, valor) {
    var wrap = el('label', 'mm-field');
    wrap.appendChild(el('span', null, etiqueta));
    var input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.inputMode = 'numeric';
    // valor != null (no "if (valor)"): un 0 real —como el orden de la
    // primera subcategoría— es válido y tiene que mostrarse como "0", no
    // como el campo vacío.
    if (valor != null && valor !== '') input.value = valor;
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  function campoTexto(etiqueta, valor) {
    var wrap = el('label', 'mm-field');
    wrap.appendChild(el('span', null, etiqueta));
    var input = document.createElement('input');
    input.type = 'text';
    if (valor) input.value = valor;
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  function campoCheck(etiqueta, marcado) {
    var wrap = el('label', 'mm-check');
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!marcado;
    wrap.appendChild(input);
    wrap.appendChild(el('span', null, etiqueta));
    return { wrap: wrap, input: input };
  }

  /* --------------------------------------------------------- guardado */
  // Update primero y, si no tocó ninguna fila (el código/ruta/tarjeta
  // todavía no existe), recién ahí insert. Evita depender de que upsert()
  // reparta las columnas exactamente como se espera contra los GRANT de
  // columna de catalogo_00_base.sql (que sólo permiten UPDATE de precio/
  // sin_stock, nunca de codigo).
  function guardarPrecio(codigo, precio, sinStock) {
    var cambios = { precio: precio, sin_stock: !!sinStock };
    return sb.from('catalogo_precios').update(cambios).eq('codigo', codigo).select()
      .then(function (r) {
        if (r.error) throw r.error;
        if (r.data && r.data.length) return;
        return sb.from('catalogo_precios').insert(Object.assign({ codigo: codigo }, cambios))
          .then(function (r2) { if (r2.error) throw r2.error; });
      })
      .then(function () {
        var parche = { precios: {}, sinStock: {} };
        parche.precios[codigo] = precio;
        parche.sinStock[codigo] = !!sinStock;
        MMCatalogo.parche(parche);
      });
  }

  function guardarFoto(ruta, codigo) {
    return sb.from('catalogo_fotos').update({ codigo: codigo }).eq('ruta', ruta).select()
      .then(function (r) {
        if (r.error) throw r.error;
        if (r.data && r.data.length) return;
        return sb.from('catalogo_fotos').insert({ ruta: ruta, codigo: codigo })
          .then(function (r2) { if (r2.error) throw r2.error; });
      })
      .then(function () {
        var parche = { fotos: {} };
        parche.fotos[ruta] = codigo;
        MMCatalogo.parche(parche);
      });
  }

  // camposSoloAlta: campos que sólo tiene sentido mandar en el INSERT, nunca
  // en el UPDATE — hoy sólo titulo_ref. No puede viajar en "campos" porque
  // el grant de columna de catalogo_00_base.sql sólo da UPDATE de
  // (oculta, sin_stock, precio_fijo, nota): un UPDATE que toque titulo_ref
  // rebota por permisos y tira abajo TODO el guardado, no sólo ese campo.
  // titulo_ref es a propósito así — es el que congela el <h3> tal como
  // estaba cuando se ocultó/movió la tarjeta, para poder detectar después
  // si el HTML le cambió el nombre (ver .claude/check-catalogo.js).
  function guardarTarjeta(pagina, slug, campos, camposSoloAlta) {
    return sb.from('catalogo_tarjetas').update(campos).eq('pagina', pagina).eq('slug', slug).select()
      .then(function (r) {
        if (r.error) throw r.error;
        if (r.data && r.data.length) return;
        return sb.from('catalogo_tarjetas').insert(Object.assign({ pagina: pagina, slug: slug }, campos, camposSoloAlta))
          .then(function (r2) { if (r2.error) throw r2.error; });
      })
      .then(function () {
        var parche = { tarjetas: {} };
        parche.tarjetas[pagina + '~' + slug] = {
          oculta: campos.oculta,
          sinStock: 'sin_stock' in campos ? campos.sin_stock : null,
          precioFijo: 'precio_fijo' in campos ? campos.precio_fijo : null,
          subcategoriaId: 'subcategoria_id' in campos ? campos.subcategoria_id : null,
          codigoOverride: 'codigo_override' in campos ? campos.codigo_override : null,
          coloresSinStock: 'colores_sin_stock' in campos ? campos.colores_sin_stock : []
        };
        MMCatalogo.parche(parche);
      });
  }

  function guardar() {
    if (!cardActual) return;
    var card = cardActual;
    var clave = claveDe(card);
    // Mismo texto que construir() ya puso en el título del popover — sólo
    // se usa si esta es la primera vez que se guarda algo de esta tarjeta
    // (ver camposSoloAlta en guardarTarjeta()).
    var tituloH3 = $('h3', popHead);
    var titulo = tituloH3 ? tituloH3.textContent.trim() : '';
    mostrarError(''); mostrarOk('');
    guardarBtn.disabled = true;

    var pasos = [];

    if (camposSimple) {
      if (camposSimple.sinCodigo) {
        var nuevoCodigo = camposSimple.codigoIn.value.trim();
        if (nuevoCodigo) {
          var ruta = rutaPrincipal(card);
          var p = guardarFoto(ruta, nuevoCodigo);
          var precioVal = camposSimple.precioIn.value ? Number(camposSimple.precioIn.value) : 0;
          if (precioVal > 0) {
            p = p.then(function () { return guardarPrecio(nuevoCodigo, precioVal, camposSimple.stockChk.checked); });
          }
          pasos.push(p);
        } else if (camposSimple.precioIn.value) {
          mostrarError('Cargá primero el código antes de ponerle precio.');
          guardarBtn.disabled = false;
          return;
        }
      } else {
        var precioVal2 = Number(camposSimple.precioIn.value || 0);
        if (precioVal2 > 0) pasos.push(guardarPrecio(camposSimple.codigo, precioVal2, camposSimple.stockChk.checked));
      }
    }

    if (filasTalles) {
      filasTalles.forEach(function (f) {
        var p = Number(f.precioIn.value || 0);
        if (p > 0) pasos.push(guardarPrecio(f.codigo, p, f.stockChk.checked));
      });
    }

    if (camposGaleriaMulti) {
      camposGaleriaMulti.forEach(function (f) {
        var nuevoCodigo = f.codigoIn.value.trim();
        // Sólo si lo cambiaron respecto al que ya traía esa foto: guarda el
        // código de ESE color puntual (catalogo_fotos, keyed por su propia
        // ruta) — así corregir uno no pisa a los demás colores de la galería.
        if (nuevoCodigo && nuevoCodigo !== f.codigoOriginal && f.ruta) {
          pasos.push(guardarFoto(f.ruta, nuevoCodigo));
        }
        var codigoUsar = nuevoCodigo || f.codigoOriginal;
        var p = Number(f.precioIn.value || 0);
        if (codigoUsar && p > 0) pasos.push(guardarPrecio(codigoUsar, p, f.stockChk.checked));
      });
    }

    // subcategoria_id puede necesitar crear la fila nueva primero (si el
    // admin eligió "+ Crear subcategoría nueva…"), así que el resto de
    // tarjetaCampos se arma DESPUÉS de que esto resuelva — y recién ahí se
    // hace el único UPDATE/INSERT en catalogo_tarjetas por click en
    // Guardar: nunca dos llamadas separadas a guardarTarjeta() en el mismo
    // guardar(), porque si la fila todavía no existe las dos harían el
    // mismo INSERT en paralelo y la segunda chocaría contra la clave
    // primaria (pagina, slug) de la primera.
    resolverSubcategoriaId(clave.pagina).then(function (subcategoriaId) {
      // "Sacar de la web" viaja siempre, tenga o no otros cambios: es lo que
      // permite ocultar una tarjeta sin tocar nada más.
      var tarjetaCampos = { oculta: ocultaChk.checked };
      if (subcategoriaId !== undefined) tarjetaCampos.subcategoria_id = subcategoriaId;

      if (campoComboPrecio) {
        var comboP = Number(campoComboPrecio.value || 0);
        if (comboP > 0) tarjetaCampos.precio_fijo = comboP;
      }
      // "Sin stock" de la TARJETA (no de un código) sólo tiene sentido acá
      // cuando no hay ningún código vinculado: si ya hay uno, el stock se
      // sigue por catalogo_precios (guardarPrecio, arriba) y no hay que
      // duplicarlo acá — un override de tarjeta seteado taparía para siempre
      // lo que diga el código, aunque después se resuelva bien.
      if (camposSimple && camposSimple.sinCodigo && !camposSimple.codigoIn.value.trim()) {
        tarjetaCampos.sin_stock = camposSimple.stockChk.checked;
      }
      // Código corregido a mano — sólo aplica cuando YA había un código
      // resuelto (el caso "sin código" de arriba usa catalogo_fotos, no
      // esto). Si lo dejaron igual no se escribe nada; si lo borraron, se
      // limpia el override y la tarjeta vuelve a la cascada de siempre.
      if (camposSimple && !camposSimple.sinCodigo) {
        var codigoEditado = camposSimple.codigoIn.value.trim();
        if (codigoEditado && codigoEditado !== camposSimple.codigo) tarjetaCampos.codigo_override = codigoEditado;
        else if (!codigoEditado) tarjetaCampos.codigo_override = null;
      }
      // Sin stock por color (galería con un solo código) — viaja siempre
      // que haya colores para elegir, aunque queden todos destildados: es
      // lo que permite volver a poner un color en stock.
      if (camposColores) {
        tarjetaCampos.colores_sin_stock = camposColores
          .filter(function (c) { return c.input.checked; })
          .map(function (c) { return c.nombre; });
      }

      pasos.push(guardarTarjeta(clave.pagina, clave.slug, tarjetaCampos, { titulo_ref: titulo }));
      return Promise.all(pasos);
    }).then(function () {
      if (window.MMPrecios && window.MMPrecios.repintar) MMPrecios.repintar();
      mostrarOk('Guardado.');
      guardarBtn.disabled = false;
      setTimeout(cerrarPopover, 700);
    }).catch(function (err) {
      mostrarError((err && err.message) || 'No se pudo guardar. Probá de nuevo.');
      guardarBtn.disabled = false;
    });
  }

  document.addEventListener('mm:sesion', chequear);
  chequear();
})();
