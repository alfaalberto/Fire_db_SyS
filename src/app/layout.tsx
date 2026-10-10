import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { SwRegister } from '@/components/sw-register';

// Tipografías servidas desde el propio sitio (ver src/fonts/LICENSE.md).
const body = localFont({
  src: '../fonts/NunitoSans-latin.woff2',
  variable: '--font-body',
  weight: '200 1000',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});

const display = localFont({
  src: '../fonts/Fredoka-latin.woff2',
  variable: '--font-display',
  weight: '300 700',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
});

const mono = localFont({
  src: [
    { path: '../fonts/DMMono-latin-400.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/DMMono-latin-500.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
});

export const metadata: Metadata = {
  title: 'Señales y Sistemas — Plataforma Académica',
  description:
    'Presentaciones interactivas del curso de Señales y Sistemas, organizadas según el libro de Oppenheim, Willsky y Nawab.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.svg',
    apple: '/icons/icon-512.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFF9F2' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1020' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Casi todas las presentaciones cargan KaTeX y tipografías de estos orígenes. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://firestore.googleapis.com" />
      </head>
      <body className={`${body.variable} ${display.variable} ${mono.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
          <SwRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
