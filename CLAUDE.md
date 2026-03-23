# CLAUDE.md — Whisper Agent

## Project Overview

**Whisper Agent** — сервис транскрибации аудио/видео с диаризацией (разделением по спикерам), развёрнутый на Home PC как Docker-контейнер. Доступен как REST API, через VPS-домен и как скилл Claude Code.

## Architecture

```
┌─────────────────┐      ┌──────────────┐      ┌──────────────────┐
│  Claude Code    │─scp─▶│   VPS        │─curl─▶│  Home PC         │
│  /transcribe    │      │  (relay)     │  WG   │  whisper:9100    │
│  skill          │◀─────│  vps1        │◀──────│  WhisperX engine │
└─────────────────┘      └──────────────┘      └──────────────────┘
                              │
                    https://whisper.pusk365.ru
                    (Traefik + ForwardAuth)
```

### Telegram Bot

```
Telegram → tg-bot (Node.js, grammY) → Whisper ASR (whisper:9000) → OpenRouter LLM → Telegram
```

- **Container**: `tg-bot` (Node.js 20 Alpine)
- **Framework**: grammY (TypeScript)
- **Text cleanup**: OpenRouter API (LLM removes filler words)
- **Auth**: whitelist of Telegram user IDs

### Whisper ASR

- **Container**: `onerahmet/openai-whisper-asr-webservice:latest`
- **Engine**: WhisperX (faster-whisper + pyannote diarization)
- **Default model**: `small` (~2 GB RAM)
- **Device**: CPU (AMD Ryzen 7 5800U, 8C/16T)
- **API**: REST `POST /asr`, Swagger UI at `/docs`
- **Port**: 9100 (mapped from internal 9000)
- **Idle timeout**: 300s — model unloads after 5 min, reloads in ~10-30s

## Infrastructure

| Resource | Details |
|----------|---------|
| Home PC | 192.168.1.100, SSH `home-pc`, Ryzen 7 5800U, 30GB RAM |
| VPS | pusk365.ru, SSH `vps1` (root) |
| WireGuard | VPS 10.0.0.1 ↔ Home PC 10.0.0.2 |
| Portainer | portainer-h.pusk365.ru, stack "whisper" (ID 4), endpoint 3 |
| Domain | whisper.pusk365.ru (ForwardAuth via Keycloak realm `traefik`) |
| Proxy | VPS home-proxy nginx → 10.0.0.2:9100 |

## Directory Structure

```
Whisper-agent/
├── CLAUDE.md              # This file
├── docker/
│   ├── docker-compose.yml # Compose for Portainer deploy
│   └── stack.env.example  # Environment variables template
├── tg-bot/                # Telegram bot service
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts       # Entry point
│       ├── config.ts      # Env vars
│       ├── bot.ts         # Bot setup
│       ├── handlers/
│       │   └── voice.ts   # Voice message handler
│       ├── services/
│       │   ├── whisper.ts      # Whisper ASR client
│       │   └── text-cleaner.ts # OpenRouter LLM cleanup
│       └── middleware/
│           └── auth.ts    # User whitelist
├── docs/
│   ├── deployment.md      # How to deploy/redeploy
│   ├── api-reference.md   # Full API documentation
│   └── troubleshooting.md # Common issues and fixes
└── .claude/
    ├── agents/
    │   └── agent-factory.md
    ├── commands/
    │   └── transcribe.md  # /transcribe skill
    └── agent-memory/
        └── agent-factory/
```

## Quick Start

### Telegram bot
Send a voice message to the bot — it transcribes and returns clean text (filler words removed via LLM).

### Transcribe a file (via skill)
```
/transcribe /path/to/audio.mp3
/transcribe /path/to/meeting.wav --diarize
/transcribe /path/to/podcast.mp4 --language en --srt
```

### Direct API call (from VPS)
```bash
ssh vps1 "curl -s -X POST \
  -F 'audio_file=@/tmp/file.wav' \
  'http://10.0.0.2:9100/asr?task=transcribe&language=ru&output=txt'"
```

### From Docker containers on Home PC
```bash
curl -s -X POST -F 'audio_file=@/tmp/file.wav' \
  'http://whisper:9000/asr?task=transcribe&language=ru&output=txt'
```

## Conventions

- Язык документации: русский
- Язык кода и комментариев: английский
- Конфиги: YAML
- Скрипты: bash с `set -euo pipefail`

## Agents

### agent-factory
Meta-agent for creating, auditing, and managing sub-agents and skills.
**Location:** `.claude/agents/agent-factory.md`

## Skills

### /transcribe
Transcribe audio/video files via Whisper ASR on Home PC. Supports diarization.
**Location:** `.claude/commands/transcribe.md`

## Development Roadmap

- [ ] Добавить поддержку batch-обработки (несколько файлов)
- [ ] Интеграция с meeting-parser (извлечение поручений из транскриптов)
- [ ] Веб-интерфейс для загрузки файлов
- [ ] Автоматический выбор модели по длине файла
- [ ] Мониторинг через Beszel (RAM/CPU при транскрибации)
- [ ] Поддержка fine-tuned русских моделей (antony66/whisper-large-v3-russian)
