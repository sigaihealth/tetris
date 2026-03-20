import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    include: ['matter-js'],
  },
  build: {
    commonjsOptions: {
      include: [/matter-js/, /node_modules/],
    },
  },
});
