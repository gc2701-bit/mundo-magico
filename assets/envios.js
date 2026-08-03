/* Vocabulario y configuración compartida de envíos — window.MMEnvios.
 *
 * Fuente de verdad única para lo que hoy está duplicado a mano en cuenta.js
 * y admin-pedidos.js (ESTADOS_TXT, fechaLegible) y para la configuración
 * que antes hubiera sido una constante de JS (zonas, tarifas, franjas,
 * sucursales): ahora vive en Postgres, editable desde admin-envios.html sin
 * tocar código.
 *
 * Usa `fetch` contra /rest/v1/ con el header `apikey` — el mismo patrón que
 * assets/precios.js — así que NO depende del bundle UMD de Supabase y
 * funciona para un visitante sin cuenta en cualquier página, apenas se
 * incluye este script.
 *
 * Contrato defensivo, igual que MMCuenta: si Supabase no responde, las
 * funciones devuelven datos de respaldo (constantes fijas más abajo) en vez
 * de dejar el carrito sin zonas para elegir. La única excepción real es
 * `cupos()`: si falla, el llamador tiene que tratarlo como "todo
 * disponible" — nunca como "todo bloqueado" — para no impedir un pedido por
 * un problema de red.
 */
(function () {
  'use strict';

  var SUPABASE_URL = (window.MM_SUPABASE && window.MM_SUPABASE.url) || 'https://kyuilrlewynqrzebouww.supabase.co';
  var ANON_KEY = (window.MM_SUPABASE && window.MM_SUPABASE.anonKey) || 'sb_publishable_Q-M5uG2ChZIg0c1zPfNXiQ_unIG1hZ8';

  var CACHE_KEY = 'mm_envios_cache_v1';
  var CACHE_MS = 30 * 60 * 1000; // 30 min: ver nota de "Riesgos" del plan sobre este intercambio.

  var ESTADOS = [
    'nuevo', 'confirmado', 'en_preparacion', 'en_transito', 'listo',
    'en_reparto', 'entregado', 'ausente', 'reprogramado', 'cancelado'
  ];
  var ESTADOS_TXT = {
    nuevo: 'Nuevo',
    confirmado: 'Confirmado',
    en_preparacion: 'En preparación',
    en_transito: 'En viaje a Yerba Buena',
    listo: 'Listo',
    en_reparto: 'En reparto',
    entregado: 'Entregado',
    ausente: 'No había nadie',
    reprogramado: 'Reprogramado',
    cancelado: 'Cancelado'
  };
  var MOTIVOS_AUSENTE = ['nadie_en_domicilio', 'direccion_inexistente', 'cliente_reprogramo', 'zona_inundada', 'vehiculo', 'otro'];
  var MOTIVOS_AUSENTE_TXT = {
    nadie_en_domicilio: 'No había nadie en el domicilio',
    direccion_inexistente: 'La dirección no existe o no se encontró',
    cliente_reprogramo: 'El cliente pidió reprogramar',
    zona_inundada: 'Zona inundada / no se pudo llegar',
    vehiculo: 'Problema con el vehículo',
    otro: 'Otro motivo'
  };

  // `en_transito` sólo aplica a un retiro en una sucursal que requiere
  // traslado (hoy, Yerba Buena); `en_reparto` sólo a un envío. `metodo` y
  // `sucursalId` desambiguan esas dos ramas — sin ellos no hay forma de
  // saber cuál de los dos "siguientes" pasos ofrecer desde "en_preparacion"
  // o "listo".
  function siguientes(estado, metodo, sucursalId) {
    var transferencia = false;
    if (sucursalId) {
      var s = sucursales().filter(function (x) { return x.id === sucursalId; })[0];
      transferencia = !!(s && s.requiere_transferencia);
    }
    switch (estado) {
      case 'nuevo': return ['confirmado', 'cancelado'];
      case 'confirmado': return ['en_preparacion', 'cancelado'];
      case 'en_preparacion':
        return (metodo === 'retiro' && transferencia) ? ['en_transito', 'cancelado'] : ['listo', 'cancelado'];
      case 'en_transito': return ['listo', 'cancelado'];
      case 'listo': return metodo === 'envio' ? ['en_reparto', 'cancelado'] : ['entregado', 'cancelado'];
      case 'en_reparto': return ['entregado', 'ausente', 'cancelado'];
      case 'ausente': return ['reprogramado', 'cancelado'];
      case 'reprogramado': return ['listo', 'cancelado'];
      default: return [];
    }
  }

  var fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

  // Respaldo si Supabase no responde: espeja el seed de envios_01_config.sql.
  // El "id" acá es el slug (no un uuid real de la base) — sólo sirve para
  // que el carrito muestre algo mientras no hay conexión; no se usa para
  // escribir un pedido, porque sin conexión el pedido tampoco se puede
  // guardar en la base (sigue pudiendo mandarse por WhatsApp igual).
  var RESPALDO = {
    tarifas: [
      { id: 'capital', nombre: 'Capital', costo: 2000 },
      { id: 'cercano', nombre: 'Cercano', costo: 3500 },
      { id: 'lejano', nombre: 'Lejano', costo: 5500 }
    ],
    zonas: [
      { id: 'smt-microcentro', slug: 'smt-microcentro', nombre: 'Microcentro', descripcion: 'Dentro del perímetro del estacionamiento medido', grupo_ruta: 'centro', orden_ruta: 1, tarifa_id: 'capital', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.8252, lng: -65.2251 },
      { id: 'smt-oeste', slug: 'smt-oeste', nombre: 'San Miguel — Oeste', descripcion: 'Eje Av. Mate de Luna / Aconquija', grupo_ruta: 'oeste', orden_ruta: 1, tarifa_id: 'capital', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.8279, lng: -65.2203 },
      { id: 'cevil-redondo', slug: 'cevil-redondo', nombre: 'Cevil Redondo', descripcion: null, grupo_ruta: 'oeste', orden_ruta: 2, tarifa_id: 'cercano', dias_semana: [1, 2, 3, 4, 5, 6], alias: ['Cevil Redondo'], lat: -26.8002, lng: -65.2600 },
      { id: 'yerba-buena', slug: 'yerba-buena', nombre: 'Yerba Buena', descripcion: 'Contigua al oeste de la capital', grupo_ruta: 'oeste', orden_ruta: 3, tarifa_id: 'cercano', dias_semana: [1, 2, 3, 4, 5, 6], alias: ['Yerba Buena'], lat: -26.8216, lng: -65.3045 },
      { id: 'smt-norte', slug: 'smt-norte', nombre: 'San Miguel — Norte', descripcion: 'Al norte de Av. Sarmiento / Ejército del Norte', grupo_ruta: 'norte', orden_ruta: 1, tarifa_id: 'capital', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.8144, lng: -65.2299 },
      { id: 'las-talitas', slug: 'las-talitas', nombre: 'Las Talitas', descripcion: null, grupo_ruta: 'norte', orden_ruta: 2, tarifa_id: 'cercano', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.7899, lng: -65.1897 },
      { id: 'tafi-viejo', slug: 'tafi-viejo', nombre: 'Tafí Viejo', descripcion: null, grupo_ruta: 'norte', orden_ruta: 3, tarifa_id: 'cercano', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.7362, lng: -65.2576 },
      { id: 'smt-este', slug: 'smt-este', nombre: 'San Miguel — Este', descripcion: 'Eje Av. Alem, hacia el río', grupo_ruta: 'este', orden_ruta: 1, tarifa_id: 'capital', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.8404, lng: -65.2214 },
      { id: 'banda-del-rio-sali', slug: 'banda-del-rio-sali', nombre: 'Banda del Río Salí', descripcion: 'Cruzando el río hacia el este', grupo_ruta: 'este', orden_ruta: 2, tarifa_id: 'cercano', dias_semana: [1, 2, 3, 4, 5, 6], alias: ['Banda del Río Salí'], lat: -26.8386, lng: -65.1658 },
      { id: 'alderetes', slug: 'alderetes', nombre: 'Alderetes', descripcion: null, grupo_ruta: 'este', orden_ruta: 3, tarifa_id: 'cercano', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.8224, lng: -65.1441 },
      { id: 'smt-sur', slug: 'smt-sur', nombre: 'San Miguel — Sur', descripcion: 'Al sur de Av. Roca', grupo_ruta: 'sur', orden_ruta: 1, tarifa_id: 'capital', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.8424, lng: -65.2125 },
      { id: 'el-manantial', slug: 'el-manantial', nombre: 'El Manantial', descripcion: null, grupo_ruta: 'sur', orden_ruta: 2, tarifa_id: 'lejano', dias_semana: [1, 2, 3, 4, 5, 6], alias: [], lat: -26.8479, lng: -65.2826 },
      { id: 'san-pablo', slug: 'san-pablo', nombre: 'San Pablo', descripcion: null, grupo_ruta: 'sur', orden_ruta: 3, tarifa_id: 'lejano', dias_semana: [1, 2, 3, 4, 5, 6], alias: ['San Pablo'], lat: -26.8795, lng: -65.3138 },
      { id: 'lules', slug: 'lules', nombre: 'Lules', descripcion: 'La más lejana al sur', grupo_ruta: 'sur', orden_ruta: 4, tarifa_id: 'lejano', dias_semana: [1, 2, 3, 4, 5, 6], alias: ['Lules'], lat: -26.9254, lng: -65.3372 }
    ],
    franjas: [
      { id: 'manana', nombre: 'Mañana', hora_inicio: '09:00', hora_fin: '13:00', dias_semana: [1, 2, 3, 4, 5] },
      { id: 'tarde', nombre: 'Tarde', hora_inicio: '17:00', hora_fin: '21:00', dias_semana: [1, 2, 3, 4, 5] },
      { id: 'sabado', nombre: 'Sábado', hora_inicio: '09:00', hora_fin: '13:30', dias_semana: [6] }
    ],
    sucursales: [
      { id: 'junin-351', nombre: 'Junín 351', direccion: 'Junín 351, San Miguel de Tucumán', es_deposito: true, requiere_transferencia: false, microcentro: true },
      { id: 'junin-241', nombre: 'Junín 241', direccion: 'Junín 241, San Miguel de Tucumán', es_deposito: false, requiere_transferencia: false, microcentro: true },
      { id: 'cordoba-784', nombre: 'Córdoba 784', direccion: 'Córdoba 784, San Miguel de Tucumán', es_deposito: false, requiere_transferencia: false, microcentro: true },
      { id: 'solano-vera-510', nombre: 'Solano Vera 510', direccion: 'Solano Vera 510, Yerba Buena', es_deposito: false, requiere_transferencia: true, microcentro: false }
    ],
    // entrega_propia: false — hoy el envío lo arma y paga el cliente por su
    // cuenta (remis/Uber Moto/Uber Envíos), no el local. Ver supabase/
    // envios_14_entrega_propia.sql — se puede volver a prender sin perder
    // nada de lo de acá arriba (zonas, tarifas, cupos, rutas).
    config: { lead_dias: 1, horizonte_dias: 14, dias_fijos_activos: false, cobrar_envio: true, minimo_compra: 0, minutos_carga: 30, costo_envio_inmediato: 0, corte_inmediato_hora: '13:00:00', entrega_propia: false }
  };

  var datos = null; // se llena con { tarifas, zonas, franjas, sucursales, config } al cargar
  var promesaCarga = null;

  function leerCache() {
    try {
      var crudo = sessionStorage.getItem(CACHE_KEY);
      if (!crudo) return null;
      var o = JSON.parse(crudo);
      if (!o || !o.t || Date.now() - o.t > CACHE_MS) return null;
      return o.data;
    } catch (e) { return null; }
  }

  function guardarCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data: data }));
    } catch (e) { /* sessionStorage lleno o no disponible: seguir sin cachear */ }
  }

  function get(tabla, query) {
    return fetch(SUPABASE_URL + '/rest/v1/' + tabla + '?' + query, {
      headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY }
    }).then(function (r) {
      if (!r.ok) throw new Error('rest ' + tabla + ' ' + r.status);
      return r.json();
    });
  }

  function cargar() {
    if (promesaCarga) return promesaCarga;

    var cacheado = leerCache();
    if (cacheado) {
      datos = cacheado;
      promesaCarga = Promise.resolve(datos);
      return promesaCarga;
    }

    promesaCarga = Promise.all([
      get('envio_tarifas', 'select=*&order=orden.asc'),
      get('envio_zonas', 'select=*&order=grupo_ruta.asc,orden_ruta.asc&activa=eq.true'),
      get('envio_franjas', 'select=*&order=orden.asc&activa=eq.true'),
      get('sucursales', 'select=*&activa=eq.true'),
      get('envio_config', 'select=*&id=eq.1')
    ]).then(function (r) {
      datos = {
        tarifas: r[0],
        zonas: r[1],
        franjas: r[2],
        sucursales: r[3],
        config: r[4] && r[4][0] ? r[4][0] : RESPALDO.config
      };
      guardarCache(datos);
      return datos;
    }).catch(function () {
      datos = RESPALDO;
      return datos;
    });

    return promesaCarga;
  }

  function actual() { return datos || RESPALDO; }

  function zonas() { return actual().zonas; }

  function zona(idOSlug) {
    return zonas().filter(function (z) { return z.id === idOSlug || z.slug === idOSlug; })[0] || null;
  }

  function tarifaDe(tarifaId) {
    return actual().tarifas.filter(function (t) { return t.id === tarifaId; })[0] || null;
  }

  function costoDe(zonaId) {
    var z = zona(zonaId);
    var t = z && tarifaDe(z.tarifa_id);
    return t ? Number(t.costo) : 0;
  }

  function franjas(isodow) {
    return actual().franjas.filter(function (f) {
      return (f.dias_semana || []).indexOf(isodow) !== -1;
    });
  }

  function sucursales() { return actual().sucursales; }

  function config() { return actual().config || RESPALDO.config; }

  function plata(n) { return fmt.format(Number(n) || 0); }

  // "yyyy-mm-dd" → "dd/mm/aaaa" a mano: `new Date(iso)` interpreta la fecha
  // en UTC y en husos horarios negativos puede mostrar el día anterior.
  function fechaLegible(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function hoyISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    if (m.length < 2) m = '0' + m;
    if (day.length < 2) day = '0' + day;
    return d.getFullYear() + '-' + m + '-' + day;
  }

  // Postgres isodow: 1=lunes…7=domingo. JS Date#getDay: 0=domingo…6=sábado.
  // Este es el único lugar donde se convierte. Construye la fecha con
  // año/mes/día locales (no `new Date(iso)`) por la misma razón que
  // fechaLegible: evita el corrimiento de un día por UTC.
  function isodow(iso) {
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return ((d.getDay() + 6) % 7) + 1;
  }

  // Normaliza un teléfono argentino escrito de cualquier forma
  // ("0381 15 555-5555", "+54 9 381 555-5555", etc.) al formato que espera
  // wa.me: 549 + característico + número, sin 0 ni 15.
  function telWa(txt) {
    var d = String(txt || '').replace(/\D/g, '');
    d = d.replace(/^54/, '');
    d = d.replace(/^9/, '');
    d = d.replace(/^0/, '');
    d = d.replace(/^(\d{2,4})15/, '$1');
    return '549' + d;
  }

  // Busca la zona nueva que corresponde a un valor viejo de texto libre
  // (el <select> fijo que tenía carrito.js). Si no hay alias que coincida,
  // devuelve null a propósito: es mejor marcarlo para revisar a mano que
  // adivinar el corredor.
  function aliasZona(texto) {
    if (!texto) return null;
    return zonas().filter(function (z) {
      return (z.alias || []).indexOf(texto) !== -1;
    })[0] || null;
  }

  // RPC del servidor (llega en E3 con envios_02_pedidos.sql). Hasta que
  // exista, todo llamado falla y cae al respaldo permisivo de abajo — nunca
  // hay que traducir "no pude preguntarle al servidor" en "no hay cupo".
  // `sucursalId` es opcional: sólo importa para un retiro en una sucursal
  // que requiere traslado (hoy, Yerba Buena), donde el servidor suma un día
  // extra de anticipación. Para un envío alcanza con zonaId.
  // `ignorarAnticipacion` es para el envío inmediato (E11): permite
  // preguntar por una fecha sin que el "sin_anticipacion" normal la tape —
  // el resto de los motivos (domingo, bloqueada, cupo lleno) se siguen
  // respetando igual.
  function cupos(desde, hasta, zonaId, sucursalId, ignorarAnticipacion) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/cupos_disponibles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY },
      body: JSON.stringify({ p_desde: desde, p_hasta: hasta, p_zona_id: zonaId, p_sucursal_id: sucursalId || null, p_ignorar_anticipacion: !!ignorarAnticipacion })
    }).then(function (r) {
      if (!r.ok) throw new Error('rpc cupos_disponibles ' + r.status);
      return r.json();
    }).catch(function () { return permisivo(desde, hasta); });
  }

  function permisivo(desde, hasta) {
    var out = [];
    var d = desde.split('-');
    var cur = new Date(Number(d[0]), Number(d[1]) - 1, Number(d[2]));
    var fin = hasta.split('-');
    var lim = new Date(Number(fin[0]), Number(fin[1]) - 1, Number(fin[2]));
    while (cur <= lim) {
      var m = String(cur.getMonth() + 1); if (m.length < 2) m = '0' + m;
      var day = String(cur.getDate()); if (day.length < 2) day = '0' + day;
      var isoFecha = cur.getFullYear() + '-' + m + '-' + day;
      var dow = ((cur.getDay() + 6) % 7) + 1;
      out.push({ fecha: isoFecha, disponible: dow !== 7, motivo: dow === 7 ? 'domingo' : null });
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }

  window.MMEnvios = {
    cargar: cargar,
    zonas: zonas,
    zona: zona,
    costoDe: costoDe,
    franjas: franjas,
    sucursales: sucursales,
    config: config,
    ESTADOS: ESTADOS,
    ESTADOS_TXT: ESTADOS_TXT,
    MOTIVOS_AUSENTE: MOTIVOS_AUSENTE,
    MOTIVOS_AUSENTE_TXT: MOTIVOS_AUSENTE_TXT,
    siguientes: siguientes,
    plata: plata,
    fechaLegible: fechaLegible,
    hoyISO: hoyISO,
    isodow: isodow,
    telWa: telWa,
    aliasZona: aliasZona,
    cupos: cupos
  };

  cargar();
})();
