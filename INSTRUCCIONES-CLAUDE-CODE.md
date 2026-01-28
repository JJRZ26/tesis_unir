# Instrucciones para Claude Code - Correcciones y Continuación

## 📋 RESUMEN DE CAMBIOS

### 1. Cambio de API: Claude → OpenAI
- Usaremos **OpenAI GPT-4 Vision** en lugar de Claude API
- El usuario tiene API key de OpenAI disponible

### 2. Arquitectura Híbrida confirmada
- **NestJS** como API Gateway (ya en progreso)
- **Python/FastAPI** para microservicios de ML (OCR, NLP, Clustering)

### 3. Nueva estructura de carpetas
- Agregar `/services` para microservicios Python

---

## 🔧 CORRECCIONES INMEDIATAS

### Corrección 1: Actualizar .env.example

Agregar las siguientes variables al archivo `.env.example`:

```env
# OpenAI API (en lugar de Anthropic)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# Microservicios Python
OCR_SERVICE_URL=http://localhost:8001
NLP_SERVICE_URL=http://localhost:8002
CLUSTERING_SERVICE_URL=http://localhost:8003
```

### Corrección 2: Actualizar docker-compose.dev.yml

Agregar los servicios Python al docker-compose (se hará en Fase 5):

```yaml
# Se agregará después:
# - ocr-service (puerto 8001)
# - nlp-service (puerto 8002)  
# - clustering-service (puerto 8003)
```

### Corrección 3: Crear estructura para servicios Python

```bash
mkdir -p services/ocr-service/app/{api,services,utils}
mkdir -p services/nlp-service/app/{api,services,models}
mkdir -p services/clustering-service/app/{api,algorithms}
```

---

## ✅ CONTINUAR CON FASE 3

### Prompt para Claude Code:

```
Continúa con la FASE 3 - Módulo de Chat.

IMPORTANTE: 
- Usaremos OpenAI API (GPT-4 Vision), NO Claude API
- El módulo multimodal se integrará en FASE 4

Para FASE 3, crea los siguientes archivos en orden:

1. apps/backend/src/modules/chat/schemas/chat-session.schema.ts
   - playerId: string (opcional, del URL param)
   - status: enum ['active', 'closed']
   - context: enum ['ticket_verification', 'kyc', 'general']
   - metadata: objeto con userAgent, ip
   - timestamps

2. apps/backend/src/modules/chat/schemas/chat-message.schema.ts
   - sessionId: ObjectId (ref a ChatSession)
   - role: enum ['user', 'assistant', 'system']
   - content.type: enum ['text', 'image', 'mixed']
   - content.text: string opcional
   - content.images: array de { url, base64, mimeType }
   - metadata: { processingTime, tokensUsed, model }
   - timestamps

3. apps/backend/src/modules/chat/dto/create-session.dto.ts
4. apps/backend/src/modules/chat/dto/send-message.dto.ts
5. apps/backend/src/modules/chat/dto/message-response.dto.ts

6. apps/backend/src/modules/chat/chat.service.ts
   - createSession()
   - getSession()
   - sendMessage() - por ahora solo guarda, sin AI
   - getMessages()
   - closeSession()

7. apps/backend/src/modules/chat/chat.controller.ts
   - POST /chat/sessions
   - GET /chat/sessions/:id
   - POST /chat/sessions/:id/messages
   - GET /chat/sessions/:id/messages
   - DELETE /chat/sessions/:id

8. apps/backend/src/modules/chat/chat.gateway.ts (WebSocket)
   - @SubscribeMessage('chat:join')
   - @SubscribeMessage('chat:message')
   - @SubscribeMessage('chat:typing')

9. apps/backend/src/modules/chat/chat.module.ts

Empieza con el archivo 1 (chat-session.schema.ts).
```

---

## 📁 ESTRUCTURA ESPERADA DESPUÉS DE FASE 3

```
apps/backend/src/modules/chat/
├── schemas/
│   ├── chat-session.schema.ts
│   └── chat-message.schema.ts
├── dto/
│   ├── create-session.dto.ts
│   ├── send-message.dto.ts
│   └── message-response.dto.ts
├── chat.service.ts
├── chat.controller.ts
├── chat.gateway.ts
└── chat.module.ts
```

---

## 🔮 VISIÓN GENERAL DE FASES RESTANTES

| Fase | Descripción | Tecnología |
|------|-------------|------------|
| 3 | Módulo Chat | NestJS |
| 4 | Multimodal (GPT-4 Vision) | NestJS + OpenAI |
| 5a | OCR Service | Python/FastAPI |
| 5b | NLP Service | Python/FastAPI |
| 5c | Clustering Service | Python/FastAPI |
| 6 | Orquestador | NestJS |
| 7 | Frontend Chat | Next.js |
| 8 | Testing | Jest + Pytest |

---

## 💡 NOTAS IMPORTANTES

1. **OpenAI vs Claude**: Usamos `openai` npm package, modelo `gpt-4o` para visión
2. **Python services**: Se crean en `/services`, NO en `/apps`
3. **Docker**: Los servicios Python se agregarán al docker-compose en Fase 5
4. **Por ahora**: Fase 3 NO incluye AI, solo la estructura del chat
5. **AI se agrega en Fase 4**: Cuando integremos OpenAI GPT-4 Vision
