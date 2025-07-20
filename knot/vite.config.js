import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,        // required for Docker to expose the server
    port: 3001,         // force dev server to run on port 3001
    strictPort: true,   // fail if port 3001 is already in use
    watch: {
      usePolling: true  // important for file change detection inside Docker
    }
  }
})
