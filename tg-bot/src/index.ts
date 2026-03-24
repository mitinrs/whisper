import { createBot } from "./bot.js";

const bot = createBot();

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

console.log("Starting Whisper Telegram bot...");
bot.start({
  timeout: 10,
  onStart: () => console.log("Bot polling started successfully"),
}).catch((err) => {
  console.error("Bot.start() failed:", err);
  process.exit(1);
});
