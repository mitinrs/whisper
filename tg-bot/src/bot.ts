import { Bot } from "grammy";
import { config } from "./config.js";
import { authMiddleware } from "./middleware/auth.js";
import { handleVoice } from "./handlers/voice.js";

// Wrap native fetch to match node-fetch signature expected by grammY
const nativeFetch: typeof globalThis.fetch = (...args) => globalThis.fetch(...args);

export function createBot(): Bot {
  const bot = new Bot(config.botToken, {
    client: {
      fetch: nativeFetch as any,
    },
  });

  bot.use(authMiddleware(config.allowedUserIds));

  bot.on([":voice", ":audio", ":video_note"], handleVoice);

  bot.command("start", (ctx) =>
    ctx.reply("Send me a voice message and I will transcribe it."),
  );

  bot.catch((err) => {
    console.error("Bot error:", err.error);
  });

  return bot;
}
