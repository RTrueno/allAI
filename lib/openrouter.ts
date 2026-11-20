import { OpenRouter } from '@openrouter/sdk';
import { OpenRouterError, RequestTimeoutError, RequestAbortedError, ConnectionError } from '@openrouter/sdk/models/errors';

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

/** Safe to return to the UI or print in the CLI; never contains a key or raw upstream body. */
export class OpenRouterRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'OpenRouterRequestError';
    this.status = status;
  }
}

export async function sendOpenRouterChat(options: {
  apiKey?: string;
  model: string;
  messages: ChatMessage[];
  referer?: string;
  maxTokens?: number;
}) {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    throw new OpenRouterRequestError('Не задан OPENROUTER_API_KEY. Создай ключ на https://openrouter.ai/keys и добавь его в окружение.', 503);
  }
  const client = new OpenRouter({
    apiKey,
    serverURL: 'https://openrouter.ai/api/v1',
    appTitle: 'allAI',
    httpReferer: options.referer,
    timeoutMs: 90_000,
    // A failed generation may have been charged already. Let the user choose whether to retry.
    retryConfig: { strategy: 'none' },
  });

  try {
    const response = await client.chat.send({
      chatRequest: {
        model: options.model,
        messages: options.messages,
        maxTokens: options.maxTokens ?? 4096,
        stream: false,
      },
    });
    const content = response.choices[0]?.message.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new OpenRouterRequestError('Модель вернула пустой ответ. Попробуй другую модель.', 502);
    }
    return { content, model: response.model, id: response.id };
  } catch (error) {
    if (error instanceof OpenRouterRequestError) throw error;
    if (error instanceof OpenRouterError) {
      const status = error.statusCode;
      const message = status === 401 ? 'OpenRouter отклонил API key. Проверь ключ.'
        : status === 402 ? 'Недостаточно средств или исчерпан бюджет ключа OpenRouter.'
        : status === 403 ? 'Доступ к OpenRouter или выбранной модели запрещён. Проверь ограничения сети и аккаунта.'
        : status === 404 ? 'Модель не найдена. Выбери действующий slug на https://openrouter.ai/models.'
        : status === 429 ? 'Лимит OpenRouter исчерпан. Подожди или выбери другую модель.'
        : status === 400 || status === 422 ? 'OpenRouter отклонил запрос. Проверь модель и размер контекста.'
        : 'OpenRouter временно недоступен. Попробуй позже.';
      throw new OpenRouterRequestError(message, status >= 400 && status <= 599 ? status : 502);
    }
    if (error instanceof RequestTimeoutError || error instanceof RequestAbortedError) {
      throw new OpenRouterRequestError('Модель не ответила за 90 секунд. Попробуй ещё раз.', 504);
    }
    if (error instanceof ConnectionError) {
      throw new OpenRouterRequestError('Не удалось подключиться к OpenRouter. Проверь сеть.', 502);
    }
    throw new OpenRouterRequestError('OpenRouter вернул некорректный ответ. Попробуй другую модель.', 502);
  }
}
