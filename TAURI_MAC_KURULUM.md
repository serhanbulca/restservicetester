# Modern API Tester - macOS Tauri (Rust) Kurulum ve Derleme Rehberi

## 1. Ön Hazırlık
1. Xcode araçları: `xcode-select --install`
2. Rust kurulumu: `curl --proto '=https' --tlsv1.2 -sSf "https://sh.rustup.rs" | sh`
3. Ortam değişkenleri: `source "$HOME/.cargo/env"`

## 2. Bağımlılıklar ve İkon
1. Node paketleri: `npm install`
2. İkon üretimi: `npx @tauri-apps/cli icon icon.png`

## 3. Çalıştırma ve Paketleme (.app / .dmg)
- Geliştirme modu: `npm run tauri:dev`
- macOS Build (.dmg & .app): `npm run tauri:build`
- Kayıtlı projelerin yeri: `~/Library/Application Support/modern-http-tester/projects/`
