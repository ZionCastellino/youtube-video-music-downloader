import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/download': 'http://127.0.0.1:8000',
      '/pick-folder': 'http://127.0.0.1:8000',
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
