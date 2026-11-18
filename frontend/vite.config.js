import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Front-end na porta 5173; a API (Express) fica na 3000 e libera CORS para esta origem.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
});
