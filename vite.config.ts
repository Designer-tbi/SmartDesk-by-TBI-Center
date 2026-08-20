import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({mode}) => {
  void mode;
  return {
    plugins: [react(), tailwindcss()],
    // GEMINI_API_KEY is no longer exposed to the client bundle — it used
    // to be baked in here via `define`, which put a paid API key in
    // plaintext in every visitor's browser. The Gemini call now happens
    // server-side (server/services/accountingAI.ts).
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': ['motion/react', 'lucide-react', 'recharts'],
            'vendor-utils': ['i18next', 'react-i18next', 'date-fns', 'clsx', 'tailwind-merge'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      allowedHosts: true,
    },
  };
});
