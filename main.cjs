const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// === UYGULAMA İSMİNİ ZORLA (DEV MODUNDA BİLE KENDİ KLASÖRÜNÜ AÇAR) ===
app.setName('Modern API Tester');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Modern API Tester',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Geliştirme aşamasında Vite'in yerel sunucusuna bağlanıyoruz
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }
}

app.whenReady().then(() => {
  // === MAC İÇİN MENÜ ÇUBUĞU ===
  const template = [
    {
      label: 'Modern API Tester',
      submenu: [
        { role: 'about', label: 'Hakkında' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: 'Gizle' },
        { role: 'hideOthers', label: 'Diğerlerini Gizle' },
        { role: 'unhide', label: 'Göster' },
        { type: 'separator' },
        { role: 'quit', label: 'Çıkış' }
      ]
    },
    {
      label: 'Düzen',
      submenu: [
        { role: 'undo', label: 'Geri Al' },
        { role: 'redo', label: 'Yinele' },
        { type: 'separator' },
        { role: 'cut', label: 'Kes' },
        { role: 'copy', label: 'Kopyala' },
        { role: 'paste', label: 'Yapıştır' },
        { role: 'selectAll', label: 'Tümünü Seç' }
      ]
    },
    {
      label: 'Görünüm',
      submenu: [
        { role: 'reload', label: 'Yeniden Yükle' },
        { role: 'forceReload', label: 'Zorla Yeniden Yükle' },
        { role: 'toggleDevTools', label: 'Geliştirici Araçları' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Yakınlaştırmayı Sıfırla' },
        { role: 'zoomIn', label: 'Yakınlaştır' },
        { role: 'zoomOut', label: 'Uzaklaştır' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tam Ekran' }
      ]
    },
    {
      label: 'Pencere',
      submenu: [
        { role: 'minimize', label: 'Küçült' },
        { role: 'zoom', label: 'Yakınlaştır' },
        { role: 'close', label: 'Kapat' }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // === PROJE KLASÖRÜNÜ HAZIRLA ===
  // İşletim sisteminin güvenli uygulama verileri klasörünü kullanıyoruz
  const projectsDir = path.join(app.getPath('userData'), 'projects');
  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true });
  }
  
  console.log("📁 Projelerin Kaydedildiği Dizin:", projectsDir);

// === 1. SINIRSIZ HTTP İSTEĞİ (CORS'U AŞMAK İÇİN) ===
  ipcMain.handle('make-request', async (event, { method, url, body, customHeaders, timeout }) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const start = Date.now();
    
    // Timeout mekanizması için AbortController
    const controller = new AbortController();
    const timeoutMs = (parseInt(timeout) || 10) * 1000; // Saniyeyi milisaniyeye çevir (Varsayılan 10sn)
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const options = { 
        method, 
        headers: { 'Content-Type': 'application/json', ...customHeaders },
        signal: controller.signal // İptal sinyalini buraya bağlıyoruz
      };
      
      if (method !== 'GET' && method !== 'HEAD' && body && body.trim() !== "{\n  \n}") {
        options.body = body;
      }
      
      const res = await fetch(url, options);
      clearTimeout(timeoutId); // İstek başarılıysa zamanlayıcıyı temizle

      const text = await res.text();
      return { ok: res.ok, status: res.status, statusText: res.statusText, time: Date.now() - start, data: text };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return { error: `Zaman aşımı! Sunucu ${timeout} saniye içinde yanıt vermedi.` };
      }
      return { error: err.message };
    }
  });

  // === 2. PROJE DOSYALARI YÖNETİMİ (FILE SYSTEM) ===
  
  // Tüm projeleri listele
  ipcMain.handle('get-projects', () => {
    if (!fs.existsSync(projectsDir)) return [];
    const files = fs.readdirSync(projectsDir);
    // Sadece .json uzantılı dosyaları al ve uzantılarını kırparak isimleri döndür
    return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  });

  // Yeni proje oluştur
  ipcMain.handle('create-project', (event, name) => {
    const filePath = path.join(projectsDir, `${name}.json`);
    
    // Eğer bu isimde bir proje zaten varsa hata dön
    if (fs.existsSync(filePath)) {
      return { error: 'Bu isimde bir proje zaten var!' };
    }
    
    // Yoksa varsayılan boş iskeleti oluştur ve kaydet
    const defaultData = { endpoints: [], requests: [] };
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    return { success: true };
  });

  // Seçilen projenin verilerini oku
  ipcMain.handle('load-project', (event, name) => {
    const filePath = path.join(projectsDir, `${name}.json`);
    if (!fs.existsSync(filePath)) {
      return { endpoints: [], requests: [] };
    }
    // Dosyayı oku ve JSON objesine çevirerek React'a (Arayüze) gönder
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  });

  // İstekleri projeye kaydet (Üzerine yaz)
  ipcMain.handle('save-project', (event, name, data) => {
    const filePath = path.join(projectsDir, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return { success: true };
  });

  // === UYGULAMAYI BAŞLAT ===
  createWindow();

  // macOS için pencere davranışı (Dock'tan tıklanınca yeniden açılma)
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// macOS hariç, tüm pencereler kapanınca uygulamayı tamamen kapat
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
