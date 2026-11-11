# 分拣匣 Sortbox

桌面应用。下载目录安静之后，按预设把文件搬到归档目录。不联网、无账号。判断依据是文件名、扩展名和大小，不打开文件看正文。

给别人用时，不需要对方安装 Node。在这台电脑上打出一个安装包，对方双击即可。从源码启动才需要下面的环境。

## 环境

- Node.js **20 LTS**（与 Electron 30 一致，原生模块有现成预编译包）
- [pnpm](https://pnpm.io/) 9 及以上（本仓库用 pnpm 12 验证过）
- Windows、macOS 或 Linux

Node 22 及以上可以跑单测：`better-sqlite3` 加载失败时会改用 Node 自带的 `node:sqlite`。桌面窗口跑在 Electron 30（Node 20）里，**不能**用这个后备，窗口启动仍需要 Electron 版的 `better-sqlite3`。

## 第一次打开

窗口标题是「分拣匣 Sortbox」。第一次会停在初始化页，按页面上的四步做完：

1. 添加监视目录，一般是下载文件夹。
2. 选一个归档根目录。不要放在监视目录里面，否则程序拒绝启动。
3. 勾选预设。名字预设只在文件名里出现你写的词时才会命中，例如文件名含「课件」。
4. 点「完成初始化」。

进入控制台之后：

- 顶部一句话说明当前状态。还没启动时先点「启动」。已经在跑时，实心按钮是「立即整理」。
- 「试运行」默认是关。点成「开」之后只记日志、不移动文件，并且会记住，直到再点一次关掉。按钮写成「试运行：开」时，文件不会被整理走。
- 每次整理结束，主页给出这一轮扫描、归档、未分类、失败各有多少。点「查看」才看每个文件。列表里没有一长串数字，那是内部轮次号，界面不显示。
- 策略选「定时」时，默认每 5 分钟看一次（300000 毫秒）。「静默检测」不是轮询：目录安静几秒就会整理。已经初始化过的数据库仍保存着当初的间隔，要在设置里改成 `300000` 再点保存。
- 预设编辑页的「预览路径」只替换目录模板里的占位符。默认模板是 `{yyyy-MM}/{origFileName}`，所以改名称或文件名条件时，这一行不变。要看某个文件名会归到哪，改样例文件名再点「试命中」。

设置页底部的版本号来自 `package.json` 的 `version`，目前是 `0.1.0`。推送到 Git 仓库不会改这个数字。

## 从源码启动

```bash
pnpm install
pnpm dev
```

`pnpm dev` 会编译主进程和预加载脚本，并打开窗口。已经构建过、只想再开窗口：

```bash
pnpm build
pnpm start
```

## 做成双击就能安装的程序

安装包在开发机上打，不在对方电脑上打。对方不需要 Node、pnpm 或这个仓库。

```bash
pnpm dist
```

这条命令先编译，再用 electron-builder 打 Windows 安装包。`electron-builder.yml` 里的 NSIS 已设成 `oneClick: true`：对方双击后直接安装，不再一步步选目录。装完后开始菜单和桌面都有「分拣匣 Sortbox」。

产物在 `dist` 目录，文件名类似 `Sortbox Setup 0.1.0.exe`。把这一个文件拷走即可。数据库和习惯文件仍写在对方自己的用户目录里，不在安装目录里。

这台 Windows 如果没有创建符号链接的权限，签名工具解压会失败。配置里已关掉 `signAndEditExecutable`，安装包可以生成，只是没有代码签名。对方的系统可能会多问一次是否信任这个程序。

打包装之前，这台电脑必须已经能 `pnpm dev` 打开窗口。`better-sqlite3` 是原生模块，安装包里要带上 Electron 30 能加载的那一份。没有 Visual Studio 时，按下一节放好预编译文件再执行 `pnpm dist`。

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

应用名是 `Sortbox`。第一次启动后，库和习惯文件出现在用户数据目录下的 `sortbox` 里。这里的 `user.md` 只记录整理习惯，不是安装说明：

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
