'use strict';
const { app, BrowserWindow, WebContentsView, Menu, ipcMain, shell, session, screen, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { APP_URL, APP_ORIGIN, safeHTTPS, internalURL, boundsFromSaved, loadError } = require('./policy.cjs');
const SHELL_FILE = path.join(__dirname, 'ui', 'index.html');
const SHELL_URL = pathToFileURL(SHELL_FILE).href;
const PARTITION = 'persist:allai-web';
let win, view, smokeTimer;
let state = { status: 'loading', message: 'Подключаем твоё пространство…', canGoBack: false, canGoForward: false, version: app.getVersion() };
const smoke = !app.isPackaged && process.argv.includes('--smoke-test');
const securePreferences = { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, navigateOnDragDrop: false };
function update(patch) {
  state = { ...state, ...patch };
  if (win && !win.isDestroyed()) win.webContents.send('allai:state', state);
}
function historyState() {
  if (!view || view.webContents.isDestroyed()) return;
  update({ canGoBack: view.webContents.navigationHistory.canGoBack(), canGoForward: view.webContents.navigationHistory.canGoForward() });
}
function allowedSender(event) { return event.sender === win?.webContents && event.senderFrame?.url === SHELL_URL; }
function openExternal(url) { if (safeHTTPS(url)) shell.openExternal(url).catch(() => update({ message: 'Не удалось открыть системный браузер.' })); }
function attachNavigation(contents) {
  const protect = (event, url) => { if (!internalURL(url)) { event.preventDefault(); if (safeHTTPS(url)) openExternal(url); } };
  contents.on('will-navigate', protect);
  contents.on('will-redirect', protect);
  contents.on('will-attach-webview', event => event.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    if (!internalURL(url)) { openExternal(url); return { action: 'deny' }; }
    return { action: 'allow', overrideBrowserWindowOptions: { parent: win, width: 580, height: 760, autoHideMenuBar: true, webPreferences: { ...securePreferences, partition: PARTITION } } };
  });
  contents.on('did-create-window', child => {
    attachNavigation(child.webContents);
    child.webContents.on('did-navigate', (_event, url) => {
      if (new URL(url).origin === APP_ORIGIN) { child.close(); connect(); }
    });
  });
}
function finishSmoke(ok, detail) {
  if (!smoke) return;
  clearTimeout(smokeTimer);
  const visible = win.isVisible();
  console.log(JSON.stringify({ app: 'allAI', ok: ok && visible, detail, windowVisible: visible, remoteSandbox: view.webContents.getLastWebPreferences().sandbox, remoteNodeIntegration: view.webContents.getLastWebPreferences().nodeIntegration, localShell: win.webContents.getURL() === SHELL_URL }));
  app.exit(ok && visible ? 0 : 1);
}
function connect() {
  if (!view || view.webContents.isDestroyed()) return;
  update({ status: 'loading', message: 'Подключаем твоё пространство…' });
  view.setVisible(false);
  view.webContents.loadURL(APP_URL).catch(() => {});
}
function layout() {
  if (!win || !view) return;
  const [width, height] = win.getContentSize();
  view.setBounds({ x: 0, y: 58, width, height: Math.max(0, height - 58) });
}
function createWindow() {
  let saved;
  try { saved = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'window.json'), 'utf8')); } catch {}
  win = new BrowserWindow({
    ...boundsFromSaved(saved, screen.getAllDisplays().map(d => d.workArea)),
    minWidth: 860, minHeight: 620, title: 'allAI', backgroundColor: '#f1eff7',
    icon: path.join(__dirname, 'assets', 'icon.png'), show: true, autoHideMenuBar: true,
    webPreferences: { ...securePreferences, preload: path.join(__dirname, 'preload.cjs') },
  });
  win.loadFile(SHELL_FILE);
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.once('ready-to-show', () => win.show());
  const ses = session.fromPartition(PARTITION);
  ses.setPermissionRequestHandler((contents, permission, callback) => callback(permission === 'clipboard-sanitized-write' && new URL(contents.getURL()).origin === APP_ORIGIN));
  ses.setPermissionCheckHandler((_contents, permission, origin) => permission === 'clipboard-sanitized-write' && origin === APP_ORIGIN);
  ses.on('will-download', event => event.preventDefault());
  view = new WebContentsView({ webPreferences: { ...securePreferences, partition: PARTITION } });
  win.contentView.addChildView(view);
  view.setVisible(false);
  layout();
  win.on('resize', layout);
  attachNavigation(view.webContents);
  view.webContents.on('did-start-loading', () => update({ status: 'loading' }));
  view.webContents.on('did-finish-load', () => {
    view.setVisible(true);
    update({ status: 'ready', message: 'Подключено к allAI' }); historyState();
    finishSmoke(true, 'Remote page loaded');
  });
  view.webContents.on('did-navigate', historyState);
  view.webContents.on('did-navigate-in-page', historyState);
  view.webContents.on('did-fail-load', (_event, code, _description, _url, mainFrame) => {
    if (!mainFrame || code === -3) return;
    view.setVisible(false);
    update({ status: 'offline', message: loadError(code) });
    finishSmoke(false, `Navigation error ${code}`);
  });
  view.webContents.on('render-process-gone', () => { view.setVisible(false); update({ status: 'offline', message: 'Окно сайта завершило работу. Нажми «Подключиться».' }); });
  win.on('close', () => {
    if (!win.isMaximized() && !win.isMinimized()) {
      try { fs.writeFileSync(path.join(app.getPath('userData'), 'window.json'), JSON.stringify(win.getBounds())); } catch {}
    }
  });
  win.on('closed', () => { if (view && !view.webContents.isDestroyed()) view.webContents.close(); view = null; win = null; });
  connect();
  if (smoke) smokeTimer = setTimeout(() => finishSmoke(false, 'Navigation timed out'), 30_000);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.setName('allAI');
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('app.allai.desktop');
    ipcMain.handle('allai:state', event => allowedSender(event) ? state : null);
    ipcMain.on('allai:action', (event, action) => {
      if (!allowedSender(event)) return;
      if (action === 'retry' || action === 'home') connect();
      else if (action === 'reload') view?.webContents.reload();
      else if (action === 'back' && view?.webContents.navigationHistory.canGoBack()) view.webContents.navigationHistory.goBack();
      else if (action === 'forward' && view?.webContents.navigationHistory.canGoForward()) view.webContents.navigationHistory.goForward();
      else if (action === 'browser') openExternal(APP_URL);
    });
    const menu = [
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { label: 'allAI', submenu: [
        { label: 'Главная', click: connect },
        { label: 'Обновить', accelerator: 'CmdOrCtrl+R', click: () => view?.webContents.reload() },
        { label: 'Открыть сайт в браузере', click: () => openExternal(APP_URL) },
        { type: 'separator' }, { role: 'quit', label: 'Выйти' },
      ] },
      { label: 'Правка', submenu: [{ role: 'undo', label: 'Отменить' }, { role: 'redo', label: 'Повторить' }, { type: 'separator' }, { role: 'cut', label: 'Вырезать' }, { role: 'copy', label: 'Копировать' }, { role: 'paste', label: 'Вставить' }, { role: 'selectAll', label: 'Выделить всё' }] },
      { label: 'Вид', submenu: [{ role: 'resetZoom', label: 'Масштаб 100%' }, { role: 'zoomIn', label: 'Увеличить' }, { role: 'zoomOut', label: 'Уменьшить' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'Полный экран' }] },
      { label: 'Помощь', submenu: [{ label: 'О приложении', click: () => dialog.showMessageBox(win, { type: 'info', title: 'allAI', message: `allAI ${app.getVersion()}`, detail: 'Библиотека нейросетей и чат с моделями OpenRouter.\n\nПриложение подключено к веб-версии. Для чатов нужен интернет и вход в аккаунт. Ключ OpenRouter вводится в настройках сайта и хранится в памяти вкладки.\n\nЕсли Google не разрешает вход во встроенном окне, используй вход по почте.' }) }] },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
    createWindow();
    app.on('activate', () => { if (!win) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
