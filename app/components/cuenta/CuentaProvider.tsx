'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase';

export type CuentaTab = 'signup' | 'login' | 'recuperar';
export type AjustesTab = 'datos' | 'pass' | 'email' | 'pedidos';

type CuentaContextValue = {
  sb: SupabaseClient;
  sesion: Session | null;
  cargandoSesion: boolean;
  esAdmin: boolean;
  modalAbierto: boolean;
  tabModal: CuentaTab;
  ajustesAbierto: boolean;
  tabAjustes: AjustesTab;
  favoritosAbierto: boolean;
  pedirSesion: (cb?: (() => void) | null, tabInicial?: CuentaTab) => void;
  irATab: (tab: CuentaTab) => void;
  cerrarModal: () => void;
  tomarPendiente: () => (() => void) | null;
  abrirAjustes: (tab?: AjustesTab) => void;
  irAAjustesTab: (tab: AjustesTab) => void;
  cerrarAjustes: () => void;
  abrirFavoritos: () => void;
  cerrarFavoritos: () => void;
  cerrarSesion: () => Promise<void>;
};

const CuentaContext = createContext<CuentaContextValue | null>(null);

/**
 * Sesión de cliente (Supabase Auth), portada de assets/cuenta.js (Sprint 5,
 * Task 5.1). Un solo cliente para toda la página — mismo patrón que ya usa
 * app/components/admin/AdminGate.tsx (Sprint 4), pero acá vive arriba del
 * layout para que Nav (el ícono de cuenta) y cualquier página cliente
 * puedan pedir sesión sin crear su propio GoTrueClient (evita el warning
 * de Supabase por dos clientes compitiendo por el mismo storage).
 */
export function CuentaProvider({ children }: { children: React.ReactNode }) {
  const sbRef = useRef<SupabaseClient | null>(null);
  if (!sbRef.current) sbRef.current = supabaseBrowser();
  const sb = sbRef.current;

  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);
  const esAdminCache = useRef<Record<string, boolean>>({});

  const [modalAbierto, setModalAbierto] = useState(false);
  const [tabModal, setTabModal] = useState<CuentaTab>('signup');
  const pendienteRef = useRef<(() => void) | null>(null);

  const [ajustesAbierto, setAjustesAbierto] = useState(false);
  const [tabAjustes, setTabAjustes] = useState<AjustesTab>('datos');

  const [favoritosAbierto, setFavoritosAbierto] = useState(false);

  useEffect(() => {
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSesion(s);
      setCargandoSesion(false);
    });
    sb.auth.getSession().then((r) => {
      setSesion(r.data.session);
      setCargandoSesion(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    const uid = sesion?.user?.id;
    if (!uid) { setEsAdmin(false); return; }
    if (Object.prototype.hasOwnProperty.call(esAdminCache.current, uid)) {
      setEsAdmin(esAdminCache.current[uid]);
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const r = await sb.rpc('es_admin');
        if (cancelado) return;
        const admin = !r.error && !!r.data;
        esAdminCache.current[uid] = admin;
        setEsAdmin(admin);
      } catch {
        if (!cancelado) setEsAdmin(false);
      }
    })();
    return () => { cancelado = true; };
  }, [sb, sesion]);

  const pedirSesion = useCallback((cb?: (() => void) | null, tabInicial: CuentaTab = 'signup') => {
    pendienteRef.current = cb || null;
    setTabModal(tabInicial);
    setModalAbierto(true);
  }, []);

  const irATab = useCallback((tab: CuentaTab) => setTabModal(tab), []);
  const cerrarModal = useCallback(() => setModalAbierto(false), []);
  const tomarPendiente = useCallback(() => {
    const cb = pendienteRef.current;
    pendienteRef.current = null;
    return cb;
  }, []);

  const abrirAjustes = useCallback((tab: AjustesTab = 'datos') => {
    if (!sesion) { pedirSesion(() => abrirAjustes(tab)); return; }
    setTabAjustes(tab);
    setAjustesAbierto(true);
  }, [sesion, pedirSesion]);
  const irAAjustesTab = useCallback((tab: AjustesTab) => setTabAjustes(tab), []);
  const cerrarAjustes = useCallback(() => setAjustesAbierto(false), []);

  const abrirFavoritos = useCallback(() => setFavoritosAbierto(true), []);
  const cerrarFavoritos = useCallback(() => setFavoritosAbierto(false), []);

  // scope: 'global' invalida la sesión en todos los dispositivos donde esa
  // cuenta esté logueada, no sólo en este navegador — mismo criterio que el
  // sitio viejo.
  const cerrarSesion = useCallback(async () => {
    await sb.auth.signOut({ scope: 'global' });
  }, [sb]);

  return (
    <CuentaContext.Provider
      value={{
        sb, sesion, cargandoSesion, esAdmin,
        modalAbierto, tabModal, ajustesAbierto, tabAjustes, favoritosAbierto,
        pedirSesion, irATab, cerrarModal, tomarPendiente,
        abrirAjustes, irAAjustesTab, cerrarAjustes,
        abrirFavoritos, cerrarFavoritos,
        cerrarSesion,
      }}
    >
      {children}
    </CuentaContext.Provider>
  );
}

export function useCuenta() {
  const ctx = useContext(CuentaContext);
  if (!ctx) throw new Error('useCuenta() tiene que usarse dentro de <CuentaProvider>.');
  return ctx;
}
