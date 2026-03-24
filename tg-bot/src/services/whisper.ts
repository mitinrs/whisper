import { config } from "../config.js";

export async function transcribe(audio: Buffer, filename: string, whisperUrl?: string): Promise<string> {
  const url = whisperUrl || config.whisperUrl;

  const params = new URLSearchParams({
    task: "transcribe",
    language: config.whisperLanguage,
    output: "txt",
    encode: "true",
    vad_filter: "true",
  });

  const form = new FormData();
  form.append("audio_file", new Blob([new Uint8Array(audio)]), filename);

  const res = await fetch(`${url}/asr?${params}`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(600_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Whisper ASR error ${res.status}: ${body}`);
  }

  return (await res.text()).trim();
}
