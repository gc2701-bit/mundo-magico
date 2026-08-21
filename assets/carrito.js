/* Carrito de pedidos → WhatsApp.  VERSIÓN DE PRUEBA.
 *
 * Qué resuelve: hoy el visitante pregunta "¿tenés esto?" producto por producto.
 * Con esto arma la lista completa en la web y la manda de una, en un solo
 * mensaje; el empleado la revisa, confirma stock y arregla el pago por chat.
 *
 * Muestra el total mientras se agrega, con los precios que assets/precios.js
 * trae de la planilla y deja en window.MMPrecios. Si ese módulo no está, el
 * carrito funciona igual que antes, sin precios ni totales.
 *
 * El total es honesto sobre lo que no sabe: hoy la mayoría de las tarjetas
 * todavía no tiene código del POS cargado, así que un pedido mezcla renglones
 * con precio y sin precio. Cuando falta alguno dice "Subtotal" y aclara
 * cuántos faltan, en vez de dar un número redondo que el cliente leería como
 * la cuenta final. El total definitivo lo confirma el empleado desde el POS.
 *
 * La unidad del pedido es la VARIANTE, no la tarjeta: "Globo estándar 12 x25"
 * es 01848 en blanco y 01862 en celeste. Si el cliente no elige el color, el
 * empleado tiene que volver a preguntar — que es justo lo que queremos evitar.
 * Por eso, en tarjetas con variantes, elegir es obligatorio.
 *
 * El código de POS sale, por orden: del data-pos de la variante, del data-pos
 * de la tarjeta, o del número al final del nombre del archivo de la foto
 * ("... 01848.jpeg"). Si no hay ninguno, el renglón viaja sin código y el
 * empleado lo busca por nombre — el carrito funciona igual, incompleto pero
 * útil, y va mejorando a medida que se carguen los códigos.
 *
 * Funciona en dos markups distintos: las tarjetas del catálogo (.pcard) y las
 * slides de Explorar (el visor tipo reel). Los dos se traducen al mismo
 * "producto" normalizado, así que de acá para abajo el archivo no sabe de
 * dónde vino cada pedido. Todo el enganche con Explorar vive acá y no en
 * explorar.js, para que sacar el carrito siga siendo borrar dos líneas por
 * página.
 */
(function () {
  'use strict';

  var WA = '5493813006343';

  // Dominio público para el link "ver el pedido con fotos". Se detecta solo
  // cuando la página corre en un servidor; abierta como archivo (file://) no
  // hay URL compartible, así que el mensaje va sin link y sigue sirviendo.
  var SITIO = '';

  // v2: cambió el SIGNIFICADO del renglón, no sólo el formato. Los pedidos
  // guardados con la versión anterior tienen code:'' en todo lo que se eligió
  // por texto (los talles, sobre todo), y ahora esa misma elección resuelve al
  // código del POS. Importarlos dejaría dos renglones para lo mismo, y encima
  // uno de ellos sin código — justo lo que este carrito existe para evitar. Un
  // carrito es una sesión de compra corta: se pierde una sola vez.
  var LS = 'mm_carrito_v2';
  var MAX_ITEMS = 40;
  var LSF = 'mm_favoritos_v1';

  // --- Utilidades -------------------------------------------------------
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function base64url(str) {
    var b = btoa(unescape(encodeURIComponent(str)));
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // --- Estado (localStorage: el carrito sobrevive a recargar y a cambiar
  //     de página, que es exactamente cómo se navega este catálogo) --------
  var items = [];

  function cargar() {
    try {
      var raw = localStorage.getItem(LS);
      items = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(items)) items = [];
    } catch (e) { items = []; }
  }

  function guardar() {
    try { localStorage.setItem(LS, JSON.stringify(items)); } catch (e) { /* modo privado */ }
    pintarCuenta();
    pintarControles();
  }

  function clave(it) { return (it.code || '') + '::' + it.title + '::' + (it.variant || ''); }

  // --- Favoritos ------------------------------------------------------------
  // Igual que el carrito: viven en localStorage y no dependen de tener sesión
  // iniciada. Se guarda el título/foto de cada producto (no sólo la clave)
  // para poder listarlos en el panel "Mis favoritos" aunque esa tarjeta ya no
  // esté en el DOM de la página que se está mirando.
  var favoritos = {}; // clave -> { title, img, url }

  function cargarFavoritos() {
    try {
      var raw = localStorage.getItem(LSF);
      favoritos = raw ? JSON.parse(raw) : {};
      if (!favoritos || typeof favoritos !== 'object') favoritos = {};
    } catch (e) { favoritos = {}; }
  }

  function guardarFavoritosLS() {
    try { localStorage.setItem(LSF, JSON.stringify(favoritos)); } catch (e) { /* modo privado */ }
  }

  function claveFav(card) {
    return (card.getAttribute('data-cat') || '') + '::' + titulo(card);
  }

  function pintarBotonFav(boton, on) {
    boton.classList.toggle('is-on', on);
    boton.setAttribute('aria-pressed', on ? 'true' : 'false');
    boton.setAttribute('aria-label', on ? 'Sacar de favoritos' : 'Agregar a favoritos');
  }

  function sincronizarBotonesFav() {
    $$('.pcard').forEach(function (card) {
      var b = $('.pcard-fav', card);
      if (b) pintarBotonFav(b, !!favoritos[claveFav(card)]);
    });
  }

  function toggleFavorito(card, boton) {
    var k = claveFav(card);
    if (favoritos[k]) {
      delete favoritos[k];
    } else {
      favoritos[k] = { title: titulo(card), img: fotoPrincipal(card), url: location.pathname };
    }
    guardarFavoritosLS();
    pintarBotonFav(boton, !!favoritos[k]);
    if (panelFav && panelFav.classList.contains('is-on')) pintarListaFav();
  }

  // El renglón del carrito es el producto MÁS el color: por eso la cantidad se
  // cuenta siempre por variante y no por producto. "3 globos" no dice nada;
  // "3 negros y 2 blancos" es un pedido.
  function codigoDe(prod, v) {
    return v ? (v.code || prod.base || '') : prod.code;
  }

  function itemDe(prod, v) {
    var k = codigoDe(prod, v) + '::' + prod.title + '::' + (v ? v.name : '');
    var enc = null;
    items.forEach(function (x) { if (clave(x) === k) enc = x; });
    return enc;
  }

  function cantidadDe(prod, v) {
    var it = itemDe(prod, v);
    return it ? it.qty : 0;
  }

  // Todo lo pedido de este producto, sumando sus colores. Es lo que muestra el
  // botón de una tarjeta con variantes, donde no hay una cantidad única.
  function cantidadTotal(prod) {
    var n = 0;
    items.forEach(function (x) { if (x.title === prod.title) n += x.qty; });
    return n;
  }

  function ponerCantidad(prod, v, n) {
    var it = itemDe(prod, v);
    if (n <= 0) {
      if (it) items.splice(items.indexOf(it), 1);
    } else if (it) {
      it.qty = n;
    } else {
      if (items.length >= MAX_ITEMS) {
        alert('El pedido llegó a ' + MAX_ITEMS + ' productos distintos. Para pedidos más grandes conviene escribirnos directo por WhatsApp.');
        return false;
      }
      items.push({
        title: prod.title,
        variant: v ? v.name : '',
        code: codigoDe(prod, v),
        img: (v && v.img) || prod.img,
        qty: n
      });
    }
    guardar();
    return true;
  }

  // --- Producto normalizado ----------------------------------------------
  // Ya no se arma acá: lo hace assets/producto.js, que es el único lugar del
  // sitio que sabe traducir una tarjeta (o una slide de Explorar) a un objeto.
  // Antes cada archivo tenía su propia versión con reglas apenas distintas, y
  // por eso el carrito no se enteraba de data-talles: los talles con código del
  // POS existían para los precios y no para el pedido, que es justo al revés de
  // lo que hace falta.
  //
  // De ese objeto, acá se usan:
  //   title, img, code, base — igual que siempre.
  //   dimension  — la ÚNICA elección del producto, con un código por opción
  //                cuando lo hay. Reemplaza a la vieja lista `variantes`.
  //   preferencia — la segunda pregunta (el color, cuando el talle ya se llevó
  //                la elección). No genera código: la ficha la pega al nombre
  //                de la variante y viaja como texto en el renglón.
  var P = window.MMProducto;
  if (!P) {
    if (window.console) console.error('carrito.js necesita assets/producto.js cargado antes.');
    return;
  }

  var titulo = function (card) {
    var h = $('.pcard-body h3', card);
    return h ? h.textContent.trim() : 'Producto';
  };

  function fotoPrincipal(card) {
    var img = $('.pcard-ph img', card);
    return img ? img.getAttribute('src') : '';
  }

  // Las opciones entre las que hay que elegir, o [] si el producto es simple.
  function opciones(prod) {
    return (prod && prod.dimension) ? prod.dimension.opciones : [];
  }

  // --- Selector de colores y cantidades -----------------------------------
  // No es "elegí uno y listo": es la pantalla donde el cliente carga CUÁNTOS
  // de CADA color quiere. Un pedido real de globos es "3 negros y 2 blancos",
  // y obligarlo a abrir el selector una vez por color sería absurdo. Cada
  // opción tiene su propio − N +, y lo que carga se va guardando en el acto.
  var pick, pickGrid, pickTitle, pickPie, pickProd;

  function armarPicker() {
    pick = el('div', 'cart-pick');
    pick.setAttribute('role', 'dialog');
    pick.setAttribute('aria-modal', 'true');
    pick.setAttribute('aria-label', 'Elegir colores y cantidades');

    var head = el('div', 'cart-head');
    pickTitle = el('h2', null, 'Elegí colores y cantidades');
    var x = el('button', 'cart-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Cerrar');
    x.addEventListener('click', cerrarPicker);
    head.appendChild(pickTitle);
    head.appendChild(x);

    pickGrid = el('div', 'cart-pick-grid');

    var pie = el('div', 'cart-pick-foot');
    pickPie = el('p', 'cart-pick-total');
    var listo = el('button', 'cart-send', 'Listo');
    listo.type = 'button';
    listo.addEventListener('click', cerrarPicker);
    pie.appendChild(pickPie);
    pie.appendChild(listo);

    pick.appendChild(head);
    pick.appendChild(pickGrid);
    pick.appendChild(pie);
    document.body.appendChild(pick);
  }

  // La grilla de opciones con su − N + y su precio. La usan el selector rápido
  // y la ficha del producto: que sea una sola función es lo que garantiza que
  // las dos pantallas no puedan discrepar sobre qué se puede elegir ni a qué
  // precio.
  function pintarOpciones(caja, prod, lista, alTocar) {
    var conFoto = lista.some(function (v) { return v.img; });
    caja.className = 'cart-pick-grid' + (conFoto ? '' : ' no-fotos');
    caja.innerHTML = '';

    // El código y el precio sólo se muestran cuando DISTINGUEN una opción de
    // otra. En los 16 colores de un individual el POS tiene un código y un
    // precio solos: repetirlos 16 veces no informa nada y empuja el resto de la
    // ficha fuera de la pantalla — el precio ya está arriba, junto al nombre.
    // En los talles de un disfraz, en cambio, cada uno es un artículo distinto
    // con su propio precio, y ahí es justo el dato que hace falta ver antes de
    // elegir.
    var codigos = {}, precios = {}, codDistintos = 0, preDistintos = 0;
    lista.forEach(function (v) {
      var c = codigoDe(prod, v);
      if (c && !codigos[c]) { codigos[c] = 1; codDistintos++; }
      var p = precioUnidad({ code: c });
      if (!precios[p]) { precios[p] = 1; preDistintos++; }
    });
    var mostrarCodigo = codDistintos > 1;
    var mostrarPrecio = preDistintos > 1;

    lista.forEach(function (v) {
      var opt = el('div', 'cart-opt' + (v.sinStock ? ' is-agotado' : ''));
      if (v.img) {
        var im = el('img');
        im.src = v.img;
        im.alt = '';
        im.loading = 'lazy';
        opt.appendChild(im);
      }
      opt.appendChild(el('span', 'cart-opt-n', v.name));
      // Advertencia, no bloqueo: igual que el "Sin stock" de la tarjeta en
      // la grilla, esto no le impide al cliente pedirlo — el empleado es
      // quien confirma disponibilidad real al leer el pedido.
      if (v.sinStock) opt.appendChild(el('span', 'cart-opt-agotado', 'Sin stock'));

      // El precio de ESTA opción, no el de la tarjeta: en un producto con
      // talles cada uno vale distinto, y elegir a ciegas para enterarse
      // después es lo que hace que el cliente vuelva a preguntar.
      var code = codigoDe(prod, v);
      var u = precioUnidad({ code: code });
      if (window.MMPrecios && mostrarPrecio) {
        opt.appendChild(el('span', 'cart-opt-p', u > 0 ? plata(u) : 'a confirmar'));
      }
      if (mostrarCodigo && code) opt.appendChild(el('span', 'cart-opt-c', 'Cód. ' + code));

      opt.appendChild(pasoDeCantidad(
        v.name,
        function () { return cantidadDe(prod, v); },
        function (n) { ponerCantidad(prod, v, n); }
      ));

      // Tocar la opción (fuera del − N +) muestra su foto en grande. Sirve sólo
      // en la ficha; el selector no tiene foto grande y le pasa un alTocar vacío.
      if (alTocar) {
        opt.addEventListener('click', function (ev) {
          if (ev.target.closest('.cart-step')) return;
          alTocar(v);
        });
      }
      caja.appendChild(opt);
    });
  }

  function abrirPicker(prod) {
    pickProd = prod;
    pickTitle.textContent = prod.title;
    pintarOpciones(pickGrid, prod, opciones(prod));

    scrim.classList.add('is-on');
    pick.classList.add('is-on');
    trabarFondo(true);
    pickGrid.scrollTop = 0;
    pintarPicker();
  }

  function pintarPicker() {
    if (!pickProd) return;
    // Los − N + del selector no están en `controles` (nacen y mueren con el
    // selector), así que se repintan acá: si no, el número dibujado se queda
    // viejo aunque el carrito esté bien.
    $$('.cart-step', pickGrid).forEach(function (s) { if (s._pintar) s._pintar(); });
    var n = cantidadTotal(pickProd);
    pickPie.textContent = n
      ? n + (n === 1 ? ' unidad en tu pedido' : ' unidades en tu pedido')
      : 'Elegí cuántos querés de cada color.';
  }

  function cerrarPicker() {
    pick.classList.remove('is-on');
    pickProd = null;
    if (!panel.classList.contains('is-on')) {
      scrim.classList.remove('is-on');
      trabarFondo(false);
    }
  }

  // --- Control de cantidad, reutilizable -----------------------------------
  // El mismo − N + del selector, de las tarjetas y de los renglones del panel.
  // Lee y escribe por función y no por valor, así el control siempre refleja
  // el carrito aunque lo hayan cambiado desde otro lado.
  function pasoDeCantidad(etiqueta, leer, escribir) {
    var box = el('div', 'cart-step');
    var menos = el('button', 'cart-step-b', '−');
    menos.type = 'button';
    menos.setAttribute('aria-label', 'Quitar uno de ' + etiqueta);
    var n = el('span', 'cart-step-n', '0');
    var mas = el('button', 'cart-step-b', '+');
    mas.type = 'button';
    mas.setAttribute('aria-label', 'Agregar uno de ' + etiqueta);

    menos.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      escribir(Math.max(0, leer() - 1));
    });
    mas.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      escribir(leer() + 1);
    });

    box.appendChild(menos);
    box.appendChild(n);
    box.appendChild(mas);
    box._pintar = function () {
      var q = leer();
      n.textContent = String(q);
      box.classList.toggle('is-cero', q === 0);
      menos.disabled = q === 0;
    };
    box._pintar();
    return box;
  }

  // --- Alta directa (un toque = una unidad) --------------------------------
  function sumar(prod, v, boton) {
    var entro = ponerCantidad(prod, v, cantidadDe(prod, v) + 1);
    if (entro) latido(boton);
    return entro;
  }

  function latido(b) {
    if (b) {
      b.classList.add('is-added');
      setTimeout(function () { b.classList.remove('is-added'); }, 700);
    }
    cuentas.forEach(function (c) {
      c.classList.add('pop');
      setTimeout(function () { c.classList.remove('pop'); }, 360);
    });
  }

  // `yaElegida` es la variante que el cliente tiene delante (Explorar): si vino
  // una, no le abrimos un selector para que conteste lo que ya contestó.
  function pedir(prod, boton, yaElegida) {
    if (!prod) return;
    if (yaElegida) { sumar(prod, yaElegida, boton); return; }
    var lista = opciones(prod);
    // Una sola opción no es una elección, pero sí es información: se agrega
    // directo conservando el nombre, que sigue sirviendo en el renglón del
    // pedido (y, si esa opción trae código propio, el código correcto).
    if (lista.length === 1) { sumar(prod, lista[0], boton); return; }
    if (lista.length) { abrirPicker(prod); return; }
    sumar(prod, null, boton);
  }

  // --- Control "Agregar al pedido" / "− N +" ------------------------------
  // Un control por tarjeta o slide. Se guardan todos en una lista para poder
  // repintarlos cuando cambia el carrito: si el cliente saca algo desde el
  // panel, el botón de la tarjeta tiene que enterarse.
  var controles = [];

  // `leerVariante` devuelve de qué color estamos hablando en este momento.
  // Devuelve null cuando no hay color (producto simple) o cuando todavía no se
  // eligió; el control resuelve solo qué mostrar en cada caso.
  function montarControl(caja, prod, leerVariante) {
    var boton = el('button', 'pcard-add', 'Agregar al pedido');
    boton.type = 'button';

    var paso = pasoDeCantidad(prod.title,
      function () { return cantidadDe(prod, leerVariante()); },
      function (n) { ponerCantidad(prod, leerVariante(), n); });

    boton.addEventListener('click', function (ev) {
      // La tarjeta entera es un <a href="#">: sin esto el clic burbujea y
      // dispara la navegación/galería de site.js.
      ev.preventDefault();
      ev.stopPropagation();
      pedir(prod, boton, leerVariante());
    });

    caja.appendChild(boton);
    caja.appendChild(paso);

    // `releer` deja el control atado a su tarjeta para poder rearmar el modelo
    // cuando llegan los precios: precios.js escribe el código ganador
    // (data-pos-ok) DESPUÉS de que esto se montó, y un modelo viejo genera
    // claves con el código viejo — el − N + de la tarjeta mostraría 0 para algo
    // que sí está en el pedido.
    var ctrl = { caja: caja, boton: boton, paso: paso, prod: prod,
                 variante: leerVariante, releer: null };
    controles.push(ctrl);
    pintarControl(ctrl);
    return ctrl;
  }

  function pintarControl(c) {
    var v = c.variante();
    // ¿La cantidad de qué? Si el producto tiene opciones y todavía no sabemos
    // cuál, no hay una cantidad única que mostrar: el botón manda al selector
    // y muestra el total ya cargado.
    var ambiguo = !v && opciones(c.prod).length > 1;
    var q = ambiguo ? cantidadTotal(c.prod) : cantidadDe(c.prod, v);

    // El − N + ACOMPAÑA al botón, no lo reemplaza. Antes el botón desaparecía
    // en cuanto la cantidad pasaba de cero y quedaba sólo el − N +: la acción
    // con nombre se esfumaba justo después de tocarla, y para sumar otra
    // unidad había que buscar un "+" chiquito que aparecía donde antes estaba
    // el botón. Ahora el botón dice siempre lo mismo y hace siempre lo mismo.
    c.paso.hidden = ambiguo || q === 0;
    if (!c.paso.hidden) c.paso._pintar();

    c.boton.hidden = false;
    c.boton.textContent = textoBoton(c.prod, ambiguo, q);
  }

  // Qué dice el botón de una tarjeta. En un producto con opciones NO dice
  // "Agregar": tocarlo no agrega nada, abre una pregunta. Decir de antemano
  // cuántos colores o talles hay ahorra el toque a ciegas y, sobre todo, avisa
  // que hay algo para elegir a quien mira la grilla de paso.
  function textoBoton(prod, ambiguo, q) {
    if (ambiguo) {
      if (q > 0) return q === 1 ? '1 unidad · editar' : q + ' unidades · editar';
      var lista = opciones(prod);
      return 'Elegir entre ' + lista.length + ' ' + (prod.dimension.plural || 'opciones');
    }
    return 'Agregar unidad al pedido';
  }

  function pintarControles() {
    // Explorar destruye slides al scrollear: los controles de las que ya no
    // están en la página se descartan acá en vez de acumularse.
    controles = controles.filter(function (c) { return c.caja.isConnected; });
    controles.forEach(pintarControl);
    pintarPicker();
    // El bloque de la ficha no está en `controles` (sus − N + nacen y mueren
    // con cada apertura), así que se repinta acá: si no, el número dibujado se
    // queda viejo aunque el carrito esté bien. Mismo motivo que pintarPicker().
    if (pintarFicha && window.MMFicha && MMFicha.abierta()) pintarFicha();
  }

  // Rearmar los modelos desde el DOM. Se llama cuando llegan los precios, que
  // es cuando aparecen los data-pos-ok (ver montarControl).
  function releerModelos() {
    controles.forEach(function (c) {
      if (c.releer) c.prod = c.releer();
    });
  }

  /* --- El pedido dentro de la ficha del producto --------------------------
   *
   * La ficha (assets/site.js) es donde el cliente mira el producto en grande:
   * es ahí donde tiene que poder pedirlo. Antes terminaba en "Consultar por
   * WhatsApp", o sea que después de decidirse tenía que volver a la grilla a
   * buscar la misma tarjeta para agregarla.
   *
   * Se elige acá con el mismo criterio que en el selector rápido: NO es "elegí
   * uno y listo", es cargar cuántos de cada opción. Un pedido real de globos es
   * "3 negros y 2 blancos", y obligar a abrir y cerrar la ficha una vez por
   * color sería peor que lo que había.
   */
  var pintarFicha = null;   // repinta el bloque de la ficha abierta, si hay una

  function llenarFichaCarrito(card, slot, ficha) {
    var prod = P.leer(card);
    var lista = opciones(prod);
    var caja = el('div', 'ficha-pedido');
    var grid = null;

    // La preferencia con la que este producto ya está en el pedido. Sin esto,
    // volver a abrir la ficha arrancaba en "Me da igual" y los − N + mostraban
    // 0 al lado de un "ya tenés 2 unidades": los renglones cargados eran de
    // otra preferencia y no se veían por ningún lado. Sólo se restaura si hay
    // una sola: con dos colores distintos cargados no hay una para elegir.
    var pref = prefEnElPedido(prod);

    function prefEnElPedido(p) {
      var vistas = {}, ultima = '';
      items.forEach(function (x) {
        if (x.title !== p.title) return;
        var i = (x.variant || '').indexOf(' · ');
        var s = i > -1 ? x.variant.slice(i + 3) : '';
        if (s && !vistas[s]) { vistas[s] = 1; ultima = s; }
      });
      return Object.keys(vistas).length === 1 ? ultima : '';
    }

    // La preferencia no cambia el código: se pega al nombre de la variante y
    // viaja como texto en el renglón ("Talle 3 · rosa"). Como el nombre es
    // parte de la identidad del renglón, cambiarla arma un renglón distinto —
    // que es lo correcto: el POS no los distingue, el empleado sí.
    function conPref(v) {
      if (!pref) return v;
      return { name: v.name + ' · ' + pref, img: v.img, code: v.code };
    }

    function alTocar(v) {
      if (v.img) ficha.verFoto(v.img, prod.title + ' — ' + v.name);
    }

    // --- La elección principal
    if (lista.length > 1) {
      caja.appendChild(el('p', 'fp-label', prod.dimension.etiqueta));
      grid = el('div', 'cart-pick-grid');
      caja.appendChild(grid);
    }

    // --- La segunda pregunta, si la hay
    if (prod.preferencia) {
      caja.appendChild(el('p', 'fp-label', '¿' + prod.preferencia.etiqueta + '?'));
      var chips = el('div', 'fp-chips');
      // "Me da igual" primero y elegido por defecto: es una preferencia, no un
      // requisito, y no puede trabar el pedido de quien no tiene una.
      var todas = ['Me da igual'].concat(prod.preferencia.opciones);
      todas.forEach(function (nombre, i) {
        var chip = el('button', 'fp-chip', nombre);
        chip.type = 'button';
        var elegido = pref ? (nombre === pref) : (i === 0);
        chip.setAttribute('aria-pressed', elegido ? 'true' : 'false');
        chip.addEventListener('click', function () {
          pref = (i === 0) ? '' : nombre;
          chips.querySelectorAll('.fp-chip').forEach(function (o) {
            o.setAttribute('aria-pressed', o === chip ? 'true' : 'false');
          });
          repintar();
        });
        chips.appendChild(chip);
      });
      caja.appendChild(chips);
    }

    // --- Producto sin elección (o con una sola): el control de siempre
    if (lista.length <= 1) {
      var cajaAdd = el('div', 'cart-add');
      caja.appendChild(cajaAdd);
      var ctrl = montarControl(cajaAdd, prod, function () {
        return lista.length ? conPref(lista[0]) : null;
      });
      ctrl.releer = function () { return P.leer(card); };
    }

    var estado = el('p', 'fp-estado');
    caja.appendChild(estado);
    slot.appendChild(caja);

    function repintar() {
      if (grid) pintarOpciones(grid, prod, lista.map(conPref), alTocar);
      var n = cantidadTotal(prod);
      estado.innerHTML = '';
      if (n) {
        estado.appendChild(document.createTextNode(
          'Ya tenés ' + n + (n === 1 ? ' unidad' : ' unidades') + ' de esto en tu pedido. '));
        var ver = el('button', 'fp-ver', 'Ver mi pedido');
        ver.type = 'button';
        ver.addEventListener('click', abrirPanel);
        estado.appendChild(ver);
      } else if (grid) {
        estado.textContent = 'Cargá cuántos querés de cada uno.';
      }
    }

    // Mientras esta ficha esté abierta, es la que se repinta cuando cambia el
    // carrito (por ejemplo si sacan algo desde el panel).
    pintarFicha = repintar;
    repintar();
  }

  // --- Botones en las tarjetas ------------------------------------------
  function montarBotones() {
    $$('.pcard').forEach(function (card) {
      var body = $('.pcard-body', card);
      if (!body || $('.cart-add', body)) return;
      var caja = el('div', 'cart-add');
      body.appendChild(caja);
      var ctrl = montarControl(caja, P.leer(card), function () { return null; });
      ctrl.releer = function () { return P.leer(card); };
    });
  }

  // --- Corazón de favoritos en las tarjetas -------------------------------
  function montarFavoritos() {
    $$('.pcard').forEach(function (card) {
      var ph = $('.pcard-ph', card);
      if (!ph || $('.pcard-fav', ph)) return;
      var boton = el('button', 'pcard-fav');
      boton.type = 'button';
      boton.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 20.5s-7.5-4.8-9.8-9.2C.7 8 2 4.5 5.3 3.7c2-.5 4 .3 5.2 2 .3.4.6.8.8 1.3.2-.5.5-.9.8-1.3 ' +
        '1.2-1.7 3.2-2.5 5.2-2 3.3.8 4.6 4.3 3.1 7.6-2.3 4.4-9.7 9.2-9.7 9.2z"/></svg>';
      pintarBotonFav(boton, !!favoritos[claveFav(card)]);
      boton.addEventListener('click', function (ev) {
        // Mismo motivo que en el botón de "Agregar al pedido": la tarjeta es
        // un <a href="#"> y sin esto el clic dispara su navegación/galería.
        ev.preventDefault();
        ev.stopPropagation();
        toggleFavorito(card, boton);
      });
      ph.appendChild(boton);
    });
  }

  // --- Botón en Explorar (el visor tipo reel) ----------------------------
  // Diferencia de fondo con el catálogo: acá el cliente ESTÁ MIRANDO un color
  // — la foto ocupa la pantalla y el punto encendido dice cuál. Abrirle el
  // selector para elegir el que ya tiene delante sería preguntarle algo que
  // acaba de responder. Así que se agrega la foto visible, y el selector queda
  // sólo para cuando esa foto no identifica un color: la de "todos los
  // colores", las fotos sin nombre, o los productos cuyos colores están
  // únicamente en el texto.
  function montarBotonesReel() {
    $$('.slide-actions').forEach(function (actions) {
      if ($('.cart-add', actions)) return;
      var slide = actions.closest('.slide');
      if (!slide || !slide._product) return;

      var caja = el('div', 'cart-add slide-add');
      // Primero de la fila: pedir pesa más que consultar o compartir.
      actions.insertBefore(caja, actions.firstChild);

      var ctrl = montarControl(caja, P.leerSlide(slide), function () {
        return P.varianteVisible(slide);
      });

      ctrl.boton.addEventListener('click', function () {
        // Querer pedir un producto es la señal de interés más fuerte que hay.
        // explorar.js la escucha para ordenar el feed; se avisa por evento
        // para no atarnos a sus funciones internas — y si nadie escucha, no
        // pasa nada.
        slide.dispatchEvent(new CustomEvent('mm:pedido', { bubbles: true }));
      });

      // Al deslizar de un color a otro cambia de qué producto es la cantidad
      // que muestra el control. Los puntitos son la señal: explorar.js les
      // mueve la clase is-on en cuanto cambia la foto.
      var dots = $('.slide-dots', slide);
      if (dots && window.MutationObserver) {
        new MutationObserver(function () { pintarControl(ctrl); })
          .observe(dots, { attributes: true, subtree: true, attributeFilter: ['class'] });
      }
    });
  }

  // --- Accesos al pedido ---------------------------------------------------
  // Dos formas, según la página tenga barra de navegación o no. En las dos hay
  // un solo acceso: dos contadores con el mismo número en pantalla se leen
  // como un error.
  var cuentas = [];   // todo lo que muestra el total y abre el panel
  var heroOtro = null; // el "Armá tu pedido" de la portada, si esta página lo tiene

  function armarAccesos() {
    var nav = $('.nav');
    if (nav) {
      // En la barra de navegación y NO adentro de .nav-links: ese bloque se
      // pliega detrás del botón de hamburguesa en celular, y un carrito que
      // hay que abrir un menú para ver no cumple ninguna función.
      var b = el('button', 'cart-nav');
      b.type = 'button';
      b.setAttribute('aria-label', 'Ver mi pedido');
      b.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.55L21 8H6"/>' +
        '<circle cx="10" cy="20" r="1.4"/><circle cx="17.5" cy="20" r="1.4"/></svg>' +
        '<span class="cart-n">0</span><span class="cart-mini" hidden></span>';
      b.addEventListener('click', abrirPanel);
      var toggle = $('.nav-toggle', nav);
      if (toggle) nav.insertBefore(b, toggle); else nav.appendChild(b);
      cuentas.push(b);
    } else {
      // Explorar no tiene barra: ahí sigue la burbuja flotante.
      var f = el('button', 'cart-fab');
      f.type = 'button';
      f.innerHTML = 'Ver mi pedido <span class="cart-n">0</span><span class="cart-mini" hidden></span>';
      f.addEventListener('click', abrirPanel);
      document.body.appendChild(f);
      cuentas.push(f);
    }

    // En la portada, si el pedido quedó a medio armar de una visita anterior
    // (vive en localStorage), se ofrece retomarlo ahí mismo. Sin esto el
    // cliente vuelve a la home, ve el catálogo de cero y no se entera de que
    // tenía cosas cargadas hasta que mira el contador de la barra.
    var heroCta = $('.hero-cta');
    if (heroCta) {
      var s = el('button', 'btn btn-primary cart-seguir');
      s.type = 'button';
      s.innerHTML = 'Seguí tu pedido <span class="cart-n">0</span>';
      s.addEventListener('click', abrirPanel);
      heroCta.insertBefore(s, heroCta.firstChild);
      // Entra en la misma lista que los otros accesos: así el número lo
      // mantiene pintarCuenta() y no hay una segunda cuenta que desincronizar.
      cuentas.push(s);
      // El otro botón principal del hero, para poder bajarlo a secundario
      // mientras haya un pedido a medio armar.
      heroOtro = $('.btn-primary:not(.cart-seguir)', heroCta);
    }
  }

  // Traba el scroll de la página mientras hay algo abierto encima. Sin esto,
  // al llegar al final de la lista el dedo sigue y arrastra el catálogo que
  // está atrás: es la sensación de "dos cosas que se scrollean a la vez".
  var scrollY = 0;
  function trabarFondo(trabar) {
    var b = document.body;
    // Si la ficha del producto está abierta, ella ya trabó el fondo con
    // body.ficha-open{overflow:hidden} (assets/v2.css). Trabar de nuevo acá
    // agrega un position/top al body, y al cerrar el panel el scrollTo de
    // abajo se ejecuta con la ficha todavía abierta: el catálogo de atrás se
    // iba al principio y el cliente perdía dónde venía mirando.
    if (b.classList.contains('ficha-open')) return;
    if (trabar === b.classList.contains('cart-abierto')) return;
    if (trabar) {
      scrollY = window.scrollY;
      b.classList.add('cart-abierto');
      b.style.top = -scrollY + 'px';
    } else {
      b.classList.remove('cart-abierto');
      b.style.top = '';
      // behavior:'instant' — el sitio tiene scroll-behavior:smooth, y sin esto
      // volver a la posición se anima: al cerrar el panel el catálogo se iba
      // solo hasta arriba y el cliente perdía dónde estaba mirando.
      try { window.scrollTo({ top: scrollY, behavior: 'instant' }); }
      catch (e) { window.scrollTo(0, scrollY); }
    }
  }

  var ZONA_OTRA = '__otra__';
  var ZONAS = ['San Miguel de Tucumán', 'Yerba Buena', 'Cevil Redondo', 'Lules', 'Banda del Río Salí', 'San Pablo'];

  var scrim, panel, lista, totalCaja, nombreIn, metodoRetiroBtn, metodoEnvioBtn, metodoEntrega,
    envioCampos, direccionIn, zonaSel, zonaOtraIn, fechaIn, lFechaWrap, entregaInfoFallback, notaIn, sesionEl;

  // Si assets/envio-form.js cargó, ese módulo dibuja y valida todo el bloque
  // de "Tus datos" (nombre, teléfono, retiro/envío, fecha, franja) contra
  // las zonas/sucursales reales de la base. Si no está, se arma acá el
  // formulario mínimo de siempre — ninguna otra parte del archivo depende
  // de cuál de los dos terminó dibujando el panel.
  var usarModulo = !!window.MMEnvioForm;

  function armarUI() {
    armarAccesos();

    scrim = el('div', 'cart-scrim');
    scrim.addEventListener('click', function () { cerrarPicker(); cerrarPanel(); cerrarPanelFav(); });
    document.body.appendChild(scrim);

    panel = el('aside', 'cart-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Mi pedido');

    var head = el('div', 'cart-head');
    head.appendChild(el('h2', null, 'Mi pedido'));
    var x = el('button', 'cart-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Cerrar');
    x.addEventListener('click', cerrarPanel);
    head.appendChild(x);

    // UN solo contenedor con scroll: la lista y el formulario bajan juntos.
    // Antes eran dos cajas independientes y en celular el formulario se comía
    // media pantalla, dejando el pedido en una rendija que scrolleaba aparte.
    var scroll = el('div', 'cart-scroll');
    lista = el('div', 'cart-body');

    // El total va pegado abajo de la lista y arriba de "Tus datos": es lo que
    // se mira después de revisar los renglones y antes de completar los datos.
    totalCaja = el('div', 'cart-total');
    totalCaja.hidden = true;

    var foot = el('div', 'cart-foot');

    var l1, l2;
    if (!usarModulo) {
      nombreIn = el('input');
      nombreIn.type = 'text';
      nombreIn.placeholder = 'Tu nombre';
      l1 = el('label', 'cart-field');
      l1.appendChild(el('span', null, 'Nombre'));
      l1.appendChild(nombreIn);

      // Método de entrega: dos botones tipo "toggle" en vez de un <select>,
      // para que se sienta parte del mismo lenguaje táctil que el − N + del
      // carrito. Guarda el valor en `metodoEntrega` ('retiro' | 'envio') y
      // muestra/esconde los campos de dirección y zona según corresponda.
      metodoRetiroBtn = el('button', 'cart-metodo-b is-on', 'Retiro en el local');
      metodoRetiroBtn.type = 'button';
      metodoEnvioBtn = el('button', 'cart-metodo-b', 'Envío a domicilio');
      metodoEnvioBtn.type = 'button';
      metodoEntrega = 'retiro';
      metodoRetiroBtn.addEventListener('click', function () { elegirMetodo('retiro'); });
      metodoEnvioBtn.addEventListener('click', function () { elegirMetodo('envio'); });
      var metodoWrap = el('div', 'cart-metodo');
      metodoWrap.appendChild(metodoRetiroBtn);
      metodoWrap.appendChild(metodoEnvioBtn);
      l2 = el('label', 'cart-field');
      l2.appendChild(el('span', null, '¿Retirás o te lo enviamos?'));
      l2.appendChild(metodoWrap);

      direccionIn = el('input');
      direccionIn.type = 'text';
      direccionIn.placeholder = 'Calle, número, referencia';
      var lDireccion = el('label', 'cart-field');
      lDireccion.appendChild(el('span', null, 'Dirección'));
      lDireccion.appendChild(direccionIn);

      // Link a Maps sin geocodificar nada (este formulario de respaldo no
      // tiene el chequeo contra Nominatim de envio-form.js): sólo abre la
      // búsqueda pública de Google Maps con lo tipeado, para que el cliente
      // la revise a ojo antes de mandar el pedido.
      var direccionLinkFallback = el('a', 'cart-direccion-maps', 'Ver esta dirección en Google Maps');
      direccionLinkFallback.target = '_blank';
      direccionLinkFallback.rel = 'noopener';
      direccionLinkFallback.hidden = true;
      function refrescarLinkDireccionFallback() {
        var texto = direccionIn.value.trim();
        if (texto.length < 4) { direccionLinkFallback.hidden = true; return; }
        var zonaTxt = zonaSel.value === ZONA_OTRA ? zonaOtraIn.value.trim() : zonaSel.value;
        var consulta = texto + (zonaTxt ? ', ' + zonaTxt : '') + ', Tucumán, Argentina';
        direccionLinkFallback.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(consulta);
        direccionLinkFallback.hidden = false;
      }
      direccionIn.addEventListener('input', refrescarLinkDireccionFallback);

      // Lista cerrada en vez de texto libre: así el panel de administración
      // puede agrupar los pedidos por zona sin que un mismo barrio quede
      // partido en grupos distintos por cómo cada cliente lo tipeó (mayúsculas,
      // "Yerba Bs." vs "Yerba Buena", etc.). "Otra zona" deja una vía de
      // escape para direcciones fuera de esta lista, sin bloquear el pedido.
      zonaSel = el('select');
      var optZonaVacia = document.createElement('option');
      optZonaVacia.value = '';
      optZonaVacia.textContent = 'Elegí una zona…';
      optZonaVacia.disabled = true;
      optZonaVacia.selected = true;
      zonaSel.appendChild(optZonaVacia);
      ZONAS.forEach(function (z) {
        var o = document.createElement('option');
        o.value = z;
        o.textContent = z;
        zonaSel.appendChild(o);
      });
      var optZonaOtra = document.createElement('option');
      optZonaOtra.value = ZONA_OTRA;
      optZonaOtra.textContent = 'Otra zona…';
      zonaSel.appendChild(optZonaOtra);

      zonaOtraIn = el('input');
      zonaOtraIn.type = 'text';
      zonaOtraIn.placeholder = 'Escribí la zona o el barrio';
      zonaOtraIn.hidden = true;
      zonaSel.addEventListener('change', function () {
        zonaOtraIn.hidden = zonaSel.value !== ZONA_OTRA;
        refrescarLinkDireccionFallback();
      });
      zonaOtraIn.addEventListener('input', refrescarLinkDireccionFallback);

      var lZona = el('label', 'cart-field');
      lZona.appendChild(el('span', null, 'Zona / barrio'));
      lZona.appendChild(zonaSel);
      lZona.appendChild(zonaOtraIn);

      // Sin clase con `display` propio: así el atributo `hidden` nativo del
      // navegador esconde el bloque sin que ninguna regla de CSS lo pise (ver
      // el mismo problema ya resuelto para `.cart-add [hidden]` más arriba).
      envioCampos = el('div', 'cart-envio-campos');
      envioCampos.hidden = true;
      envioCampos.appendChild(lDireccion);
      envioCampos.appendChild(direccionLinkFallback);
      envioCampos.appendChild(lZona);

      fechaIn = el('input');
      fechaIn.type = 'date';
      lFechaWrap = el('label', 'cart-field');
      lFechaWrap.appendChild(el('span', null, '¿Para cuándo lo necesitás?'));
      lFechaWrap.appendChild(fechaIn);

      // Solo el retiro elige fecha a mano; en envío el negocio la asigna
      // después de armar las rutas (ver la misma regla en envio-form.js).
      // Mismo interruptor entrega_propia que envio-form.js — este es el
      // camino de respaldo (envio-form.js no cargó), por eso chequea
      // window.MMEnvios con cuidado en vez de depender de que exista.
      entregaInfoFallback = el('p', 'cart-field-hint',
        (window.MMEnvios && MMEnvios.config().entrega_propia)
          ? 'Te lo entregamos en 1 a 3 días hábiles. Te confirmamos por WhatsApp el día y el horario exacto (de 9 a 13 o de 17 a 21).'
          : 'El envío lo coordinás vos: pedís un remis, Uber Moto o Uber Envíos que lo retire en el local y lo lleve a tu dirección. El costo del viaje lo pagás directo a quien te lo lleva.');
      entregaInfoFallback.hidden = true;
    }

    notaIn = el('textarea');
    notaIn.placeholder = 'Colores, aclaraciones…';
    var l3 = el('label', 'cart-field');
    l3.appendChild(el('span', null, 'Comentario (opcional)'));
    l3.appendChild(notaIn);

    var verCompleto = el('button', 'cart-ver-completo', 'Ver pedido completo (abre en otra pestaña)');
    verCompleto.type = 'button';
    verCompleto.addEventListener('click', abrirVistaCompleta);

    var send = el('button', 'cart-send', 'Enviar pedido por WhatsApp');
    send.type = 'button';
    send.addEventListener('click', enviar);

    var nota = el('p', 'cart-note',
      'Te vamos a responder confirmando disponibilidad, el total y cómo pagarlo. ' +
      'Los pedidos de la mañana se confirman durante el día.');

    sesionEl = el('p', 'cart-sesion');
    sesionEl.hidden = true;
    foot.appendChild(sesionEl);

    var entregaDiv = el('div');
    foot.appendChild(entregaDiv);
    if (usarModulo) {
      MMEnvioForm.montar(entregaDiv);
    } else {
      entregaDiv.appendChild(el('h3', 'cart-foot-t', 'Tus datos'));
      entregaDiv.appendChild(l1);
      entregaDiv.appendChild(l2);
      entregaDiv.appendChild(envioCampos);
      entregaDiv.appendChild(lFechaWrap);
      entregaDiv.appendChild(entregaInfoFallback);
    }
    foot.appendChild(l3);

    // El botón de enviar queda pegado abajo, fuera del scroll: es la salida de
    // la pantalla y tiene que estar siempre a la vista, sin importar cuánto
    // haya cargado el cliente.
    var barra = el('div', 'cart-enviar');
    barra.appendChild(verCompleto);
    barra.appendChild(send);
    barra.appendChild(nota);

    scroll.appendChild(lista);
    scroll.appendChild(totalCaja);
    scroll.appendChild(foot);

    panel.appendChild(head);
    panel.appendChild(scroll);
    panel.appendChild(barra);
    document.body.appendChild(panel);

    armarPicker();
    armarPanelFav();

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (pick.classList.contains('is-on')) cerrarPicker();
      else if (panelFav.classList.contains('is-on')) cerrarPanelFav();
      else if (panel.classList.contains('is-on')) cerrarPanel();
    });

    document.addEventListener('mm:sesion', pintarSesion);
    pintarSesion();
  }

  function elegirMetodo(m) {
    metodoEntrega = m;
    metodoRetiroBtn.classList.toggle('is-on', m === 'retiro');
    metodoEnvioBtn.classList.toggle('is-on', m === 'envio');
    envioCampos.hidden = m !== 'envio';
    lFechaWrap.hidden = m !== 'retiro';
    entregaInfoFallback.hidden = m !== 'envio';
  }

  // Cuenta de cliente (cuenta.js): si ese módulo no llegó a cargar,
  // `window.MMCuenta` no existe y esto no muestra nada — el panel sigue
  // funcionando exactamente igual que antes de que existiera la cuenta.
  function pintarSesion() {
    if (!sesionEl) return;
    if (!window.MMCuenta || !MMCuenta.sesionActiva()) { sesionEl.hidden = true; return; }
    sesionEl.innerHTML = '';
    sesionEl.hidden = false;
    var nombre = MMCuenta.nombre() || MMCuenta.email();
    sesionEl.appendChild(el('span', null, 'Conectado como '));
    sesionEl.appendChild(el('b', null, nombre));
    var salir = el('button', 'cart-sesion-out', 'Cerrar sesión');
    salir.type = 'button';
    salir.addEventListener('click', function () { MMCuenta.cerrarSesion(); });
    sesionEl.appendChild(salir);
    if (usarModulo) {
      MMEnvioForm.prefijar({
        nombre: MMCuenta.nombre(),
        direccion: MMCuenta.direccion && MMCuenta.direccion()
      });
      return;
    }
    if (!nombreIn.value.trim() && MMCuenta.nombre()) nombreIn.value = MMCuenta.nombre();
    if (!direccionIn.value.trim() && MMCuenta.direccion && MMCuenta.direccion()) {
      direccionIn.value = MMCuenta.direccion();
    }
  }

  function pintarCuenta() {
    var n = items.reduce(function (a, x) { return a + x.qty; }, 0);
    // El total al lado del contador, para irlo viendo sin abrir el panel. Con
    // renglones sin precio lleva "+" (12.400+) en vez de un número redondo que
    // se leería como el final del pedido.
    var r = resumen();
    var mini = (r.hayPrecios && r.conPrecio)
      ? plata(r.suma) + (r.sinPrecio ? '+' : '')
      : '';
    cuentas.forEach(function (c) {
      $('.cart-n', c).textContent = String(n);
      c.classList.toggle('is-on', n > 0);
      var m = $('.cart-mini', c);
      if (m) { m.textContent = mini; m.hidden = !mini || !n; }
    });
    // Con pedido empezado, "Seguí tu pedido" es la acción principal de la
    // portada y "Armá tu pedido" pasa a secundario: dos botones verdes iguales
    // uno al lado del otro no dicen cuál tocar primero.
    if (heroOtro) {
      heroOtro.classList.toggle('btn-primary', !n);
      heroOtro.classList.toggle('btn-ghost', n > 0);
    }
    if (panel.classList.contains('is-on')) pintarLista();
    else pintarTotal();
  }

  function pintarLista() {
    lista.innerHTML = '';
    pintarTotal();
    if (!items.length) {
      lista.appendChild(el('p', 'cart-empty',
        'Todavía no agregaste nada. Tocá "Agregar al pedido" en los productos que te gusten.'));
      return;
    }
    items.forEach(function (it) {
      var row = el('div', 'cart-item');

      if (it.img) {
        var im = el('img');
        im.src = it.img;
        im.alt = '';
        im.loading = 'lazy';
        row.appendChild(im);
      }

      var box = el('div', 'cart-item-in');
      box.appendChild(el('p', 'cart-item-t', it.title));
      if (it.variant) box.appendChild(el('p', 'cart-item-v', it.variant));
      if (it.code) box.appendChild(el('p', 'cart-item-c', 'Cód. ' + it.code));

      // Precio del renglón. Con más de una unidad se muestra la cuenta
      // ("2 × $3.100 = $6.200") para que el total de abajo se pueda verificar
      // de un vistazo y no haya que confiar en él.
      var u = precioUnidad(it);
      if (u > 0) {
        box.appendChild(el('p', 'cart-item-p', it.qty > 1
          ? it.qty + ' × ' + plata(u) + ' = ' + plata(u * it.qty)
          : plata(u)));
      } else if (window.MMPrecios) {
        box.appendChild(el('p', 'cart-item-p is-pend', 'Precio a confirmar'));
      }

      var q = el('div', 'cart-qty');
      // El renglón se identifica por su clave, no por su posición: quitar algo
      // reordena la lista y un índice guardado apuntaría a otro producto.
      var k = clave(it);
      q.appendChild(pasoDeCantidad(it.title + (it.variant ? ' ' + it.variant : ''),
        function () { var x = porClave(k); return x ? x.qty : 0; },
        function (n) {
          var x = porClave(k);
          if (!x) return;
          if (n <= 0) items.splice(items.indexOf(x), 1); else x.qty = n;
          guardar(); pintarLista();
        }));

      var del = el('button', 'cart-del', 'Quitar');
      del.type = 'button';
      del.addEventListener('click', function () {
        var x = porClave(k);
        if (x) items.splice(items.indexOf(x), 1);
        guardar(); pintarLista();
      });
      q.appendChild(del);

      box.appendChild(q);
      row.appendChild(box);
      lista.appendChild(row);
    });
  }

  function porClave(k) {
    var enc = null;
    items.forEach(function (x) { if (clave(x) === k) enc = x; });
    return enc;
  }

  /* --- Total del pedido --------------------------------------------------
   * Los precios los trae assets/precios.js desde la planilla y los deja en
   * window.MMPrecios. Puede no estar (página sin precios.js, o Google que no
   * contestó): en ese caso el carrito se comporta como antes, sin totales.
   *
   * Hoy 249 de las 321 tarjetas todavía no tienen código del POS cargado, así
   * que un pedido mezcla renglones con precio y sin precio. Sumar solo los que
   * tienen y llamar a eso "Total" sería un número que el cliente lee como el
   * final y no lo es. Cuando falta alguno se dice "Subtotal" y se aclara
   * cuántos faltan. */
  function precioUnidad(it) {
    if (!window.MMPrecios || !it.code) return 0;
    return MMPrecios.de(it.code) || 0;
  }

  function plata(n) {
    return (window.MMPrecios && MMPrecios.formato) ? MMPrecios.formato(n) : ('$ ' + n);
  }

  function resumen() {
    var r = { suma: 0, conPrecio: 0, sinPrecio: 0, hayPrecios: !!window.MMPrecios };
    items.forEach(function (it) {
      var u = precioUnidad(it);
      if (u > 0) { r.suma += u * it.qty; r.conPrecio++; }
      else r.sinPrecio++;
    });
    r.completo = r.conPrecio > 0 && r.sinPrecio === 0;
    return r;
  }

  function pintarTotal() {
    if (!totalCaja) return;
    var r = resumen();
    totalCaja.innerHTML = '';
    // Con el carrito vacío, o en una página sin precios.js, no hay nada que
    // decir sobre un total.
    if (!r.hayPrecios || !items.length) { totalCaja.hidden = true; return; }
    totalCaja.hidden = false;

    // Ningún renglón tiene precio todavía: no hay un número que mostrar, pero
    // abrir el carrito y no ver ni una palabra sobre el total es peor que
    // decir derecho que todavía no se puede calcular. Antes esta caja
    // directamente desaparecía en este caso.
    if (!r.conPrecio) {
      totalCaja.appendChild(el('p', 'cart-total-n cart-total-pend',
        items.length === 1
          ? 'Todavía no tenemos el precio de este producto. Te lo confirmamos por WhatsApp.'
          : 'Todavía no tenemos el precio de estos productos. Te los confirmamos por WhatsApp.'));
      return;
    }

    var fila = el('div', 'cart-total-l');
    fila.appendChild(el('span', null, r.completo ? 'Total' : 'Subtotal'));
    fila.appendChild(el('strong', null, plata(r.suma)));
    totalCaja.appendChild(fila);

    if (r.sinPrecio) {
      totalCaja.appendChild(el('p', 'cart-total-n',
        r.sinPrecio === 1
          ? 'Falta el precio de 1 producto, te lo confirmamos por WhatsApp.'
          : 'Faltan los precios de ' + r.sinPrecio + ' productos, te los confirmamos por WhatsApp.'));
    } else {
      totalCaja.appendChild(el('p', 'cart-total-n',
        'No incluye el envío. Confirmamos disponibilidad y total por WhatsApp.'));
    }
  }

  function abrirPanel() {
    pintarLista();
    scrim.classList.add('is-on');
    panel.classList.add('is-on');
    trabarFondo(true);
    var b = $('.cart-x', panel);
    if (b) b.focus();
  }

  function cerrarPanel() {
    panel.classList.remove('is-on');
    if (!pick.classList.contains('is-on') && !(panelFav && panelFav.classList.contains('is-on'))) {
      scrim.classList.remove('is-on');
      trabarFondo(false);
    }
  }

  // --- Panel "Mis favoritos" -----------------------------------------------
  // Mismo shell que el panel del pedido (.cart-panel), para que se sienta
  // parte del mismo carrito y no un widget aparte.
  var panelFav, listaFav;

  function armarPanelFav() {
    panelFav = el('aside', 'cart-panel');
    panelFav.setAttribute('role', 'dialog');
    panelFav.setAttribute('aria-modal', 'true');
    panelFav.setAttribute('aria-label', 'Mis favoritos');

    var head = el('div', 'cart-head');
    head.appendChild(el('h2', null, 'Mis favoritos'));
    var x = el('button', 'cart-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Cerrar');
    x.addEventListener('click', cerrarPanelFav);
    head.appendChild(x);

    var scroll = el('div', 'cart-scroll');
    listaFav = el('div', 'cart-body');
    scroll.appendChild(listaFav);

    panelFav.appendChild(head);
    panelFav.appendChild(scroll);
    document.body.appendChild(panelFav);
  }

  function pintarListaFav() {
    listaFav.innerHTML = '';
    var claves = Object.keys(favoritos);
    if (!claves.length) {
      listaFav.appendChild(el('p', 'cart-empty',
        'Todavía no marcaste ningún favorito. Tocá el corazón en los productos que te gusten.'));
      return;
    }
    claves.forEach(function (k) {
      var f = favoritos[k];
      var row = el('div', 'cart-item');
      if (f.img) {
        var im = el('img');
        im.src = f.img;
        im.alt = '';
        im.loading = 'lazy';
        row.appendChild(im);
      }
      var box = el('div', 'cart-item-in');
      box.appendChild(el('p', 'cart-item-t', f.title));
      var acciones = el('div', 'cart-qty');
      if (f.url) {
        var ver = el('a', 'cart-fav-ver', 'Ver producto');
        ver.href = f.url;
        acciones.appendChild(ver);
      }
      var del = el('button', 'cart-del', 'Quitar');
      del.type = 'button';
      del.addEventListener('click', function () {
        delete favoritos[k];
        guardarFavoritosLS();
        pintarListaFav();
        sincronizarBotonesFav();
      });
      acciones.appendChild(del);
      box.appendChild(acciones);
      row.appendChild(box);
      listaFav.appendChild(row);
    });
  }

  function abrirPanelFav() {
    pintarListaFav();
    scrim.classList.add('is-on');
    panelFav.classList.add('is-on');
    trabarFondo(true);
  }

  function cerrarPanelFav() {
    panelFav.classList.remove('is-on');
    if (!pick.classList.contains('is-on') && !panel.classList.contains('is-on')) {
      scrim.classList.remove('is-on');
      trabarFondo(false);
    }
  }

  // --- Armado del mensaje -------------------------------------------------
  // `entrega` es opcional: sólo lo manda enviarAhora() cuando usarModulo es
  // true, para que pedido.html también pueda mostrar el bloque "Entrega".
  // El guard `if (!Array.isArray(datos))` que ya tiene pedido.html hace
  // gratis la rama vieja (sin entrega) para links ya compartidos.
  function urlPedido(entrega, vistaCliente) {
    var base = SITIO;
    if (!base && location.protocol !== 'file:') {
      base = location.origin + location.pathname.replace(/[^/]*$/, '');
    }
    if (!base) return '';                       // abierto como archivo local
    if (!/\/$/.test(base)) base += '/';

    // El pedido viaja DENTRO del link (no hay base de datos): pedido.html lo
    // decodifica y dibuja las fotos. Se mandan sólo los campos mínimos; la
    // foto la resuelve la página desde el catálogo.
    var lista = items.map(function (it) {
      var o = { t: it.title, q: it.qty };
      if (it.variant) o.v = it.variant;
      if (it.code) o.c = it.code;
      if (it.img) o.i = it.img;
      return o;
    });
    var payload = entrega ? { i: lista, e: entrega } : lista;
    // ?vista=cliente: mismo visor, pero pedido.html se salta el bloque
    // "Para confirmar" (son instrucciones para quien atiende el WhatsApp,
    // no para el cliente que sólo lo está revisando antes de mandarlo).
    var qs = vistaCliente ? '?vista=cliente' : '';
    return base + 'pedido.html' + qs + '#' + base64url(JSON.stringify(payload));
  }

  // Botón "Ver pedido completo": abre el mismo visor de pedido.html con lo
  // que hay cargado AHORA (items + lo que ya llenó del formulario de
  // entrega, esté completo o no) en una pestaña nueva, sin tocar el panel
  // — es sólo para revisar producto por producto antes de mandarlo, no
  // reemplaza el panel para editar.
  function abrirVistaCompleta() {
    if (!items.length) { alert('Tu pedido está vacío.'); return; }
    var entrega = usarModulo && MMEnvioForm.leer ? MMEnvioForm.leer() : null;
    var link = urlPedido(entrega, true);
    if (!link) { alert('Esto sólo funciona en el sitio publicado, no abriendo el archivo local.'); return; }
    window.open(link, '_blank', 'noopener');
  }

  // Reformatea "yyyy-mm-dd" (lo que da <input type="date">) a "dd/mm/aaaa"
  // a mano, en vez de `new Date(iso)`: ese constructor interpreta la fecha
  // en UTC y en husos horarios negativos (como Argentina) puede mostrar el
  // día anterior.
  function fechaLegible(iso) {
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function enviar() {
    if (!items.length) { alert('Tu pedido está vacío.'); return; }
    if (usarModulo) {
      var v = MMEnvioForm.validar();
      if (!v.ok) { alert(v.mensaje); return; }
    }
    // Cuenta de cliente: si cuenta.js cargó y no hay sesión, se pide antes de
    // seguir. `pedirSesion` reintenta este mismo `enviar` al loguear/crear
    // la cuenta, así que de acá para abajo el flujo es exactamente el de
    // siempre. Si cuenta.js no está, no se pide nada (ver comentario en
    // pintarSesion más arriba).
    if (window.MMCuenta && !MMCuenta.sesionActiva()) { MMCuenta.pedirSesion(enviar); return; }
    enviarAhora();
  }

  function enviarAhora() {
    var L = [];
    L.push('*Pedido desde la web* — Mundo Mágico');
    L.push('');
    items.forEach(function (it) {
      var linea = '• ' + it.qty + 'x ';
      if (it.code) linea += '[' + it.code + '] ';
      linea += it.title;
      if (it.variant) linea += ' — ' + it.variant;
      var u = precioUnidad(it);
      if (u > 0) linea += ' — ' + plata(u * it.qty);
      L.push(linea);
    });
    L.push('');

    // El mismo número que el cliente vio en el panel. Si no coincidiera con lo
    // que manda, el empleado tendría que discutir un total que la web mostró.
    var res = resumen();
    if (res.hayPrecios && res.conPrecio) {
      L.push((res.completo ? '*Total:* ' : '*Subtotal:* ') + plata(res.suma) +
        (res.completo ? '' : ' (' + res.sinPrecio + ' sin precio)'));
      L.push('');
    }

    var d = usarModulo ? MMEnvioForm.leer() : null;
    var nom = usarModulo ? d.nombre : nombreIn.value.trim();
    var metodo = usarModulo ? d.metodoEntrega : metodoEntrega;
    var direccion = usarModulo ? d.direccion : direccionIn.value.trim();
    var zona = usarModulo ? d.zonaNombre : (zonaSel.value === ZONA_OTRA ? zonaOtraIn.value.trim() : zonaSel.value);
    var fecha = usarModulo ? d.fechaEntrega : fechaIn.value; // yyyy-mm-dd o ''
    var not = notaIn.value.trim();

    if (nom) L.push('*Nombre:* ' + nom);
    if (usarModulo) {
      L.push.apply(L, MMEnvioForm.resumenTexto());
    } else if (metodo === 'envio') {
      var entTxt = 'Envío';
      if (zona) entTxt += ' — ' + zona;
      if (direccion) entTxt += ' (' + direccion + ')';
      L.push('*Entrega:* ' + entTxt);
      // El envío a domicilio ya no elige fecha: se confirma después (ver
      // elegirMetodo/entregaInfoFallback y la misma regla en envio-form.js).
      L.push((window.MMEnvios && MMEnvios.config().entrega_propia)
        ? '*Entrega estimada:* 1 a 3 días hábiles. Te confirmamos el día y el horario (de 9 a 13 o de 17 a 21) por WhatsApp.'
        : '*Envío:* lo coordina y paga el cliente (remis/Uber Moto/Uber Envíos) — retira en el local.');
    } else {
      L.push('*Entrega:* Retiro en el local');
      if (fecha) L.push('*Para cuándo:* ' + fechaLegible(fecha));
    }
    if (not) L.push('*Comentario:* ' + not);

    var link = urlPedido(usarModulo ? d : null);
    if (link) { L.push(''); L.push('Ver el pedido con fotos: ' + link); }

    L.push('');
    L.push('_Enviado desde la web. Espero confirmación de disponibilidad y total._');

    // Guarda una copia en el historial de pedidos del cliente (Perfil → Mis
    // pedidos) y, con los campos estructurados, en el panel de administración
    // (admin-pedidos.html) para poder agrupar por fecha/zona/estado. No
    // bloquea el envío por WhatsApp: si falla (por ejemplo, las columnas
    // nuevas todavía no se agregaron en Supabase — ver
    // supabase/pedidos_envio.sql) el pedido se manda igual.
    if (window.MMCuenta && MMCuenta.sesionActiva && MMCuenta.sesionActiva() && MMCuenta.guardarPedido) {
      var itemsGuardar = items.map(function (it) {
        var o = { t: it.title, q: it.qty };
        if (it.variant) o.v = it.variant;
        if (it.code) o.c = it.code;
        return o;
      });
      var pedidoGuardar = usarModulo ? {
        items: itemsGuardar,
        nombre: d.nombre,
        metodoEntrega: d.metodoEntrega,
        direccion: d.direccion,
        zona: d.zonaNombre,
        fechaEntrega: d.fechaEntrega,
        nota: not,
        telefono: d.telefono,
        zonaId: d.zonaId,
        sucursalId: d.sucursalId,
        franjaId: d.franjaId,
        entreCalles: d.entreCalles,
        pisoDepto: d.pisoDepto,
        receptorNombre: d.receptorNombre,
        receptorTelefono: d.receptorTelefono,
        bultos: d.bultos,
        envioInmediato: d.envioInmediato
      } : {
        items: itemsGuardar,
        nombre: nom,
        metodoEntrega: metodo,
        direccion: metodo === 'envio' ? direccion : '',
        zona: metodo === 'envio' ? zona : '',
        fechaEntrega: fecha,
        nota: not
      };
      MMCuenta.guardarPedido(pedidoGuardar).then(function () {}, function () {});
    }

    var waUrl = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(L.join('\n'));
    // Si el pedido se reanuda después de crear la cuenta/loguearse, cuenta.js
    // ya dejó una pestaña en blanco abierta (ver comentario en cuenta.js:
    // window.open no funciona acá porque el permiso del clic original ya
    // expiró mientras se esperaba la respuesta de Supabase). Si no hay
    // ninguna pendiente — el caso normal, con sesión ya activa — se abre una
    // nueva como siempre.
    var ventana = (window.MMCuenta && MMCuenta.tomarVentana) ? MMCuenta.tomarVentana() : null;
    if (ventana) ventana.location.href = waUrl;
    else window.open(waUrl, '_blank', 'noopener');
  }

  // --- Arranque ----------------------------------------------------------
  function montarTodo() {
    montarBotones();
    montarBotonesReel();
    montarFavoritos();
  }

  window.MMFavoritos = {
    abrir: function () { if (panelFav) abrirPanelFav(); },
    estaEnFavoritos: function (cat, title) { return !!favoritos[(cat || '') + '::' + title]; },
    toggle: function (card) { var b = $('.pcard-fav', card); if (b) toggleFavorito(card, b); }
  };

  function iniciar() {
    cargar();
    cargarFavoritos();
    armarUI();
    montarTodo();
    pintarCuenta();

    // La ficha del producto ofrece un cajón para la acción principal: nos
    // anotamos para llenarlo. Se prueba las dos veces —ahora y por evento—
    // para no depender del orden de los <script>: hoy site.js va antes, pero
    // si algún día se invierte esto sigue funcionando.
    function engancharFicha() {
      if (window.MMFicha) MMFicha.alAbrir(llenarFichaCarrito);
    }
    engancharFicha();
    document.addEventListener('mm:ficha', engancharFicha);

    // Los precios llegan de la red, así que el primer dibujado del carrito casi
    // siempre pasa antes. assets/precios.js avisa cuando están y acá se rehace
    // la cuenta: sin esto, quien abre la página con el carrito ya cargado ve
    // "Precio a confirmar" en todo hasta recargar.
    //
    // Además se rearman los modelos: ese mismo aviso significa que ya están los
    // data-pos-ok, o sea los códigos definitivos de cada opción.
    document.addEventListener('mm:precios', function () {
      releerModelos();
      pintarCuenta();
      pintarControles();
    });

    // Los filtros redibujan tarjetas y Explorar arma y destruye slides a
    // medida que se scrollea: se vuelven a montar los botones cuando aparece
    // contenido nuevo, sin duplicar los que ya están.
    if (window.MutationObserver) {
      // En el reel esto se dispara en ráfagas de decenas de mutaciones por
      // deslizamiento; sin agruparlas recorreríamos el DOM entero en cada una,
      // justo mientras corre la animación de scroll.
      // setTimeout y no requestAnimationFrame: rAF no corre mientras la
      // pestaña está oculta, y el cliente que se va a WhatsApp y vuelve tiene
      // que encontrar los botones puestos, no esperando al primer cuadro.
      var pendiente = 0;
      var mo = new MutationObserver(function () {
        if (pendiente) return;
        pendiente = setTimeout(function () { pendiente = 0; montarTodo(); }, 0);
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
