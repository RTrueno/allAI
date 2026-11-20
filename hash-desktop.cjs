const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
(async () => {
  const root = path.resolve(__dirname, '..');
  const files = ['desktop/release/allAI-1.0.0-windows-x64-setup.exe', 'desktop/release/allAI-1.0.0-windows-x64-portable.exe', 'outputs/allAI-desktop-source.zip'];
  const lines = [];
  for (const file of files) {
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(path.join(root, file))) hash.update(chunk);
    lines.push(`${hash.digest('hex')}  ${path.basename(file)}`);
  }
  fs.writeFileSync(path.join(__dirname, 'SHA256SUMS-desktop.txt'), lines.join('\n') + '\n');
  console.log('SHA256 checksums saved for 2 Windows executables and the source ZIP.');
})().catch(() => { console.error('Unable to hash desktop artifacts'); process.exitCode = 1; });
