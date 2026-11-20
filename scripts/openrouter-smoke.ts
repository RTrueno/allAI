import { existsSync } from 'node:fs';
import { sendOpenRouterChat, OpenRouterRequestError } from '../lib/openrouter.ts';

// Use the process environment first. Ignored local files are convenient for local development.
if (!process.env.OPENROUTER_API_KEY?.trim()) {
  for (const file of ['.dev.vars', '.env.local', '.env']) {
    if (existsSync(file)) process.loadEnvFile(file);
    if (process.env.OPENROUTER_API_KEY?.trim()) break;
  }
}

const model = process.argv[2] || process.env.OPENROUTER_MODEL || 'openrouter/free';
const prompt = process.argv.slice(3).join(' ') || 'Ответь одной короткой фразой: подключение allAI к OpenRouter работает.';

try {
  const response = await sendOpenRouterChat({
    apiKey: process.env.OPENROUTER_API_KEY,
    model,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 256,
  });
  console.log(`Модель: ${response.model}`);
  console.log(response.content);
} catch (error) {
  // Do not print SDK error objects: they may include the HTTP request and its Authorization header.
  console.error(error instanceof OpenRouterRequestError
    ? `Ошибка${error.status ? ` (${error.status})` : ''}: ${error.message}`
    : 'Не удалось выполнить пробный запрос. Проверь настройки окружения.');
  process.exitCode = 1;
}
