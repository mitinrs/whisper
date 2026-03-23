import { Context } from 'grammy';
import { config } from '../config.js';
import { transcribe } from '../services/whisper.js';
import { cleanText } from '../services/text-cleaner.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB Telegram Bot API limit

export async function handleVoice(ctx: Context): Promise<void> {
  const voice = ctx.msg?.voice;
  const audio = ctx.msg?.audio;
  const videoNote = ctx.msg?.video_note;
  const source = voice || audio || videoNote;

  if (!source) return;

  if (source.file_size && source.file_size > MAX_FILE_SIZE) {
    await ctx.reply('File too large (max 20 MB).');
    return;
  }

  const statusMsg = await ctx.reply('Transcribing...');

  try {
    const file = await ctx.api.getFile(source.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;

    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to download file: ${response.status}`);
    const audioBuffer = Buffer.from(await response.arrayBuffer());

    const filename = file.file_path?.split('/').pop() || 'voice.ogg';

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
