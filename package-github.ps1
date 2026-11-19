$ErrorActionPreference = 'Stop'
$projectRoot = 'C:\Users\Руслан\Documents\ChatGPT\allAI\allai'
$archivePath = Join-Path $projectRoot 'outputs\allAI-github.zip'
$gitPath = 'C:\Program Files\Git\cmd\git.exe'
Set-Location -LiteralPath $projectRoot
& $gitPath archive --format=zip --output=$archivePath HEAD
if ($LASTEXITCODE -ne 0) { throw 'Git archive failed' }

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$archive = [IO.Compression.ZipFile]::Open($archivePath, [IO.Compression.ZipArchiveMode]::Update)
function Write-ZipText([string]$name, [string]$content) {
    $existing = $archive.GetEntry($name)
    if ($existing) { $existing.Delete() }
    $entry = $archive.CreateEntry($name, [IO.Compression.CompressionLevel]::Optimal)
    $writer = New-Object IO.StreamWriter($entry.Open(), (New-Object Text.UTF8Encoding($false)))
    try { $writer.Write($content) } finally { $writer.Dispose() }
}
try {
    $starterReadme = [IO.File]::ReadAllText((Join-Path $projectRoot 'README.md'))
    $projectReadme = [IO.File]::ReadAllText((Join-Path $projectRoot 'README-ALLAI.md')).Replace('см. README.md стартера', 'см. DEVELOPMENT.md')
    $uploadNotes = @'
# Загрузка allAI на GitHub

1. Распакуй allAI-github.zip на компьютере.
2. Создай пустой репозиторий на GitHub.
3. Открой Add file → Upload files и загрузи содержимое распакованной папки. Сам ZIP GitHub автоматически не распакует.
4. Убедись, что package.json и README.md находятся в корне репозитория. При загрузке через браузер не забудь файлы с точкой в имени: .gitignore, .env.example, .npmrc и папку .openai.

Для загрузки всех файлов через Git из распакованной папки:

```sh
git init
git add .
git commit -m "Initial allAI source"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

## Запуск

Нужен Node.js 22.13 или новее. Сначала `npm ci`, затем `npm run dev`.
Для локальной базы D1 собери проект (`npm run build`) и примени SQL-миграции из drizzle по инструкции DEVELOPMENT.md. Не применяй уже выполненные миграции повторно.
Пробный API-запрос: `npm run openrouter:smoke`. Подробности — в README.md.

## Что находится в архиве

Исходники интерфейса и сервера, lockfile зависимостей, миграции базы, тесты и пустой шаблон переменных .env.example. История Git, node_modules, сборки, локальные базы и реальные .env/.dev.vars исключены.

## Размещение сайта

Загрузка исходников на GitHub не запускает сайт автоматически. Это серверное приложение Cloudflare Workers + D1, оно не работает целиком на GitHub Pages.
Файл .openai/hosting.json относится к существующему опубликованному allAI в Sites. Для отдельного нового сайта настрой собственный проект и базу; не переиспользуй идентификатор чужого проекта.
Реальные API-ключи храни в секретах хостинга либо в локальном игнорируемом .dev.vars. Пользователи также могут вводить свои OpenRouter API-ключи в настройках сайта.

## Описание для About

allAI — библиотека нейросетей с единым чатом через OpenRouter. Выбор и смена моделей с сохранением истории, пользовательские API-ключи, личные диалоги и чат сообщества. Адаптивный интерфейс в стиле Material You со светлой и тёмной темами.
'@
    Write-ZipText 'DEVELOPMENT.md' $starterReadme
    Write-ZipText 'README.md' $projectReadme
    Write-ZipText 'README-ALLAI.md' $projectReadme
    Write-ZipText 'GITHUB-UPLOAD.md' $uploadNotes
} finally { $archive.Dispose() }

$check = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    $names = @($check.Entries | ForEach-Object { $_.FullName })
    foreach ($required in @('package.json','package-lock.json','README.md','GITHUB-UPLOAD.md','.env.example','.gitignore','app/AllAI.tsx','app/api/[...path]/route.ts','lib/openrouter.ts','db/schema.ts')) {
        if ($names -notcontains $required) { throw "Missing required entry: $required" }
    }
    if ($names | Where-Object { $_ -match '(^|/)(node_modules|\.git|\.wrangler|outputs|dist)/|(^|/)(\.env($|\.(?!example$))|\.dev\.vars)' }) { throw 'Archive contains excluded data' }
    $secretPattern = 'sk-or-v1-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
    foreach ($entry in $check.Entries) {
        if ($entry.Name -eq '') { continue }
        $reader = New-Object IO.StreamReader($entry.Open())
        try { $content = $reader.ReadToEnd() } finally { $reader.Dispose() }
        if ($content -match $secretPattern) { throw 'Potential secret found; archive delivery stopped' }
    }
    $size = (Get-Item -LiteralPath $archivePath).Length
    [PSCustomObject]@{archive=$archivePath; files=$names.Count; bytes=$size; required_files='verified'; excluded_data='verified'; credential_scan='passed'} | ConvertTo-Json -Compress
} finally { $check.Dispose() }
