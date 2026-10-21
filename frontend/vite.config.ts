import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server:{ port: 5173, host: true },
  test:{
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.ts',
    env: {
      VITE_API_BASE_URL: 'http://localhost:3000/api/v1'
    },
  }
});
