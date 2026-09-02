'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useCuenta } from '../cuenta/CuentaProvider';
import {
  cargarCarrito, guardarCarrito, ponerCantidad, quitarItem as quitarItemPuro, itemPorClave, cantidadDe, cantidadTotalDe,
  resumen, construirMensaje, urlPedido, waLink, guardarPedido, itemsParaLink,
  type ItemCarrito, type PreciosMapa, type Resumen,
} from '@/lib/carrito';
import { registrarEventoCarrito } from '@/lib/carrito-tracking';
import {
  estadoInicial, leerDatos, validar, resumenTexto, calcularProximoTurno,
  type EstadoEnvioForm, type DatosEntrega,
} from '@/lib/envio-form-logic';
import { cargarEnvios, type DatosEnvios } from '@/lib/envios';

export type ProductoParaCarrito = { title: string; code: string; variant?: string; img?: string };

type CarritoContextValue = {
  items: ItemCarrito[];
  panelAbierto: boolean;
  abrirPanel: () => void;
  cerrarPanel: () => void;
  cantidadDe: (prod: { title: string; code: string; variant?: string }) => number;
  cantidadTotalDe: (title: string) => number;
  agregar: (prod: ProductoParaCarrito) => void;
  setCantidad: (prod: ProductoParaCarrito, n: number) => void;
  quitarItem: (clave: string) => void;
  nota: string;
  setNota: (v: string) => void;
  precios: PreciosMapa | null;
  resumenPedido: Resumen;
  datosEnvios: DatosEnvios | null;
  estadoEnvio: EstadoEnvioForm;
  actualizarEnvio: (parcial: Partial<EstadoEnvioForm>) => void;
  elegirMetodo: (m: 'retiro' | 'envio') => void;
  activarEnvioInmediato: (activo: boolean) => void;
  buscandoTurno: boolean;
  datosEntrega: DatosEntrega;
  enviando: boolean;
  enviarPedido: () => Promise<void>;
  verPedidoCompleto: () => void;
};

const CarritoContext = createContext<CarritoContextValue | null>(null);

/**
 * Carrito de pedidos → WhatsApp (Sprint 5, Task 5.2), portado de
 * public/assets/carrito.js + envio-form.js. Vive dentro de CuentaProvider
 * (necesita sesión para pedir login antes de mandar el pedido, mismo
 * criterio que MMCuenta.pedirSesion en el sitio viejo) — ver
 * app/layout.tsx.
 */
export function CarritoProvider({ children }: { children: React.ReactNode }) {
  const { sb, sesion, pedirSesion } = useCuenta();

  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [nota, setNota] = useState('');
  const [precios, setPrecios] = useState<PreciosMapa | null>(null);
  const [datosEnvios, setDatosEnvios] = useState<DatosEnvios | null>(null);
  const [estadoEnvio, setEstadoEnvio] = useState<EstadoEnvioForm>(estadoInicial());
  const [buscandoTurno, setBuscandoTurno] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const pendienteRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    setItems(cargarCarrito());
  }, []);

  useEffect(() => {
    let cancelado = false;
    cargarEnvios(sb).then((d) => { if (!cancelado) setDatosEnvios(d); });
    return () => { cancelado = true; };
  }, [sb]);

  useEffect(() => {
    let cancelado = false;
    sb.rpc('catalogo_publico').then(({ data, error }: { data: any; error: any }) => {
      if (cancelado || error || !data) return;
      setPrecios(data.precios || {});
    });
    return () => { cancelado = true; };
  }, [sb]);

  const persistir = useCallback((siguiente: ItemCarrito[]) => {
    setItems(siguiente);
    guardarCarrito(siguiente);
  }, []);

  // Tracking de carritos (Sprint E del dashboard admin) — sólo con sesión
  // activa, a propósito (ver lib/carrito-tracking.ts). Nunca bloquea el
  // carrito: se dispara "en segundo plano", sin esperar su resultado.
  const trackear = useCallback((prod: Pick<ProductoParaCarrito, 'title' | 'code' | 'variant'>, n: number) => {
    if (!sesion) return;
    registrarEventoCarrito(sb, {
      user_id: sesion.user.id,
      tipo: n > 0 ? 'agregado' : 'quitado',
      titulo: prod.title,
      codigo: prod.code || null,
      variante: prod.variant || null,
      cantidad: n > 0 ? n : null,
    });
  }, [sesion, sb]);

  const agregar = useCallback((prod: ProductoParaCarrito) => {
    setItems((actuales) => {
      const n = cantidadDe(actuales, { title: prod.title, code: prod.code, variant: prod.variant }) + 1;
      const r = ponerCantidad(actuales, prod, n);
      if (!r.ok) {
        if (typeof window !== 'undefined') window.alert('El pedido llegó a 40 productos distintos. Para pedidos más grandes conviene escribirnos directo por WhatsApp.');
        return actuales;
      }
      guardarCarrito(r.items);
      trackear(prod, n);
      return r.items;
    });
  }, [trackear]);

  const setCantidad = useCallback((prod: ProductoParaCarrito, n: number) => {
    setItems((actuales) => {
      const r = ponerCantidad(actuales, prod, n);
      if (!r.ok) {
        if (typeof window !== 'undefined') window.alert('El pedido llegó a 40 productos distintos. Para pedidos más grandes conviene escribirnos directo por WhatsApp.');
        return actuales;
      }
      guardarCarrito(r.items);
      trackear(prod, n);
      return r.items;
    });
  }, [trackear]);

  const quitarItem = useCallback((clave: string) => {
    setItems((actuales) => {
      const item = itemPorClave(actuales, clave);
      const siguiente = quitarItemPuro(actuales, clave);
      guardarCarrito(siguiente);
      if (item) trackear({ title: item.title, code: item.code, variant: item.variant }, 0);
      return siguiente;
    });
  }, [trackear]);

  const abrirPanel = useCallback(() => setPanelAbierto(true), []);
  const cerrarPanel = useCallback(() => setPanelAbierto(false), []);

  const actualizarEnvio = useCallback((parcial: Partial<EstadoEnvioForm>) => {
    setEstadoEnvio((actual) => ({ ...actual, ...parcial }));
  }, []);

  const elegirMetodo = useCallback((m: 'retiro' | 'envio') => {
    setEstadoEnvio((actual) => ({
      ...actual, metodo: m,
      envioInmediato: m === 'retiro' ? false : actual.envioInmediato,
      turnoInmediato: m === 'retiro' ? null : actual.turnoInmediato,
    }));
  }, []);

  const activarEnvioInmediato = useCallback((activo: boolean) => {
    if (!activo) {
      setEstadoEnvio((actual) => ({ ...actual, envioInmediato: false, turnoInmediato: null, fecha: '', franjaId: null }));
      return;
    }
    setEstadoEnvio((actual) => {
      if (!actual.zonaId) {
        if (typeof window !== 'undefined') window.alert('Elegí primero tu zona.');
        return actual;
      }
      return { ...actual, envioInmediato: true };
    });
  }, []);

  // Cuando se activa envío inmediato (o cambia la zona con inmediato ya
  // activo), busca el próximo turno — mismo criterio que
  // aplicarEnvioInmediato() en envio-form.js.
  useEffect(() => {
    if (!datosEnvios || !estadoEnvio.envioInmediato || !estadoEnvio.zonaId || estadoEnvio.turnoInmediato) return;
    let cancelado = false;
    setBuscandoTurno(true);
    calcularProximoTurno(sb, datosEnvios, estadoEnvio.zonaId).then((turno) => {
      if (cancelado) return;
      setBuscandoTurno(false);
      setEstadoEnvio((actual) => {
        if (!actual.envioInmediato) return actual; // se destildó mientras se calculaba
        if (!turno) return { ...actual, turnoInmediato: null, fecha: '', franjaId: null };
        return { ...actual, turnoInmediato: turno, fecha: turno.fecha, franjaId: turno.franjaId };
      });
    });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datosEnvios, estadoEnvio.envioInmediato, estadoEnvio.zonaId]);

  const datosEntrega = datosEnvios ? leerDatos(estadoEnvio, datosEnvios) : leerDatos(estadoEnvio, { tarifas: [], zonas: [], franjas: [], sucursales: [], config: { horizonte_dias: 14, cobrar_envio: false, minimo_compra: 0, costo_envio_inmediato: 0, corte_inmediato_hora: '13:00:00', entrega_propia: false } });

  const linkPedido = useCallback((vistaCliente: boolean, entrega: DatosEntrega | null) => {
    if (typeof window === 'undefined' || window.location.protocol === 'file:') return '';
    const baseUrl = window.location.origin + '/';
    return urlPedido({ items, entrega, vistaCliente, baseUrl });
  }, [items]);

  const verPedidoCompleto = useCallback(() => {
    if (!items.length) { window.alert('Tu pedido está vacío.'); return; }
    const link = linkPedido(true, datosEntrega);
    if (!link) { window.alert('Esto sólo funciona en el sitio publicado, no abriendo el archivo local.'); return; }
    window.open(link, '_blank', 'noopener');
  }, [items, linkPedido, datosEntrega]);

  const enviarAhora = useCallback(async () => {
    setEnviando(true);
    try {
      const entregaLineas = resumenTexto(datosEntrega);
      const link = linkPedido(false, datosEntrega);
      const mensaje = construirMensaje({ items, precios, nombre: datosEntrega.nombre, entregaLineas, nota: nota.trim(), link });

      if (sesion) {
        items.forEach((it) => {
          registrarEventoCarrito(sb, {
            user_id: sesion.user.id, tipo: 'checkout_iniciado',
            titulo: it.title, codigo: it.code || null, variante: it.variant || null, cantidad: it.qty,
          });
        });
        await guardarPedido(sb, {
          user_id: sesion.user.id,
          items: itemsParaLink(items),
          nombre: datosEntrega.nombre,
          nota: nota.trim(),
          metodo_entrega: datosEntrega.metodoEntrega || 'retiro',
          direccion: datosEntrega.direccion,
          zona: datosEntrega.zonaNombre,
          telefono: datosEntrega.telefono,
          zona_nombre: datosEntrega.zonaNombre,
          costo_envio: datosEntrega.costoEnvio,
          franja_id: datosEntrega.franjaId,
          sucursal_id: datosEntrega.sucursalId,
          fecha_entrega: datosEntrega.fechaEntrega || null,
          entre_calles: datosEntrega.entreCalles,
          piso_depto: datosEntrega.pisoDepto,
          receptor_nombre: datosEntrega.receptorNombre,
          receptor_telefono: datosEntrega.receptorTelefono,
        });
      }

      window.open(waLink(mensaje), '_blank', 'noopener');
    } finally {
      setEnviando(false);
    }
  }, [items, precios, nota, datosEntrega, linkPedido, sesion, sb]);

  const enviarPedido = useCallback(async () => {
    if (!items.length) { window.alert('Tu pedido está vacío.'); return; }
    const v = validar(datosEntrega, datosEnvios || { tarifas: [], zonas: [], franjas: [], sucursales: [], config: { horizonte_dias: 14, cobrar_envio: false, minimo_compra: 0, costo_envio_inmediato: 0, corte_inmediato_hora: '13:00:00', entrega_propia: false } });
    if (!v.ok) { window.alert(v.mensaje); return; }
    if (!sesion) {
      pendienteRef.current = enviarAhora;
      pedirSesion(() => { pendienteRef.current?.(); });
      return;
    }
    await enviarAhora();
  }, [items, datosEntrega, datosEnvios, sesion, pedirSesion, enviarAhora]);

  return (
    <CarritoContext.Provider
      value={{
        items, panelAbierto, abrirPanel, cerrarPanel,
        cantidadDe: (prod) => cantidadDe(items, prod),
        cantidadTotalDe: (title) => cantidadTotalDe(items, title),
        agregar, setCantidad, quitarItem,
        nota, setNota, precios,
        resumenPedido: resumen(items, precios),
        datosEnvios, estadoEnvio, actualizarEnvio, elegirMetodo, activarEnvioInmediato, buscandoTurno,
        datosEntrega, enviando, enviarPedido, verPedidoCompleto,
      }}
    >
      {children}
    </CarritoContext.Provider>
  );
}

export function useCarrito() {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error('useCarrito() tiene que usarse dentro de <CarritoProvider>.');
  return ctx;
}
