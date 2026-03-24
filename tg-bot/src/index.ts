import { ProxyAgent, setGlobalDispatcher } from "undici";
import { createBot } from "./bot.js";

// Patch all HTTP requests (including node-fetch used by grammY) to use proxy
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
  console.log(`Proxy enabled: ${proxyUrl}`);
}

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
