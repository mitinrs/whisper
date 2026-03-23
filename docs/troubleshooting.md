# Troubleshooting

## Connection refused (10.0.0.2:9100)

**Причина**: контейнер не запущен или WireGuard туннель не работает.

```bash
# Проверить WireGuard
ssh vps1 "wg show"
# latest handshake должен быть < 2 мин назад

# Проверить контейнер
ssh home-pc "docker ps | grep whisper"

# Перезапустить контейнер
ssh home-pc "docker restart whisper"
```

## Медленный первый запрос

**Причина**: модель выгружена из RAM (idle timeout 5 мин). Это нормально.

- `small` модель: загрузка ~10-30 сек
- `medium`: ~15-20 сек
- `large-v3`: ~30-60 сек

Последующие запросы быстрые, пока модель в RAM.

## Timeout на длинных файлах

**Причина**: CPU-транскрибация медленная (~1x realtime для small).

```bash
# Использовать VAD фильтр (пропускает тишину, 2-3x быстрее)
curl ... 'http://10.0.0.2:9100/asr?...&vad_filter=true'

# Использовать модель tiny для черновика
# Изменить ASR_MODEL=tiny в Portainer и перезапустить стек
```

Таймауты настроены:
- nginx: `proxy_read_timeout 1800s` (30 мин)
- curl: `--max-time 3600` (60 мин)

## Пустой результат

- Аудио без речи (музыка, тоны) → пустой текст
- Неверный язык → попробовать `language=auto`
- Повреждённый файл → проверить `ffprobe файл.mp3`

## Диаризация не работает

**Проверить:**
1. `ASR_ENGINE=whisperx` (не `faster_whisper`):
   ```bash
   ssh home-pc "docker inspect whisper --format '{{range .Config.Env}}{{println .}}{{end}}' | grep ASR_ENGINE"
   ```
2. `HF_TOKEN` установлен:
   ```bash
   ssh home-pc "docker inspect whisper --format '{{range .Config.Env}}{{println .}}{{end}}' | grep HF_TOKEN"
   ```
3. Лицензия pyannote принята на huggingface.co

## Контейнер перезапускается (crash loop)

```bash
# Посмотреть логи
ssh home-pc "docker logs whisper --tail 50 2>&1"

# Частые причины:
# - Нехватка RAM (docker stats whisper)
# - Неверный HF_TOKEN
# - Сеть traefik_public не существует
```

## Высокое потребление RAM

```bash
ssh home-pc "docker stats whisper --no-stream"
```

Ожидаемое потребление (модель загружена):
- `small`: ~2-3 GB
- `medium`: ~5-6 GB
- `large-v3`: ~10-12 GB

После idle timeout (5 мин): ~100-200 MB (только процесс без модели).

## Portainer: стек не обновляется

```bash
# Проверить ID стека
source .env && curl -sk -H "X-API-Key: $PORTAINER_HOME_API_KEY" \
  'https://portainer-h.pusk365.ru/api/stacks' \
  | python3 -c 'import json,sys; [print(s["Id"], s["Name"]) for s in json.load(sys.stdin)]'

# Обновить через PUT вместо POST
```
