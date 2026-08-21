'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Turnstile (captcha) — Supabase Auth lo exige en signInWithPassword para
 * este proyecto ("Enable CAPTCHA protection" está prendido), así que el
 * login del panel admin no puede mandar la request sin esto. Mismo
 * sitekey público que ya usaba assets/cuenta.js (assets/supabase-config.js).
 * Se porta acá en vez de esperar al Sprint 5 (cuenta completa) porque sin
 * esto el botón "Iniciar sesión" de este panel no funciona en absoluto —
 * no es una mejora, es un requisito para que el login ande.
 */
const SITEKEY = '0x4AAAAAAECQq0Yu3dLrZtNE';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
    };
  }
}

export function useTurnstile() {
  const [token, setToken] = useState('');
  const contRef = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    let intervalo: ReturnType<typeof setInterval> | null = null;

    function render() {
      if (cancelado || widgetId.current !== null || !contRef.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(contRef.current, {
        sitekey: SITEKEY,
        callback: (t: string) => setToken(t),
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken('')
      });
    }

    if (window.turnstile) render();
    else intervalo = setInterval(() => window.turnstile && render(), 200);

    return () => {
      cancelado = true;
      if (intervalo) clearInterval(intervalo);
    };
  }, []);

  function reset() {
    setToken('');
    if (widgetId.current !== null && window.turnstile) window.turnstile.reset(widgetId.current);
  }

  return { token, contRef, reset };
}
