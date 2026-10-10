"use client";

import { useEffect } from 'react';

/** Registra el service worker (solo en producción, para no cachear en desarrollo). */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker la app funciona igual; solo pierde el modo sin conexión.
    });
  }, []);

  return null;
}
