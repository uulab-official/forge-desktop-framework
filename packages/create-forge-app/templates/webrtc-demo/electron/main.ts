import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { createLogger } from '@forge/logger';

const logger = createLogger('main');
const isDev = !app.isPackaged;

function isTrustedRendererUrl(targetUrl: string) {
  if (!targetUrl) return false;
  if (!isDev) return targetUrl.startsWith('file://');
  const devServerUrl = process.env['VITE_DEV_SERVER_URL'];
  if (!devServerUrl) return false;
  try {
    return new URL(targetUrl).origin === new URL(devServerUrl).origin;
  } catch {
    return false;
  }
}

function maybeOpenExternalUrl(targetUrl: string) {
  try {
    const parsed = new URL(targetUrl);
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      void shell.openExternal(targetUrl);
    }
  } catch {}
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isTrustedRendererUrl(url)) maybeOpenExternalUrl(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isTrustedRendererUrl(url)) return;
    event.preventDefault();
    maybeOpenExternalUrl(url);
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
