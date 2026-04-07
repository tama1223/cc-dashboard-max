import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5175,
    proxy: {
      '/api': 'http://localhost:4002',
      '/ws': {
        target: 'ws://localhost:4002',
        ws: true,
      },
    },
  },
});
