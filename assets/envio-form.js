/* Formulario de entrega (nombre, teléfono, retiro/envío, fecha y franja) —
 * window.MMEnvioForm.
 *
 * Se extrae de carrito.js porque este bloque solo (sucursal + franja +
 * selector de días + costo + validación) son ~400 líneas, y carrito.js ya
 * tiene de sobra. carrito.js llama a `MMEnvioForm.montar(foot)` si este
 * script existe; si no, arma el formulario mínimo de siempre — la función
 * completa sigue siendo borrable sin romper nada.
 *
 * Depende de window.MMEnvios para las zonas, sucursales, franjas y cupos.
 * Si ese script no está, este módulo no se define (`window.MMEnvioForm`
 * queda sin existir) y carrito.js cae solo al formulario de respaldo.
 *
 * Regla de falla: si MMEnvios.cupos() no responde, TODOS los días no
 * domingo dentro del horizonte quedan seleccionables — nunca hay que
 * convertir "no pude preguntarle al servidor" en "no hay cupo". Eso ya lo
 * resuelve el respaldo permisivo de assets/envios.js; acá sólo hay que
 * dibujar lo que esa función devuelve, no reinterpretarlo.
 */
(function () {
  'use strict';

  if (!window.MMEnvios) return;

  // Hoy el local no reparte por su cuenta: el cliente arma su propio envío
  // (remis, Uber Moto, Uber Envíos) y lo paga aparte. Interruptor en
  // envio_config (supabase/envios_14_entrega_propia.sql) — apaga zona,
  // costo por zona y envío inmediato del lado del cliente, sin perder esa
  // infraestructura por si se vuelve a prender más adelante.
  function entregaPropia() {
    var cfg = MMEnvios.config();
    return !!(cfg && cfg.entrega_propia);
  }

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  var CORREDOR_TXT = { centro: 'Centro', oeste: 'Oeste', norte: 'Norte', este: 'Este', sur: 'Sur' };
  var MOTIVO_TXT = {
    pasada: 'Esa fecha ya pasó.',
    domingo: 'Los domingos el local está cerrado.',
    sin_anticipacion: 'Necesitamos un poco más de anticipación para esa fecha.',
    fuera_de_horizonte: 'Todavía no tomamos pedidos tan a futuro por acá — escribinos y lo coordinamos igual.',
    zona_no_reparte_ese_dia: 'Esta zona no tiene reparto ese día.',
    bloqueada: 'Ese día no hay reparto (feriado o aviso especial).',
    cupo_pedidos: 'Se llenaron los pedidos de esa fecha.',
    cupo_bultos: 'Se llenó la capacidad de esa fecha.'
  };

  var raiz, nombreIn;
  var metodoRetiroBtn, metodoEnvioBtn;
  var sucursalesWrap, envioWrap;
  var zonaSel, zonaHint, direccionIn, direccionHint, direccionLink, entreCallesIn, pisoDeptoIn;
  var recibeOtraChk, receptorWrap, receptorNombreIn, receptorTelefonoIn;
  var costoLinea, minimoLinea;
  var diasWrap, fechaIn, franjasWrap, franjaHint, fechaFranjaWrap, entregaInfoWrap;
  var envioInmediatoChk, envioInmediatoLinea;

  // null = todavía no eligió: ya no hay método por defecto, tiene que
  // tocar "Retiro" o "Envío" a propósito antes de poder mandar el pedido
  // (ver validar()).
  var metodo = null;
  var sucursalId = null;
  var zonaId = null;
  var franjaId = null;
  var envioInmediato = false;
  var turnoInmediato = null; // { fecha, franjaId, franjaNombre } una vez resuelto
  var datosCargados = false;

  // --- Método de entrega ---------------------------------------------------
  // El retiro sigue eligiendo día + franja a mano (el cliente es quien pasa a
  // buscarlo). El envío a domicilio ya no: el negocio arma las rutas y le
  // asigna la fecha/franja real después, así que acá sólo se avisa una
  // ventana estimada (ver entregaInfoWrap) — salvo con envío inmediato, que
  // sigue resolviendo un turno concreto automáticamente.
  function actualizarBloqueEntrega() {
    if (metodo === 'retiro') {
      fechaFranjaWrap.hidden = false;
      entregaInfoWrap.hidden = true;
    } else if (metodo === 'envio') {
      fechaFranjaWrap.hidden = true;
      entregaInfoWrap.hidden = envioInmediato;
    } else {
      // Todavía no eligió retiro ni envío: no hay nada que mostrar de esto.
      fechaFranjaWrap.hidden = true;
      entregaInfoWrap.hidden = true;
    }
  }

  function elegirMetodo(m) {
    metodo = m;
    metodoRetiroBtn.classList.toggle('is-on', m === 'retiro');
    metodoEnvioBtn.classList.toggle('is-on', m === 'envio');
    sucursalesWrap.hidden = m !== 'retiro';
    envioWrap.hidden = m !== 'envio';
    // El envío inmediato es sólo para envío a domicilio (ver nota en
    // aplicarEnvioInmediato); al volver a retiro se apaga solo.
    if (m === 'retiro' && envioInmediato) {
      envioInmediatoChk.checked = false;
      aplicarEnvioInmediato(false);
    }
    actualizarBloqueEntrega();
    refrescarDias();
  }

  // --- Retiro: chips de sucursal -------------------------------------------
  function pintarSucursales() {
    sucursalesWrap.innerHTML = '';
    var chips = el('div', 'cart-chips');
    var nota = el('p', 'cart-suc-nota');
    nota.hidden = true;

    MMEnvios.sucursales().forEach(function (s) {
      var chip = el('button', 'cart-chip', s.nombre);
      chip.type = 'button';
      chip.addEventListener('click', function () {
        sucursalId = s.id;
        Array.prototype.forEach.call(chips.children, function (c) { c.classList.remove('is-on'); });
        chip.classList.add('is-on');
        if (s.requiere_transferencia) {
          nota.hidden = false;
          nota.textContent = 'En ' + s.nombre + ' tenemos menos stock, así que tu pedido se arma en el ' +
            'Centro y viaja hasta ahí. Por eso el retiro ahí necesita un día más.';
        } else {
          nota.hidden = true;
        }
        refrescarDias();
      });
      chips.appendChild(chip);
    });

    sucursalesWrap.appendChild(chips);
    sucursalesWrap.appendChild(nota);
  }

  // --- Envío: zona, dirección, entre calles, piso, receptor ----------------
  function pintarZonas() {
    zonaSel.innerHTML = '';
    var vacia = document.createElement('option');
    vacia.value = '';
    vacia.textContent = 'Elegí una zona…';
    vacia.disabled = true;
    vacia.selected = true;
    zonaSel.appendChild(vacia);

    var grupos = {};
    MMEnvios.zonas().forEach(function (z) {
      (grupos[z.grupo_ruta] = grupos[z.grupo_ruta] || []).push(z);
    });
    Object.keys(grupos).forEach(function (g) {
      var og = document.createElement('optgroup');
      og.label = CORREDOR_TXT[g] || g;
      grupos[g].forEach(function (z) {
        var o = document.createElement('option');
        o.value = z.id;
        o.textContent = z.nombre;
        og.appendChild(o);
      });
      zonaSel.appendChild(og);
    });
  }

  function zonaActual() {
    return MMEnvios.zona(zonaId);
  }

  function pintarCosto() {
    // Sin reparto propio no hay costo de envío que calcular — costoLinea y
    // minimoLinea quedan como arrancaron (ocultas), y zonaId nunca se llega
    // a setear porque el <select> de zona está oculto (ver montar()).
    if (!entregaPropia()) return;
    var z = zonaActual();
    var cfg = MMEnvios.config();
    if (!z || !cfg.cobrar_envio) { costoLinea.hidden = true; }
    else {
      var extra = envioInmediato ? Number(cfg.costo_envio_inmediato || 0) : 0;
      costoLinea.hidden = false;
      costoLinea.textContent = 'Envío a ' + z.nombre + ': ' + MMEnvios.plata(MMEnvios.costoDe(zonaId) + extra) +
        (extra ? ' (incluye recargo por envío inmediato)' : '') +
        ' (el total de los productos te lo confirmamos por WhatsApp)';
    }
    if (cfg.minimo_compra > 0) {
      minimoLinea.hidden = false;
      minimoLinea.textContent = 'Compra mínima para envío: ' + MMEnvios.plata(cfg.minimo_compra);
    } else {
      minimoLinea.hidden = true;
    }
  }

  // --- Aviso si la dirección tipeada cae lejos de la zona elegida ----------
  // No bloquea nada (validar() no mira esto): es sólo para que el cliente
  // note un error de tipeo o de zona antes de mandar el pedido. Geocodifica
  // UNA vez por dirección terminada (blur, no cada tecla) contra Nominatim
  // (OpenStreetMap, sin API key) y compara contra el lat/lng de la zona
  // (envio_zonas — ver supabase/envios_08_zona_geo.sql). Si Nominatim no
  // responde o la zona no tiene coordenadas cargadas, no se muestra nada:
  // "no pude revisarlo" nunca debe leerse como "está mal".
  var UMBRAL_KM_ZONA = 7;
  var direccionRevisada = ''; // zonaId·texto de la última consulta, para no repetir la misma

  function distanciaKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function ocultarAvisoDireccion() {
    direccionHint.hidden = true;
    direccionHint.classList.remove('cart-field-hint-alerta');
  }

  // Link de "verla en Google Maps": no depende de Nominatim ni de ninguna
  // clave de API (el sitio no tiene una configurada — ver el mismo
  // comentario en admin-pedidos.js/tramosMapas), es sólo el link público de
  // búsqueda de Maps con lo que el cliente ya tipeó, para que la revise a
  // ojo antes de mandar el pedido. Se actualiza en vivo (cada tecleo), no
  // hace falta esperar a que termine de escribir.
  function refrescarLinkDireccion() {
    var texto = direccionIn.value.trim();
    if (texto.length < 4) { direccionLink.hidden = true; return; }
    var z = zonaActual();
    var consulta = texto + (z && z.nombre ? ', ' + z.nombre : '') + ', Tucumán, Argentina';
    direccionLink.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(consulta);
    direccionLink.hidden = false;
  }

  function revisarDireccion() {
    var z = zonaActual();
    var texto = direccionIn.value.trim();
    if (!z || z.lat == null || z.lng == null || texto.length < 6) { ocultarAvisoDireccion(); return; }

    var clave = zonaId + '·' + texto;
    if (clave === direccionRevisada) return;
    direccionRevisada = clave;

    // A propósito NO se agrega z.nombre acá: si el cliente eligió la zona
    // equivocada, meter ese nombre en la búsqueda sesga o directamente rompe
    // la geocodificación (Nominatim no encuentra nada) — justo el caso que
    // este chequeo tiene que poder detectar. Se geocodifica el texto solo,
    // con "Tucumán, Argentina" como único contexto, y recién después se
    // compara contra el centro de la zona elegida.
    var consulta = texto + ', Tucumán, Argentina';
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ar&q=' + encodeURIComponent(consulta))
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        if (clave !== direccionRevisada) return; // el cliente ya cambió algo: esta respuesta quedó vieja
        if (!data || !data[0]) {
          // No es lo mismo que "queda lejos de la zona": acá directamente no
          // se pudo ubicar. Aviso neutro (sin la clase -alerta) que empuja
          // al link de Maps en vez de bloquear — puede ser una dirección
          // rural o mal indexada en OpenStreetMap y existir igual.
          direccionHint.hidden = false;
          direccionHint.classList.remove('cart-field-hint-alerta');
          direccionHint.textContent = 'No pudimos ubicarla automáticamente. Revisala con el link a Google Maps de abajo antes de confirmar.';
          return;
        }
        var dist = distanciaKm(z.lat, z.lng, Number(data[0].lat), Number(data[0].lon));
        if (dist > UMBRAL_KM_ZONA) {
          direccionHint.hidden = false;
          direccionHint.classList.add('cart-field-hint-alerta');
          direccionHint.textContent = 'Esa dirección parece estar lejos de "' + z.nombre + '" (unos ' +
            Math.round(dist) + ' km). Fijate si elegiste la zona correcta.';
        } else {
          ocultarAvisoDireccion();
        }
      })
      .catch(function () { ocultarAvisoDireccion(); });
  }

  // --- Envío inmediato: sale en el próximo turno, con recargo -------------
  // Regla simple: si se pide antes de config.corte_inmediato_hora, el turno
  // más cercano es la tarde de hoy; después del corte, la mañana de mañana.
  // Si ese día no tiene franjas (domingo) o el corredor está lleno/bloqueado
  // ese día, se prueba el día siguiente — hasta un tope de intentos, para no
  // quedar buscando para siempre si algo anda raro.
  var ENVIO_INMEDIATO_MAX_INTENTOS = 8;

  function sumarDiasISO(iso, n) {
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + n);
    var m = String(d.getMonth() + 1); if (m.length < 2) m = '0' + m;
    var day = String(d.getDate()); if (day.length < 2) day = '0' + day;
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function horaActualHHMM() {
    var d = new Date();
    var h = String(d.getHours()); if (h.length < 2) h = '0' + h;
    var m = String(d.getMinutes()); if (m.length < 2) m = '0' + m;
    return h + ':' + m;
  }

  // 'primera' = la franja que abre más temprano ese día (el "turno mañana");
  // 'ultima' = la que empieza más tarde (el "turno tarde"). Sirve para
  // cualquier día, no sólo lunes a viernes — así un sábado con una sola
  // franja ("Sábado") también entra en la regla sin caso especial.
  function franjaDelTurno(franjasDia, cual) {
    if (!franjasDia.length) return null;
    var ordenadas = franjasDia.slice().sort(function (a, b) {
      return String(a.hora_inicio).localeCompare(String(b.hora_inicio));
    });
    return cual === 'ultima' ? ordenadas[ordenadas.length - 1] : ordenadas[0];
  }

  // Camina hacia adelante día por día hasta encontrar un turno realmente
  // disponible para la zona elegida (MMEnvios.cupos con ignorarAnticipacion,
  // que sigue respetando domingo/bloqueos/cupo — sólo se salta el "necesitás
  // pedir con más anticipación" de siempre). cb(null) si no encuentra nada
  // dentro del tope de intentos.
  function calcularProximoTurno(cb) {
    var cfg = MMEnvios.config();
    var corte = String(cfg.corte_inmediato_hora || '13:00:00').slice(0, 5);
    var antesDelCorte = horaActualHHMM() < corte;
    var fecha = antesDelCorte ? MMEnvios.hoyISO() : sumarDiasISO(MMEnvios.hoyISO(), 1);
    var cual = antesDelCorte ? 'ultima' : 'primera';

    function intentar(intento) {
      if (intento > ENVIO_INMEDIATO_MAX_INTENTOS) { cb(null); return; }
      var franja = franjaDelTurno(MMEnvios.franjas(MMEnvios.isodow(fecha)), cual);
      if (!franja) {
        fecha = sumarDiasISO(fecha, 1);
        cual = 'primera';
        intentar(intento + 1);
        return;
      }
      MMEnvios.cupos(fecha, fecha, zonaId, null, true).then(function (dias) {
        var info = dias && dias[0];
        if (info && info.disponible) {
          cb({ fecha: fecha, franjaId: franja.id, franjaNombre: franja.nombre });
        } else {
          fecha = sumarDiasISO(fecha, 1);
          cual = 'primera';
          intentar(intento + 1);
        }
      });
    }

    intentar(1);
  }

  function aplicarEnvioInmediato(activo) {
    envioInmediato = activo;
    if (!activo) {
      turnoInmediato = null;
      actualizarBloqueEntrega();
      envioInmediatoLinea.hidden = true;
      pintarCosto();
      refrescarDias();
      refrescarFranjas();
      return;
    }
    if (!zonaId) {
      envioInmediatoChk.checked = false;
      envioInmediato = false;
      actualizarBloqueEntrega();
      alert('Elegí primero tu zona.');
      return;
    }
    actualizarBloqueEntrega();
    envioInmediatoLinea.hidden = false;
    envioInmediatoLinea.textContent = 'Buscando el próximo turno disponible…';
    pintarCosto();
    calcularProximoTurno(function (turno) {
      if (!envioInmediato) return; // se destildó mientras se calculaba
      if (!turno) {
        turnoInmediato = null;
        fechaIn.value = '';
        franjaId = null;
        envioInmediatoLinea.textContent = 'No encontramos un turno inmediato disponible por ahora — probá una fecha normal o escribinos por WhatsApp.';
        return;
      }
      turnoInmediato = turno;
      fechaIn.value = turno.fecha;
      franjaId = turno.franjaId;
      envioInmediatoLinea.textContent = 'Sale el ' + MMEnvios.fechaLegible(turno.fecha) + ', turno ' + turno.franjaNombre + '.';
    });
  }

  // --- Fecha: tira de chips + <input type=date> como salida de escape ------
  function refrescarDias() {
    if (!window.MMEnvios) return;
    // Sólo retiro elige día/franja a mano; en envío el negocio asigna la
    // fecha real después, así que no hace falta pedirle cupos al servidor.
    if (metodo !== 'retiro') { diasWrap.innerHTML = ''; franjasWrap.innerHTML = ''; return; }
    var cfg = MMEnvios.config();
    var horizonte = cfg.horizonte_dias || 14;
    var desde = MMEnvios.hoyISO();
    var d = new Date();
    d.setDate(d.getDate() + horizonte - 1);
    var m = String(d.getMonth() + 1); if (m.length < 2) m = '0' + m;
    var day = String(d.getDate()); if (day.length < 2) day = '0' + day;
    var hasta = d.getFullYear() + '-' + m + '-' + day;

    fechaIn.min = desde;

    MMEnvios.cupos(desde, hasta, metodo === 'envio' ? zonaId : null, metodo === 'retiro' ? sucursalId : null).then(function (dias) {
      diasWrap.innerHTML = '';
      dias.forEach(function (info) {
        var p = info.fecha.split('-');
        var chip = el('button', 'cart-chip' + (info.disponible ? '' : ' is-off'));
        chip.type = 'button';
        chip.appendChild(el('b', null, p[2]));
        chip.appendChild(document.createTextNode(mesCorto(p[1])));
        if (!info.disponible) {
          chip.disabled = false; // deshabilitado visualmente (is-off), no con :disabled, para que el title se vea
          chip.title = MOTIVO_TXT[info.motivo] || 'No disponible.';
        }
        if (info.fecha === fechaIn.value) chip.classList.add('is-on');
        chip.addEventListener('click', function () {
          if (!info.disponible) return;
          fechaIn.value = info.fecha;
          Array.prototype.forEach.call(diasWrap.children, function (c) { c.classList.remove('is-on'); });
          chip.classList.add('is-on');
          refrescarFranjas();
        });
        diasWrap.appendChild(chip);
      });
    });
  }

  function mesCorto(mm) {
    var n = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return n[Number(mm)] || '';
  }

  function refrescarFranjas() {
    franjasWrap.innerHTML = '';
    franjaId = null;
    if (!fechaIn.value) {
      franjaHint.hidden = false;
      franjaHint.textContent = 'Elegí primero una fecha.';
      return;
    }
    var isodow = MMEnvios.isodow(fechaIn.value);
    var franjas = MMEnvios.franjas(isodow);
    if (!franjas.length) {
      franjaHint.hidden = false;
      franjaHint.textContent = isodow === 7 ? 'Los domingos el local está cerrado.' : 'No hay franjas para ese día.';
      return;
    }
    franjaHint.hidden = true;
    franjas.forEach(function (f) {
      var chip = el('button', 'cart-chip', f.nombre + ' (' + String(f.hora_inicio).slice(0, 5) + '–' + String(f.hora_fin).slice(0, 5) + ')');
      chip.type = 'button';
      chip.addEventListener('click', function () {
        franjaId = f.id;
        Array.prototype.forEach.call(franjasWrap.children, function (c) { c.classList.remove('is-on'); });
        chip.classList.add('is-on');
      });
      franjasWrap.appendChild(chip);
    });
  }

  // --- Montaje ---------------------------------------------------------------
  function campo(labelTxt, nodo) {
    var l = el('label', 'cart-field');
    l.appendChild(el('span', null, labelTxt));
    l.appendChild(nodo);
    return l;
  }

  function montar(contenedor) {
    raiz = contenedor;
    raiz.innerHTML = '';

    nombreIn = el('input'); nombreIn.type = 'text'; nombreIn.placeholder = 'Tu nombre';

    metodoRetiroBtn = el('button', 'cart-metodo-b', 'Retiro en el local');
    metodoRetiroBtn.type = 'button';
    metodoEnvioBtn = el('button', 'cart-metodo-b', 'Envío a domicilio');
    metodoEnvioBtn.type = 'button';
    metodoRetiroBtn.addEventListener('click', function () { elegirMetodo('retiro'); });
    metodoEnvioBtn.addEventListener('click', function () { elegirMetodo('envio'); });
    var metodoWrap = el('div', 'cart-metodo');
    metodoWrap.appendChild(metodoRetiroBtn);
    metodoWrap.appendChild(metodoEnvioBtn);

    // Ninguno de los dos empieza elegido (ver `metodo` arriba): los dos
    // bloques quedan ocultos hasta que toque uno.
    sucursalesWrap = el('div', 'cart-envio-campos');
    sucursalesWrap.hidden = true;
    envioWrap = el('div', 'cart-envio-campos');
    envioWrap.hidden = true;

    zonaSel = document.createElement('select');
    zonaHint = el('p', 'cart-field-hint');
    zonaSel.addEventListener('change', function () {
      zonaId = zonaSel.value || null;
      var z = zonaActual();
      zonaHint.textContent = (z && z.descripcion) || '';
      pintarCosto();
      refrescarDias();
      direccionRevisada = ''; // cambió la zona: aunque el texto sea el mismo, hay que revisar de nuevo
      revisarDireccion();
      refrescarLinkDireccion(); // el link a Maps también suma el nombre de la zona nueva
      if (envioInmediato) aplicarEnvioInmediato(true); // recalcular el turno para la zona nueva
    });
    direccionIn = el('input'); direccionIn.type = 'text'; direccionIn.placeholder = 'Calle, número, referencia';
    direccionIn.addEventListener('blur', revisarDireccion);
    direccionIn.addEventListener('input', refrescarLinkDireccion);
    direccionHint = el('p', 'cart-field-hint');
    direccionHint.hidden = true;
    direccionLink = el('a', 'cart-direccion-maps', 'Ver esta dirección en Google Maps');
    direccionLink.target = '_blank';
    direccionLink.rel = 'noopener';
    direccionLink.hidden = true;
    entreCallesIn = el('input'); entreCallesIn.type = 'text'; entreCallesIn.placeholder = 'Entre qué calles';
    pisoDeptoIn = el('input'); pisoDeptoIn.type = 'text'; pisoDeptoIn.placeholder = 'Piso / depto / timbre';

    var recibeLabel = el('label', 'cart-recibe-otra');
    recibeOtraChk = document.createElement('input');
    recibeOtraChk.type = 'checkbox';
    recibeLabel.appendChild(recibeOtraChk);
    recibeLabel.appendChild(el('span', null, '¿Lo recibe otra persona?'));

    receptorWrap = el('div', 'cart-envio-campos');
    receptorWrap.hidden = true;
    receptorNombreIn = el('input'); receptorNombreIn.type = 'text'; receptorNombreIn.placeholder = 'Nombre de quien recibe';
    receptorTelefonoIn = el('input'); receptorTelefonoIn.type = 'tel'; receptorTelefonoIn.placeholder = 'Teléfono de quien recibe';
    receptorWrap.appendChild(campo('Nombre de quien recibe', receptorNombreIn));
    receptorWrap.appendChild(campo('Teléfono de quien recibe', receptorTelefonoIn));
    recibeOtraChk.addEventListener('change', function () { receptorWrap.hidden = !recibeOtraChk.checked; });

    costoLinea = el('p', 'cart-envio-costo');
    costoLinea.hidden = true;
    minimoLinea = el('p', 'cart-envio-minimo');
    minimoLinea.hidden = true;

    var envioInmediatoLabel = el('label', 'cart-recibe-otra');
    envioInmediatoChk = document.createElement('input');
    envioInmediatoChk.type = 'checkbox';
    envioInmediatoChk.addEventListener('change', function () { aplicarEnvioInmediato(envioInmediatoChk.checked); });
    envioInmediatoLabel.appendChild(envioInmediatoChk);
    envioInmediatoLabel.appendChild(el('span', null, 'Envío inmediato — sale en el próximo turno (con recargo)'));
    envioInmediatoLinea = el('p', 'cart-field-hint');
    envioInmediatoLinea.hidden = true;

    var zonaCampo = campo('Zona / barrio', zonaSel);
    envioWrap.appendChild(zonaCampo);
    envioWrap.appendChild(zonaHint);
    envioWrap.appendChild(campo('Dirección', direccionIn));
    envioWrap.appendChild(direccionLink);
    envioWrap.appendChild(direccionHint);
    envioWrap.appendChild(campo('Entre qué calles', entreCallesIn));
    envioWrap.appendChild(campo('Piso / depto / timbre', pisoDeptoIn));
    envioWrap.appendChild(recibeLabel);
    envioWrap.appendChild(receptorWrap);
    envioWrap.appendChild(envioInmediatoLabel);
    envioWrap.appendChild(envioInmediatoLinea);
    envioWrap.appendChild(costoLinea);
    envioWrap.appendChild(minimoLinea);

    // Sin reparto propio: zona y envío inmediato no aplican — sólo dirección
    // (para pasársela a quien lo retire) y el aviso de entregaInfoWrap, más
    // abajo. No se sacan del DOM, sólo se ocultan: si entrega_propia vuelve
    // a true no hay que reconstruir nada de esto.
    if (!entregaPropia()) {
      zonaCampo.hidden = true;
      zonaHint.hidden = true;
      envioInmediatoLabel.hidden = true;
      envioInmediatoLinea.hidden = true;
    }

    diasWrap = el('div', 'cart-dias');
    fechaIn = el('input'); fechaIn.type = 'date';
    fechaIn.addEventListener('change', function () {
      Array.prototype.forEach.call(diasWrap.children, function (c) { c.classList.remove('is-on'); });
      refrescarFranjas();
    });
    franjasWrap = el('div', 'cart-chips');
    franjaHint = el('p', 'cart-field-hint');

    fechaFranjaWrap = el('div');
    fechaFranjaWrap.appendChild(campo('¿Para cuándo lo necesitás?', diasWrap));
    fechaFranjaWrap.appendChild(fechaIn);
    fechaFranjaWrap.appendChild(campo('Franja horaria', franjasWrap));
    fechaFranjaWrap.appendChild(franjaHint);

    entregaInfoWrap = el('div', 'cart-envio-info');
    entregaInfoWrap.appendChild(el('p', 'cart-field-hint', entregaPropia()
      ? 'Te lo entregamos en 1 a 3 días hábiles. Te confirmamos por WhatsApp el día y el horario exacto (de 9 a 13 o de 17 a 21).'
      : 'El envío lo coordinás vos: pedís un remis, Uber Moto o Uber Envíos que lo retire en el local y lo lleve a la dirección que nos dejaste. El costo del viaje lo pagás directo a quien te lo lleva.'));
    entregaInfoWrap.hidden = true;

    raiz.appendChild(el('h3', 'cart-foot-t', 'Tus datos'));
    raiz.appendChild(campo('Nombre', nombreIn));
    raiz.appendChild(campo('¿Retirás o te lo enviamos?', metodoWrap));
    raiz.appendChild(sucursalesWrap);
    raiz.appendChild(envioWrap);
    raiz.appendChild(fechaFranjaWrap);
    raiz.appendChild(entregaInfoWrap);

    pintarSucursales();
    pintarZonas();
    actualizarBloqueEntrega();
    refrescarDias();
    refrescarFranjas();
    datosCargados = true;

    MMEnvios.cargar().then(function () {
      pintarSucursales();
      pintarZonas();
      refrescarDias();
    });
  }

  function leer() {
    var z = zonaActual();
    var suc = MMEnvios.sucursales().filter(function (x) { return x.id === sucursalId; })[0];
    var franja = fechaIn.value
      ? MMEnvios.franjas(MMEnvios.isodow(fechaIn.value)).filter(function (x) { return x.id === franjaId; })[0]
      : null;
    // Envío estándar (sin envío inmediato) ya no trae fecha/franja elegidas
    // por el cliente: las asigna el negocio al armar las rutas. El envío
    // inmediato es la excepción — ahí sí hay un turno concreto resuelto.
    var ocultarFecha = metodo === 'envio' && !envioInmediato;
    return {
      nombre: nombreIn.value.trim(),
      // Ya no se pide acá: por WhatsApp el número queda a la vista solo. Si
      // la cuenta tiene uno cargado (Ajustes), viaja igual con el pedido
      // guardado en la base para que el admin pueda avisar por WhatsApp
      // cuando esté listo (ver admin-pedidos.js) — sin pedírselo de nuevo.
      telefono: (window.MMCuenta && MMCuenta.telefono && MMCuenta.telefono()) || '',
      metodoEntrega: metodo,
      sucursalId: metodo === 'retiro' ? sucursalId : null,
      sucursalNombre: metodo === 'retiro' && suc ? suc.nombre : '',
      zonaId: metodo === 'envio' ? zonaId : null,
      zonaNombre: metodo === 'envio' && z ? z.nombre : '',
      direccion: metodo === 'envio' ? direccionIn.value.trim() : '',
      entreCalles: metodo === 'envio' ? entreCallesIn.value.trim() : '',
      pisoDepto: metodo === 'envio' ? pisoDeptoIn.value.trim() : '',
      receptorNombre: metodo === 'envio' && recibeOtraChk.checked ? receptorNombreIn.value.trim() : '',
      receptorTelefono: metodo === 'envio' && recibeOtraChk.checked ? receptorTelefonoIn.value.trim() : '',
      fechaEntrega: ocultarFecha ? '' : (fechaIn.value || ''),
      franjaId: ocultarFecha ? null : franjaId,
      franjaNombre: ocultarFecha ? '' : (franja ? franja.nombre : ''),
      envioInmediato: metodo === 'envio' && envioInmediato && !!turnoInmediato,
      costoEnvio: metodo === 'envio' && entregaPropia()
        ? MMEnvios.costoDe(zonaId) + (envioInmediato && turnoInmediato ? Number(MMEnvios.config().costo_envio_inmediato || 0) : 0)
        : 0,
      // Viaja con el pedido (queda guardado en el link de pedido.html) para
      // que ese resumen muestre lo que era cierto CUANDO SE HIZO el pedido,
      // no lo que diga envio_config si lo cambian después.
      entregaPropia: entregaPropia()
    };
  }

  function validar() {
    var d = leer();
    if (!d.metodoEntrega) return { ok: false, mensaje: 'Elegí si retirás en el local o te lo enviamos a domicilio.' };
    if (d.metodoEntrega === 'retiro' && !d.sucursalId) return { ok: false, mensaje: 'Elegí en qué sucursal retirás.' };
    if (d.metodoEntrega === 'retiro' && !d.fechaEntrega) return { ok: false, mensaje: 'Elegí para cuándo lo necesitás.' };
    if (d.metodoEntrega === 'retiro' && !d.franjaId) return { ok: false, mensaje: 'Elegí la franja horaria.' };
    if (d.metodoEntrega === 'envio' && envioInmediato && !d.fechaEntrega) {
      return { ok: false, mensaje: 'No encontramos un turno inmediato disponible — probá sin envío inmediato o escribinos por WhatsApp.' };
    }
    // Sin reparto propio no hay zona que elegir (el <select> está oculto).
    if (d.metodoEntrega === 'envio' && entregaPropia() && !d.zonaId) return { ok: false, mensaje: 'Elegí tu zona.' };
    if (d.metodoEntrega === 'envio' && !d.direccion) return { ok: false, mensaje: 'Falta la dirección de envío.' };
    return { ok: true };
  }

  function prefijar(datos) {
    if (!datos) return;
    if (datos.nombre && !nombreIn.value.trim()) nombreIn.value = datos.nombre;
    if (datos.direccion && !direccionIn.value.trim()) { direccionIn.value = datos.direccion; refrescarLinkDireccion(); }
  }

  function resumenTexto() {
    var d = leer();
    var L = [];
    if (d.metodoEntrega === 'envio') {
      var linea = 'Envío';
      if (d.zonaNombre) linea += ' — ' + d.zonaNombre;
      if (d.direccion) linea += ' (' + d.direccion + ')';
      L.push('*Entrega:* ' + linea);
      if (d.entreCalles) L.push('*Entre calles:* ' + d.entreCalles);
      if (d.pisoDepto) L.push('*Piso/depto:* ' + d.pisoDepto);
      if (d.receptorNombre) L.push('*Lo recibe:* ' + d.receptorNombre + (d.receptorTelefono ? ' (' + d.receptorTelefono + ')' : ''));
      if (d.envioInmediato) L.push('*Envío inmediato:* sí, en el próximo turno disponible');
      if (d.costoEnvio) L.push('*Costo de envío:* ' + MMEnvios.plata(d.costoEnvio) + ' (más el total de los productos)');
    } else {
      L.push('*Entrega:* Retiro en ' + (d.sucursalNombre || 'el local'));
    }
    // Sin línea de teléfono acá a propósito: por WhatsApp el número del
    // cliente ya queda a la vista solo, sin que haga falta repetirlo.
    if (d.metodoEntrega === 'envio' && !d.envioInmediato && !d.fechaEntrega) {
      L.push(entregaPropia()
        ? '*Entrega estimada:* 1 a 3 días hábiles. Te confirmamos el día y el horario (de 9 a 13 o de 17 a 21) por WhatsApp.'
        : '*Envío:* lo coordina y paga el cliente (remis/Uber Moto/Uber Envíos) — retira en el local.');
    }
    if (d.fechaEntrega) L.push('*Para cuándo:* ' + MMEnvios.fechaLegible(d.fechaEntrega));
    if (d.franjaNombre) L.push('*Franja:* ' + d.franjaNombre);
    return L;
  }

  window.MMEnvioForm = {
    montar: montar,
    leer: leer,
    validar: validar,
    prefijar: prefijar,
    resumenTexto: resumenTexto
  };
})();
