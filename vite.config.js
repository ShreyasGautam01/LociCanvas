import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages hosts this project under /LociCanvas/; Vercel serves it at the domain root.
// GitHub Actions sets GITHUB_ACTIONS=true for the Pages build, while Vercel does not.
const base = process.env.GITHUB_ACTIONS === 'true' ? '/LociCanvas/' : '/'

export default defineConfig({
  base,
  plugins: [react()],
})
