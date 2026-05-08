"use client";

import { useEffect } from 'react';

export function SwRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });

      if ('caches' in window) {
        caches.keys().then((names) => {
          const currentVersion = 'v1';
          names.forEach((name) => {
            if (name !== currentVersion) {
              caches.delete(name);
            }
          });
        });
      }
    }
  }, []);

  return null;
}
