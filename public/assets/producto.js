/* Mundo Mágico · qué es un producto
 *
 * Traductor puro: DOM → objeto. No calcula precios, no toca el carrito, no
 * dibuja nada. Existe porque hasta ahora cada archivo se armaba su propia idea
 * de "producto" leyendo los mismos atributos con reglas apenas distintas:
 * precios.js sabía leer data-talles y el carrito no, el carrito sabía sacar el
 * código del nombre de la foto y la ficha ni se enteraba. Resultado: el cliente
 * podía ver el precio de un código y el empleado recibir otro.
 *
 * De acá en adelante hay UNA sola respuesta a "qué se puede elegir de este
 * producto y con qué código viaja cada opción", y la usan la ficha, el carrito
 * y los precios.
 *
 * LA REGLA QUE ORDENA TODO:
 *
 *   Una dimensión es una dimensión sólo si CAMBIA EL CÓDIGO.
 *
 * El pedido está hecho de códigos del POS. Ningún producto del catálogo tiene
 * un código por combinación (el disfraz de dama antigua se ofrece en 3 colores
 * y 2 talles, pero el POS tiene 2 códigos: el color no es parte del artículo).
 * Entonces se elige UNA cosa —la que cambia el código— y todo lo demás viaja
 * como PREFERENCIA: texto pegado al renglón, sin inventar un código que el POS
 * no tiene. El empleado recibe "[9256] Vestido de dama antigua — Talle 0/1/2 ·
 * rosa" y no tiene que volver a preguntar, que es todo el punto.
 *
 * Se carga antes que precios.js y no depende de nadie. Para revisar una tarjeta
 * desde la consola del navegador:
 *   MMProducto.leer(document.querySelector('.pcard'))
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------ utilidades */

  // El código del POS al final del nombre del archivo: "Globo ... 01848.jpeg".
  // Exige un espacio antes para no confundirlo con una medida pegada al nombre
  // ("Vaso 500cc"). Vivía duplicada, idéntica, en carrito.js y en precios.js.
  function codigoDeImagen(src) {
    if (!src) return '';
    var f;
    try { f = decodeURIComponent(src); } catch (e) { f = src; }
    f = f.split('/').pop().replace(/\.[a-z0-9]+$/i, '');
    var m = f.match(/\s(\d{3,8})$/);
    return m ? m[1] : '';
  }

  // "Todos los colores" es la foto de catálogo del set completo, no un color
  // pedible: si el cliente la elige, el pedido queda ambiguo.
  function variantePedible(v) {
    return !!v.name && !/^todos\b/i.test(v.name);
  }

  function primero(lista) {
    for (var i = 0; i < lista.length; i++) if (lista[i]) return lista[i];
    return '';
  }

  function attr(nodo, nombre) {
    return (nodo && nodo.getAttribute && nodo.getAttribute(nombre)) || '';
  }

  // "Chico:9283;Grande:4228" → [{label:'Chico', code:'9283'}, ...]
  // Los códigos NO se validan: hay algunos que no son numéricos ('Funyi12').
  function leerPares(raw) {
    if (!raw) return null;
    var out = [];
    raw.split(';').forEach(function (par) {
      var i = par.indexOf(':');
      if (i < 0) return;
      var label = par.slice(0, i).trim();
      var code = par.slice(i + 1).trim();
      if (label && code) out.push({ label: label, code: code });
    });
    return out.length ? out : null;
  }

  /* ------------------------------------------ opciones escritas en el texto */

  // Renglones de data-specs que son una LISTA DE OPCIONES y no una descripción.
  // Se guarda la clave de cada grupo (no se aplanan todos juntos, como se hacía
  // antes): "Colores: rosa, celeste | Talles: 1, 3" son dos preguntas distintas,
  // y mezclarlas hacía que elegir "rosa" te dejara sin talle.
  //
  // Sólo están acá los campos que en este catálogo se escriben de verdad como
  // lista. "Forma:" quedó AFUERA a propósito: sus 30 valores son prosa que
  // describe UN producto ("Forma: silueta redondeada de cuello angosto",
  // "Forma: cónica, alta y estilizada"), así que tomarlo como opciones le
  // preguntaba al cliente si quería su florero "cónico" o "alto y estilizado".
  // Lo mismo con "Modelo:" y "Sabor:", que hoy no se usan en ninguna tarjeta.
  // Si alguna vez hacen falta, el requisito es el mismo: que se escriban como
  // lista separada por comas y que cada opción sea pedible por su nombre.
  // "Formas:" (plural, con "s") es distinto de "Forma:" (singular): el
  // singular sigue siendo prosa de un solo producto (ver arriba) y no entra acá
  // a propósito. El plural es explícito: quien lo escribe está enumerando
  // opciones de verdad, así que sí se puede tomar como lista.
  var GRUPOS = [
    { re: /^\s*Colores?\s*:\s*(.+)$/i,        clave: 'color', elegir: 'Elegí el color',  nombre: 'Color' },
    { re: /^\s*Talles?\s*:\s*(.+)$/i,         clave: 'talle', elegir: 'Elegí el talle',  nombre: 'Talle' },
    { re: /^\s*Tama(?:ñ|n)os?\s*:\s*(.+)$/i,  clave: 'talle', elegir: 'Elegí el tamaño', nombre: 'Tamaño' },
    { re: /^\s*Formas\s*:\s*(.+)$/i,          clave: 'forma', elegir: 'Elegí la forma',  nombre: 'Forma' }
  ];

  // Cada renglón de data-specs, con el grupo de opciones colgado si lo es. La
  // ficha necesita las dos cosas a la vez: mostrar la ficha técnica completa,
  // pero SIN repetir el renglón que ya se convirtió en un selector. Dejar
  // "Talles: 1, 3" impreso arriba de un selector de talles es ruido, y cuando
  // los dos no coinciden es una contradicción.
  function lineasDeSpecs(specs) {
    var out = [];
    (specs || '').split('|').forEach(function (seg) {
      var t = seg.trim();
      if (!t) return;
      for (var i = 0; i < GRUPOS.length; i++) {
        var m = t.match(GRUPOS[i].re);
        if (!m) continue;
        var ops = [];
        m[1].split(/\s*,\s*/).forEach(function (n) {
          n = n.trim();
          // "varios" / "surtido" no identifican nada: no sirven como opción.
          if (n && !/^(varios|surtidos?)\b/i.test(n)) ops.push({ name: n, img: '', code: '' });
        });
        // Una sola opción no es una elección: "Colores: rosa" es un dato del
        // producto, y ya se lee en la ficha técnica. Pedir que elija entre una
        // cosa es ruido.
        if (ops.length > 1) {
          out.push({ text: t, grupo: { clave: GRUPOS[i].clave, elegir: GRUPOS[i].elegir,
                                       nombre: GRUPOS[i].nombre, opciones: ops } });
          return;
        }
        break;
      }
      out.push({ text: t, grupo: null });
    });
    return out;
  }

  /* ---------------------------------------------------------- el código POS */

  // De dónde sale el código de UNA foto de la galería, del más confiable al
  // menos:
  //   1. data-pos     — lo escribió una persona a mano para esta foto. Manda.
  //   2. data-pos-ok  — el que resolvió precios.js y ADEMÁS tiene precio
  //                     cargado (ver assets/precios.js). Es el que el cliente
  //                     está viendo en pantalla, así que es el que tiene que
  //                     viajar en el pedido.
  //   3. el número al final del nombre del archivo — una adivinanza razonable.
  //   4. el data-pos de la tarjeta, heredado.
  //
  // Si precios.js no corrió (sin red, o una página que ni lo carga), data-pos-ok
  // no existe y la cascada cae en lo de siempre: nada de esto es una dependencia
  // dura.
  function codigoDeFoto(im, base) {
    return primero([
      attr(im, 'data-pos'),
      attr(im, 'data-pos-ok'),
      codigoDeImagen(attr(im, 'src')),
      base
    ]);
  }

  // data-talles no siempre habla de talles: modela "una elección donde cada
  // opción tiene su propio código del POS", y eso a veces son talles ("Talle
  // 1", "Talle 3"), a veces tamaños ("Chico", "Grande") y a veces dos productos
  // distintos que comparten una foto ("Collar", "Vincha x 12"). Pedirle al
  // cliente que "elija el talle" entre un collar y una vincha es peor que no
  // decir nada, así que la etiqueta se deduce de las opciones y ante la duda
  // queda genérica.
  var TAMANIOS = /^(chic[ao]|median[ao]|grande|peque(ñ|n)[ao]|mini|maxi|x?[sml]|x{1,2}l)\b/i;

  // Devuelve [cómo se pide elegir, cómo se llaman en plural]. El plural lo usa
  // la tarjeta de la grilla para avisar qué hay adentro ("Elegir 3 talles")
  // antes de que el cliente toque: si no, el botón promete agregar algo y lo
  // que hace es abrir una pregunta.
  function etiquetaDeTalles(pares) {
    var talles = 0, tamanios = 0;
    for (var i = 0; i < pares.length; i++) {
      if (/^talles?\b/i.test(pares[i].label)) talles++;
      else if (TAMANIOS.test(pares[i].label)) tamanios++;
    }
    if (talles === pares.length) return ['Elegí el talle', 'talles'];
    if (tamanios === pares.length) return ['Elegí el tamaño', 'tamaños'];
    return ['Elegí una opción', 'opciones'];
  }

  /* ------------------------------------------------- armar el modelo común */

  // Devuelve { dimension, preferencia } a partir de las tres fuentes posibles.
  // El orden importa y es siempre el mismo:
  //
  //   1. data-talles — la ÚNICA fuente con un código del POS por opción.
  //   2. las fotos de la galería — con foto y (casi siempre) con código.
  //   3. el texto de data-specs — sin código, último recurso.
  //
  // La fuente que trae códigos se queda con la elección; la otra baja a
  // preferencia. Si las dos hablan de lo mismo (data-talles + "Talles: 1, 3"),
  // la de texto se descarta: es la misma pregunta escrita dos veces.
  function elegibles(opts) {
    var grupos = (opts.lineas || []).filter(function (l) { return l.grupo; })
                                    .map(function (l) { return l.grupo; });
    var dimension = null;

    // 1) Opciones con código propio (talles, tamaños, o dos productos que
    //    comparten una foto). Va primero porque es la única fuente donde cada
    //    opción trae SU código: elegir acá es lo que hace que el empleado no
    //    tenga que volver a preguntar.
    if (opts.talles && opts.talles.length) {
      var et = etiquetaDeTalles(opts.talles);
      dimension = {
        tipo: 'talle', fuente: 'talles', clave: 'talle',
        etiqueta: et[0], plural: et[1],
        opciones: opts.talles.map(function (t) {
          return { name: t.label, img: '', code: t.code };
        })
      };
    }

    // 2) Colores con foto propia. Una sola foto no es una elección; y una
    //    galería marcada data-fotos="detalle" son fotos del MISMO producto
    //    (el combo entero, un primer plano de los platos), no opciones.
    if (!dimension && !opts.soloDetalle && opts.conFoto.length > 1) {
      dimension = {
        tipo: 'color', fuente: 'fotos', clave: 'color',
        etiqueta: 'Elegí el color', plural: 'colores', opciones: opts.conFoto
      };
    }

    // 3) Lo que sólo está escrito. Sin código: el renglón viaja con el de la
    //    tarjeta y el empleado termina de identificarlo por el nombre.
    if (!dimension) {
      for (var i = 0; i < grupos.length; i++) {
        dimension = {
          tipo: 'opcion', fuente: 'specs', clave: grupos[i].clave,
          etiqueta: grupos[i].elegir,
          plural: grupos[i].clave === 'color' ? 'colores' : 'opciones',
          opciones: grupos[i].opciones
        };
        break;
      }
    }

    // La segunda pregunta, si la hay. No genera código: se pega al renglón
    // como texto ("Talle 3 · rosa"). Una sola opción no es una pregunta.
    var preferencia = null;
    if (dimension) {
      for (var j = 0; j < grupos.length; j++) {
        if (grupos[j].clave === dimension.clave) continue;
        if (grupos[j].opciones.length < 2) continue;
        preferencia = {
          clave: grupos[j].clave, etiqueta: grupos[j].nombre,
          opciones: grupos[j].opciones.map(function (o) { return o.name; })
        };
        break;
      }
    }

    // Los renglones de la ficha técnica, marcando cuáles ya se muestran arriba
    // como selector o como preferencia para no repetirlos.
    var usadas = {};
    if (dimension) usadas[dimension.clave] = true;
    if (preferencia) usadas[preferencia.clave] = true;
    var specs = (opts.lineas || []).map(function (l) {
      return { text: l.text, yaEsSelector: !!(l.grupo && usadas[l.grupo.clave]) };
    });

    return { dimension: dimension, preferencia: preferencia, specs: specs };
  }

  /* ------------------------------------- origen 1: tarjeta del catálogo */

  function titulo(card) {
    var h = card.querySelector('.pcard-body h3');
    return h ? h.textContent.trim() : 'Producto';
  }

  function leer(card) {
    if (!card) return null;

    var base = attr(card, 'data-pos');
    var phImg = card.querySelector('.pcard-ph img');
    var foto = attr(phImg, 'src');
    var gal = card.querySelectorAll('.gtrack img');

    // Todas las fotos, incluida la de "todos los colores": la ficha las muestra
    // igual. El filtro de lo que se puede PEDIR es otra cosa y va más abajo.
    var fotos = [];
    var conFoto = [];
    if (gal.length) {
      for (var i = 0; i < gal.length; i++) {
        var cap = attr(gal[i], 'data-cap').trim();
        fotos.push({ src: attr(gal[i], 'src'), cap: cap });
        // data-agotado en ESTA foto puntual (no en la tarjeta entera) es
        // "sin stock de este color" — precios.js lo pone ahí a partir de
        // catalogo_tarjetas.colores_sin_stock, para el caso de una galería
        // que comparte un solo código y necesita apagar un color sin apagar
        // los demás.
        var v = { name: cap, img: attr(gal[i], 'src'), code: codigoDeFoto(gal[i], base),
                  sinStock: gal[i].hasAttribute('data-agotado') };
        if (variantePedible(v)) conFoto.push(v);
      }
    } else if (phImg) {
      fotos.push({ src: foto, cap: '' });
    }

    var e = elegibles({
      talles: leerPares(attr(card, 'data-talles')),
      conFoto: conFoto,
      lineas: lineasDeSpecs(attr(card, 'data-specs')),
      soloDetalle: attr(card, 'data-fotos') === 'detalle'
    });

    var items = null;
    try { items = attr(card, 'data-items') ? JSON.parse(attr(card, 'data-items')) : null; }
    catch (err) { items = null; }

    return {
      title: titulo(card),
      cat: attr(card, 'data-cat'),
      img: foto,
      // El código del producto suelto (sin elección posible). El data-pos de la
      // tarjeta va primero: lo escribió una persona pensando en ESTE producto.
      code: primero([base, attr(card, 'data-pos-ok'), attr(phImg, 'data-pos'),
                     attr(phImg, 'data-pos-ok'), codigoDeImagen(foto)]),
      // El único código que una opción sin código propio puede heredar. No se
      // usa acá el sacado del nombre de la foto principal: ese es el de UN color
      // puntual ("Globo Negro 01954"), y colgárselo al blanco mandaría al
      // empleado a buscar el producto equivocado.
      base: base,
      fotos: fotos,
      dimension: e.dimension,
      specs: e.specs,
      preferencia: e.preferencia,
      incluye: leerPares(attr(card, 'data-incluye')) || [],
      items: items
    };
  }

  /* ---------------------------------------- origen 2: slide de Explorar */

  // explorar.js deja el producto colgado del nodo (slide._product) al armar la
  // slide, con las fotos y el data-cap de cada color ya resueltos. Leerlo de ahí
  // evita reparsear el DOM del visor, que se arma y se destruye al scrollear.
  //
  // El snapshot de Explorar no guarda data-talles ni data-incluye (los genera
  // .claude/gen-explorar-data.js, que no los exporta), así que acá la elección
  // sólo puede salir de las fotos o del texto.
  function leerSlide(slide) {
    var p = slide && slide._product;
    if (!p) return null;

    var fotos = (p.images || []).map(function (im) {
      return { src: im.src, cap: (im.cap || '').trim() };
    });
    var conFoto = fotos.length > 1 ? fotos.map(function (f) {
      return { name: f.cap, img: f.src, code: codigoDeImagen(f.src) || (p.pos || '') };
    }).filter(variantePedible) : [];

    var e = elegibles({
      talles: null,
      conFoto: conFoto,
      lineas: lineasDeSpecs((p.specs || []).join('|')),
      soloDetalle: false
    });

    return {
      title: p.title,
      cat: p.cat || '',
      img: fotos.length ? fotos[0].src : '',
      code: primero([p.pos, fotos.length ? codigoDeImagen(fotos[0].src) : '']),
      base: p.pos || '',
      fotos: fotos,
      dimension: e.dimension,
      specs: e.specs,
      preferencia: e.preferencia,
      incluye: [],
      items: null
    };
  }

  // El color que el cliente TIENE A LA VISTA en el reel. Los puntitos son la
  // única fuente confiable de cuál se está mostrando: explorar.js los mantiene
  // sincronizados con la foto, deslice o toque el cliente.
  function varianteVisible(slide) {
    var p = slide && slide._product;
    if (!p || !p.images) return null;
    var i = -1;
    var dots = slide.querySelectorAll('.slide-dots .sdot');
    for (var k = 0; k < dots.length; k++) {
      if (dots[k].classList.contains('is-on')) i = k;
    }
    var im = i > -1 ? p.images[i] : null;
    if (!im) return null;
    var v = {
      name: (im.cap || '').trim(),
      img: im.src,
      code: codigoDeImagen(im.src) || (p.pos || '')
    };
    return variantePedible(v) ? v : null;
  }

  window.MMProducto = {
    leer: leer,
    leerSlide: leerSlide,
    varianteVisible: varianteVisible,
    // data-talles="Chico:9283;Grande:4228" — una ELECCIÓN, con un código del
    // POS por opción. El cliente se lleva una.
    leerTalles: function (card) { return leerPares(attr(card, 'data-talles')); },
    // data-incluye="Banderín:12011;Platos:02165" — los componentes de un combo.
    // NO son una elección: el combo trae TODOS y se cobra al precio del combo
    // (data-price escrito a mano). Antes esto compartía atributo con lo de
    // arriba, y el carrito terminaba preguntándole al cliente si quería "el
    // banderín O los platos" de un combo que trae los dos.
    leerIncluye: function (card) { return leerPares(attr(card, 'data-incluye')); },
    variantePedible: variantePedible,
    codigoDeImagen: codigoDeImagen
  };
})();
