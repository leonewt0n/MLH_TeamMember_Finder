import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// On GitHub Actions, the Pages workflow sets VITE_BASE to the project
// path (for example /MLH_TeamMember_Finder). Local dev stays at /.
const pagesBase = process.env.VITE_BASE?.replace(/\/$/, '')

export default defineConfig({
  base: pagesBase ? `${pagesBase}/` : '/',
  plugins: [react()],
  optimizeDeps: {
    include: ['yjs', 'y-indexeddb', 'mqtt'],
  },
})
