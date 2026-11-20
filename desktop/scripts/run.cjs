const { spawn } = require('node:child_process');
const path = require('node:path');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), [path.join(__dirname, '..'), ...process.argv.slice(2)], { env, stdio: 'inherit', windowsHide: true });
child.on('error', () => { console.error('Не удалось запустить Electron. Выполни npm ci в папке desktop.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child.kill(); });
