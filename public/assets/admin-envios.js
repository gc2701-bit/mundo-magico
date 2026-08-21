/* Editor de configuración de envíos (admin-envios.html).
 *
 * Cada pestaña es una tabla de assets/envios.js (zonas, tarifas, franjas,
 * sucursales, cupos, bloqueos, repartidores). No hay una API a medida por
 * tabla: TABLAS de más abajo describe columnas y tipos, y una única función
 * genérica arma filas editables con un botón "Guardar" por fila que hace un
 * `update ... .eq('id', ...)` — el mismo patrón que ya usa el <select> de
 * estado en admin-pedidos.js.
 *
 * Llamar a `sb.rpc('es_admin')` acá es una desviación a propósito: decide
 * si DIBUJAR el editor, no si dejar guardar. La barrera real son las
 * políticas de RLS de cada tabla (ver supabase/envios_01_config.sql) — si
 * alguien sin permiso entrara igual a esta URL, cada "Guardar" le daría 403.
 * Sin este chequeo, esa misma persona vería un editor completo que nunca
 * puede usar, lo cual es confuso; con él, ve el aviso correcto.
 */
(function () {
  'use strict';

  // Reusa el cliente que ya crea cuenta.js (mismo storage key): crear otro
  // acá disparaba el warning de Supabase por dos GoTrueClient concurrentes.
  if (!window.MMCuenta) return;
  var sb = window.MMCuenta.cliente();
  if (!sb) return;

  var gate = document.getElementById('adm-gate');
  var noAdmin = document.getElementById('adm-noadmin');
  var loginBtn = document.getElementById('adm-login-btn');
  var panel = document.getElementById('adm-panel');
  var sesionInfo = document.getElementById('adm-sesion');
  var logoutBtn = document.getElementById('adm-logout-btn');
  var tabsEl = document.getElementById('adm-cfg-tabs');
  var msgEl = document.getElementById('adm-cfg-msg');
  var contenidoEl = document.getElementById('adm-cfg-contenido');

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  var CORREDORES = ['centro', 'oeste', 'norte', 'este', 'sur'];

  var TABLAS = {
    zonas: {
      tabla: 'envio_zonas', titulo: 'Zonas', orden: 'grupo_ruta.asc,orden_ruta.asc',
      columnas: [
        { campo: 'slug', label: 'Slug', tipo: 'texto', soloLectura: true },
        { campo: 'nombre', label: 'Nombre', tipo: 'texto' },
        { campo: 'descripcion', label: 'Descripción', tipo: 'texto', nullable: true },
        { campo: 'grupo_ruta', label: 'Corredor', tipo: 'select', opciones: CORREDORES },
        { campo: 'orden_ruta', label: 'Orden', tipo: 'numero' },
        { campo: 'tarifa_id', label: 'Tarifa', tipo: 'select_tarifa' },
        { campo: 'km_centro', label: 'Km al centro', tipo: 'numero', nullable: true },
        { campo: 'lat', label: 'Latitud (centro de la zona)', tipo: 'numero', nullable: true },
        { campo: 'lng', label: 'Longitud (centro de la zona)', tipo: 'numero', nullable: true },
        { campo: 'dias_semana', label: 'Días (1-7, coma)', tipo: 'lista_numeros' },
        { campo: 'alias', label: 'Alias (texto viejo, coma)', tipo: 'lista_texto' },
        { campo: 'activa', label: 'Activa', tipo: 'bool' }
      ]
    },
    tarifas: {
      tabla: 'envio_tarifas', titulo: 'Tarifas', orden: 'orden.asc',
      columnas: [
        { campo: 'nombre', label: 'Nombre', tipo: 'texto' },
        { campo: 'costo', label: 'Costo ($)', tipo: 'numero' },
        { campo: 'orden', label: 'Orden', tipo: 'numero' },
        { campo: 'activa', label: 'Activa', tipo: 'bool' }
      ]
    },
    franjas: {
      tabla: 'envio_franjas', titulo: 'Franjas', orden: 'orden.asc',
      columnas: [
        { campo: 'nombre', label: 'Nombre', tipo: 'texto' },
        { campo: 'hora_inicio', label: 'Desde', tipo: 'hora' },
        { campo: 'hora_fin', label: 'Hasta', tipo: 'hora' },
        { campo: 'dias_semana', label: 'Días (1-7, coma)', tipo: 'lista_numeros' },
        { campo: 'orden', label: 'Orden', tipo: 'numero' },
        { campo: 'activa', label: 'Activa', tipo: 'bool' }
      ]
    },
    sucursales: {
      tabla: 'sucursales', titulo: 'Sucursales', orden: 'nombre.asc',
      columnas: [
        { campo: 'nombre', label: 'Nombre', tipo: 'texto' },
        { campo: 'direccion', label: 'Dirección', tipo: 'texto' },
        { campo: 'es_deposito', label: 'Es depósito', tipo: 'bool' },
        { campo: 'requiere_transferencia', label: 'Requiere traslado', tipo: 'bool' },
        { campo: 'microcentro', label: 'Microcentro', tipo: 'bool' },
        { campo: 'carga_hasta', label: 'Carga hasta', tipo: 'hora', nullable: true },
        { campo: 'activa', label: 'Activa', tipo: 'bool' }
      ]
    },
    cupos: {
      tabla: 'envio_cupos', titulo: 'Cupos', orden: 'grupo_ruta.asc,dia_semana.asc',
      columnas: [
        { campo: 'grupo_ruta', label: 'Corredor', tipo: 'texto', soloLectura: true },
        { campo: 'dia_semana', label: 'Día (1=lun…7=dom)', tipo: 'numero', soloLectura: true },
        { campo: 'cupo_pedidos', label: 'Cupo pedidos', tipo: 'numero' },
        { campo: 'cupo_bultos', label: 'Cupo bultos', tipo: 'numero' }
      ]
    },
    bloqueos: {
      tabla: 'envio_bloqueos', titulo: 'Bloqueos', orden: 'fecha.asc',
      permiteNuevo: true, permiteBorrar: true,
      columnas: [
        { campo: 'fecha', label: 'Fecha', tipo: 'fecha' },
        { campo: 'grupo_ruta', label: 'Corredor (vacío = todos)', tipo: 'select', opciones: [''].concat(CORREDORES), nullable: true },
        { campo: 'motivo', label: 'Motivo', tipo: 'texto' }
      ]
    },
    repartidores: {
      tabla: 'repartidores', titulo: 'Repartidores', orden: 'nombre.asc',
      permiteNuevo: true,
      columnas: [
        { campo: 'nombre', label: 'Nombre', tipo: 'texto' },
        { campo: 'tipo', label: 'Tipo', tipo: 'select', opciones: ['propio', 'cadeteria'] },
        { campo: 'telefono', label: 'Teléfono', tipo: 'texto', nullable: true },
        { campo: 'activo', label: 'Activo', tipo: 'bool' }
      ]
    },
    mensajes: {
      tabla: 'mensajes_plantillas', titulo: 'Mensajes', orden: 'estado.asc', clave: 'estado',
      columnas: [
        { campo: 'estado', label: 'Estado', tipo: 'texto', soloLectura: true },
        { campo: 'cuerpo', label: 'Mensaje ({nombre} {numero} {fecha} {franja} {sucursal} {zona} {costo_envio} {link})', tipo: 'parrafo' },
        { campo: 'activa', label: 'Activa', tipo: 'bool' }
      ]
    }
  };
  var ORDEN_TABS = ['zonas', 'tarifas', 'franjas', 'sucursales', 'cupos', 'bloqueos', 'repartidores', 'mensajes'];

  var tarifasCache = [];
  var tabActiva = ORDEN_TABS[0];

  function avisar(txt, esError) {
    msgEl.textContent = txt || '';
    msgEl.style.color = esError ? 'var(--red)' : '';
  }

  // --- Construcción de un input según el tipo de columna -------------------
  function campoInput(col, valor) {
    if (col.soloLectura) return el('span', 'adm-cfg-ro', valor == null ? '' : String(valor));

    if (col.tipo === 'bool') {
      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = !!valor;
      return chk;
    }
    if (col.tipo === 'select' || col.tipo === 'select_tarifa') {
      var sel = document.createElement('select');
      var opciones = col.tipo === 'select_tarifa'
        ? tarifasCache.map(function (t) { return { value: t.id, label: t.nombre }; })
        : col.opciones.map(function (o) { return { value: o, label: o || '(todos)' }; });
      opciones.forEach(function (o) {
        var op = document.createElement('option');
        op.value = o.value;
        op.textContent = o.label;
        if (o.value === valor) op.selected = true;
        sel.appendChild(op);
      });
      return sel;
    }

    if (col.tipo === 'parrafo') {
      var area = document.createElement('textarea');
      area.rows = 3;
      area.value = valor == null ? '' : valor;
      return area;
    }

    var inp = document.createElement('input');
    if (col.tipo === 'numero') inp.type = 'number';
    else if (col.tipo === 'hora') inp.type = 'time';
    else if (col.tipo === 'fecha') inp.type = 'date';
    else inp.type = 'text';

    if (col.tipo === 'lista_numeros') inp.value = (valor || []).join(',');
    else if (col.tipo === 'lista_texto') inp.value = (valor || []).join(', ');
    else if (col.tipo === 'hora' && valor) inp.value = String(valor).slice(0, 5);
    else inp.value = valor == null ? '' : valor;

    return inp;
  }

  function leerInput(col, input) {
    if (col.soloLectura) return undefined;
    if (col.tipo === 'bool') return input.checked;
    if (col.tipo === 'numero') {
      if (input.value === '' && col.nullable) return null;
      return Number(input.value);
    }
    if (col.tipo === 'lista_numeros') {
      return input.value.split(',').map(function (s) { return s.trim(); })
        .filter(function (s) { return s !== ''; }).map(Number);
    }
    if (col.tipo === 'lista_texto') {
      return input.value.split(',').map(function (s) { return s.trim(); })
        .filter(function (s) { return s !== ''; });
    }
    if (col.nullable && input.value === '') return null;
    return input.value;
  }

  // --- Una tabla completa ----------------------------------------------------
  function pintarTabla(def, filas) {
    contenidoEl.innerHTML = '';
    var tabla = el('div', 'adm-cfg-tabla');

    if (def.permiteNuevo) {
      tabla.appendChild(filaFormulario(def, null));
    }

    filas.forEach(function (fila) {
      tabla.appendChild(filaFormulario(def, fila));
    });

    contenidoEl.appendChild(tabla);
  }

  function filaFormulario(def, fila) {
    var esNueva = !fila;
    var row = el('div', 'adm-cfg-fila' + (esNueva ? ' adm-cfg-fila-nueva' : ''));
    var inputs = {};

    def.columnas.forEach(function (col) {
      var campo = el('label', 'adm-cfg-campo');
      campo.appendChild(el('span', null, col.label));
      var valorInicial = fila ? fila[col.campo] : (col.tipo === 'bool' ? false : null);
      var input = campoInput(col, valorInicial);
      inputs[col.campo] = input;
      campo.appendChild(input);
      row.appendChild(campo);
    });

    var acciones = el('div', 'adm-cfg-acciones');

    var btnGuardar = el('button', 'adm-cfg-guardar', esNueva ? 'Agregar' : 'Guardar');
    btnGuardar.type = 'button';
    btnGuardar.addEventListener('click', function () {
      var datos = {};
      def.columnas.forEach(function (col) {
        var v = leerInput(col, inputs[col.campo]);
        if (v !== undefined) datos[col.campo] = v;
      });
      btnGuardar.disabled = true;
      var accion = esNueva
        ? sb.from(def.tabla).insert(datos)
        : sb.from(def.tabla).update(datos).eq(def.clave || 'id', fila[def.clave || 'id']);
      accion.then(function (r) {
        btnGuardar.disabled = false;
        if (r.error) { avisar('No se pudo guardar: ' + r.error.message, true); return; }
        avisar(esNueva ? 'Agregado.' : 'Guardado.');
        cargarTab(tabActiva);
      });
    });
    acciones.appendChild(btnGuardar);

    if (def.permiteBorrar && !esNueva) {
      var btnBorrar = el('button', 'adm-cfg-borrar', 'Quitar');
      btnBorrar.type = 'button';
      btnBorrar.addEventListener('click', function () {
        if (!window.confirm('¿Quitar esta fila? No se puede deshacer.')) return;
        btnBorrar.disabled = true;
        sb.from(def.tabla).delete().eq(def.clave || 'id', fila[def.clave || 'id']).then(function (r) {
          btnBorrar.disabled = false;
          if (r.error) { avisar('No se pudo quitar: ' + r.error.message, true); return; }
          avisar('Quitado.');
          cargarTab(tabActiva);
        });
      });
      acciones.appendChild(btnBorrar);
    }

    row.appendChild(acciones);
    return row;
  }

  function cargarTab(clave) {
    tabActiva = clave;
    pintarTabs();
    var def = TABLAS[clave];
    avisar('Cargando…');
    contenidoEl.innerHTML = '';

    var pedirTarifas = tarifasCache.length
      ? Promise.resolve()
      : sb.from('envio_tarifas').select('*').order('orden', { ascending: true }).then(function (r) {
          tarifasCache = r.data || [];
        });

    pedirTarifas.then(function () {
      var partesOrden = def.orden.split(',');
      var q = sb.from(def.tabla).select('*');
      partesOrden.forEach(function (p) {
        var pp = p.split('.');
        q = q.order(pp[0], { ascending: pp[1] !== 'desc' });
      });
      return q;
    }).then(function (r) {
      if (r.error) { avisar('No se pudo cargar ' + def.titulo + ': ' + r.error.message, true); return; }
      avisar('');
      pintarTabla(def, r.data || []);
    });
  }

  function pintarTabs() {
    tabsEl.innerHTML = '';
    ORDEN_TABS.forEach(function (clave) {
      var b = el('button', 'adm-cfg-tab' + (clave === tabActiva ? ' is-on' : ''), TABLAS[clave].titulo);
      b.type = 'button';
      b.addEventListener('click', function () { cargarTab(clave); });
      tabsEl.appendChild(b);
    });
  }

  // --- Sesión y verificación de admin (sólo para decidir si dibujar) -------
  function pintarSesion() {
    if (!window.MMCuenta || !MMCuenta.sesionActiva()) {
      gate.hidden = false;
      noAdmin.hidden = true;
      panel.hidden = true;
      sesionInfo.hidden = true;
      logoutBtn.hidden = true;
      return;
    }
    sesionInfo.hidden = false;
    sesionInfo.textContent = 'Conectado como ' + (MMCuenta.nombre() || MMCuenta.email());
    logoutBtn.hidden = false;
    gate.hidden = true;

    sb.rpc('es_admin').then(function (r) {
      if (r.error || !r.data) {
        noAdmin.hidden = false;
        panel.hidden = true;
        return;
      }
      noAdmin.hidden = true;
      panel.hidden = false;
      cargarTab(tabActiva);
    });
  }

  loginBtn.addEventListener('click', function () {
    if (window.MMCuenta) MMCuenta.pedirSesion(function () {});
  });

  logoutBtn.addEventListener('click', function () {
    if (window.MMCuenta) MMCuenta.cerrarSesion();
  });

  document.addEventListener('mm:sesion', pintarSesion);
  pintarSesion();
})();
