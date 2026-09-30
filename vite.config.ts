import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { outDir: 'dist/renderer', rollupOptions: { input: { main: 'index.html', preview: 'preview.html' } } } });
