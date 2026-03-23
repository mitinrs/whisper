function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env variable: ${name}`);
    process.exit(1);
  }
  return value;
}

export const config = {
  botToken: requireEnv('TELEGRAM_BOT_TOKEN'),
  allowedUserIds: requireEnv('ALLOWED_USER_IDS').split(',').map(Number),
  whisperUrl: process.env.WHISPER_URL || 'http://whisper:9000',
  whisperLanguage: process.env.WHISPER_LANGUAGE || 'ru',
  openrouterApiKey: requireEnv('OPENROUTER_API_KEY'),
  openrouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
};
