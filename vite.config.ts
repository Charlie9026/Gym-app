import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative URLs, so the build works at any address (a project page like
  // user.github.io/Gym-app/, a custom domain, or a local folder).
  base: './',
  build: {
    // The Firebase chunk is large but only downloaded when you use cloud backup.
    chunkSizeWarningLimit: 700,
  },
})
