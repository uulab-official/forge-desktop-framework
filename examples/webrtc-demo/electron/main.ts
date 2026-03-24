import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { createLogger } from '@forge/logger';

const logger = createLogger('main');
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Grant media permissions for camera/mic access
  win.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'mediaKeySystem', 'display-capture'].includes(permission);
    logger.info(`Permission request: ${permission} -> ${allowed ? 'granted' : 'denied'}`);
    callback(allowed);
  });

  if (isDev && process.env['VITE_DEV_SERVER_URL']) {
    win.loadURL(process.env['VITE_DEV_SERVER_URL']);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

ipcMain.handle('worker:execute', async () => {
  return { success: true, data: { status: 'ok' }, error: null };
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
