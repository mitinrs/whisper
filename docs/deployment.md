# Deployment Guide

## Требования

- Home PC с Docker и Portainer CE
- WireGuard туннель VPS ↔ Home PC (10.0.0.0/24)
- VPS с home-proxy (nginx + Traefik)
- HuggingFace токен (для диаризации)

## Развёртывание через Portainer API

### 1. Подготовка

```bash
# Проверить что порт 9100 свободен
ssh home-pc "ss -tlnp | grep 9100"

# Проверить что сеть traefik_public существует
ssh home-pc "docker network ls | grep traefik_public"
```

### 2. Deploy через Portainer API

```bash
# Получить API ключ
source .env  # PORTAINER_HOME_API_KEY

# Создать payload
python3 -c "
import json, sys
with open('docker/docker-compose.yml') as f:
    content = f.read()
payload = {
    'name': 'whisper',
    'stackFileContent': content,
    'env': [
        {'name': 'HF_TOKEN', 'value': 'hf_YOUR_TOKEN'}
    ]
}
json.dump(payload, sys.stdout)
" > /tmp/whisper-payload.json

# Deploy
curl -sk -X POST \
  -H "X-API-Key: $PORTAINER_HOME_API_KEY" \
  -H 'Content-Type: application/json' \
  -d @/tmp/whisper-payload.json \
  'https://portainer-h.pusk365.ru/api/stacks/create/standalone/string?endpointId=3'
```

### 3. Проверка

```bash
# Контейнер запущен?
ssh home-pc "docker ps --filter name=whisper"

# Логи — ждём "Uvicorn running"
ssh home-pc "docker logs whisper --tail 20 2>&1"

# API доступен?
ssh home-pc "curl -s -o /dev/null -w '%{http_code}' http://localhost:9100/docs"
# Ожидаем: 200
```

### 4. Тест транскрибации

```bash
# С VPS через WireGuard
ssh vps1 "curl -s -X POST \
  -F 'audio_file=@/tmp/test.wav' \
  'http://10.0.0.2:9100/asr?task=transcribe&language=ru&output=txt' \
  --max-time 300"
```

## Обновление

### Обновление образа

```bash
# Через Portainer UI: Stack → whisper → Editor → Pull and Redeploy
# Или через API:
source .env
STACK_ID=4  # ID стека whisper

# Получить текущий compose
curl -sk -H "X-API-Key: $PORTAINER_HOME_API_KEY" \
  "https://portainer-h.pusk365.ru/api/stacks/$STACK_ID/file" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["StackFileContent"])'

# Обновить стек (pullImage=true для обновления образа)
curl -sk -X PUT \
  -H "X-API-Key: $PORTAINER_HOME_API_KEY" \
  -H 'Content-Type: application/json' \
  -d @/tmp/whisper-payload.json \
  "https://portainer-h.pusk365.ru/api/stacks/$STACK_ID?endpointId=3" \
  --data-urlencode "pullImage=true"
```

### Смена модели

Изменить `ASR_MODEL` в env vars стека через Portainer UI или API:
- `tiny` — ~500 MB RAM, быстро, низкое качество
- `base` — ~1 GB RAM, приемлемое качество
- `small` — ~2 GB RAM (по умолчанию), хороший баланс
- `medium` — ~5 GB RAM, высокое качество, медленнее
- `large-v3` — ~10 GB RAM, лучшее качество, очень медленно на CPU

После смены — перезапустить стек.

## VPS Proxy (home-proxy)

Whisper доступен через `https://whisper.pusk365.ru` с ForwardAuth (Keycloak realm `traefik`).

**nginx server block** в `/opt/home-proxy/nginx.conf`:
```nginx
# --- Whisper ASR (speech-to-text transcription) ---
server {
    listen 80;
    server_name whisper.pusk365.ru;
    client_max_body_size 500M;
    proxy_request_buffering off;
    location / {
        proxy_pass http://10.0.0.2:9100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
        proxy_read_timeout 1800s;
        proxy_send_timeout 600s;
        proxy_connect_timeout 60s;
    }
}
```

**Traefik labels** в `/opt/home-proxy/docker-compose.yml`:
```yaml
# --- Whisper ASR (with forwardauth) ---
- "traefik.http.routers.whisper.rule=Host(`whisper.pusk365.ru`)"
- "traefik.http.routers.whisper.entrypoints=websecure"
- "traefik.http.routers.whisper.tls.certresolver=letsencrypt"
- "traefik.http.routers.whisper.middlewares=crowdsec-bouncer@docker,forwardauth@docker"
- "traefik.http.routers.whisper-http.rule=Host(`whisper.pusk365.ru`)"
- "traefik.http.routers.whisper-http.entrypoints=web"
- "traefik.http.routers.whisper-http.middlewares=whisper-redirect"
- "traefik.http.middlewares.whisper-redirect.redirectscheme.scheme=https"
```
