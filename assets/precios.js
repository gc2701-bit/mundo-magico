/* Precios en la web, editables desde Supabase. VERSIÓN DE PRUEBA.
 *
 * Hasta acá los precios salían de una Google Sheet publicada; ahora salen de
 * Supabase (tabla catalogo_precios), editable en el lugar desde el propio
 * catálogo con una cuenta de admin — ver assets/admin-catalogo.js. De dónde
 * sale el dato ya NO lo decide este archivo: lo decide assets/catalogo.js
 * (window.MMCatalogo), que se carga antes que este y tiene su propia
 * cascada (Supabase → último bueno en localStorage → respaldo local →
 * nada). Acá sólo queda la parte que no cambió: CÓMO se resuelve el código
 * de una tarjeta y CÓMO se pinta.
 *
 * Cómo se identifica cada producto: por el código del POS, con los mismos
 * lugares donde lo busca assets/carrito.js, para que el precio que se ve y el
 * código que le llega al empleado sean siempre del mismo artículo. Se prueban
 * en este orden y gana el primero que TENGA precio cargado:
 *   codigo_override de catalogo_tarjetas (admin-catalogo.js) → data-pos de la
 *   variante → data-pos de la tarjeta → catalogo_fotos (antes, pestaña
 *   "Códigos" de la Sheet) → número al final del nombre de la foto
 *   ("... 01848.jpeg") → assets/pos-codes.js (el mapa viejo).
 *
 * Ese orden importa: el número del nombre de la foto es una adivinanza y va
 * después de catalogo_fotos, porque hay fotos que terminan en un número que no
 * es un código del POS y taparían el código que alguien cargó a mano.
 *
 * codigo_override va primero que todo, incluso antes que data-pos: es la
 * forma de corregir un código mal resuelto SIN tocar el HTML (data-pos vive
 * en el HTML, no se puede pisar desde acá). Si un admin lo carga, gana
 * siempre — ver assets/admin-catalogo.js.
 *
 * Los códigos se comparan EXACTOS, con sus ceros de adelante. En el export del
 * POS hay 79 pares que coinciden al quitar los ceros y NO son el mismo
 * producto ('01985' es un globo de $4.000, '1985' un disfraz de $21.000). El
 * mapa de alias sin ceros (window.__PRECIOS_ALIAS__, assets/precios-datos.js)
 * solo cubre los casos de un único código posible, y sigue viviendo ahí: no
 * tiene que ver con qué tan al día está el precio, así que no se migró.
 */
(function () {
  'use strict';

  // Quién sabe leer una tarjeta (data-talles, data-incluye, el código al final
  // del nombre de la foto) es assets/producto.js, que se carga antes que este
  // archivo en todas las páginas. Acá sólo se calculan precios. Si falta, se
  // avisa fuerte en la consola en vez de pintar precios a medias.
  var P = window.MMProducto;
  if (!P) {
    if (window.console) console.error('precios.js necesita assets/producto.js cargado antes.');
    return;
  }

  var fmt = new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  });

  /* --------------------------------------------------------------- lectura */

  var codigoDeImagen = P.codigoDeImagen;

  function rutaLimpia(src) {
    try { return decodeURIComponent(src || ''); } catch (e) { return src || ''; }
  }

  /* ---------------------------------------------------------------- pintar */

  // El precio de un código suelto. Se usa acá para pintar las tarjetas y lo
  // reutiliza el carrito (a través de window.MMPrecios) para sumar el total.
  function hacerBuscador(precios, alias) {
    return function (codigo) {
      if (!codigo) return 0;
      codigo = String(codigo).trim();
      if (precios[codigo] > 0) return precios[codigo];
      var real = alias[codigo.replace(/^0+/, '') || '0'];
      return (real && precios[real] > 0) ? precios[real] : 0;
    };
  }

  function Resolutor(precios, codigos, alias) {
    // Mapa viejo por ruta de imagen (assets/pos-codes.js), que sigue sirviendo
    // como respaldo si catalogo_fotos todavía no tiene esa foto cargada.
    var viejo = window.__POS_CODES__ || {};
    var precioDe = hacerBuscador(precios, alias);

    // Los candidatos a código de un producto, del más confiable al menos.
    //
    // El número al final del nombre de la foto va DESPUÉS de catalogo_fotos a
    // propósito: es una adivinanza. Muchas fotos terminan en un número que no
    // es un código del POS ("Velas largas metalizadas 21818"), y si esa
    // adivinanza ganara, el código que un admin cargó a mano para arreglar
    // justo ese caso no se usaría nunca.
    function candidatos(nodo, foto, heredado, override) {
      var ruta = rutaLimpia(foto);
      return [
        override || '',
        (nodo && nodo.getAttribute && nodo.getAttribute('data-pos')) || '',
        heredado || '',
        codigos[ruta] || '',
        codigoDeImagen(ruta),
        viejo[foto] || viejo[ruta] || ''
      ];
    }

    // Para los códigos que vienen sueltos en un atributo (data-talles), sin
    // foto ni tarjeta de la cual deducirlos.
    this.precioDeCodigo = precioDe;

    // Se queda con el primer candidato que TENGA precio, no con el primero que
    // exista: un código presente pero sin precio cargado no debe tapar al
    // siguiente, que sí puede resolver.
    //
    // Devuelve TAMBIÉN cuál ganó, no sólo el número. El carrito necesita ese
    // código: si la ficha muestra el precio de un código y el pedido viaja con
    // otro, el cliente y el empleado están mirando dos artículos distintos.
    //
    // `override` es codigo_override de catalogo_tarjetas (candidato de más
    // prioridad, ver el comentario de cabecera) — undefined para cualquier
    // llamada que no venga de preciosDeTarjeta (data-talles, combos).
    this.resolver = function (nodo, foto, heredado, override) {
      var c = candidatos(nodo, foto, heredado, override);
      for (var i = 0; i < c.length; i++) {
        var p = precioDe(c[i]);
        if (p > 0) return { code: c[i], precio: p };
      }
      return { code: '', precio: 0 };
    };

    this.precio = function (nodo, foto, heredado) {
      return this.resolver(nodo, foto, heredado).precio;
    };
  }

  // Todos los precios que se pueden resolver para una tarjeta: el de la
  // tarjeta y el de cada variante con foto propia.
  //
  // De paso deja anotado en el DOM (data-pos-ok) QUÉ código ganó en cada caso.
  // Ese es el aporte para el resto del sitio: el carrito y la ficha lo leen
  // (ver assets/producto.js) y así el código que viaja en el pedido es
  // exactamente el mismo del precio que el cliente tiene en pantalla.
  function preciosDeTarjeta(card, R, override) {
    var base = card.getAttribute('data-pos') || '';
    var fotos = card.querySelectorAll('.gtrack img');
    var lista = [];

    // Una galería comparte UN solo código (ver admin-catalogo.js/analizar):
    // el override, si está cargado, se aplica igual a todas las fotos —
    // exactamente lo mismo que ya pasa hoy con `base` (data-pos) más abajo.
    if (fotos.length > 1) {
      for (var i = 0; i < fotos.length; i++) {
        var cap = (fotos[i].getAttribute('data-cap') || '').trim();
        // "Todos los colores" es la foto del set completo, no un color pedible.
        if (!cap || /^todos\b/i.test(cap)) continue;
        var r = R.resolver(fotos[i], fotos[i].getAttribute('src'), base, override);
        if (r.precio > 0) {
          // Tal cual salió, sin normalizar: los ceros de adelante distinguen
          // productos distintos ('01985' globo vs '1985' disfraz).
          fotos[i].setAttribute('data-pos-ok', r.code);
          lista.push(r.precio);
        }
      }
    }
    if (!lista.length) {
      var img = card.querySelector('.pcard-ph img');
      var uno = R.resolver(img, img && img.getAttribute('src'), base, override);
      if (uno.precio > 0) {
        card.setAttribute('data-pos-ok', uno.code);
        lista.push(uno.precio);
      }
    }
    return lista;
  }

  // El precio va DEBAJO de la foto, en el flujo normal de .pcard-body — no
  // flotando encima de la imagen. Antes era position:absolute pegado a la
  // foto, y se rompía justo al terminar la animación .reveal con la que
  // aparece la tarjeta: esa animación anima con transform, y mientras dura
  // ese transform se vuelve el "ancla" del precio; en el instante en que
  // termina y el transform se saca, el precio pierde esa ancla y salta a
  // pegarse contra el borde de algún contenedor mucho más arriba en la
  // página — se veía como el precio "roto" arriba a la derecha. En flujo
  // normal no hay ancla que perder: no puede saltar.
  function pintarTexto(card, texto, precioBase) {
    card.dataset.price = precioBase;
    var body = card.querySelector('.pcard-body');
    // El .pricetag se busca en TODA la tarjeta, no sólo en .pcard-body: los
    // combos traen el suyo escrito a mano dentro de .pcard-ph, y buscándolo
    // ahí también se evita duplicarlo si ya existe.
    var tag = card.querySelector('.pricetag');
    if (tag) return;
    tag = document.createElement('span');
    tag.className = 'pricetag';
    // Marca de origen: sólo estas etiquetas las puede borrar repintar() al
    // repintar tras una edición. Las de los combos (escritas a mano en el
    // HTML, dentro de .pcard-ph) no llevan esta marca y no se tocan.
    tag.setAttribute('data-mm-precio', '1');
    tag.textContent = texto;
    var h3 = body && body.querySelector('h3');
    if (h3 && h3.nextSibling) body.insertBefore(tag, h3.nextSibling);
    else if (body) body.appendChild(tag);
  }

  // El precio_fijo de un combo (admin-catalogo.js) es distinto de un precio
  // calculado: tiene que PISAR el .pricetag aunque ya exista uno escrito a
  // mano en el HTML — si no, la tarjeta seguiría mostrando el precio viejo
  // mientras la ficha (que lee dataset.price) ya mostraría el nuevo.
  function pintarPrecioFijo(card, precio) {
    var texto = fmt.format(precio);
    card.dataset.price = texto;
    var tag = card.querySelector('.pricetag');
    if (tag) { tag.textContent = texto; return; }
    pintarTexto(card, texto, texto);
  }

  function pintar(card, lista) {
    var min = Math.min.apply(null, lista);
    var max = Math.max.apply(null, lista);
    // Si los colores de una misma tarjeta no valen igual, mostrar uno solo es
    // mentirle al que elija otro: se muestra "desde".
    var texto = (min === max) ? fmt.format(min) : 'desde ' + fmt.format(min);
    // Los dos van con el mismo texto: el segundo es lo que lee la ficha del
    // producto (assets/site.js) al abrirla. Si acá fuera solo el número sin
    // "desde", la ficha mostraría un precio fijo donde en realidad varía
    // según el color — mismo motivo que el fix de pintarTalles.
    pintarTexto(card, texto, texto);
  }

  // Tarjeta con data-talles: un precio por opción ("Chico:9283;Grande:4228").
  // Solo se cuentan las opciones que ya tienen precio cargado; si no hay
  // ninguna, la tarjeta queda sin precio como cualquier otra.
  //
  // Va "desde $mínimo" y no la lista entera: el detalle por opción ya no hace
  // falta guardarlo acá, porque la ficha resuelve el precio exacto del código
  // de la opción que el cliente elige (ver assets/carrito.js).
  function pintarTalles(card, talles, R) {
    var precios = [];
    talles.forEach(function (t) {
      var p = R.precioDeCodigo(t.code);
      if (p > 0) precios.push(p);
    });
    if (!precios.length) return false;

    var min = Math.min.apply(null, precios);
    var max = Math.max.apply(null, precios);
    var pill = (min === max) ? fmt.format(min) : 'desde ' + fmt.format(min);
    pintarTexto(card, pill, pill);
    return true;
  }

  // Combo (data-incluye): el precio NO es el mínimo de sus partes ni la lista
  // de todas — es lo que sale el combo. Dos casos:
  //
  //   1. La tarjeta ya trae data-price escrito a mano. Ese es el precio
  //      negociado del combo (casi siempre MENOR que la suma de las partes) y
  //      manda: no se toca nada.
  //   2. No lo trae. Se suma, y sólo se publica si TODOS los componentes
  //      resolvieron. Una suma a la que le falta un componente es publicar un
  //      precio de menos sin que nadie se entere; mejor mudo que barato.
  function pintarIncluye(card, comps, R) {
    if (card.getAttribute('data-price')) return false;

    var total = 0;
    for (var i = 0; i < comps.length; i++) {
      var p = R.precioDeCodigo(comps[i].code);
      if (!(p > 0)) return false;
      total += p;
    }
    if (!total) return false;

    var texto = fmt.format(total);
    pintarTexto(card, texto, texto);
    return true;
  }

  // Mismo slug que assets/site.js (slugify) y assets/explorar.js (slug): NFD,
  // saca diacríticos, todo lo que no sea a-z0-9 se vuelve '-'. Tiene que
  // coincidir a mano con esas dos — es la clave que usa admin-catalogo.js
  // para guardar "ocultar"/"sin stock de tarjeta" en catalogo_tarjetas.
  function slug(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // La página actual, SIEMPRE con ".html" al final — sin esto, si Netlify
  // sirve las URLs "lindas" (sin extensión, "Pretty URLs" en Post
  // processing) esto da "disfraces-v2" en vez de "disfraces-v2.html", que es
  // como está guardado (pagina, slug) en catalogo_tarjetas/catalogo_productos
  // — nunca coincidirían y una tarjeta ocultada/movida/un producto nuevo
  // dejarían de aplicar en silencio en esta página.
  function paginaDeUrl() {
    var partes = location.pathname.split('/').filter(Boolean);
    var seg = partes.length ? partes[partes.length - 1] : 'index';
    return /\.html?$/i.test(seg) ? seg : seg + '.html';
  }

  function claveDe(card) {
    var h3 = card.querySelector('.pcard-body h3');
    return paginaDeUrl() + '~' + slug(h3 ? h3.textContent.trim() : '');
  }

  // Una tarjeta dibujada por catalogo-productos.js NO es una tarjeta del
  // HTML: su fila es la de catalogo_productos, donde "sacar de la web" es
  // `publicado` y el precio sale de su propio código. El override de
  // catalogo_tarjetas se busca por (página, slug del <h3>), así que
  // aplicárselo la haría heredar el de CUALQUIER tarjeta del HTML que tenga
  // el mismo título.
  //
  // No es hipotético: al convertir una tarjeta en producto dejándola en su
  // mundo (admin-catalogo.js), la original queda oculta y el producto nuevo
  // conserva el título — misma clave. Sin este corte, el producto recién
  // creado nacía invisible.
  function overrideDe(card, tarjetas) {
    if (card.hasAttribute('data-mm-producto-id')) return undefined;
    return tarjetas[claveDe(card)];
  }

  /* ------------------------------------------------------ subcategorías */
  // Mover una tarjeta a la subcategoría que le asignó admin-catalogo.js.
  // Solo dentro del MISMO mundo: una subcategoría es siempre de una sola
  // página (supabase/catalogo_03_subcategorias.sql), así que si
  // subcategoriaId apunta a otro mundo acá no hay nada que mover — eso lo
  // resuelve "mover a otro mundo" en admin-catalogo.js convirtiendo la
  // tarjeta en catalogo_productos, no reubicando el nodo del HTML.
  var paginaActual = paginaDeUrl();

  // Crea la <section class="catsec"> igual a las que ya están escritas a
  // mano, ANTES de "Seguí explorando otros mundos". SIN la clase "reveal":
  // site.js arma su IntersectionObserver corriendo en paralelo (no espera a
  // DOMContentLoaded), así que una .reveal creada después de eso nunca sería
  // observada y quedaría en opacity:0 para siempre.
  function crearSeccion(sub) {
    var section = document.createElement('section');
    section.className = 'catsec';
    section.id = 'cat-' + sub.slug;
    var wrap = document.createElement('div');
    wrap.className = 'wrap';
    var head = document.createElement('div');
    head.className = 'catsec-head is-visible';
    var h2 = document.createElement('h2');
    h2.textContent = sub.nombre;
    head.appendChild(h2);
    var pgrid = document.createElement('div');
    pgrid.className = 'pgrid';
    wrap.appendChild(head);
    wrap.appendChild(pgrid);
    section.appendChild(wrap);

    var otros = document.querySelector('main > section.otros');
    var main = document.querySelector('main');
    if (otros && otros.parentNode) otros.parentNode.insertBefore(section, otros);
    else if (main) main.appendChild(section);

    return pgrid;
  }

  // Primero se busca el id TAL CUAL (una sección migrada desde el HTML
  // trae el id que ya tenía escrito a mano, ej. "cortinas" — ver
  // .claude/gen-subcategorias-sql.js) y recién si no existe se prueba con
  // el prefijo "cat-" que usa crearSeccion() para las que nacen 100% desde
  // el navegador. Sin este orden, una subcategoría migrada terminaría
  // creando una <section> DUPLICADA en vez de reusar la que ya está.
  function pgridDe(sub) {
    var existente = document.getElementById(sub.slug) || document.getElementById('cat-' + sub.slug);
    if (existente) return existente.querySelector('.pgrid');
    return crearSeccion(sub);
  }

  function reubicar(tarjetas, subcategorias) {
    var cards = document.querySelectorAll('.pcard');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var tarjetaOv = overrideDe(card, tarjetas);
      var subId = tarjetaOv && tarjetaOv.subcategoriaId;
      if (!subId) continue;
      var sub = subcategorias[subId];
      if (!sub || sub.pagina !== paginaActual) continue;
      var pgrid = pgridDe(sub);
      if (pgrid && card.parentNode !== pgrid) pgrid.appendChild(card);
    }
  }

  // Una sección que se quedó sin ninguna tarjeta visible (todas ocultas,
  // agotadas-y-escondidas, o movidas a otra subcategoría) no debe quedar
  // mostrando un título sin nada debajo.
  function ocultarSeccionesVacias() {
    var secciones = document.querySelectorAll('.catsec');
    for (var i = 0; i < secciones.length; i++) {
      var grid = secciones[i].querySelector('.pgrid');
      var visibles = grid ? grid.querySelectorAll('.pcard:not([hidden])').length : 0;
      secciones[i].hidden = visibles === 0;
    }
  }

  // A qué subcategoría corresponde esta <section> de ESTA página — mismo
  // criterio de pgridDe() (id tal cual, o con el prefijo "cat-"), en el
  // sentido inverso: de la sección a la subcategoría, no al revés.
  function subcategoriaDeSeccion(section, subcategorias) {
    var domId = section.id;
    for (var id in subcategorias) {
      var s = subcategorias[id];
      if (s.pagina !== paginaActual) continue;
      if (s.slug === domId || ('cat-' + s.slug) === domId) return s;
    }
    return null;
  }

  // El campo "orden" de cada subcategoría (admin-catalogo.js) no sirve de
  // nada si nadie lo lee para de verdad reacomodar las secciones — esto es
  // lo que lo hace real. Las que no resuelven a ninguna subcategoría (no
  // debería pasar hoy, todas las secciones de las 7 páginas están migradas,
  // pero por las dudas) se quedan al final, respetando el orden que ya
  // tenían entre sí.
  function ordenarSecciones(subcategorias) {
    var secciones = Array.prototype.slice.call(document.querySelectorAll('.catsec'));
    if (secciones.length < 2) return;
    var conOrden = secciones.map(function (section, i) {
      var sub = subcategoriaDeSeccion(section, subcategorias);
      return { section: section, orden: sub ? sub.orden : (1e6 + i) };
    });
    conOrden.sort(function (a, b) { return a.orden - b.orden; });

    var otros = document.querySelector('main > section.otros');
    if (!otros || !otros.parentNode) return;
    // Insertar cada una, en orden, justo antes de "otros mundos": la
    // técnica de siempre para reordenar sin sacar y volver a poner todo el
    // árbol — cada insertBefore empuja a las anteriores un lugar más atrás.
    conOrden.forEach(function (item) { otros.parentNode.insertBefore(item.section, otros); });
  }

  // La barra de categorías de arriba (.catbar-inner, el "salto rápido" con
  // un link por subcategoría) está escrita a mano en el HTML de cada
  // página — a diferencia de las <section>, nadie la arma sola. Sin esto,
  // una subcategoría creada desde el navegador aparece con su sección al
  // hacer scroll pero nunca con su link ahí arriba, y una que se queda sin
  // productos deja un link muerto apuntando a una sección oculta.
  function sincronizarCatbar(subcategorias) {
    var inner = document.querySelector('.catbar-inner');
    if (!inner) return; // páginas sin esta barra (ej. combos, especiales)

    var lista = [];
    for (var id in subcategorias) {
      var s = subcategorias[id];
      if (s.pagina === paginaActual) lista.push(s);
    }
    lista.sort(function (a, b) { return (a.orden - b.orden) || a.nombre.localeCompare(b.nombre); });

    lista.forEach(function (s) {
      // Mismo orden de búsqueda que pgridDe(): el id tal cual (migrada) antes
      // que el prefijo "cat-" (creada desde el navegador).
      var domId = document.getElementById(s.slug) ? s.slug : 'cat-' + s.slug;
      var section = document.getElementById(domId);
      var visible = !!(section && !section.hidden);
      var link = inner.querySelector('a[href="#' + domId + '"]');

      if (!link) {
        if (!visible) return; // no crear un link para algo que no se ve
        link = document.createElement('a');
        link.href = '#' + domId;
        link.textContent = s.nombre;
        inner.appendChild(link);
        return;
      }
      link.hidden = !visible;
    });
  }

  // Los códigos que terminaron pintados en esta tarjeta — precios.js ya los
  // dejó escritos como data-pos-ok al resolverlos (ver preciosDeTarjeta).
  // Reusar eso en vez de recalcular es lo que garantiza que "sin stock" mire
  // exactamente el mismo código que el precio que está en pantalla.
  function codigosDeTarjeta(card) {
    var fotos = card.querySelectorAll('.gtrack img[data-pos-ok]');
    if (fotos.length) return Array.prototype.map.call(fotos, function (f) { return f.getAttribute('data-pos-ok'); });
    var propio = card.getAttribute('data-pos-ok');
    return propio ? [propio] : [];
  }

  // Agotado: todos los códigos resueltos de la tarjeta están sin stock (una
  // galería de colores comparte código — si ese código no hay, no hay ningún
  // color). El override de la tarjeta (sin código propio, ver
  // admin-catalogo.js) manda cuando está seteado: es lo único que cubre las
  // tarjetas que no resuelven a ningún código del POS.
  function marcarEstado(card, codigosUsados, sinStock, tarjetaOv) {
    var agotado;
    if (tarjetaOv && tarjetaOv.sinStock != null) agotado = !!tarjetaOv.sinStock;
    else agotado = codigosUsados.length > 0 && codigosUsados.every(function (c) { return !!sinStock[c]; });
    if (agotado) card.setAttribute('data-agotado', '1');
    else card.removeAttribute('data-agotado');

    marcarColoresSinStock(card, tarjetaOv);

    // Ocultar: la tarjeta sigue en el HTML (ver el comentario sobre esto en
    // el plan — no es borrado real), sólo se saca de la vista en esta misma
    // página. explorar.js y search.js aplican el mismo flag por su lado.
    var oculta = !!(tarjetaOv && tarjetaOv.oculta);
    card.hidden = oculta;
  }

  // Sin stock de UN color puntual dentro de una galería que comparte un solo
  // código (ver supabase/catalogo_04_colores_sin_stock.sql) — independiente
  // del "agotado" de arriba, que es de la tarjeta/código entero. Se marca en
  // la propia <img data-cap> de la galería, mismo lugar donde ya vive
  // data-pos-ok: assets/producto.js lo lee de ahí para avisarle al selector
  // de color del carrito (assets/carrito.js) cuál opción no conviene pedir.
  function marcarColoresSinStock(card, tarjetaOv) {
    var lista = (tarjetaOv && tarjetaOv.coloresSinStock) || [];
    var set = {};
    lista.forEach(function (c) { set[String(c || '').trim().toLowerCase()] = true; });
    var fotos = card.querySelectorAll('.gtrack img[data-cap]');
    for (var i = 0; i < fotos.length; i++) {
      var cap = (fotos[i].getAttribute('data-cap') || '').trim().toLowerCase();
      if (cap && set[cap]) fotos[i].setAttribute('data-agotado', '1');
      else fotos[i].removeAttribute('data-agotado');
    }
  }

  function aplicar(precios, codigos, alias, origen, sinStock, tarjetas, subcategorias) {
    sinStock = sinStock || {};
    tarjetas = tarjetas || {};
    subcategorias = subcategorias || {};
    var R = new Resolutor(precios, codigos, alias);
    var cards = document.querySelectorAll('.pcard');
    var n = 0;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var tarjetaOv = overrideDe(card, tarjetas);
      var talles = P.leerTalles(card);
      if (talles) {
        if (pintarTalles(card, talles, R)) n++;
        marcarEstado(card, talles.map(function (t) { return t.code; }), sinStock, tarjetaOv);
        continue;
      }
      var incluye = P.leerIncluye(card);
      if (incluye) {
        // precio_fijo (cargado desde admin-catalogo.js) pisa TANTO el
        // data-price a mano como la suma de componentes — es la forma de
        // corregir el precio de un combo sin tener que editar el HTML.
        if (tarjetaOv && tarjetaOv.precioFijo) { pintarPrecioFijo(card, tarjetaOv.precioFijo); n++; }
        else if (pintarIncluye(card, incluye, R)) n++;
        marcarEstado(card, incluye.map(function (c) { return c.code; }), sinStock, tarjetaOv);
        continue;
      }
      var lista = preciosDeTarjeta(card, R, tarjetaOv && tarjetaOv.codigoOverride);
      if (lista.length) { pintar(card, lista); n++; }
      marcarEstado(card, codigosDeTarjeta(card), sinStock, tarjetaOv);
    }
    reubicar(tarjetas, subcategorias);
    ocultarSeccionesVacias();
    ordenarSecciones(subcategorias);
    sincronizarCatbar(subcategorias);
    // Queda a mano para revisar desde la consola del navegador por qué una
    // tarjeta no muestra precio, sin tener que leer este archivo.
    window.__PRECIOS_INFO__ = {
      origen: origen, tarjetas: cards.length, conPrecio: n,
      codigos: Object.keys(precios).length
    };

    // Para el carrito: buscar el precio de un código y formatearlo con el mismo
    // criterio que las tarjetas, así el total nunca se ve distinto del precio
    // que el cliente leyó al agregar.
    window.MMPrecios = {
      de: hacerBuscador(precios, alias),
      formato: function (n) { return fmt.format(n); },
      sinStock: function (codigo) { return !!sinStock[String(codigo || '').trim()]; },
      // Repinta sin recargar después de guardar un cambio desde
      // admin-catalogo.js: borra sólo LAS PROPIAS etiquetas (data-mm-precio
      // — los combos escritos a mano no las tienen) y vuelve a aplicar con
      // los datos ya actualizados en MMCatalogo. Dispara mm:precios de
      // nuevo, así el carrito recalcula el total solo (ver carrito.js).
      repintar: function () {
        document.querySelectorAll('.pricetag[data-mm-precio]').forEach(function (t) { t.remove(); });
        document.querySelectorAll('.pcard[data-price]').forEach(function (c) {
          if (c.querySelector('.pricetag')) return; // los de combo quedan
          c.removeAttribute('data-price');
        });
        document.querySelectorAll('.pcard[data-pos-ok], .gtrack img[data-pos-ok]').forEach(function (n) {
          n.removeAttribute('data-pos-ok');
        });
        if (!window.MMCatalogo) return;
        MMCatalogo.cargar(function (d) {
          aplicar(d.precios, d.fotos, window.__PRECIOS_ALIAS__ || {}, d.origen, d.sinStock, d.tarjetas, d.subcategorias);
        });
      }
    };
    // Esto llega DESPUÉS de que el carrito se dibujó (los precios vienen de la
    // red). El aviso es lo que le permite recalcular el total sin recargar.
    document.dispatchEvent(new CustomEvent('mm:precios'));
  }

  function arrancar() {
    if (!window.MMCatalogo) {
      // Sin assets/catalogo.js no hay de dónde sacar precios — mismo caso que
      // "sin-datos": la tarjeta queda exactamente como está, sin precio.
      window.__PRECIOS_INFO__ = { origen: 'sin-datos' };
      return;
    }
    MMCatalogo.cargar(function (datos) {
      if (!datos || !Object.keys(datos.precios).length) {
        window.__PRECIOS_INFO__ = { origen: (datos && datos.origen) || 'sin-datos' };
        return;
      }
      aplicar(datos.precios, datos.fotos, window.__PRECIOS_ALIAS__ || {}, datos.origen, datos.sinStock, datos.tarjetas, datos.subcategorias);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
