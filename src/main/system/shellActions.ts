/**
 * 和操作系统对话框、资源管理器打交道。
 * Electron 的 dialog / shell 只能在主进程用。界面把「选个文件夹」发给这里。
 */
import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);

interface OpenResult {
  canceled: boolean;
  filePaths: string[];
}

interface SaveResult {
  canceled: boolean;
  filePath?: string;
}

interface ElectronShell {
  dialog: {
    showOpenDialog(
      window: unknown,
      options: { title: string; properties: string[]; filters?: Array<{ name: string; extensions: string[] }> }
    ): Promise<OpenResult>;
    showSaveDialog(
      window: unknown,
      options: { title: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }
    ): Promise<SaveResult>;
  };
  shell: {
    openPath(target: string): Promise<string>;
    showItemInFolder(target: string): void;
  };
  BrowserWindow: {
    getFocusedWindow(): unknown;
    getAllWindows(): unknown[];
  };
}

function electron(): ElectronShell {
  return nodeRequire('electron') as ElectronShell;
}

function hostWindow(): unknown {
  const windows = electron().BrowserWindow;
  return windows.getFocusedWindow() ?? windows.getAllWindows()[0];
}

/** 弹出选择文件夹。用户取消时返回 null。 */
export async function pickDirectory(title: string): Promise<string | null> {
  const result = await electron().dialog.showOpenDialog(hostWindow(), {
    title,
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0] ?? null;
}

/** 用系统默认程序打开路径。 */
export async function openPath(target: string): Promise<void> {
  await electron().shell.openPath(target);
}

/** 在文件管理器中定位。 */
export function revealPath(target: string): void {
  electron().shell.showItemInFolder(target);
}

/** 选择一个 JSON 文件。取消返回 null。 */
export async function pickJsonFile(title: string): Promise<string | null> {
  const result = await electron().dialog.showOpenDialog(hostWindow(), {
    title,
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0] ?? null;
}

/** 选择把 JSON 保存到哪里。取消返回 null。 */
export async function pickSaveJson(title: string, defaultPath: string): Promise<string | null> {
  const result = await electron().dialog.showSaveDialog(hostWindow(), {
    title,
    defaultPath,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) {
    return null;
  }
  return result.filePath;
}
