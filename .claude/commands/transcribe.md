# Transcribe Audio/Video

Transcribe an audio or video file to text using Whisper ASR service on Home PC.
Supports speaker diarization (separation by speakers).

## Arguments

- `$ARGUMENTS` — file path and optional flags
  - Example: `/tmp/meeting.mp3`
  - Example: `/tmp/interview.wav --diarize`
  - Example: `/tmp/podcast.mp4 --language en --srt`

## Options

- `--language LANG` — language code (default: `ru`). Use `auto` for auto-detection.
- `--diarize` — enable speaker diarization (who said what)
- `--min-speakers N` — minimum number of speakers (with --diarize)
- `--max-speakers N` — maximum number of speakers (with --diarize)
- `--output FORMAT` — output format: `txt` (default), `json`, `srt`, `vtt`, `tsv`
- `--json` — shorthand for `--output json` (with timestamps)
- `--srt` — shorthand for `--output srt` (subtitles)
- `--vad` — enable VAD filter (skip silence, faster)
- `--translate` — translate to English instead of transcribing
- `--word-timestamps` — include word-level timing (json output)

## Supported Formats

Audio: `.wav`, `.mp3`, `.flac`, `.ogg`, `.m4a`, `.aac`, `.wma`
Video: `.webm`, `.mp4`, `.mkv`, `.avi`, `.mov`, `.wmv`, `.flv`

## Execution Steps

### Step 1: Parse arguments

Extract from `$ARGUMENTS`:
- `FILE_PATH` — local file path (required, first non-flag argument)
- `LANGUAGE` — default `ru`
- `OUTPUT` — default `txt`
- `TASK` — `transcribe` (default) or `translate` (if `--translate`)
- `DIARIZE` — `false` (default) or `true` (if `--diarize`)
- `MIN_SPEAKERS` — optional (if `--min-speakers`)
- `MAX_SPEAKERS` — optional (if `--max-speakers`)
- `VAD_FILTER` — `false` (default) or `true` (if `--vad`)
- `WORD_TIMESTAMPS` — `false` (default) or `true` (if `--word-timestamps`)

If `--json` is passed, set OUTPUT=json. If `--srt`, set OUTPUT=srt.

Validate that FILE_PATH exists and is a supported format.

### Step 2: Copy file to VPS

The Whisper API runs on Home PC, reachable from VPS via WireGuard at `10.0.0.2:9100`.
Copy the file to VPS as a relay:

```bash
scp "FILE_PATH" vps1:/tmp/whisper_input
```

### Step 3: Build and send API request

Construct the curl command with query parameters:

```bash
ssh vps1 "curl -s -X POST \
  -F 'audio_file=@/tmp/whisper_input' \
  'http://10.0.0.2:9100/asr?encode=true&task=TASK&language=LANGUAGE&output=OUTPUT&diarize=DIARIZE&vad_filter=VAD_FILTER&word_timestamps=WORD_TIMESTAMPS&min_speakers=MIN_SPEAKERS&max_speakers=MAX_SPEAKERS' \
  --max-time 3600"
```

Use timeout 600000 ms (10 minutes) for Bash tool. For very large files (>1 hour), the API may take 15-30 min on CPU.

**Important**: The first request after idle (5 min timeout) takes 10-30 extra seconds for model loading. This is normal.

### Step 4: Clean up

```bash
ssh vps1 "rm -f /tmp/whisper_input"
```

### Step 5: Format and return output

- **txt**: Return raw text directly
- **json**: Pretty-print with `python3 -m json.tool`, highlight segments with timestamps
- **srt/vtt**: Return as-is (subtitle format)
- **tsv**: Format as readable table

Report:
- File name and size
- Language detected
- Number of segments
- Processing time (if available)
- If diarized: number of speakers found

### Step 6: Save result (optional)

If the user wants to save, write result to a `.md` or appropriate format file next to the source file or at a specified path.

## API Reference

Base URL: `http://10.0.0.2:9100` (from VPS via WireGuard)

**Endpoints:**
- `POST /asr` — transcribe audio (multipart form: `audio_file`)
- `GET /docs` — Swagger UI

**Query parameters:**
| Parameter | Values | Default |
|-----------|--------|---------|
| `task` | `transcribe`, `translate` | `transcribe` |
| `language` | ISO code (`ru`, `en`, etc.) | `ru` |
| `output` | `txt`, `json`, `srt`, `vtt`, `tsv` | `txt` |
| `encode` | `true`, `false` | `true` |
| `diarize` | `true`, `false` | `false` |
| `vad_filter` | `true`, `false` | `false` |
| `word_timestamps` | `true`, `false` | `false` |
| `min_speakers` | integer | (auto) |
| `max_speakers` | integer | (auto) |

## Model Info

- **Default model**: `small` (~2 GB RAM)
- **Engine**: WhisperX (faster-whisper + diarization)
- **Device**: CPU (Ryzen 7 5800U)
- **Speed**: ~1x realtime (1 min audio ≈ 1 min processing)
- **Idle timeout**: 300s — model unloads after 5 min idle, reloads in ~10-30s on next request
- **Container**: `whisper` on Home PC, port 9100

## Troubleshooting

**Connection refused (10.0.0.2:9100):**
- Check WireGuard: `ssh vps1 "wg show"` — verify Home PC handshake
- Check container: `ssh home-pc "docker ps | grep whisper"`

**Slow first request:**
- Normal — model loading takes 10-30 seconds after idle timeout (5 min)

**Timeout on long files:**
- Use `--vad` to skip silence (can be 2-3x faster)
- Large files (>1 hour) may take 15-30 min on CPU — increase Bash timeout

**Empty result:**
- Audio has no speech (music/tones return empty text)
- Wrong language? Try `--language auto`

**Diarization not working:**
- Requires `ASR_ENGINE=whisperx` in container (already configured)
- Requires valid `HF_TOKEN` for pyannote models
