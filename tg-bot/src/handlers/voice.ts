import { Context } from 'grammy';
import { config } from '../config.js';
import { transcribe } from '../services/whisper.js';
import { cleanText } from '../services/text-cleaner.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB Telegram Bot API limit

const TEST_MODELS = [
  { name: 'tiny', url: 'http://whisper-tiny:9000' },
  { name: 'base', url: 'http://whisper-base:9000' },
  { name: 'small', url: 'http://whisper:9000' },
  { name: 'medium', url: 'http://whisper-medium:9000' },
  { name: 'large-v3', url: 'http://whisper-large-v3:9000' },
  { name: 'large-v3-turbo', url: 'http://whisper-turbo:9000' },
];

const MODEL_UNLOAD_WAIT = 15_000; // wait for MODEL_IDLE_TIMEOUT (10s) + margin

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadAudio(ctx: Context): Promise<{ buffer: Buffer; filename: string } | null> {
  const voice = ctx.msg?.voice;
  const audio = ctx.msg?.audio;
  const videoNote = ctx.msg?.video_note;
  const source = voice || audio || videoNote;

  if (!source) return null;

  if (source.file_size && source.file_size > MAX_FILE_SIZE) {
    await ctx.reply('File too large (max 20 MB).');
    return null;
  }

  const file = await ctx.api.getFile(source.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to download file: ${response.status}`);

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    filename: file.file_path?.split('/').pop() || 'voice.ogg',
  };
}

async function handleTestMode(ctx: Context, audioBuffer: Buffer, filename: string): Promise<void> {
  await ctx.reply(`Model comparison test (${TEST_MODELS.length} models, 2 runs each)...`);

  for (let i = 0; i < TEST_MODELS.length; i++) {
    const model = TEST_MODELS[i];
    const statusMsg = await ctx.reply(`[${i + 1}/${TEST_MODELS.length}] ${model.name}: loading...`);

    try {
      // Cold start (includes model load)
      const coldStart = Date.now();
      const rawCold = await transcribe(audioBuffer, filename, model.url);
      const coldTime = ((Date.now() - coldStart) / 1000).toFixed(1);

      await ctx.api.editMessageText(
        ctx.chat!.id, statusMsg.message_id,
        `[${i + 1}/${TEST_MODELS.length}] ${model.name}: cold ${coldTime}s, running warm...`,
      );

      // Warm run (model already loaded)
      const warmStart = Date.now();
      const rawWarm = await transcribe(audioBuffer, filename, model.url);
      const warmTime = ((Date.now() - warmStart) / 1000).toFixed(1);

      await ctx.api.editMessageText(
        ctx.chat!.id, statusMsg.message_id,
        `[${i + 1}/${TEST_MODELS.length}] ${model.name}: cleaning text...`,
      );

      // LLM cleanup
      const cleaned = await cleanText(rawWarm);

      const result = [
        `--- ${model.name} ---`,
        `Cold: ${coldTime}s | Warm: ${warmTime}s`,
        ``,
        `Raw:`,
        rawWarm,
        ``,
        `Cleaned:`,
        cleaned,
      ].join('\n');

      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await ctx.api.editMessageText(
        ctx.chat!.id, statusMsg.message_id,
        `--- ${model.name} ---\nError: ${message}`,
      ).catch(() => {});
    }

    // Wait for model to unload before next test
    if (i < TEST_MODELS.length - 1) {
      await sleep(MODEL_UNLOAD_WAIT);
    }
  }

  await ctx.reply('Test complete.');
}

async function handleNormalMode(ctx: Context, audioBuffer: Buffer, filename: string): Promise<void> {
  const statusMsg = await ctx.reply('Transcribing...');

  try {
    const rawText = await transcribe(audioBuffer, filename);

    if (!rawText) {
      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, 'No speech detected.');
      return;
    }

    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, 'Cleaning up text...');

    const cleanedText = await cleanText(rawText);

    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, cleanedText);
  } catch (err) {
    console.error('Transcription error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `Error: ${message}`,
    ).catch(() => {});
  }
}

export async function handleVoice(ctx: Context): Promise<void> {
  const audio = await downloadAudio(ctx);
  if (!audio) return;

  if (config.whisperTestMode) {
    await handleTestMode(ctx, audio.buffer, audio.filename);
  } else {
    await handleNormalMode(ctx, audio.buffer, audio.filename);
  }
}
