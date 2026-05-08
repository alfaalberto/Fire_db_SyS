import type {NextConfig} from 'next';

const isGithubPages = process.env.GITHUB_PAGES === 'true';
const repo = process.env.REPO_NAME || '';
const distDir = process.env.NEXT_DIST_DIR || '.next';

const nextConfig: NextConfig = {
  distDir,
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
  output: isGithubPages ? 'export' : undefined,
  images: {
    unoptimized: !!isGithubPages,
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', port: '', pathname: '/**' },
    ],
  },
  ...(isGithubPages
    ? {
        basePath: repo ? `/${repo}` : undefined,
        assetPrefix: repo ? `/${repo}/` : undefined,
      }
    : {
        headers: async () => {
          const csp = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http: data: blob:",
            "style-src 'self' 'unsafe-inline' https: http: data:",
            "img-src 'self' data: blob: https: http:",
            "media-src 'self' data: blob: https: http:",
            "font-src 'self' data: https: http:",
            "connect-src 'self' https: http: ws: wss: data:",
            "worker-src 'self' blob: https: http: data:",
            "frame-src 'self' https: http: data: blob:",
            "frame-ancestors 'self'",
            "object-src 'none'",
            "base-uri 'self'",
          ].join('; ');
          return [
            {
              source: '/:path*',
              headers: [
                { key: 'Content-Security-Policy', value: csp },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
              ],
            },
            {
              source: '/katex/fonts/:path*',
              headers: [
                { key: 'Access-Control-Allow-Origin', value: '*' },
                { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
                { key: 'Access-Control-Allow-Headers', value: '*' },
                { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
              ],
            },
            {
              source: '/images/:path*',
              headers: [
                { key: 'Access-Control-Allow-Origin', value: '*' },
                { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
                { key: 'Access-Control-Allow-Headers', value: '*' },
                { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
              ],
            },
            {
              source: '/assets/:path*',
              headers: [
                { key: 'Access-Control-Allow-Origin', value: '*' },
                { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
                { key: 'Access-Control-Allow-Headers', value: '*' },
                { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
