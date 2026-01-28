# PROMPT PARA CLAUDE CODE - COPIAR Y PEGAR

---

## PROMPT 1: Actualizar configuración (ejecutar primero)

```
Antes de continuar con Fase 3, necesito hacer algunas correcciones:

1. CAMBIO IMPORTANTE: Usaremos OpenAI API (GPT-4 Vision) en lugar de Claude/Anthropic API.
   - Actualiza .env.example agregando:
     OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
     OCR_SERVICE_URL=http://localhost:8001
     NLP_SERVICE_URL=http://localhost:8002
     CLUSTERING_SERVICE_URL=http://localhost:8003

2. Crea la estructura de carpetas para los microservicios Python:
   mkdir -p services/ocr-service/app/{api,services,utils}
   mkdir -p services/nlp-service/app/{api,services,models}
   mkdir -p services/clustering-service/app/{api,algorithms}
   touch services/ocr-service/.gitkeep
   touch services/nlp-service/.gitkeep
   touch services/clustering-service/.gitkeep

3. Confirma los cambios y muéstrame la estructura actualizada.
```

---

## PROMPT 2: Fase 3 - Módulo de Chat (ejecutar después)

```
Continúa con FASE 3 - Módulo de Chat en NestJS.

CONTEXTO:
- Usaremos OpenAI GPT-4 Vision (NO Claude API) - se integrará en Fase 4
- Por ahora el chat solo guarda mensajes, sin procesamiento AI
- La AI se agregará después

ARCHIVOS A CREAR (en orden):

1. apps/backend/src/modules/chat/schemas/chat-session.schema.ts
Schema de Mongoose para sesiones de chat:
- _id: ObjectId (auto)
- playerId?: string (opcional, viene del URL ?playerId=xxx)
- status: 'active' | 'closed'
- context: 'ticket_verification' | 'kyc' | 'general'
- metadata: { userAgent?: string, ipAddress?: string }
- createdAt, updatedAt (timestamps)

2. apps/backend/src/modules/chat/schemas/chat-message.schema.ts
Schema para mensajes:
- _id: ObjectId
- sessionId: ObjectId (ref: ChatSession)
- role: 'user' | 'assistant' | 'system'
- content: {
    type: 'text' | 'image' | 'mixed',
    text?: string,
    images?: Array<{ url?: string, base64?: string, mimeType?: string, filename?: string }>
  }
- metadata?: { processingTimeMs?: number, model?: string, tokensUsed?: number }
- createdAt (timestamp)

3. apps/backend/src/modules/chat/dto/create-session.dto.ts
4. apps/backend/src/modules/chat/dto/send-message.dto.ts  
5. apps/backend/src/modules/chat/dto/message-response.dto.ts

6. apps/backend/src/modules/chat/chat.service.ts
Métodos:
- createSession(playerId?: string, context?: string): Promise<ChatSession>
- getSession(sessionId: string): Promise<ChatSession>
- addMessage(sessionId: string, dto: SendMessageDto): Promise<ChatMessage>
- getMessages(sessionId: string, limit?: number): Promise<ChatMessage[]>
- closeSession(sessionId: string): Promise<ChatSession>

7. apps/backend/src/modules/chat/chat.controller.ts
Endpoints:
- POST /api/chat/sessions - crear sesión
- GET /api/chat/sessions/:id - obtener sesión
- POST /api/chat/sessions/:id/messages - enviar mensaje
- GET /api/chat/sessions/:id/messages - obtener historial
- DELETE /api/chat/sessions/:id - cerrar sesión

8. apps/backend/src/modules/chat/chat.gateway.ts
WebSocket Gateway con Socket.io:
- handleConnection, handleDisconnect
- @SubscribeMessage('chat:join') - unirse a sala de sesión
- @SubscribeMessage('chat:message') - enviar mensaje
- @SubscribeMessage('chat:typing') - indicador de escritura
- Emitir eventos: 'chat:message', 'chat:typing', 'chat:error'

9. apps/backend/src/modules/chat/chat.module.ts
Importar MongooseModule con los schemas, exportar ChatService

Empieza creando el archivo 1 (chat-session.schema.ts).
Cuando termines cada archivo, continúa con el siguiente.
```

---

## PROMPT 3: Verificar Fase 3 completada

```
Muéstrame un resumen de todos los archivos creados en la Fase 3.

Luego, dame los comandos para:
1. Instalar las dependencias necesarias (@nestjs/websockets, @nestjs/platform-socket.io, socket.io)
2. Probar que el backend compila sin errores
3. Probar los endpoints con curl

Después confirmaré si podemos pasar a la Fase 4 (integración OpenAI).
```

---

## NOTAS

- Ejecuta PROMPT 1 primero para las correcciones
- Luego ejecuta PROMPT 2 para crear el módulo de chat
- Finalmente PROMPT 3 para verificar

Si Claude Code pregunta algo, responde según el contexto del proyecto:
- Modelo de AI: OpenAI GPT-4o (gpt-4o)
- Base de datos: MongoDB con Mongoose
- Cache: Redis
- WebSocket: Socket.io
