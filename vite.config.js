import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Custom Vite Dev Plugin to run Vercel serverless API handlers in local development
 */
function localApiPlugin() {
  return {
    name: 'local-serverless-api',
    configureServer(server) {
      // Load environment variables for the Node.js process in dev mode
      const env = loadEnv('development', process.cwd(), '');
      for (const [k, v] of Object.entries(env)) {
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }

      server.middlewares.use(async (req, res, next) => {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:5173'}`);
        const pathname = parsedUrl.pathname;

        if (!pathname.startsWith('/api/')) {
          return next();
        }

        // Map pathname to api/ file
        let relativePath = pathname.replace(/^\/api\//, '');
        // Strip trailing slash
        relativePath = relativePath.replace(/\/$/, '');

        const candidatePaths = [
          path.resolve(process.cwd(), 'api', `${relativePath}.js`),
          path.resolve(process.cwd(), 'api', relativePath, 'index.js')
        ];

        let targetFile = null;
        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            targetFile = p;
            break;
          }
        }

        if (!targetFile) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `API route ${pathname} not found.` }));
          return;
        }

        // Parse query params into req.query
        req.query = Object.fromEntries(parsedUrl.searchParams.entries());

        // Parse JSON or form body for POST/PUT/DELETE
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
          let rawBody = '';
          for await (const chunk of req) {
            rawBody += chunk;
          }
          try {
            req.body = rawBody ? JSON.parse(rawBody) : {};
          } catch {
            req.body = rawBody;
          }
        } else {
          req.body = {};
        }

        // Enhance response object with Express-like helpers
        res.status = function (code) {
          this.statusCode = code;
          return this;
        };

        res.json = function (data) {
          if (!this.getHeader('Content-Type')) {
            this.setHeader('Content-Type', 'application/json');
          }
          this.end(JSON.stringify(data));
          return this;
        };

        try {
          // Dynamically import handler
          const moduleUrl = url.pathToFileURL(targetFile).href + `?t=${Date.now()}`;
          const mod = await import(moduleUrl);
          const handler = mod.default || mod;
          await handler(req, res);
        } catch (err) {
          console.error(`Error executing ${pathname}:`, err);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Internal server error executing API handler.' }));
          }
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    localApiPlugin()
  ],
  build: {
    sourcemap: false, // Prevent exposing source code files via browser inspection
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (
            id.includes('components/admin') || 
            id.includes('components/AdminModal') || 
            id.includes('components/AdminLoginModal')
          ) {
            return 'admin-portal';
          }
        }
      }
    }
  }
});
