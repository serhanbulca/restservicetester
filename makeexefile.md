# Modern API Tester - EXE Oluşturma Rehberi

Bu dosya, uygulamanın Windows için taşınabilir bir `.exe` haline getirilme adımlarını içerir.

## 1. Gerekli Kütüphanenin Kurulması
Öncelikle paketleme işlemini yapacak olan `electron-builder` kütüphanesini geliştirme bağımlılığı olarak kurun:

```bash
npm install electron-builder --save-dev