// electron/main.js
import { app, BrowserWindow } from 'electron';
import path from 'path';
import url from 'url';

// Geliştirme ortamında olup olmadığımızı kontrol et
const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  // Tarayıcı penceresini oluştur.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Opsiyonel: preload script'i için
      contextIsolation: true,
      nodeIntegration: false, // Güvenlik için false olması önerilir, gerekirse preload ile iletişim kurun
    },
  });

  // Geliştirme modunda Vite dev sunucusunu yükle.
  // Üretim modunda ise build edilmiş index.html dosyasını yükle.
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173'); // Vite dev sunucunuzun portu (package.json'daki port)
    // Geliştirici araçlarını aç.
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, '../dist/index.html'), // Vite build çıktısındaki index.html
        protocol: 'file:',
        slashes: true,
      })
    );
  }
}

// Bu metod, Electron başlatıldığında ve tarayıcı pencerelerini oluşturmaya
// hazır olduğunda çağrılacaktır.
// Bazı API'ler sadece bu olay gerçekleştikten sonra kullanılabilir.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // macOS'ta, dock simgesine tıklandığında ve başka pencere açık olmadığında
    // genellikle bir pencere yeniden oluşturulur.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Tüm pencereler kapatıldığında uygulamadan çık. (Windows & Linux)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit(); // macOS hariç
});

// Opsiyonel: electron/preload.js dosyası (güvenli IPC için)
// Bu dosyayı oluşturup, renderer processe (React uygulamanıza)
// güvenli bir şekilde Node.js API'lerini veya Electron API'lerini sunabilirsiniz.
// Şimdilik boş bırakabilir veya basit bir console.log ekleyebilirsiniz.
// electron/preload.js
// window.addEventListener('DOMContentLoaded', () => {
//   console.log('Preload script yüklendi');
// });