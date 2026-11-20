from pathlib import Path
import subprocess
import zipfile
import re
import json

root = Path(__file__).resolve().parents[1]
git = r'C:\Program Files\Git\cmd\git.exe'
files = subprocess.check_output([git, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=root).decode('utf-8').split('\0')
files = sorted(set(f for f in files if f and (root/f).is_file()))
output = root/'outputs'/'allAI-desktop-source.zip'
secret = re.compile(rb'sk-or-v1-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')
for name in files:
    parts = Path(name).parts
    if any(p in {'node_modules', 'release', 'dist', '.git', '.wrangler', 'outputs'} for p in parts):
        raise RuntimeError('Unexpected private or generated entry')
    if Path(name).name.startswith(('.env', '.dev.vars')) and Path(name).name != '.env.example':
        raise RuntimeError('Unexpected environment file')
    if secret.search((root/name).read_bytes()):
        raise RuntimeError('Potential credential detected; source archive not created')

with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6, strict_timestamps=False) as archive:
    for name in files:
        if name != 'README.md':
            archive.write(root/name, name)
    archive.writestr('README.md', (root/'desktop'/'README.md').read_text(encoding='utf-8') + '\n\n## Веб-приложение\n\nИнструкция по серверу и сайту: [README-ALLAI.md](README-ALLAI.md).\n')
    archive.writestr('GITHUB-DESKTOP.md', '''# Как получить сборки Windows, macOS и Linux

1. Распакуй архив и загрузи его содержимое в корень своего репозитория GitHub.
2. Не забудь скрытую папку `.github` с файлом `workflows/desktop.yml`: без неё автоматическая сборка не появится.
3. Открой вкладку Actions → Desktop builds → Run workflow.
4. После успешного выполнения скачай Windows, macOS или Linux из блока Artifacts.

Workflow собирает Windows x64 (`setup.exe`, `portable.exe`), macOS Apple Silicon и Intel (`dmg`, `zip`), Linux x64 (`AppImage`, `deb`). API-ключи моделей для сборки не нужны. Сборки без настроенных сертификатов не подписаны; для публичного распространения настрой подпись и notarization.

Если браузер GitHub ограничивает число загружаемых файлов, используй Git для загрузки всей распакованной папки. ZIP сам по себе GitHub не распакует.

Локальный запуск: `cd desktop`, `npm ci`, `npm start`.

Приложение подключается к опубликованному allAI. Это не автономный сервер: нужен интернет и доступ к сайту. Сессия входа сохраняется, API key хранится только в памяти страницы.
''')
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    for name in ['desktop/main.cjs', 'desktop/policy.cjs', 'desktop/preload.cjs', 'desktop/assets/icon.ico', 'desktop/assets/icon.icns', 'desktop/package-lock.json', '.github/workflows/desktop.yml', 'README.md', '.env.example']:
        assert name in archive.namelist(), name
    print(json.dumps({'archive':str(output),'files':len(archive.namelist()),'bytes':output.stat().st_size,'credentials':'scan passed','integrity':'passed'}, ensure_ascii=False))
