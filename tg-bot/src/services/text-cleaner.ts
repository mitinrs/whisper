import OpenAI from 'openai';
import { config } from '../config.js';

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: config.openrouterApiKey,
});

const SYSTEM_PROMPT = `Ты — редактор устной речи. Твоя задача — убрать слова-паразиты и речевые заполнители из транскрибированного текста.

Правила:
- Убери слова-паразиты: "ну", "это", "вот", "типа", "как бы", "короче", "значит", "так сказать", "в общем", "собственно", "это самое", "как его", "слушай", "смотри", "блин", "ладно", "ну такое", "э-э", "м-м", "а-а"
- НЕ меняй смысл, структуру и стиль речи
- НЕ перефразируй и НЕ добавляй ничего от себя
- Сохрани все факты, цифры, имена, термины
- Исправь очевидные ошибки распознавания речи если они есть
- Верни только очищенный текст, без комментариев`;

export async function cleanText(text: string): Promise<string> {
  const response = await client.chat.completions.create({
    model: config.openrouterModel,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content?.trim() || text;
}
