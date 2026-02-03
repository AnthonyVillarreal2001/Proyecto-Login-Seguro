# 🔐 Configuración de Secrets para CI/CD

## Secrets Requeridos en GitHub:

### 1. TELEGRAM_BOT_TOKEN
- **Descripción:** Token de tu bot de Telegram
- **Cómo obtenerlo:**
  1. Habla con @BotFather en Telegram
  2. Envía `/newbot`
  3. Sigue las instrucciones
  4. Copia el token que te dé

### 2. TELEGRAM_CHAT_ID
- **Descripción:** ID de tu chat personal o grupo
- **Cómo obtenerlo:**
  1. Envía un mensaje a tu bot
  2. Visita: `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
  3. Busca `"chat":{"id":XXXXX}`

## Pasos para Configurar:

1. Ve a tu repositorio en GitHub
2. Settings → Secrets and variables → Actions
3. Haz clic en "New repository secret"
4. Añade ambos secrets

## Verificación:
```bash
# Test manual de Telegram
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=✅ CI/CD Configurado Correctamente"