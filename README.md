# 分拣匣 Sortbox

桌面应用。按预设把下载目录里的文件整理到归档目录，不联网、无账号。界面是 Electron 窗口，数据在本机 SQLite 和 `user.md`。

## 环境

- Node.js **20 LTS**（与 Electron 30 一致，原生模块有现成预编译包）
- [pnpm](https://pnpm.io/) 9 及以上（本仓库用 pnpm 12 验证过）
- Windows、macOS 或 Linux

Node 22 及以上可以跑单测：`better-sqlite3` 加载失败时会改用 Node 自带的 `node:sqlite`。桌面窗口跑在 Electron 30（Node 20）里，**不能**用这个后备，窗口启动仍需要 Electron 版的 `better-sqlite3`。

## 安装并启动

```bash
pnpm install
pnpm dev
```

`pnpm dev` 会编译主进程和预加载脚本，打开标题为「分拣匣 Sortbox」的窗口。第一次进入初始化页：添加监视目录、选择归档根目录、确认预设包，然后点「完成初始化」。

已经构建过、只想再开窗口：

```bash
pnpm build
pnpm start
```

打包安装包：

```bash
pnpm dist
```

## 原生模块装不上时

`pnpm install` 末尾会执行 `electron-builder install-app-deps`，为 Electron 准备 `better-sqlite3`。没有对应预编译包、机器上也没有 C++ 编译器时，这一步会失败，日志里会出现「No prebuilt binaries found」或「Could not find any Visual Studio installation」。

可以改成先跳过编译，再放入 Electron 30（ABI 123）的预编译文件。下面是 Windows x64、`better-sqlite3@11.10.0` 的做法：

```powershell
pnpm install --ignore-scripts
node node_modules/electron/install.js

$root = "node_modules/better-sqlite3"
New-Item -ItemType Directory -Force -Path "$root/build/Release" | Out-Null
$tar = Join-Path $env:TEMP "better-sqlite3-electron.tar.gz"
Invoke-WebRequest `
  -Uri "https://github.com/WiseLibs/better-sqlite3/releases/download/v11.10.0/better-sqlite3-v11.10.0-electron-v123-win32-x64.tar.gz" `
  -OutFile $tar
tar -xzf $tar -C $root
pnpm dev
```

其他系统把压缩包名里的 `win32-x64` 换成对应平台（例如 `darwin-arm64`、`linux-x64`）。版本号以 `pnpm-lock.yaml` 里实际装到的 `better-sqlite3` 为准。

若希望从源码编译，安装 Visual Studio Build Tools（含「使用 C++ 的桌面开发」）或 Xcode Command Line Tools 后，重新执行 `pnpm install`。

## 检查

```bash
pnpm check
```

依次做类型检查、lint、带覆盖率的单测，以及架构边界扫描。只跑测试：

```bash
pnpm test
```

## 数据放在哪

应用名是 `Sortbox`。库和习惯文件在用户数据目录下的 `sortbox` 里：

- Windows：`%APPDATA%\Sortbox\sortbox\sortbox.db` 和同目录的 `user.md`
- macOS：`~/Library/Application Support/Sortbox/sortbox/`
- Linux：`~/.config/Sortbox/sortbox/`

这两个文件不要提交。`.gitignore` 已忽略 `*.db` 以及 WAL 附属文件。

## 目录

| 路径 | 内容 |
| --- | --- |
| `src/main` | 主进程：数据库、整理、IPC |
| `src/preload` | 只暴露 `invoke` 和 `subscribe` |
| `src/renderer` | 窗口界面 |
| `src/shared` | 两边共用的类型和 ViewModel |
| `tests/unit` | 单测 |
| `SPEC.md` / `SPEC-IMPL.md` | 产品说明和实现契约 |
