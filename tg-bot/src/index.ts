import { createBot } from './bot.js';

const bot = createBot();

process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());

console.log('Starting Whisper Telegram bot...');
bot.start();
