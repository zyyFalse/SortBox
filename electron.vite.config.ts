import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

/**
 * electron-vite 把一个仓库打成三个包：
 * main（Node/Electron 主进程，能碰磁盘和数据库）、
 * preload（隔离桥，只转发消息）、
 * renderer（浏览器页面，只负责画界面）。
 * better-sqlite3 是原生模块，必须留在 node_modules 里，不能被打进 js 包。
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
});
