/* assets/envio-form.js — el formulario de entrega que se completa justo
 * antes de mandar el pedido por WhatsApp (ver assets/carrito.js `enviar()`).
 * Acá se prueba la puerta de validación (`validar()`) que decide si el
 * pedido puede salir o no, más el aviso de dirección lejos de la zona
 * (geocoding contra Nominatim) — el único punto de este módulo que pega a
 * una red externa real en producción.
 *
 * envio-form.js sólo se define si window.MMEnvios existe (ver guarda al
 * principio del archivo real), así que cada test arranca con un mock
 * completo de esa API — la fuente de zonas/sucursales/franjas/cupos.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from '../helpers/loadScript.js';

function mockMMEnvios(overrides) {
  const cfg = Object.assign({
    entrega_propia: true,
    cobrar_envio: true,
    minimo_compra: 0,
    horizonte_dias: 14,
    corte_inmediato_hora: '13:00:00',
    costo_envio_inmediato: 500
  }, overrides && overrides.config);

  const zonas = (overrides && overrides.zonas) || [
    { id: 'z1', nombre: 'Centro', grupo_ruta: 'centro', lat: -26.8, lng: -65.2, descripcion: 'Zona centro' }
  ];
  const sucursales = (overrides && overrides.sucursales) || [
    { id: 's1', nombre: 'Sucursal Centro', requiere_transferencia: false }
  ];

  window.MMEnvios = {
    cargar: () => Promise.resolve(),
    zonas: () => zonas,
    zona: (id) => zonas.find((z) => z.id === id) || null,
    costoDe: () => 300,
    franjas: () => [{ id: 'f1', nombre: 'Mañana (9 a 13)', hora_inicio: '09:00:00', hora_fin: '13:00:00' }],
    sucursales: () => sucursales,
    config: () => cfg,
    plata: (n) => '$ ' + n,
    fechaLegible: (iso) => iso,
    hoyISO: () => '2099-01-01',
    isodow: () => 4,
    cupos: () => Promise.resolve([{ fecha: '2099-01-05', disponible: true }])
  };
}

function montar() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  window.MMEnvioForm.montar(container);
  return container;
}

function boton(container, texto) {
  return [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === texto);
}

function elegirDiaYFranja(container) {
  const diaChip = container.querySelector('.cart-dias .cart-chip');
  diaChip.click(); // dispara refrescarFranjas()
  const franjaChip = [...container.querySelectorAll('.cart-chips .cart-chip')]
    .find((el) => !el.closest('.cart-envio-campos'));
  franjaChip.click();
}

beforeEach(() => {
  document.body.innerHTML = '';
  delete window.MMEnvios;
  delete window.MMEnvioForm;
  delete window.MMCuenta;
});

describe('MMEnvioForm.validar — puerta antes de mandar el pedido por WhatsApp', () => {
  it('no define window.MMEnvioForm si window.MMEnvios no existe', () => {
    loadScript('assets/envio-form.js');
    expect(window.MMEnvioForm).toBeUndefined();
  });

  it('sin elegir método de entrega, la validación falla con un mensaje claro', () => {
    mockMMEnvios();
    loadScript('assets/envio-form.js');
    montar();
    const r = window.MMEnvioForm.validar();
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/retirás.*envías|Elegí si retirás/i);
  });

  it('retiro sin elegir sucursal falla', () => {
    mockMMEnvios();
    loadScript('assets/envio-form.js');
    const container = montar();
    boton(container, 'Retiro en el local').click();
    const r = window.MMEnvioForm.validar();
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/sucursal/i);
  });

  it('retiro con sucursal pero sin fecha/franja falla', () => {
    mockMMEnvios();
    loadScript('assets/envio-form.js');
    const container = montar();
    boton(container, 'Retiro en el local').click();
    container.querySelector('.cart-envio-campos .cart-chips .cart-chip').click(); // elige la única sucursal
    const r = window.MMEnvioForm.validar();
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/franja|fecha|cuándo/i);
  });

  it('retiro con sucursal + fecha + franja completos: pasa la validación', async () => {
    mockMMEnvios();
    loadScript('assets/envio-form.js');
    const container = montar();
    boton(container, 'Retiro en el local').click();
    container.querySelector('.cart-envio-campos .cart-chips .cart-chip').click();
    await Promise.resolve(); // refrescarDias() es async (cupos() devuelve una promesa)
    await new Promise((r) => setTimeout(r, 0));
    elegirDiaYFranja(container);
    const r = window.MMEnvioForm.validar();
    expect(r.ok).toBe(true);
  });

  it('envío con reparto propio (entrega_propia:true) sin elegir zona falla', () => {
    mockMMEnvios();
    loadScript('assets/envio-form.js');
    const container = montar();
    boton(container, 'Envío a domicilio').click();
    const dirIn = container.querySelector('input[placeholder="Calle, número, referencia"]');
    dirIn.value = 'Av. Siempre Viva 123';
    dirIn.dispatchEvent(new Event('input'));
    const r = window.MMEnvioForm.validar();
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/zona/i);
  });

  it('envío con zona y dirección completos: pasa la validación', () => {
    mockMMEnvios();
    loadScript('assets/envio-form.js');
    const container = montar();
    boton(container, 'Envío a domicilio').click();
    const zonaSel = container.querySelector('select');
    zonaSel.value = 'z1';
    zonaSel.dispatchEvent(new Event('change'));
    const dirIn = container.querySelector('input[placeholder="Calle, número, referencia"]');
    dirIn.value = 'Av. Siempre Viva 123';
    dirIn.dispatchEvent(new Event('input'));
    const r = window.MMEnvioForm.validar();
    expect(r.ok).toBe(true);
  });

  it('sin reparto propio (entrega_propia:false), el envío NO exige zona — sólo dirección', () => {
    mockMMEnvios({ config: { entrega_propia: false } });
    loadScript('assets/envio-form.js');
    const container = montar();
    boton(container, 'Envío a domicilio').click();
    const dirIn = container.querySelector('input[placeholder="Calle, número, referencia"]');
    dirIn.value = 'Av. Siempre Viva 123';
    dirIn.dispatchEvent(new Event('input'));
    const r = window.MMEnvioForm.validar();
    expect(r.ok).toBe(true);
  });

  it('la regla de "no confiar en el cliente" también aplica al costo de envío: leer() lo recalcula desde MMEnvios.costoDe(), no desde un campo editable', () => {
    mockMMEnvios();
    loadScript('assets/envio-form.js');
    const container = montar();
    boton(container, 'Envío a domicilio').click();
    const zonaSel = container.querySelector('select');
    zonaSel.value = 'z1';
    zonaSel.dispatchEvent(new Event('change'));
    const d = window.MMEnvioForm.leer();
    expect(d.costoEnvio).toBe(300); // viene de MMEnvios.costoDe('z1'), fijado arriba en el mock
  });
});

describe('MMEnvioForm — aviso de dirección lejos de la zona (geocoding vía Nominatim)', () => {
  it('si la dirección geocodifica lejos del centro de la zona, muestra un aviso (no bloquea el envío)', async () => {
    mockMMEnvios();
    // Un punto a ~50km de la zona (lat -26.8/-65.2 en el mock): supera el
    // umbral de 7km de envio-form.js sin acercarse a "mismo barrio".
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve([{ lat: '-27.2', lon: '-65.2' }])
    }));

    loadScript('assets/envio-form.js');
    const container = montar();
    boton(container, 'Envío a domicilio').click();
    const zonaSel = container.querySelector('select');
    zonaSel.value = 'z1';
    zonaSel.dispatchEvent(new Event('change'));

    const dirIn = container.querySelector('input[placeholder="Calle, número, referencia"]');
    dirIn.value = 'Dirección bien lejos 123';
    dirIn.dispatchEvent(new Event('blur'));

    // revisarDireccion() es async (fetch a Nominatim + .then): esperar la
    // resolución de esa cadena de promesas.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('nominatim.openstreetmap.org'));
    const aviso = container.querySelector('.cart-field-hint-alerta');
    expect(aviso).not.toBeNull();
    expect(aviso.textContent).toMatch(/lejos/i);

    // Y sobre todo: esto es sólo un aviso, no bloquea el pedido.
    const r = window.MMEnvioForm.validar();
    expect(r.ok).toBe(true);
  });

  it('si Nominatim no responde (red caída), no se muestra ningún aviso y el pedido sigue pudiendo mandarse ("no pude revisarlo" nunca es "está mal")', async () => {
    mockMMEnvios();
    global.fetch = vi.fn(() => Promise.reject(new Error('network down')));

    loadScript('assets/envio-form.js');
    const container = montar();
    boton(container, 'Envío a domicilio').click();
    const zonaSel = container.querySelector('select');
    zonaSel.value = 'z1';
    zonaSel.dispatchEvent(new Event('change'));

    const dirIn = container.querySelector('input[placeholder="Calle, número, referencia"]');
    dirIn.value = 'Dirección cualquiera 123';
    dirIn.dispatchEvent(new Event('blur'));

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const aviso = container.querySelector('.cart-field-hint-alerta');
    expect(aviso).toBeNull();
    const r = window.MMEnvioForm.validar();
    expect(r.ok).toBe(true);
  });
});
