/**
 * Electron 主进程入口。
 * 一个应用有三个进程：这里能碰磁盘和数据库；preload 只转发消息；窗口里的页面只画界面。
 * 单实例锁避免开两个窗口同时搬同一个文件。
 */
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { sortboxDir, dbFilePath, userMdPath } from './core/paths';
import { logger } from './core/logger';
import { ServiceContainer } from './app/ServiceContainer';

const locked = app.requestSingleInstanceLock();
if (!locked) {
  app.quit();
}

app.setName('Sortbox');

let mainWindow: BrowserWindow | null = null;
let container: ServiceContainer | null = null;
let quitting = false;

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 880,
    minHeight: 560,
    title: '分拣匣 Sortbox',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void window.loadURL(devUrl);
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  return window;
}

if (locked) {
  app.on('second-instance', () => {
    if (!mainWindow) {
      return;
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  });

  app.on('will-quit', (event) => {
    if (quitting || !container) {
      return;
    }
    event.preventDefault();
    quitting = true;
    void container.shutdown().then(() => {
      app.quit();
    });
  });

  void app.whenReady().then(async () => {
    try {
      container = new ServiceContainer(app.getVersion(), dbFilePath(), userMdPath());
      await container.boot(sortboxDir());
    } catch (error) {
      const message = error instanceof Error ? error.message : '启动失败';
      dialog.showErrorBox('分拣匣 Sortbox', message);
      logger.error(message);
      quitting = true;
      app.quit();
      return;
    }
    mainWindow = createWindow();
    container.events.subscribe((mainEvent) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sortbox:event', mainEvent);
      }
    });
    ipcMain.handle('sortbox:invoke', (_event, payload: unknown) => {
      if (!container) {
        throw new Error('应用尚未就绪');
      }
      return container.dispatcher.invoke(payload);
    });
  });
}
