import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'skim-page-query-url-fallback',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const request = req as typeof req & { url?: string };

          if (request.url && request.url.indexOf('/?url=') === 0) {
            request.url = `/index.html${request.url.slice(1)}`;
          }

          next();
        });
      },
    },
  ],
});
