import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Política de seguridad de contenido.
 *
 * Es deliberadamente amplia en `script-src`/`style-src`: las presentaciones se
 * muestran en iframes `srcdoc`, que HEREDAN esta política, y cargan KaTeX,
 * tipografías, Tailwind o three.js desde CDN con scripts en línea. Lo que
 * protege a la plataforma no es esta lista sino el `sandbox` del iframe (origen
 * opaco: sin acceso a la sesión, al almacenamiento ni al DOM de la app) y
 * `frame-ancestors`, que impide incrustar el sitio en páginas ajenas.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:" + (isDev ? ' http:' : ''),
  "style-src 'self' 'unsafe-inline' https: data:",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' data: blob: https: http:",
  "font-src 'self' data: https:",
  "connect-src 'self' https: wss: data: blob:" + (isDev ? ' http: ws:' : ''),
  "worker-src 'self' blob: https: data:",
  "frame-src 'self' https: data: blob:",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

// Los iframes aislados tienen origen "null": lo que la app les sirve (KaTeX
// y sus tipografías) necesita CORS explícito aunque venga de este servidor.
const openCors = [
  { key: 'Access-Control-Allow-Origin', value: '*' },
  { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
];

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    },
    {
      source: '/katex/:path*',
      headers: [...openCors, { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=2592000' }],
    },
    {
      // Después de la regla general de /katex para que prevalezca.
      source: '/katex/fonts/:path*',
      headers: [...openCors, { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
    {
      source: '/icons/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' }],
    },
    {
      // El service worker debe poder actualizarse en cuanto se despliega.
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'no-cache' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
  ],
};

export default nextConfig;
