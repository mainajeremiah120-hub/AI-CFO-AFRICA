import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    target: 'esnext',
    minify: 'esbuild',
    // Split vendor libraries into a separate cached chunk so app code changes
    // don't bust the React/Recharts/router bundle.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-recharts': ['recharts'],
          'vendor-axios':    ['axios'],
        },
      },
    },
    // Warn only when a chunk exceeds 800 kB (up from 500 kB default)
    chunkSizeWarningLimit: 800,
  },

  // Keep the dev server snappy
  server: {
    warmup: {
      clientFiles: ['./src/main.jsx', './src/App.jsx'],
    },
  },
});
