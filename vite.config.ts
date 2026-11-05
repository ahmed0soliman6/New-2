import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const getEnv = (key: string) => process.env[key] || env[key] || '';

  for (const [k, v] of Object.entries(env)) {
    if (v && !process.env[k]) {
      process.env[k] = v;
    }
  }

  const apiDevMiddleware = () => ({
    name: 'api-dev-middleware',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || '';
        const routeMap: Record<string, string> = {
          '/api/users/create': './api/users/create',
          '/api/users/delete': './api/users/delete',
          '/api/users/reset-password': './api/users/reset-password',
          '/api/users/recover-admin': './api/users/recover-admin',
        };
        const matchedPath = Object.keys(routeMap).find((prefix) => url.startsWith(prefix));
        if (matchedPath) {
          try {
            let rawBody = '';
            req.on('data', (chunk: any) => {
              rawBody += chunk;
            });
            req.on('end', async () => {
              try {
                req.body = rawBody ? JSON.parse(rawBody) : {};
              } catch {
                req.body = {};
              }
              try {
                const { default: handler } = await import(routeMap[matchedPath]);
                await handler(req, res);
              } catch (handlerErr: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ error: handlerErr.message }));
              }
            });
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }
        next();
      });
    },
  });

  return {
    base: './',
    plugins: [react(), tailwindcss(), apiDevMiddleware()],
    resolve: { alias: { '@': path.resolve(__dirname, '.') } },
    envPrefix: ['VITE_'],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL')),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY') || getEnv('SUPABASE_PUBLISHABLE_KEY')),
      'import.meta.env.VITE_CLINIC_SLUG': JSON.stringify(getEnv('VITE_CLINIC_SLUG') || getEnv('CLINIC_SLUG') || 'solimedical-new2'),
      'import.meta.env.VITE_INTERNAL_EMAIL_DOMAIN': JSON.stringify(getEnv('VITE_INTERNAL_EMAIL_DOMAIN') || getEnv('INTERNAL_EMAIL_DOMAIN') || 'auth.solimedical.local'),
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@supabase')) return 'vendor-supabase';
              if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('qrcode')) return 'vendor-pdf';
              if (id.includes('react') || id.includes('lucide-react') || id.includes('motion')) return 'vendor-react';
            }
          },
        },
      },
    },
  };
});

