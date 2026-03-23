# API Reference

## Base URLs

| Access | URL |
|--------|-----|
| Docker-сеть Home PC | `http://whisper:9000` |
| VPS через WireGuard | `http://10.0.0.2:9100` |
| Интернет (ForwardAuth) | `https://whisper.pusk365.ru` |

## Endpoints

### POST /asr — Транскрибация аудио

Отправляет аудиофайл и получает транскрипт.

**Request:**
- Content-Type: `multipart/form-data`
- Form field: `audio_file` — аудио или видеофайл

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `task` | string | `transcribe` | `transcribe` — транскрибация, `translate` — перевод на английский |
| `language` | string | `ru` | Код языка ISO 639-1 (`ru`, `en`, `de`, `fr`, `auto`) |
| `output` | string | `txt` | Формат вывода: `txt`, `json`, `srt`, `vtt`, `tsv` |
| `encode` | bool | `true` | Кодировать ли входной аудио (всегда true) |
| `diarize` | bool | `false` | Включить разделение по спикерам |
| `vad_filter` | bool | `false` | VAD фильтр — пропускать тишину (быстрее) |
| `word_timestamps` | bool | `false` | Пословные таймстемпы (только json) |
| `min_speakers` | int | auto | Мин. число спикеров (с diarize=true) |
| `max_speakers` | int | auto | Макс. число спикеров (с diarize=true) |

**Примеры:**

```bash
# Простая транскрибация
curl -s -X POST -F 'audio_file=@meeting.mp3' \
  'http://10.0.0.2:9100/asr?task=transcribe&language=ru&output=txt'

# JSON с таймстемпами
curl -s -X POST -F 'audio_file=@meeting.mp3' \
  'http://10.0.0.2:9100/asr?language=ru&output=json&word_timestamps=true'

# Диаризация (разделение по спикерам)
curl -s -X POST -F 'audio_file=@meeting.mp3' \
  'http://10.0.0.2:9100/asr?language=ru&output=json&diarize=true&min_speakers=2&max_speakers=5'

# Субтитры SRT
curl -s -X POST -F 'audio_file=@video.mp4' \
  'http://10.0.0.2:9100/asr?language=ru&output=srt'

# Перевод на английский
curl -s -X POST -F 'audio_file=@speech.wav' \
  'http://10.0.0.2:9100/asr?task=translate&output=txt'

# С VAD фильтром (быстрее для файлов с тишиной)
curl -s -X POST -F 'audio_file=@podcast.mp3' \
  'http://10.0.0.2:9100/asr?language=ru&output=txt&vad_filter=true'
```

### GET /docs — Swagger UI

Интерактивная документация API. Доступна в браузере.

## Форматы вывода

### txt
Чистый текст без метаданных:
```
Привет, это тестовая запись для проверки транскрибации.
```

### json
Структурированный формат с сегментами и таймстемпами:
```json
{
  "segments": [
    {
      "start": 0.031,
      "end": 5.35,
      "text": " Привет, это тестовая запись.",
      "words": [
        {"word": "Привет,", "start": 0.031, "end": 0.698, "score": 0.509},
        {"word": "это", "start": 0.719, "end": 0.921, "score": 1.0}
      ]
    }
  ],
  "word_segments": [...],
  "language": "ru"
}
```

### srt
Формат субтитров SubRip:
```
1
00:00:00,031 --> 00:00:05,350
Привет, это тестовая запись для проверки транскрибации.
```

### vtt
Формат WebVTT:
```
WEBVTT

00:00:00.031 --> 00:00:05.350
Привет, это тестовая запись для проверки транскрибации.
```

### tsv
Tab-separated values:
```
start	end	text
0.031	5.350	Привет, это тестовая запись для проверки транскрибации.
```

## Поддерживаемые форматы файлов

**Аудио:** WAV, MP3, FLAC, OGG, M4A, AAC, WMA
**Видео:** WebM, MP4, MKV, AVI, MOV, WMV, FLV

Контейнер автоматически извлекает аудиодорожку из видеофайлов через ffmpeg.

## Модели

| Модель | RAM | Скорость (CPU) | WER русский | Рекомендация |
|--------|-----|----------------|-------------|--------------|
| `tiny` | ~500 MB | ~0.3x realtime | ~25% | Быстрая черновая |
| `base` | ~1 GB | ~0.5x realtime | ~18% | Приемлемо |
| `small` | ~2 GB | ~1x realtime | ~12% | **По умолчанию** |
| `medium` | ~5 GB | ~2-3x realtime | ~9% | Высокое качество |
| `large-v3` | ~10 GB | ~5-8x realtime | ~6% | Лучшее качество |

Скорость указана относительно длины аудио. `1x realtime` = 1 мин обработки на 1 мин аудио.

## Idle Timeout

- Модель выгружается из RAM через **300 секунд** (5 мин) простоя
- Первый запрос после idle — дополнительные **10-30 сек** на загрузку модели
- При работе модель держится в RAM до следующего idle
