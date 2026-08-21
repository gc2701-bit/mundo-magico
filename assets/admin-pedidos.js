/* Panel de administración de pedidos (admin-pedidos.html).
 *
 * No define su propia noción de "quién es admin": eso lo resuelve Supabase
 * con RLS (ver supabase/pedidos_envio.sql, tabla `admins`). Esta página sólo
 * pide sesión con el mismo modal de cuenta.js y consulta `pedidos` como
 * cualquier cliente — si la cuenta logueada está en `admins`, la política le
 * trae todos los pedidos; si no, sólo los propios. Así no hay forma de que
 * alguien sin permiso vea pedidos ajenos entrando a esta URL.
 */
(function () {
  'use strict';

  // Reusa el cliente que ya crea cuenta.js (mismo storage key): crear otro
  // acá disparaba el warning de Supabase por dos GoTrueClient concurrentes.
  if (!window.MMCuenta) return;
  var sb = window.MMCuenta.cliente();
  if (!sb) return;

  // window.MMEnvios (assets/envios.js) es la fuente de verdad de este
  // vocabulario; estas quedan como respaldo si ese script no llegó a cargar.
  var ESTADOS = window.MMEnvios ? window.MMEnvios.ESTADOS : ['nuevo', 'confirmado', 'en_preparacion', 'listo', 'entregado', 'cancelado'];
  var ESTADOS_TXT = window.MMEnvios ? window.MMEnvios.ESTADOS_TXT : {
    nuevo: 'Nuevo',
    confirmado: 'Confirmado',
    en_preparacion: 'En preparación',
    listo: 'Listo',
    entregado: 'Entregado',
    cancelado: 'Cancelado'
  };

  // El plan de reparto agrupa por fecha real (no por "día 1/2/3" fijo): la
  // clave es la fecha sola, y adentro de cada grupo-día el recorrido cruza
  // todos los corredores que tengan pedidos ese día (ver ordenarGrupo).
  var CORREDOR_TXT = { centro: 'Centro', oeste: 'Oeste', norte: 'Norte', este: 'Este', sur: 'Sur' };
  var DIA_SEMANA_TXT = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  var repartidoresCache = null; // se carga una sola vez, sólo si se usa el modo "plan"
  var plantillasCache = null;

  // E7: sin cron ni envío automático — el sitio es estático. Estos botones
  // sólo arman el texto y abren/copian el link de wa.me; una persona sigue
  // siendo quien aprieta enviar.
  function asegurarPlantillas(cb) {
    if (plantillasCache) { cb(plantillasCache); return; }
    sb.from('mensajes_plantillas').select('*').eq('activa', true).then(function (r) {
      plantillasCache = {};
      (r.data || []).forEach(function (row) { plantillasCache[row.estado] = row.cuerpo; });
      cb(plantillasCache);
    }, function () { cb({}); });
  }

  function resolverMensaje(p, cuerpo) {
    var suc = window.MMEnvios ? MMEnvios.sucursales().filter(function (s) { return s.id === (p.sucursal_id || p.sucursal_armado); })[0] : null;
    var franjaTxt = '';
    if (window.MMEnvios && p.franja_id && p.fecha_entrega) {
      var f = MMEnvios.franjas(MMEnvios.isodow(p.fecha_entrega)).filter(function (x) { return x.id === p.franja_id; })[0];
      if (f) franjaTxt = f.nombre;
    }
    var valores = {
      '{nombre}': p.nombre || '',
      '{numero}': p.numero != null ? String(p.numero) : '',
      '{fecha}': p.fecha_entrega ? fechaLegible(p.fecha_entrega) : '',
      '{franja}': franjaTxt,
      '{sucursal}': suc ? suc.nombre : '',
      '{zona}': p.zona_nombre || p.zona || '',
      '{costo_envio}': p.costo_envio && window.MMEnvios ? MMEnvios.plata(p.costo_envio) : '',
      '{link}': location.origin + '/'
    };
    var out = cuerpo;
    Object.keys(valores).forEach(function (k) { out = out.split(k).join(valores[k]); });
    return out;
  }

  function botonAvisar(p) {
    var btn = el('button', 'adm-card-avisar', 'Avisar por WhatsApp');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      // La plantilla de "confirmado" ya promete {fecha}/{franja}: si todavía
      // no se le asignó una a este envío (ver bloqueFechaEnvio), avisar antes
      // de mandar un mensaje con esos datos en blanco.
      if (p.estado === 'confirmado' && p.metodo_entrega === 'envio' && !p.fecha_entrega) {
        if (!confirm('Todavía no le asignaste fecha/franja a este envío — el mensaje va a salir sin esos datos. ¿Mandarlo igual?')) return;
      }
      asegurarPlantillas(function (plantillas) {
        var cuerpo = plantillas[p.estado];
        if (!cuerpo) { alert('No hay una plantilla activa para el estado "' + (ESTADOS_TXT[p.estado] || p.estado) + '".'); return; }
        var msg = resolverMensaje(p, cuerpo);
        var tel = window.MMEnvios ? MMEnvios.telWa(p.telefono || '') : (p.telefono || '').replace(/\D/g, '');
        window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
      });
    });
    return btn;
  }

  // Copia UN bloque de texto con un mensaje por pedido del grupo, listo
  // para pegar en WhatsApp Web de una sola vez. 25 links de a uno son 25
  // cambios de pestaña — esto es lo que hace que se use de verdad.
  function copiarAvisosDe(lista) {
    asegurarPlantillas(function (plantillas) {
      var lineas = [];
      lista.forEach(function (p) {
        if (!p.telefono) return;
        var cuerpo = plantillas[p.estado];
        if (!cuerpo) return;
        var tel = window.MMEnvios ? MMEnvios.telWa(p.telefono) : p.telefono.replace(/\D/g, '');
        lineas.push('+' + tel + ' → ' + resolverMensaje(p, cuerpo));
      });
      if (!lineas.length) { alert('No hay pedidos con teléfono y plantilla disponible en este grupo.'); return; }
      var texto = lineas.join('\n\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(function () {
          alert('Copiado ' + lineas.length + ' mensaje(s). Pegalo en WhatsApp Web.');
        }, function () { window.prompt('Copiá el texto (Ctrl+C):', texto); });
      } else {
        window.prompt('Copiá el texto (Ctrl+C):', texto);
      }
    });
  }

  function botonAvisarLote(grupoPedidos) {
    var btn = el('button', 'adm-avisar-lote', 'Copiar avisos del grupo');
    btn.type = 'button';
    btn.addEventListener('click', function () { copiarAvisosDe(grupoPedidos); });
    return btn;
  }
  var cuposCache = null;

  function tituloPlan(clave) {
    if (clave === 'retiro') return 'Retiro en el local (no requiere reparto)';
    if (clave === 'sinfecha') return 'Sin fecha o zona definida (revisar a mano)';
    var dow = window.MMEnvios ? MMEnvios.isodow(clave) : null;
    var diaTxt = dow ? DIA_SEMANA_TXT[dow] + ' ' : '';
    return diaTxt + fechaLegible(clave);
  }

  var gate = document.getElementById('adm-gate');
  var loginBtn = document.getElementById('adm-login-btn');
  var panel = document.getElementById('adm-panel');
  var sesionInfo = document.getElementById('adm-sesion');
  var logoutBtn = document.getElementById('adm-logout-btn');
  var agruparSel = document.getElementById('adm-agrupar');
  var filtroEstadoSel = document.getElementById('adm-filtro-estado');
  var refrescarBtn = document.getElementById('adm-refrescar');
  var statsEl = document.getElementById('adm-stats');
  var resumenEl = document.getElementById('adm-resumen');
  var gruposEl = document.getElementById('adm-grupos');
  var desdeIn = document.getElementById('adm-desde');
  var hastaIn = document.getElementById('adm-hasta');
  var verArchivadosChk = document.getElementById('adm-ver-archivados');
  var cargarMasBtn = document.getElementById('adm-cargar-mas');
  var archivarBtn = document.getElementById('adm-archivar');

  var pedidos = [];
  var PAGINA = 200;
  var paginaActual = 0;
  var hayMas = false;

  // Ventana por defecto: una semana para atrás (pedidos recién cambiados de
  // estado que todavía se están mirando) y un mes para adelante (lo que ya
  // se está por preparar). Se puede agrandar a mano con los campos de fecha.
  (function initFechas() {
    var d = new Date();
    d.setDate(d.getDate() - 7);
    var desde = d.toISOString().slice(0, 10);
    d.setDate(d.getDate() + 37);
    var hasta = d.toISOString().slice(0, 10);
    if (!desdeIn.value) desdeIn.value = desde;
    if (!hastaIn.value) hastaIn.value = hasta;
  })();

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  // "yyyy-mm-dd" → "dd/mm/aaaa" a mano: `new Date(iso)` interpreta la fecha
  // en UTC y en husos horarios negativos puede mostrar el día anterior.
  function fechaLegible(iso) {
    if (!iso) return '';
    if (window.MMEnvios) return window.MMEnvios.fechaLegible(iso);
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  ESTADOS.forEach(function (e) {
    var o = document.createElement('option');
    o.value = e;
    o.textContent = ESTADOS_TXT[e];
    filtroEstadoSel.appendChild(o);
  });
  // "Atrasados" no es un estado de la base: es un corte transversal (fecha
  // prometida ya pasada y el pedido sigue vivo). El prefijo __ evita que
  // alguna vez choque con un estado real.
  var opcionAtrasados = document.createElement('option');
  opcionAtrasados.value = '__atrasados';
  opcionAtrasados.textContent = 'Atrasados';
  filtroEstadoSel.appendChild(opcionAtrasados);

  // La fecha se compara en horario LOCAL: toISOString() es UTC y desde las
  // 21:00 de Argentina ya devuelve "mañana", marcando atrasos fantasma.
  function hoyLocalISO() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function esAtrasado(p) {
    return !!p.fecha_entrega && p.fecha_entrega < hoyLocalISO() &&
      p.estado !== 'entregado' && p.estado !== 'cancelado';
  }

  function pintarSesion() {
    if (!window.MMCuenta || !MMCuenta.sesionActiva()) {
      gate.hidden = false;
      panel.hidden = true;
      sesionInfo.hidden = true;
      logoutBtn.hidden = true;
      return;
    }
    sesionInfo.hidden = false;
    sesionInfo.textContent = 'Conectado como ' + (MMCuenta.nombre() || MMCuenta.email());
    logoutBtn.hidden = false;
    gate.hidden = true;
    panel.hidden = false;
    montarMetricas();
    cargarPedidos();
  }

  loginBtn.addEventListener('click', function () {
    if (window.MMCuenta) MMCuenta.pedirSesion(function () {});
  });

  logoutBtn.addEventListener('click', function () {
    if (window.MMCuenta) MMCuenta.cerrarSesion();
  });

  document.addEventListener('mm:sesion', pintarSesion);
  // cuenta.js resuelve la sesión (getSession) de forma asíncrona y puede
  // terminar — y disparar 'mm:sesion' — antes de que este script llegue a
  // registrar el listener de arriba (ambos son <script> del <body>, y el
  // navegador vacía la cola de microtareas entre uno y otro). Sin este
  // llamado directo, si ese fue el caso, el panel se queda trabado en
  // "Iniciar sesión" con la sesión ya activa hasta el próximo evento.
  pintarSesion();

  // `.or()` con fecha_entrega.is.null: un pedido sin fecha (todavía sin
  // coordinar) tiene que seguir apareciendo aunque esté fuera de la
  // ventana — si no, un pedido nuevo sin fecha desaparecería del panel,
  // que sería una regresión mucho peor que una lista un poco más larga.
  function consultaBase() {
    var q = sb.from('pedidos').select('*');
    if (!verArchivadosChk.checked) q = q.eq('archivado', false);
    var desde = desdeIn.value, hasta = hastaIn.value;
    if (desde && hasta) {
      q = q.or('fecha_entrega.is.null,and(fecha_entrega.gte.' + desde + ',fecha_entrega.lte.' + hasta + ')');
    }
    return q.order('fecha_entrega', { ascending: true, nullsFirst: false });
  }

  function cargarPedidos() {
    resumenEl.textContent = 'Cargando…';
    gruposEl.innerHTML = '';
    paginaActual = 0;
    consultaBase().range(0, PAGINA - 1)
      .then(function (r) {
        if (r.error) {
          resumenEl.textContent = 'No se pudieron cargar los pedidos. ' +
            '¿Ya corriste supabase/pedidos_envio.sql y te diste de alta en la tabla admins?';
          return;
        }
        pedidos = r.data || [];
        hayMas = pedidos.length === PAGINA;
        cargarMasBtn.hidden = !hayMas;
        pintarStats();
        pintarLista();
      }, function () {
        resumenEl.textContent = 'No se pudieron cargar los pedidos.';
      });
  }

  function cargarMasPedidos() {
    paginaActual++;
    var desde = paginaActual * PAGINA;
    cargarMasBtn.disabled = true;
    consultaBase().range(desde, desde + PAGINA - 1).then(function (r) {
      cargarMasBtn.disabled = false;
      if (r.error) { paginaActual--; return; }
      pedidos = pedidos.concat(r.data || []);
      hayMas = (r.data || []).length === PAGINA;
      cargarMasBtn.hidden = !hayMas;
      pintarStats();
      pintarLista();
    }, function () { cargarMasBtn.disabled = false; paginaActual--; });
  }

  function archivarViejos() {
    if (!window.confirm('¿Archivar los pedidos entregados/cancelados de hace más de 60 días? No se borran, sólo dejan de listarse acá salvo que actives "Ver archivados".')) return;
    archivarBtn.disabled = true;
    sb.rpc('archivar_pedidos_viejos', { p_dias: 60 }).then(function (r) {
      archivarBtn.disabled = false;
      if (r.error) { alert('No se pudo archivar: ' + r.error.message); return; }
      alert((r.data || 0) + ' pedido(s) archivado(s).');
      cargarPedidos();
    }, function () { archivarBtn.disabled = false; alert('No se pudo archivar.'); });
  }

  // --- E9: métricas, calculadas sobre la ventana ya cargada ----------------
  // Todo sale de `pedidos` (ya en memoria) más UNA sola consulta a
  // pedido_eventos, para las métricas que necesitan saber CUÁNDO pasó cada
  // cambio de estado y no sólo el estado actual. Se calculan todas juntas,
  // recién al abrir el panel — nadie las mira en cada carga.
  function montarMetricas() {
    var wrap = document.getElementById('adm-metricas-wrap');
    if (!wrap || wrap.dataset.armado) return;
    wrap.dataset.armado = '1';

    var toggle = el('button', 'adm-metricas-btn', 'Ver métricas de esta ventana');
    toggle.type = 'button';
    var panel = el('div', 'adm-metricas');
    panel.hidden = true;

    toggle.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) calcularMetricas(panel);
    });

    wrap.appendChild(toggle);
    wrap.appendChild(panel);
  }

  function mediana(nums) {
    if (!nums.length) return null;
    var s = nums.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  function diasEntre(a, b) { return (new Date(b) - new Date(a)) / 86400000; }

  function bultosDe(p) {
    return p.bultos === 'chico' ? 1 : p.bultos === 'mediano' ? 2 : p.bultos === 'grande' ? 3 : 1;
  }

  // El cliente ya no elige el tamaño al armar el pedido: lo clasifica quien
  // lo arma acá, normalmente al confirmarlo. Mientras nadie lo clasificó,
  // bultosDe() ya lo cuenta como 1 bulto para el cupo — "todavía no sé
  // cuánto ocupa" nunca debe bloquear nada, así que no hace falta pedirlo
  // antes de guardar el pedido.
  function bloqueTamano(p) {
    var sel = document.createElement('select');
    sel.className = 'adm-card-tamano-sel';
    [['', 'Tamaño: sin clasificar'], ['chico', 'Chico'], ['mediano', 'Mediano'], ['grande', 'Grande']].forEach(function (par) {
      var o = document.createElement('option');
      o.value = par[0];
      o.textContent = par[1];
      if ((p.bultos || '') === par[0]) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      sel.disabled = true;
      sb.from('pedidos').update({ bultos: sel.value || null }).eq('id', p.id).then(function (r) {
        sel.disabled = false;
        if (r.error) { alert('No se pudo guardar el tamaño.'); return; }
        p.bultos = sel.value || null;
      }, function () { sel.disabled = false; alert('No se pudo guardar el tamaño.'); });
    });
    return sel;
  }

  function calcularMetricas(panel) {
    panel.innerHTML = 'Calculando…';
    var ids = pedidos.map(function (p) { return p.id; });
    var pedidoEventos = [];

    var pedirEventos = ids.length
      ? sb.from('pedido_eventos').select('*').in('pedido_id', ids).then(function (r) { pedidoEventos = r.data || []; }, function () {})
      : Promise.resolve();

    function bloque(titulo) {
      var b = el('div', 'adm-metrica');
      b.appendChild(el('h3', 'adm-metrica-t', titulo));
      return b;
    }

    // 1. Demora mediana nuevo → confirmado, + pedidos trabados 48hs+.
    function metricaRespuesta() {
      var b = bloque('Demora en confirmar (nuevo → confirmado)');
      var demoras = [];
      var porPedido = {};
      pedidoEventos.forEach(function (ev) { (porPedido[ev.pedido_id] = porPedido[ev.pedido_id] || []).push(ev); });
      // No existe un evento "→ nuevo": ese es el estado inicial puesto en el
      // INSERT, y el trigger de auditoría sólo corre en UPDATE. El punto de
      // partida real es el created_at del propio pedido.
      var pedidoPorId = {};
      pedidos.forEach(function (p) { pedidoPorId[p.id] = p; });
      Object.keys(porPedido).forEach(function (pid) {
        var evs = porPedido[pid];
        var eConf = evs.filter(function (e) { return e.estado_nuevo === 'confirmado'; })[0];
        var p = pedidoPorId[pid];
        if (eConf && p) demoras.push(diasEntre(p.created_at, eConf.created_at) * 24);
      });
      var med = mediana(demoras);
      var ahora = new Date();
      var trabados = pedidos.filter(function (p) { return p.estado === 'nuevo' && diasEntre(p.created_at, ahora) > 2; }).length;
      b.appendChild(el('p', null, med != null ? ('Mediana: ' + med.toFixed(1) + ' hora(s), sobre ' + demoras.length + ' pedido(s).') : 'Sin datos suficientes todavía.'));
      b.appendChild(el('p', null, trabados + ' pedido(s) llevan más de 48hs en "nuevo" sin confirmar.'));
      return b;
    }

    // 2. Tasa de entregas fallidas por zona, por motivo.
    function metricaFallas() {
      var b = bloque('Entregas fallidas por zona');
      var porZona = {};
      pedidos.forEach(function (p) {
        var zona = p.zona_nombre || p.zona || (p.metodo_entrega === 'retiro' ? 'Retiro' : 'Sin zona');
        porZona[zona] = porZona[zona] || { total: 0, fallidos: 0, motivos: {} };
        porZona[zona].total++;
        if (p.motivo_ausente) {
          porZona[zona].fallidos++;
          porZona[zona].motivos[p.motivo_ausente] = (porZona[zona].motivos[p.motivo_ausente] || 0) + 1;
        }
      });
      var filas = Object.keys(porZona).filter(function (z) { return porZona[z].fallidos > 0; });
      if (!filas.length) { b.appendChild(el('p', null, 'Sin entregas fallidas en esta ventana.')); return b; }
      filas.forEach(function (z) {
        var d = porZona[z];
        var motivosTxt = Object.keys(d.motivos).map(function (m) { return m + ': ' + d.motivos[m]; }).join(', ');
        b.appendChild(el('p', null, z + ': ' + d.fallidos + '/' + d.total + ' (' + motivosTxt + ')'));
      });
      return b;
    }

    // 3. Uso del cupo por corredor y día de la semana.
    function metricaCupos() {
      var b = bloque('Uso del cupo por corredor y día');
      var usoPorClave = {};
      pedidos.forEach(function (p) {
        if (p.estado === 'cancelado' || !p.fecha_entrega || !p.zona_id || !window.MMEnvios) return;
        var z = MMEnvios.zona(p.zona_id);
        if (!z) return;
        var dow = MMEnvios.isodow(p.fecha_entrega);
        var k = z.grupo_ruta + '·' + dow;
        usoPorClave[k] = usoPorClave[k] || { n: 0, bultos: 0 };
        usoPorClave[k].n++;
        usoPorClave[k].bultos += bultosDe(p);
      });
      var claves = Object.keys(usoPorClave);
      if (!claves.length) { b.appendChild(el('p', null, 'Sin envíos con zona y fecha en esta ventana.')); return b; }
      claves.sort().forEach(function (k) {
        var partes = k.split('·');
        var cupo = (cuposCache || []).filter(function (c) { return c.grupo_ruta === partes[0] && String(c.dia_semana) === partes[1]; })[0];
        var uso = usoPorClave[k];
        var pct = cupo ? Math.round(100 * uso.n / cupo.cupo_pedidos) : null;
        b.appendChild(el('p', null, (CORREDOR_TXT[partes[0]] || partes[0]) + ' / ' + DIA_SEMANA_TXT[partes[1]] + ': ' +
          uso.n + (cupo ? '/' + cupo.cupo_pedidos : '') + ' pedidos' + (pct != null ? ' (' + pct + '%)' : '')));
      });
      return b;
    }

    // 4. Pedidos y bultos por zona por mes.
    function metricaZonaMes() {
      var b = bloque('Pedidos y bultos por zona y mes');
      var porClave = {};
      pedidos.forEach(function (p) {
        if (!p.fecha_entrega) return;
        var zona = p.zona_nombre || p.zona || (p.metodo_entrega === 'retiro' ? 'Retiro' : 'Sin zona');
        var k = p.fecha_entrega.slice(0, 7) + ' · ' + zona;
        porClave[k] = porClave[k] || { n: 0, bultos: 0 };
        porClave[k].n++;
        porClave[k].bultos += bultosDe(p);
      });
      var claves = Object.keys(porClave).sort();
      if (!claves.length) { b.appendChild(el('p', null, 'Sin datos.')); return b; }
      claves.forEach(function (k) { b.appendChild(el('p', null, k + ': ' + porClave[k].n + ' pedido(s) · ' + porClave[k].bultos + ' bulto(s)')); });
      return b;
    }

    // 5. Tasa de reprogramación por mes.
    function metricaReprogramacion() {
      var b = bloque('Reprogramaciones por mes');
      var porMes = {};
      pedidoEventos.forEach(function (ev) {
        if (ev.estado_nuevo !== 'reprogramado') return;
        var mes = ev.created_at.slice(0, 7);
        porMes[mes] = (porMes[mes] || 0) + 1;
      });
      var meses = Object.keys(porMes).sort();
      if (!meses.length) { b.appendChild(el('p', null, 'Sin reprogramaciones en esta ventana.')); return b; }
      meses.forEach(function (m) { b.appendChild(el('p', null, m + ': ' + porMes[m] + ' reprogramación(es)')); });
      return b;
    }

    // 6. Anticipación realmente usada (fecha_entrega − created_at).
    function metricaAnticipacion() {
      var b = bloque('Anticipación real (fecha pedida − fecha del pedido)');
      var dias = pedidos.filter(function (p) { return p.fecha_entrega; })
        .map(function (p) { return diasEntre(p.created_at, p.fecha_entrega + 'T00:00:00'); });
      var med = mediana(dias);
      b.appendChild(el('p', null, med != null ? ('Mediana: ' + med.toFixed(1) + ' día(s), sobre ' + dias.length + ' pedido(s).') : 'Sin datos.'));
      return b;
    }

    // 7. Reparto de retiros por sucursal + demora del traslado a Yerba Buena.
    function metricaSucursales() {
      var b = bloque('Retiros por sucursal y demora del traslado');
      var porSuc = {};
      pedidos.forEach(function (p) {
        if (p.metodo_entrega !== 'retiro' || !p.sucursal_id) return;
        var s = window.MMEnvios ? MMEnvios.sucursales().filter(function (x) { return x.id === p.sucursal_id; })[0] : null;
        var nombre = s ? s.nombre : p.sucursal_id;
        porSuc[nombre] = (porSuc[nombre] || 0) + 1;
      });
      Object.keys(porSuc).sort().forEach(function (n) { b.appendChild(el('p', null, n + ': ' + porSuc[n] + ' retiro(s)')); });

      var demoras = [];
      var porPedido = {};
      pedidoEventos.forEach(function (ev) { (porPedido[ev.pedido_id] = porPedido[ev.pedido_id] || []).push(ev); });
      Object.keys(porPedido).forEach(function (pid) {
        var evs = porPedido[pid];
        var eTransito = evs.filter(function (e) { return e.estado_nuevo === 'en_transito'; })[0];
        var eListo = evs.filter(function (e) { return e.estado_nuevo === 'listo'; })[0];
        if (eTransito && eListo) demoras.push(diasEntre(eTransito.created_at, eListo.created_at) * 24);
      });
      var med = mediana(demoras);
      b.appendChild(el('p', null, med != null
        ? ('Demora mediana del traslado a Yerba Buena: ' + med.toFixed(1) + ' hora(s), sobre ' + demoras.length + ' traslado(s).')
        : 'Sin traslados completados en esta ventana.'));
      return b;
    }

    Promise.all([pedirEventos, new Promise(function (res) { asegurarCupos(res); })]).then(function () {
      panel.innerHTML = '';
      panel.appendChild(metricaRespuesta());
      panel.appendChild(metricaFallas());
      panel.appendChild(metricaCupos());
      panel.appendChild(metricaZonaMes());
      panel.appendChild(metricaReprogramacion());
      panel.appendChild(metricaAnticipacion());
      panel.appendChild(metricaSucursales());
    });
  }

  // Cuenta cuántos pedidos hay en cada estado, sin importar el filtro ni el
  // agrupamiento elegidos: es la respuesta rápida a "¿cuáles se confirmaron
  // y cuáles no?" sin tener que cambiar de vista. Cada badge es también un
  // atajo al filtro de esa misma pestaña.
  function pintarStats() {
    statsEl.innerHTML = '';

    function badge(valor, cantidad, etiqueta, clase) {
      var b = el('button', 'adm-stat' + (clase ? ' ' + clase : '') +
        (filtroEstadoSel.value === valor ? ' is-on' : ''));
      b.type = 'button';
      b.appendChild(el('b', null, String(cantidad)));
      b.appendChild(el('span', null, etiqueta));
      b.addEventListener('click', function () {
        filtroEstadoSel.value = valor;
        pintarStats();
        pintarLista();
      });
      statsEl.appendChild(b);
    }

    badge('', pedidos.length, 'Todos', null);
    ESTADOS.forEach(function (e) {
      var n = pedidos.filter(function (p) { return p.estado === e; }).length;
      badge(e, n, ESTADOS_TXT[e], 'ep-' + e);
    });
    // Sólo aparece cuando hay al menos uno: un "0 atrasados" permanente
    // acostumbra el ojo a ignorar el badge justo el día que importa.
    var atrasados = pedidos.filter(esAtrasado).length;
    if (atrasados) badge('__atrasados', atrasados, 'Atrasados', 'is-atrasado');

    // Atajo del final del día: avisar de una a todos los retiros que ya
    // están listos, sin ir grupo por grupo. Usa la misma plantilla "listo"
    // y el mismo bloque copiable que "Copiar avisos del grupo".
    var retirosListos = pedidos.filter(function (p) {
      return p.estado === 'listo' && p.metodo_entrega === 'retiro' && p.telefono;
    });
    if (retirosListos.length) {
      var avisarRetiros = el('button', 'adm-stat is-accion');
      avisarRetiros.type = 'button';
      avisarRetiros.appendChild(el('b', null, String(retirosListos.length)));
      avisarRetiros.appendChild(el('span', null, 'Avisar retiros listos'));
      avisarRetiros.addEventListener('click', function () { copiarAvisosDe(retirosListos); });
      statsEl.appendChild(avisarRetiros);
    }
  }

  function claveGrupo(p, modo) {
    if (modo === 'fecha') return p.fecha_entrega ? fechaLegible(p.fecha_entrega) : 'Sin fecha pedida';
    if (modo === 'metodo') return p.metodo_entrega === 'envio' ? 'Envío a domicilio' : 'Retiro en el local';
    if (modo === 'zona') {
      if (p.metodo_entrega !== 'envio') return 'Retiro en el local';
      return p.zona || 'Envío sin zona indicada';
    }
    if (modo === 'estado') return ESTADOS_TXT[p.estado] || p.estado || 'Sin estado';
    if (modo === 'plan') {
      // Un solo grupo por día, cruzando todos los corredores: antes cada
      // corredor tenía su propia sección con su propio mapa, así que un
      // pedido a "Centro" y otro a "Oeste" el mismo día salían como dos
      // recorridos separados aunque los hiciera el mismo viaje. Ahora se
      // arma un único recorrido por día (ver ordenarGrupo) y adentro se
      // resuelve el orden óptimo entre todas las zonas del día.
      if (p.metodo_entrega === 'retiro') {
        // El mismo viaje que reparte reposiciona estos retiros hasta la
        // sucursal con transferencia (hoy, la de Yerba Buena): se fusionan
        // como una parada más del día, en vez de vivir en un grupo aparte.
        if (esTraslado(p) && p.fecha_entrega) return p.fecha_entrega;
        return 'retiro';
      }
      var z = window.MMEnvios && p.zona_id ? MMEnvios.zona(p.zona_id) : null;
      if (!p.fecha_entrega || !z) return 'sinfecha';
      return p.fecha_entrega;
    }
    if (modo === 'traslado') {
      if (!esTraslado(p)) return null;
      var suc = window.MMEnvios ? MMEnvios.sucursales().filter(function (s) { return s.id === p.sucursal_id; })[0] : null;
      return suc ? suc.nombre : 'Sucursal sin identificar';
    }
    return 'Todos';
  }

  // El traslado es "arma en el Centro, viaja a otra sucursal" — se
  // reconoce por sucursal_armado <> sucursal_id, no por una bandera aparte.
  // Sólo importa mientras el pedido todavía está en camino.
  function esTraslado(p) {
    return p.metodo_entrega === 'retiro' && p.sucursal_id && p.sucursal_armado &&
      p.sucursal_armado !== p.sucursal_id &&
      (p.estado === 'en_preparacion' || p.estado === 'en_transito');
  }

  // Guarda un cambio de estado. `extra` puede llevar motivo_ausente cuando
  // el paso es → ausente. El historial (pedido_eventos) lo escribe solo un
  // trigger del lado del servidor — acá sólo se actualiza `estado`.
  function actualizarEstado(p, nuevo, extra, cb) {
    var payload = Object.assign({ estado: nuevo }, extra || {});
    sb.from('pedidos').update(payload).eq('id', p.id).then(function (r) {
      if (r.error) { alert('No se pudo actualizar el estado.'); cb(false); return; }
      p.estado = nuevo;
      if (extra && extra.motivo_ausente) p.motivo_ausente = extra.motivo_ausente;
      pintarStats();
      cb(true);
    }, function () {
      alert('No se pudo actualizar el estado.');
      cb(false);
    });
  }

  // Fila de botones con sólo los pasos plausibles desde el estado actual
  // (MMEnvios.siguientes), más un link "Corregir estado" que despliega el
  // <select> completo para el caso "lo marqué mal, hay que volver atrás".
  // → ausente pide motivo antes de guardar: sin eso, la métrica de fallas
  // de entrega no se puede calcular después.
  function bloqueEstado(p) {
    var wrap = el('div', 'adm-card-paso-wrap');

    function siguientesDe() {
      if (window.MMEnvios) return MMEnvios.siguientes(p.estado, p.metodo_entrega, p.sucursal_id);
      return ESTADOS.filter(function (e) { return e !== p.estado; });
    }

    function pintar() {
      wrap.innerHTML = '';

      var badge = el('span', 'adm-card-estado-actual ep-' + p.estado, ESTADOS_TXT[p.estado] || p.estado);
      wrap.appendChild(badge);

      var pasos = el('div', 'adm-card-pasos');
      siguientesDe().forEach(function (destino) {
        var b = el('button', 'adm-card-paso', ESTADOS_TXT[destino] || destino);
        b.type = 'button';
        b.addEventListener('click', function () {
          if (destino === 'ausente') { pintarMotivo(); return; }
          b.disabled = true;
          actualizarEstado(p, destino, null, function (ok) { if (!ok) b.disabled = false; else pintar(); });
        });
        pasos.appendChild(b);
      });
      wrap.appendChild(pasos);

      var corregirBtn = el('button', 'adm-card-corregir', 'Corregir estado');
      corregirBtn.type = 'button';
      corregirBtn.addEventListener('click', pintarCorregir);
      wrap.appendChild(corregirBtn);
    }

    function pintarMotivo() {
      wrap.innerHTML = '';
      wrap.appendChild(el('span', 'adm-card-estado-actual ep-' + p.estado, ESTADOS_TXT[p.estado] || p.estado));

      var motivos = window.MMEnvios ? MMEnvios.MOTIVOS_AUSENTE : ['nadie_en_domicilio', 'direccion_inexistente', 'cliente_reprogramo', 'zona_inundada', 'vehiculo', 'otro'];
      var motivosTxt = window.MMEnvios ? MMEnvios.MOTIVOS_AUSENTE_TXT : {};
      var sel = document.createElement('select');
      sel.className = 'adm-card-motivo';
      motivos.forEach(function (m) {
        var o = document.createElement('option');
        o.value = m;
        o.textContent = motivosTxt[m] || m;
        sel.appendChild(o);
      });

      var confirmar = el('button', 'adm-card-paso', 'Confirmar');
      confirmar.type = 'button';
      confirmar.addEventListener('click', function () {
        confirmar.disabled = true;
        actualizarEstado(p, 'ausente', { motivo_ausente: sel.value }, function (ok) {
          if (!ok) confirmar.disabled = false; else pintar();
        });
      });

      var cancelar = el('button', 'adm-card-corregir', 'Cancelar');
      cancelar.type = 'button';
      cancelar.addEventListener('click', pintar);

      var fila = el('div', 'adm-card-pasos');
      fila.appendChild(sel);
      fila.appendChild(confirmar);
      fila.appendChild(cancelar);
      wrap.appendChild(fila);
    }

    function pintarCorregir() {
      wrap.innerHTML = '';
      wrap.appendChild(el('span', 'adm-card-estado-actual ep-' + p.estado, ESTADOS_TXT[p.estado] || p.estado));

      var sel = document.createElement('select');
      sel.className = 'adm-card-corregir-sel';
      ESTADOS.forEach(function (e) {
        var o = document.createElement('option');
        o.value = e;
        o.textContent = ESTADOS_TXT[e];
        if (e === p.estado) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () {
        var nuevo = sel.value;
        var anterior = p.estado;
        sel.disabled = true;
        actualizarEstado(p, nuevo, null, function (ok) {
          sel.disabled = false;
          if (!ok) { sel.value = anterior; return; }
          pintar();
        });
      });

      var cancelar = el('button', 'adm-card-corregir', 'Volver');
      cancelar.type = 'button';
      cancelar.addEventListener('click', pintar);

      var fila = el('div', 'adm-card-pasos');
      fila.appendChild(sel);
      fila.appendChild(cancelar);
      wrap.appendChild(fila);
    }

    pintar();
    return wrap;
  }

  // Historial de cambios (pedido_eventos): se carga recién al abrirlo, no de
  // arranque con la lista — con 10-25 pedidos por día no pesa, pero no hay
  // necesidad de traerlo si nadie lo mira.
  function bloqueHistoria(p) {
    var wrap = el('div', 'adm-card-historia-wrap');
    var toggle = el('button', 'adm-card-historia-btn', 'Ver historial');
    toggle.type = 'button';
    var lista = el('div', 'adm-card-historia');
    lista.hidden = true;
    var cargado = false;

    toggle.addEventListener('click', function () {
      lista.hidden = !lista.hidden;
      if (lista.hidden || cargado) return;
      cargado = true;
      lista.textContent = 'Cargando…';
      sb.from('pedido_eventos').select('*').eq('pedido_id', p.id).order('created_at', { ascending: true })
        .then(function (r) {
          lista.innerHTML = '';
          if (r.error || !r.data || !r.data.length) {
            lista.appendChild(el('p', 'adm-card-historia-item', 'Sin cambios registrados todavía.'));
            return;
          }
          r.data.forEach(function (ev) {
            var linea = (ev.estado_anterior ? (ESTADOS_TXT[ev.estado_anterior] || ev.estado_anterior) + ' → ' : '') +
              (ESTADOS_TXT[ev.estado_nuevo] || ev.estado_nuevo);
            if (ev.motivo) linea += ' (' + ev.motivo + ')';
            var cuando = new Date(ev.created_at).toLocaleString('es-AR');
            var quien = ev.actor_email ? ' — ' + ev.actor_email : '';
            lista.appendChild(el('p', 'adm-card-historia-item', linea + ' · ' + cuando + quien));
          });
        });
    });

    wrap.appendChild(toggle);
    wrap.appendChild(lista);
    return wrap;
  }

  // Punto de partida del recorrido: coordenadas del depósito (Junín 351,
  // microcentro). El sitio no geocodifica direcciones (no hay clave de
  // Google Maps configurada — ver tramosMapas), así que se aproxima con el
  // mismo par lat/lng que ya tiene la zona "Microcentro" en
  // supabase/envios_08_zona_geo.sql, a una cuadra de distancia real.
  var DEPOSITO_LAT = -26.8252, DEPOSITO_LNG = -65.2251;

  function distanciaKmAdm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Coordenadas aproximadas de un pedido para ordenar el recorrido: la de
  // su zona si es un envío; si es un retiro-traslado (ver esTraslado), la
  // de "Yerba Buena" — hoy es la única sucursal con traslado y queda ahí.
  // Sin coordenadas (zona vieja sin lat/lng, o el respaldo sin conexión a
  // Supabase) devuelve null: ese pedido no se pierde, sólo no entra en el
  // cálculo de distancias y queda donde ya estaba (ver ordenarGrupo).
  function coordsPedido(p) {
    if (window.MMEnvios && p.zona_id) {
      var z = MMEnvios.zona(p.zona_id);
      if (z && z.lat != null && z.lng != null) return { lat: Number(z.lat), lng: Number(z.lng) };
    }
    if (esTraslado(p)) {
      var yb = window.MMEnvios ? MMEnvios.zona('yerba-buena') : null;
      if (yb && yb.lat != null && yb.lng != null) return { lat: Number(yb.lat), lng: Number(yb.lng) };
    }
    return null;
  }

  // Orden por defecto: "vecino más cercano" arrancando en el depósito —
  // junta todas las zonas del día (antes cada corredor armaba su propio
  // recorrido aparte) y en cada paso salta a la parada pendiente más
  // cercana a la última visitada. No es la ruta óptima exacta (eso es un
  // problema NP-difícil), pero con las pocas decenas de paradas de un día
  // normal da un recorrido razonable sin depender de ninguna API de mapas
  // paga. Si alguna tarjeta del grupo ya tiene orden_parada (por las
  // flechas ▲▼), ese orden manual gana sobre el automático para todo el
  // grupo.
  function ordenarGrupo(grupo) {
    var manual = grupo.some(function (p) { return p.orden_parada != null; });
    if (manual) {
      grupo.sort(function (a, b) {
        var oa = a.orden_parada == null ? 999999 : a.orden_parada;
        var ob = b.orden_parada == null ? 999999 : b.orden_parada;
        return oa - ob;
      });
      return;
    }
    var pendientes = grupo.slice();
    var ordenado = [];
    var lat = DEPOSITO_LAT, lng = DEPOSITO_LNG;
    while (pendientes.length) {
      var mejorI = -1, mejorD = Infinity;
      pendientes.forEach(function (p, i) {
        var c = coordsPedido(p);
        var d = c ? distanciaKmAdm(lat, lng, c.lat, c.lng) : Infinity;
        if (d < mejorD) { mejorD = d; mejorI = i; }
      });
      // Nadie tiene coordenadas: se van sacando en el orden que ya traían,
      // sin más vueltas (ver comentario de coordsPedido).
      if (mejorI === -1) mejorI = 0;
      var elegido = pendientes.splice(mejorI, 1)[0];
      var c2 = coordsPedido(elegido);
      if (c2) { lat = c2.lat; lng = c2.lng; }
      ordenado.push(elegido);
    }
    grupo.length = 0;
    Array.prototype.push.apply(grupo, ordenado);
  }

  // Mueve una parada dentro de su grupo. La primera vez que se usa en un
  // grupo, materializa el orden que se está viendo en `orden_parada` para
  // todas las tarjetas de ese grupo — de ahí en más ese grupo ordena sólo
  // por orden_parada (ver ordenarGrupo).
  function moverParada(grupo, p, delta, cb) {
    var necesitaAsignar = grupo.some(function (x) { return x.orden_parada == null; });
    if (necesitaAsignar) grupo.forEach(function (x, i) { x.orden_parada = i; });
    var i = grupo.indexOf(p);
    var j = i + delta;
    if (j < 0 || j >= grupo.length) { cb(); return; }
    var tmp = grupo[i].orden_parada;
    grupo[i].orden_parada = grupo[j].orden_parada;
    grupo[j].orden_parada = tmp;
    var aGuardar = necesitaAsignar ? grupo : [grupo[i], grupo[j]];
    Promise.all(aGuardar.map(function (x) {
      return sb.from('pedidos').update({ orden_parada: x.orden_parada }).eq('id', x.id);
    })).then(cb, cb);
  }

  function asegurarRepartidores(cb) {
    if (repartidoresCache) { cb(repartidoresCache); return; }
    sb.from('repartidores').select('*').eq('activo', true).order('nombre').then(function (r) {
      repartidoresCache = r.data || [];
      cb(repartidoresCache);
    }, function () { cb([]); });
  }

  // El cliente ya no elige fecha/franja de envío al pedir (ver envio-form.js
  // — sólo retiro sigue con ese picker): un pedido de envío llega con
  // fecha_entrega/franja_id en null y acá, al armar el plan de reparto, se le
  // sugiere y asigna la fecha real. La sugerencia reutiliza MMEnvios.cupos(),
  // la misma función que antes usaba el picker del cliente, apuntando a la
  // ventana de 1 a 3 días hábiles que le prometemos y sólo si ahí no hay
  // cupo se corre más adelante dentro del horizonte configurado.
  function sumarDiasISOAdm(iso, n) {
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + n);
    var m = String(d.getMonth() + 1); if (m.length < 2) m = '0' + m;
    var day = String(d.getDate()); if (day.length < 2) day = '0' + day;
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function sugerirFechaEnvio(p, cb) {
    if (!window.MMEnvios || !p.zona_id) { cb(null); return; }
    var horizonte = MMEnvios.config().horizonte_dias || 14;
    var desde = MMEnvios.hoyISO();
    var hasta = sumarDiasISOAdm(desde, horizonte - 1);
    MMEnvios.cupos(desde, hasta, p.zona_id, null).then(function (dias) {
      var disponibles = (dias || []).filter(function (x) { return x.disponible; });
      if (!disponibles.length) { cb(null); return; }
      var enVentana = disponibles.filter(function (x) { return diasEntre(desde, x.fecha) <= 3; });
      cb((enVentana[0] || disponibles[0]).fecha);
    }, function () { cb(null); });
  }

  // Control de fecha/franja del pedido: precarga una sugerencia si todavía
  // no tiene una asignada, y queda editable — el admin puede aceptarla o
  // cambiarla a mano antes de guardar.
  function bloqueFechaEnvio(p) {
    var wrap = el('div', 'adm-card-fecha');
    var label = el('span', 'adm-card-fecha-label', p.fecha_entrega ? 'Fecha/franja asignada' : 'Asignar fecha/franja (sugerida)');
    var fechaSel = document.createElement('input');
    fechaSel.type = 'date';
    fechaSel.className = 'adm-card-fecha-in';
    fechaSel.value = p.fecha_entrega || '';
    var franjaSel = document.createElement('select');
    franjaSel.className = 'adm-card-fecha-franja';
    var guardar = el('button', 'adm-card-fecha-guardar', 'Guardar');
    guardar.type = 'button';

    function refrescarFranjaOpciones() {
      franjaSel.innerHTML = '';
      if (!fechaSel.value || !window.MMEnvios) return;
      var franjas = MMEnvios.franjas(MMEnvios.isodow(fechaSel.value));
      if (!franjas.length) {
        var op = document.createElement('option');
        op.value = '';
        op.textContent = 'Sin franjas ese día';
        franjaSel.appendChild(op);
        return;
      }
      franjas.forEach(function (f) {
        var o = document.createElement('option');
        o.value = f.id;
        o.textContent = f.nombre + ' (' + String(f.hora_inicio).slice(0, 5) + '–' + String(f.hora_fin).slice(0, 5) + ')';
        if (f.id === p.franja_id) o.selected = true;
        franjaSel.appendChild(o);
      });
    }
    fechaSel.addEventListener('change', refrescarFranjaOpciones);
    refrescarFranjaOpciones();

    if (!p.fecha_entrega) {
      sugerirFechaEnvio(p, function (fecha) {
        if (!fecha || fechaSel.value) return; // el admin ya tocó el campo mientras se calculaba
        fechaSel.value = fecha;
        refrescarFranjaOpciones();
      });
    }

    guardar.addEventListener('click', function () {
      if (!fechaSel.value || !franjaSel.value) { alert('Elegí fecha y franja.'); return; }
      guardar.disabled = true;
      sb.from('pedidos').update({ fecha_entrega: fechaSel.value, franja_id: franjaSel.value }).eq('id', p.id)
        .then(function (r) {
          guardar.disabled = false;
          if (r.error) { alert('No se pudo guardar la fecha.'); return; }
          p.fecha_entrega = fechaSel.value;
          p.franja_id = franjaSel.value;
          pintarLista();
        }, function () { guardar.disabled = false; alert('No se pudo guardar la fecha.'); });
    });

    wrap.appendChild(label);
    wrap.appendChild(fechaSel);
    wrap.appendChild(franjaSel);
    wrap.appendChild(guardar);
    return wrap;
  }

  function asegurarCupos(cb) {
    if (cuposCache) { cb(cuposCache); return; }
    sb.from('envio_cupos').select('*').then(function (r) {
      cuposCache = r.data || [];
      cb(cuposCache);
    }, function () { cb([]); });
  }

  // Cuenta contra TODA la base de pedidos cargada (no sólo lo que se ve en
  // el plan, que ya excluye entregados/cancelados) — es la misma cuenta que
  // hace cupos_disponibles() del lado del servidor.
  function contarUso(fecha, corredor) {
    var n = 0, bultos = 0;
    pedidos.forEach(function (p) {
      if (p.estado === 'cancelado' || p.fecha_entrega !== fecha) return;
      var z = window.MMEnvios && p.zona_id ? MMEnvios.zona(p.zona_id) : null;
      if (!z || z.grupo_ruta !== corredor) return;
      n++;
      bultos += p.bultos === 'chico' ? 1 : p.bultos === 'mediano' ? 2 : p.bultos === 'grande' ? 3 : 1;
    });
    return { n: n, bultos: bultos };
  }

  // Un tramo de ruta por cada ~9 waypoints (el techo práctico de la URL de
  // direcciones). Sin geocodificación: si una dirección está mal escrita,
  // rutea en silencio a otro lado — por eso la hoja impresa siempre lleva
  // la dirección cruda, no sólo el link.
  // Cada tramo da dos URLs: `abrir` (Maps con api=1, para abrir en pestaña
  // nueva o en el celular) y `embed` (el viejo maps.google.com con
  // output=embed, para mostrar el recorrido acá mismo sin API key — este
  // sitio no tiene una clave de Google Maps configurada en ningún lado).
  function tramosMapas(grupoOrdenado) {
    var direcciones = grupoOrdenado.map(function (p) { return p.direccion || p.zona_nombre || p.zona || ''; }).filter(Boolean);
    if (!direcciones.length) return [];
    var deposito = (window.MMEnvios ? MMEnvios.sucursales() : []).filter(function (s) { return s.es_deposito; })[0];
    var TRAMO = 9;
    var tramos = [];
    for (var i = 0; i < direcciones.length; i += TRAMO) {
      var trozo = direcciones.slice(i, i + TRAMO);
      var origen = i === 0 ? (deposito ? deposito.direccion : trozo[0]) : direcciones[i - 1];
      var destino = trozo[trozo.length - 1];
      var waypoints = trozo.slice(0, -1);
      var abrir = 'https://www.google.com/maps/dir/?api=1&travelmode=driving' +
        '&origin=' + encodeURIComponent(origen) +
        '&destination=' + encodeURIComponent(destino) +
        (waypoints.length ? '&waypoints=' + waypoints.map(encodeURIComponent).join('|') : '');
      var paradas = waypoints.concat([destino]).map(encodeURIComponent).join('+to:');
      var embed = 'https://maps.google.com/maps?saddr=' + encodeURIComponent(origen) +
        '&daddr=' + paradas + '&output=embed';
      tramos.push({ abrir: abrir, embed: embed });
    }
    return tramos;
  }

  function tarjeta(p, modo, grupo) {
    var traslado = esTraslado(p);
    var card = el('div', 'adm-card' + (traslado ? ' is-traslado' : ''));

    var top = el('div', 'adm-card-top');
    top.appendChild(el('b', null, p.nombre || 'Sin nombre'));
    if (traslado) top.appendChild(el('span', 'adm-card-traslado-tag', 'Traslado'));
    if (p.envio_inmediato) top.appendChild(el('span', 'adm-card-inmediato-tag', 'Envío inmediato'));
    if (esAtrasado(p)) {
      var diasAtraso = Math.round((new Date(hoyLocalISO() + 'T00:00:00') - new Date(p.fecha_entrega + 'T00:00:00')) / 86400000);
      top.appendChild(el('span', 'adm-card-atrasado-tag',
        'Atrasado ' + diasAtraso + ' día' + (diasAtraso > 1 ? 's' : '')));
    }
    if (p.telefono) {
      var tel = el('a', 'adm-card-tel', p.telefono);
      tel.href = 'https://wa.me/' + (window.MMEnvios ? window.MMEnvios.telWa(p.telefono) : p.telefono.replace(/\D/g, ''));
      tel.target = '_blank';
      tel.rel = 'noopener';
      top.appendChild(tel);
    }
    card.appendChild(top);

    var partes = [];
    if (traslado) {
      var sucOrigen = window.MMEnvios ? MMEnvios.sucursales().filter(function (s) { return s.id === p.sucursal_id; })[0] : null;
      partes.push('Retiro en ' + (sucOrigen ? sucOrigen.nombre : 'sucursal con traslado'));
    } else {
      partes.push(p.metodo_entrega === 'envio' ? 'Envío' : 'Retiro');
    }
    if (p.metodo_entrega === 'envio' && (p.zona_nombre || p.zona)) partes.push(p.zona_nombre || p.zona);
    if (p.metodo_entrega === 'envio' && p.direccion) partes.push(p.direccion);
    if (p.entre_calles) partes.push('entre ' + p.entre_calles);
    if (p.piso_depto) partes.push(p.piso_depto);
    if (p.fecha_entrega) partes.push('Para el ' + fechaLegible(p.fecha_entrega));
    card.appendChild(el('p', 'adm-card-meta', partes.join(' · ')));
    if (p.metodo_entrega === 'envio' && p.direccion) {
      // Sin geocodificar nada acá tampoco (mismo motivo que en
      // envio-form.js: no hay clave de Google Maps configurada) — es sólo
      // el link público de búsqueda, para chequear a ojo antes de repartir
      // que la dirección cargada existe y está bien escrita.
      var consultaMaps = p.direccion + (p.entre_calles ? ' entre ' + p.entre_calles : '') +
        (p.zona_nombre || p.zona ? ', ' + (p.zona_nombre || p.zona) : '') + ', Tucumán, Argentina';
      var mapsLink = el('a', 'adm-card-maps', 'Ver en Google Maps');
      mapsLink.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(consultaMaps);
      mapsLink.target = '_blank';
      mapsLink.rel = 'noopener';
      card.appendChild(mapsLink);
    }
    if (p.receptor_nombre) {
      card.appendChild(el('p', 'adm-card-meta', 'Lo recibe: ' + p.receptor_nombre +
        (p.receptor_telefono ? ' (' + p.receptor_telefono + ')' : '')));
    }

    var ul = el('ul', 'adm-card-items');
    (p.items || []).forEach(function (it) {
      var txt = it.q + 'x ' + it.t;
      if (it.v) txt += ' — ' + it.v;
      if (it.c) txt += ' [' + it.c + ']';
      ul.appendChild(el('li', null, txt));
    });
    card.appendChild(ul);
    card.appendChild(bloqueTamano(p));

    if (p.nota) card.appendChild(el('p', 'adm-card-nota', p.nota));

    var foot = el('div', 'adm-card-foot');
    var creado = new Date(p.created_at);
    foot.appendChild(el('span', 'adm-card-creado',
      'Pedido el ' + creado.toLocaleDateString('es-AR')));

    card.appendChild(foot);

    // Sólo en el plan de reparto: orden de la parada y repartidor asignado.
    // Nacen y mueren con esta tarjeta — no tiene sentido reordenar un
    // pedido agrupado por estado o por zona.
    if (modo === 'plan' && grupo) {
      var rutaBar = el('div', 'adm-card-ruta');

      var flechas = el('div', 'adm-card-flechas');
      var arriba = el('button', 'adm-card-flecha', '▲');
      arriba.type = 'button';
      var abajo = el('button', 'adm-card-flecha', '▼');
      abajo.type = 'button';
      [arriba, abajo].forEach(function (b) { b.setAttribute('aria-label', 'Mover parada'); });
      arriba.addEventListener('click', function () {
        arriba.disabled = true;
        moverParada(grupo, p, -1, function () { pintarLista(); });
      });
      abajo.addEventListener('click', function () {
        abajo.disabled = true;
        moverParada(grupo, p, 1, function () { pintarLista(); });
      });
      flechas.appendChild(arriba);
      flechas.appendChild(abajo);
      rutaBar.appendChild(flechas);

      if (!traslado && p.metodo_entrega === 'envio') {
        rutaBar.appendChild(bloqueFechaEnvio(p));
      }

      var repSel = document.createElement('select');
      repSel.className = 'adm-card-repartidor';
      var repVacia = document.createElement('option');
      repVacia.value = '';
      repVacia.textContent = 'Sin repartidor asignado';
      repSel.appendChild(repVacia);
      asegurarRepartidores(function (reps) {
        reps.forEach(function (r) {
          var o = document.createElement('option');
          o.value = r.id;
          o.textContent = r.nombre + (r.tipo === 'cadeteria' ? ' (cadetería)' : '');
          if (r.id === p.repartidor_id) o.selected = true;
          repSel.appendChild(o);
        });
      });
      repSel.addEventListener('change', function () {
        repSel.disabled = true;
        sb.from('pedidos').update({ repartidor_id: repSel.value || null }).eq('id', p.id).then(function (r) {
          repSel.disabled = false;
          if (r.error) { alert('No se pudo asignar el repartidor.'); return; }
          p.repartidor_id = repSel.value || null;
        }, function () { repSel.disabled = false; alert('No se pudo asignar el repartidor.'); });
      });
      rutaBar.appendChild(repSel);

      card.appendChild(rutaBar);

      // Sólo se ve al imprimir (ver @media print en admin-pedidos.css). El
      // traslado lo firma el empleado de la sucursal que lo recibe, no el
      // cliente — todavía no llegó a manos del cliente en ese momento.
      card.appendChild(el('p', 'adm-card-firma', traslado
        ? 'Recibido en sucursal por ________________________  ·  Hora ______'
        : 'Recibido por ________________________  ·  Hora ______  ·  ☐ Ausente'));
    }

    card.appendChild(bloqueEstado(p));
    if (p.telefono) card.appendChild(botonAvisar(p));
    card.appendChild(bloqueHistoria(p));
    return card;
  }

  function pintarLista() {
    var modo = agruparSel.value;
    var filtroEstado = filtroEstadoSel.value;
    var lista = filtroEstado === '__atrasados'
      ? pedidos.filter(esAtrasado)
      : (filtroEstado ? pedidos.filter(function (p) { return p.estado === filtroEstado; }) : pedidos.slice());

    // El plan de reparto es sólo lo que falta salir: si el estado no se
    // filtró a mano, se sacan los que ya están entregados o cancelados para
    // no ensuciar el recorrido con paradas que no hay que hacer.
    var yaResueltos = 0;
    if (modo === 'plan' && !filtroEstado) {
      var antes = lista.length;
      lista = lista.filter(function (p) { return p.estado !== 'entregado' && p.estado !== 'cancelado'; });
      yaResueltos = antes - lista.length;
    }

    gruposEl.innerHTML = '';

    if (!lista.length) {
      resumenEl.textContent = pedidos.length ? '0 pedidos con ese filtro.' : 'Todavía no hay pedidos.';
      return;
    }
    resumenEl.textContent = lista.length + ' pedido(s)' +
      (filtroEstado ? ' · filtrado por "' + (ESTADOS_TXT[filtroEstado] || filtroEstado) + '"' : '') +
      (yaResueltos ? ' · ' + yaResueltos + ' ya entregado(s)/cancelado(s), no se muestran' : '');

    var orden = [];
    var grupos = {};
    lista.forEach(function (p) {
      var k = claveGrupo(p, modo);
      if (!k) return; // no aplica a este modo (p.ej. "traslado" con un pedido que no es traslado)
      if (!grupos[k]) { grupos[k] = []; orden.push(k); }
      grupos[k].push(p);
    });

    if (modo === 'plan') {
      // 'retiro' y 'sinfecha' siempre al final; el resto, por fecha — la
      // clave "yyyy-mm-dd" ya ordena bien como texto porque es ISO.
      orden.sort(function (a, b) {
        if (a === 'retiro' || a === 'sinfecha') return 1;
        if (b === 'retiro' || b === 'sinfecha') return -1;
        return a.localeCompare(b);
      });
      orden.forEach(function (k) { ordenarGrupo(grupos[k]); });
      asegurarCupos(function () { pintarGrupos(); });
    } else {
      pintarGrupos();
    }

    function pintarGrupos() {
      gruposEl.innerHTML = '';
      orden.forEach(function (k) {
        var sec = el('section', 'adm-grupo');
        var head = el('h2', 'adm-grupo-t');
        var titulo = modo === 'plan' ? tituloPlan(k) : (modo === 'traslado' ? 'Traslado a ' + k : k);
        head.appendChild(el('span', null, titulo));
        head.appendChild(el('span', 'adm-grupo-n', String(grupos[k].length)));
        sec.appendChild(head);
        sec.appendChild(botonAvisarLote(grupos[k]));

        if (modo === 'plan' && k !== 'retiro' && k !== 'sinfecha') {
          sec.appendChild(accionesGrupoPlan(k, grupos[k]));
        }

        grupos[k].forEach(function (p) { sec.appendChild(tarjeta(p, modo, grupos[k])); });
        gruposEl.appendChild(sec);
      });
    }
  }

  // Corredores presentes en un grupo del plan (para los chips de cupo y
  // para reprogramar): el cupo sigue siendo por corredor × día en la base
  // (envio_cupos), aunque el recorrido ahora sea uno solo para todo el día.
  function corredoresDe(grupo) {
    var out = [];
    grupo.forEach(function (p) {
      var z = window.MMEnvios && p.zona_id ? MMEnvios.zona(p.zona_id) : null;
      var cr = z ? z.grupo_ruta : (esTraslado(p) ? 'oeste' : null);
      if (cr && out.indexOf(cr) === -1) out.push(cr);
    });
    return out;
  }

  // Chips de cupo (uno por corredor presente ese día), links de ruta y
  // acciones de impresión/reprogramación para un grupo-día del plan de
  // reparto (un recorrido único que puede cruzar varios corredores).
  function accionesGrupoPlan(clave, grupo) {
    var fecha = clave;
    var corredores = corredoresDe(grupo);
    var contenedor = el('div', 'adm-grupo-plan');
    var wrap = el('div', 'adm-grupo-acciones');
    contenedor.appendChild(wrap);

    corredores.forEach(function (corredor) {
      var uso = contarUso(fecha, corredor);
      var cupo = (cuposCache || []).filter(function (c) {
        return c.grupo_ruta === corredor && c.dia_semana === (window.MMEnvios ? MMEnvios.isodow(fecha) : null);
      })[0];
      if (!cupo) return;
      var lleno = uso.n >= cupo.cupo_pedidos || uso.bultos >= cupo.cupo_bultos;
      var alerta = uso.n > cupo.cupo_pedidos || uso.bultos > cupo.cupo_bultos;
      var chip = el('span', 'adm-grupo-cupo' + (alerta ? ' is-lleno' : (lleno ? ' is-ambar' : '')),
        (CORREDOR_TXT[corredor] || corredor) + ': ' + uso.n + '/' + cupo.cupo_pedidos + ' pedidos · ' +
        uso.bultos + '/' + cupo.cupo_bultos + ' bultos');
      wrap.appendChild(chip);
    });

    var tramos = tramosMapas(grupo);

    // El mapa embebido arranca oculto: son iframes de un dominio externo
    // (uno por tramo) y no tiene sentido cargarlos si nadie los va a mirar,
    // sobre todo en un panel que se refresca seguido.
    var mapaWrap = el('div', 'adm-grupo-mapa-wrap');
    mapaWrap.hidden = true;

    tramos.forEach(function (t, i, arr) {
      var a = el('a', 'adm-grupo-mapa', arr.length > 1 ? 'Ver ruta (tramo ' + (i + 1) + ')' : 'Ver ruta en Maps');
      a.href = t.abrir;
      a.target = '_blank';
      a.rel = 'noopener';
      wrap.appendChild(a);

      var caja = el('div', 'adm-grupo-mapa-caja');
      if (arr.length > 1) caja.appendChild(el('p', 'adm-grupo-mapa-tramo-t', 'Tramo ' + (i + 1)));
      var iframe = document.createElement('iframe');
      iframe.className = 'adm-grupo-mapa-frame';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.title = 'Recorrido del tramo ' + (i + 1);
      caja.appendChild(iframe);
      mapaWrap.appendChild(caja);

      // El src recién se pone al abrir el mapa (ver mapaBtn más abajo), no
      // acá: así el iframe no pide nada hasta que alguien lo pida.
      caja.dataset.src = t.embed;
    });

    if (tramos.length) {
      var mapaBtn = el('button', 'adm-grupo-mapa-btn', 'Ver mapa acá');
      mapaBtn.type = 'button';
      mapaBtn.addEventListener('click', function () {
        mapaWrap.hidden = !mapaWrap.hidden;
        mapaBtn.textContent = mapaWrap.hidden ? 'Ver mapa acá' : 'Ocultar mapa';
        if (!mapaWrap.hidden) {
          Array.prototype.forEach.call(mapaWrap.querySelectorAll('.adm-grupo-mapa-caja'), function (caja) {
            var frame = caja.querySelector('iframe');
            if (frame.src) return;
            frame.src = caja.dataset.src;
          });
        }
      });
      wrap.appendChild(mapaBtn);
    }

    var imprimirBtn = el('button', 'adm-imprimir', 'Imprimir hoja de ruta');
    imprimirBtn.type = 'button';
    imprimirBtn.addEventListener('click', function () {
      var seccion = contenedor.parentElement;
      document.body.classList.add('adm-modo-ruta');
      Array.prototype.forEach.call(gruposEl.children, function (otra) {
        otra.classList.toggle('adm-oculto-impresion', otra !== seccion);
      });
      window.print();
    });
    wrap.appendChild(imprimirBtn);

    // La hoja impresa viaja en papel; esto arma el MISMO recorrido (mismo
    // orden que las tarjetas y la impresión) como texto plano para mandarlo
    // por WhatsApp al repartidor, que no tiene cuenta en este panel. Los
    // links de Maps son los mismos tramos de "Ver ruta".
    var copiarRutaBtn = el('button', 'adm-copiar-ruta', 'Copiar ruta p/ WhatsApp');
    copiarRutaBtn.type = 'button';
    copiarRutaBtn.addEventListener('click', function () {
      var lineas = ['Ruta ' + fechaLegible(fecha) + ' — Mundo Mágico', ''];
      var n = 0;
      grupo.forEach(function (p) {
        n += 1;
        lineas.push(n + '. ' + (p.nombre || 'Sin nombre') + (p.numero != null ? ' (#' + p.numero + ')' : ''));
        var dirPartes = [];
        if (esTraslado(p)) {
          var sucT = window.MMEnvios ? MMEnvios.sucursales().filter(function (s) { return s.id === p.sucursal_id; })[0] : null;
          dirPartes.push('TRASLADO a ' + (sucT ? sucT.nombre : 'sucursal'));
        } else {
          if (p.direccion) dirPartes.push(p.direccion);
          if (p.entre_calles) dirPartes.push('entre ' + p.entre_calles);
          if (p.piso_depto) dirPartes.push(p.piso_depto);
          if (p.zona_nombre || p.zona) dirPartes.push(p.zona_nombre || p.zona);
        }
        if (dirPartes.length) lineas.push('   ' + dirPartes.join(' · '));
        var extra = [];
        if (p.telefono) extra.push('Tel ' + p.telefono);
        if (p.bultos) extra.push('bulto ' + p.bultos);
        if (p.receptor_nombre) {
          extra.push('recibe ' + p.receptor_nombre + (p.receptor_telefono ? ' (' + p.receptor_telefono + ')' : ''));
        }
        if (extra.length) lineas.push('   ' + extra.join(' · '));
      });
      tramos.forEach(function (t, i, arr) {
        lineas.push('');
        lineas.push((arr.length > 1 ? 'Mapa tramo ' + (i + 1) + ': ' : 'Mapa: ') + t.abrir);
      });
      var texto = lineas.join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(function () {
          alert('Ruta copiada (' + n + ' parada/s). Pegala en el chat del repartidor.');
        }, function () { window.prompt('Copiá el texto (Ctrl+C):', texto); });
      } else {
        window.prompt('Copiá el texto (Ctrl+C):', texto);
      }
    });
    wrap.appendChild(copiarRutaBtn);

    var reprogramarBtn = el('button', 'adm-reprogramar', 'Reprogramar todo el día');
    reprogramarBtn.type = 'button';
    reprogramarBtn.addEventListener('click', function () {
      // Antes eran dos prompt() y un confirm() encadenados, con la fecha
      // tipeada a mano en formato aaaa-mm-dd (un tipeo mal = pedidos
      // movidos a cualquier día). El diálogo usa el calendario nativo.
      dialogoReprogramar(fecha, grupo.length, function (nueva, motivo) {
        continuarReprogramacion(nueva, motivo);
      });
    });

    function continuarReprogramacion(nueva, motivo) {
      reprogramarBtn.disabled = true;
      // reprogramar_dia sigue siendo por corredor del lado de la base (ver
      // supabase/envios_04_ruta.sql) — acá se llama una vez por cada
      // corredor presente en el día, ya que el recorrido los junta pero el
      // cupo/bloqueo sigue siendo por corredor.
      Promise.all(corredores.map(function (corredor) {
        return sb.rpc('reprogramar_dia', { p_fecha: fecha, p_grupo_ruta: corredor, p_nueva: nueva, p_motivo: motivo });
      })).then(function (resultados) {
        reprogramarBtn.disabled = false;
        var conError = resultados.filter(function (r) { return r.error; })[0];
        if (conError) { alert('No se pudo reprogramar: ' + conError.error.message); return; }
        var total = resultados.reduce(function (acc, r) { return acc + (r.data || 0); }, 0);
        alert(total + ' pedido(s) movido(s) a ' + fechaLegible(nueva) + '.');
        cargarPedidos();
      }, function () { reprogramarBtn.disabled = false; alert('No se pudo reprogramar.'); });
    }
    wrap.appendChild(reprogramarBtn);

    contenedor.appendChild(mapaWrap);
    return contenedor;
  }

  // Diálogo de reprogramación: fecha con calendario nativo (min = mañana) y
  // motivo elegible. Llama a onOk(fecha, motivo) sólo si se confirma.
  function dialogoReprogramar(fechaVieja, cantidad, onOk) {
    var overlay = el('div', 'adm-dialogo-overlay');
    var caja = el('div', 'adm-dialogo');
    caja.appendChild(el('h3', null, 'Reprogramar todo el día'));
    caja.appendChild(el('p', 'adm-dialogo-txt',
      'Se mueven ' + cantidad + ' pedido(s) del ' + fechaLegible(fechaVieja) +
      ' a la fecha nueva, y el día viejo queda bloqueado con el motivo elegido.'));

    var lblFecha = el('label', 'adm-dialogo-campo', 'Nueva fecha');
    var fechaIn = document.createElement('input');
    fechaIn.type = 'date';
    var manana = new Date();
    manana.setDate(manana.getDate() + 1);
    fechaIn.min = manana.getFullYear() + '-' + ('0' + (manana.getMonth() + 1)).slice(-2) + '-' + ('0' + manana.getDate()).slice(-2);
    lblFecha.appendChild(fechaIn);
    caja.appendChild(lblFecha);

    var lblMotivo = el('label', 'adm-dialogo-campo', 'Motivo');
    var motivoSel = document.createElement('select');
    ['Lluvia', 'Feriado', 'Sin repartidor', 'Otro'].forEach(function (m) {
      var o = document.createElement('option');
      o.value = m;
      o.textContent = m;
      motivoSel.appendChild(o);
    });
    lblMotivo.appendChild(motivoSel);
    caja.appendChild(lblMotivo);

    var otroIn = document.createElement('input');
    otroIn.type = 'text';
    otroIn.placeholder = 'Contá el motivo';
    otroIn.className = 'adm-dialogo-otro';
    otroIn.hidden = true;
    motivoSel.addEventListener('change', function () { otroIn.hidden = motivoSel.value !== 'Otro'; });
    caja.appendChild(otroIn);

    var botones = el('div', 'adm-dialogo-botones');
    var cancelar = el('button', 'adm-dialogo-cancelar', 'Cancelar');
    cancelar.type = 'button';
    cancelar.addEventListener('click', function () { overlay.remove(); });
    var mover = el('button', 'adm-dialogo-ok', 'Mover pedidos');
    mover.type = 'button';
    mover.addEventListener('click', function () {
      if (!fechaIn.value) { fechaIn.focus(); return; }
      var motivo = motivoSel.value === 'Otro' ? (otroIn.value.trim() || 'Otro') : motivoSel.value;
      overlay.remove();
      onOk(fechaIn.value, motivo);
    });
    botones.appendChild(cancelar);
    botones.appendChild(mover);
    caja.appendChild(botones);

    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) overlay.remove(); });
    overlay.appendChild(caja);
    document.body.appendChild(overlay);
    fechaIn.focus();
  }

  window.addEventListener('afterprint', function () {
    document.body.classList.remove('adm-modo-ruta');
    Array.prototype.forEach.call(gruposEl.children, function (s) { s.classList.remove('adm-oculto-impresion'); });
  });

  agruparSel.addEventListener('change', pintarLista);
  filtroEstadoSel.addEventListener('change', function () { pintarStats(); pintarLista(); });
  refrescarBtn.addEventListener('click', cargarPedidos);
  desdeIn.addEventListener('change', cargarPedidos);
  hastaIn.addEventListener('change', cargarPedidos);
  verArchivadosChk.addEventListener('change', cargarPedidos);
  cargarMasBtn.addEventListener('click', cargarMasPedidos);
  archivarBtn.addEventListener('click', archivarViejos);
})();
