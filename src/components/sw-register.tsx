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
          return Promise.all(
            names
              .filter((name) => name !== currentVersion)
              .map((name) => caches.delete(name))
          );
        }).catch((err) => {
          console.warn('Cache cleanup failed:', err);
        });
      }
    }
  }, []);

  return null;
}
