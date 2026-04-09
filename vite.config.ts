import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // KRİTİK: Beyaz ekranı çözen satır. 
  // EXE içinde dosyaların "file://" protokolüyle bulunabilmesini sağlar.
  base: './', 
  build: {
    // Çıktı klasörünün adının 'dist' olduğundan emin olalım
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    // Geliştirme modunda (npm run dev) Electron'un bağlanacağı port
    port: 5173,
    strictPort: true,
  }
})