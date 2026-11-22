import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: `npm run dev` proxies /api, /classic and /hisab to the Express
// backend on :4000. Prod: Express serves web/dist itself (single service),
// or deploy dist/ to Vercel and set VITE_API_BASE to the backend URL.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/classic': 'http://localhost:4000',
      '/hisab': 'http://localhost:4000'
    }
  },
  build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 700 }
});
