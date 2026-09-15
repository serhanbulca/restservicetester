import os from 'node:os'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // TS config yerine JS config kullanıyoruz; bazı ortamlarda Vite'ın
  // `vite.config.ts.timestamp-*.mjs` üretmesi engellenebiliyor (EPERM).
  // Ayrıca cache dizinini repo dışına alarak read-only checkout'larda da çalıştırmayı kolaylaştırıyoruz.
  cacheDir: path.join(os.homedir(), '.modern-api-tester', 'vite-cache'),
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
  },
})
