# CLAUDE.md - Configuración del Proyecto Sorti365 Multimodal Chat

## Contexto del Proyecto

Sistema Conversacional Multimodal para la casa de apuestas **Sorti365**. Procesa texto e imágenes para atención al cliente automatizada.

### Casos de Uso Principales

1. **Verificación de Tickets de Apuestas**
   - Usuario envía captura de pantalla de un ticket
   - Sistema extrae el ticketId de la imagen
   - Sistema consulta estado del ticket (eventos, mercados, resultados)
   - Sistema responde con información contextual

2. **Verificación de Identidad (KYC)**
   - Usuario logueado (playerId en URL) inicia proceso de verificación
   - Usuario envía: foto cédula frontal, foto cédula posterior, selfie sosteniendo cédula
   - Sistema extrae número de cédula y nombres
   - Sistema valida que la cédula no esté registrada en otro jugador
   - Sistema valida que la persona de la selfie coincida con la del documento

---

## ⚠️ ARQUITECTURA HÍBRIDA (NestJS + Python)

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js 15)                       │
│                    Puerto: 3000                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   API GATEWAY (NestJS)                           │
│                    Puerto: 3001                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Responsabilidades:                                       │   │
│  │ - REST API + WebSocket para chat                        │   │
│  │ - Autenticación/Sesiones (Redis)                        │   │
│  │ - Historial de mensajes (MongoDB)                       │   │
│  │ - Orquestación de microservicios Python                 │   │
│  │ - Integración con OpenAI GPT-4 Vision                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  OCR Service     │ │  NLP Service     │ │ Clustering Svc   │
│  (Python/FastAPI)│ │  (Python/FastAPI)│ │ (Python/FastAPI) │
│  Puerto: 8001    │ │  Puerto: 8002    │ │  Puerto: 8003    │
│                  │ │                  │ │                  │
│  - Tesseract     │ │  - spaCy         │ │  - DBSCAN        │
│  - OpenCV        │ │  - BERT español  │ │  - K-means       │
│  - Preprocesado  │ │  - Sentence-BERT │ │  - HDBSCAN       │
│    adaptativo    │ │  - Extracción    │ │  - Embeddings    │
│                  │ │    de entidades  │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## Stack Tecnológico

### Frontend
- **Next.js 15** con App Router
- **TypeScript**
- **Tailwind CSS**
- **Socket.io-client** para WebSocket

### Backend Gateway (NestJS)
- **NestJS** con TypeScript
- **MongoDB** con Mongoose (historial de chat)
- **Redis** para cache y sesiones
- **OpenAI SDK** para GPT-4 Vision (análisis multimodal)
- **Socket.io** para WebSocket

### Microservicios Python
- **FastAPI** como framework web
- **Tesseract + OpenCV** para OCR
- **spaCy + BERT** para NLP
- **scikit-learn** para Clustering
- **Docker** para containerización

### Infraestructura
- **Docker Compose** para orquestar todos los servicios
- **MongoDB** (puerto 27017)
- **Redis** (puerto 6379)

---

## Estructura del Proyecto

```
sorti365-chat/
├── apps/
│   ├── frontend/                 # Next.js 15
│   │   └── src/
│   │       ├── app/
│   │       ├── components/
│   │       └── hooks/
│   │
│   └── backend/                  # NestJS (API Gateway)
│       └── src/
│           ├── config/           ✅ Completado
│           ├── database/         ✅ Completado
│           ├── cache/            ✅ Completado
│           ├── health/           ✅ Completado
│           ├── chat/             ✅ Completado
│           ├── multimodal/       ✅ Completado (OpenAI GPT-4 Vision)
│           ├── orchestrator/     ✅ Completado
│           └── common/           ✅ Completado
│
├── services/                     # Microservicios Python
│   ├── ocr-service/              # FASE 5a
│   │   └── app/
│   │       ├── api/
│   │       ├── services/
│   │       └── utils/
│   │
│   ├── nlp-service/              # FASE 5b
│   │   └── app/
│   │       ├── api/
│   │       ├── services/
│   │       └── models/
│   │
│   └── clustering-service/       # FASE 5c
│       └── app/
│           ├── api/
│           └── algorithms/
│
├── packages/
│   └── shared/                   # Tipos compartidos
│
├── docker/
│   └── docker-compose.dev.yml
│
└── package.json
```

---

## Fases de Desarrollo

### ✅ FASE 1 - Configuración del Entorno (COMPLETADA)

### ✅ FASE 2 - Backend Base NestJS (COMPLETADA)

---

### ✅ FASE 3 - Módulo de Chat (NestJS) (COMPLETADA)
**Objetivo**: API REST + WebSocket para chat

**Tareas**:
1. ✅ Crear schemas MongoDB (ChatSession, ChatMessage)
2. ✅ Crear DTOs (CreateSession, SendMessage, etc.)
3. ✅ Implementar ChatService
4. ✅ Implementar ChatController (REST)
5. ✅ Implementar ChatGateway (WebSocket)
6. ✅ Crear ChatModule

---

### ✅ FASE 4 - Módulo Multimodal con OpenAI (NestJS) (COMPLETADA)
**Objetivo**: Integrar GPT-4 Vision para análisis de imágenes

**Archivos creados**:
- `openai.config.ts` - Configuración OpenAI
- `dto/analyze-image.dto.ts` - DTOs de entrada
- `dto/vision-response.dto.ts` - DTOs de respuesta
- `interfaces/vision.types.ts` - Tipos y prompts
- `openai.service.ts` - Cliente OpenAI
- `multimodal.service.ts` - Lógica de análisis
- `multimodal.controller.ts` - Endpoints REST
- `multimodal.module.ts` - Módulo NestJS

**Endpoints**:
- `GET /multimodal/status` - Estado del servicio
- `POST /multimodal/analyze` - Análisis genérico
- `POST /multimodal/analyze/ticket` - Verificar ticket
- `POST /multimodal/analyze/document` - Verificar documento KYC
- `POST /multimodal/analyze/selfie` - Verificar selfie KYC

---

### ✅ FASE 5 - Microservicios Python (COMPLETADA)

**5a: OCR Service (Puerto 8001)** - Tesseract + OpenCV
- `services/ocr-service/` - Extracción de texto de imágenes
- Endpoints: `/api/ocr/extract`, `/api/ocr/extract/ticket`, `/api/ocr/extract/document`
- Preprocesamiento adaptativo de imágenes

**5b: NLP Service (Puerto 8002)** - spaCy + Sentence-BERT
- `services/nlp-service/` - Procesamiento de lenguaje natural
- Endpoints: `/api/nlp/analyze`, `/api/nlp/entities`, `/api/nlp/intent`, `/api/nlp/embedding`
- Clasificación de intents y extracción de entidades

**5c: Clustering Service (Puerto 8003)** - scikit-learn + HDBSCAN
- `services/clustering-service/` - Agrupación de textos similares
- Endpoints: `/api/clustering/cluster`, `/api/clustering/similar`, `/api/clustering/embeddings`
- Algoritmos: K-means, DBSCAN, HDBSCAN, Agglomerative

**Docker Compose actualizado** con todos los servicios.

---

### ✅ FASE 6 - Orquestador y Lógica de Negocio (NestJS) (COMPLETADA)

**Archivos creados en** `apps/backend/src/orchestrator/`:

- `orchestrator.config.ts` - Configuración de URLs de microservicios
- `services/microservices-client.service.ts` - Cliente HTTP para OCR, NLP, Clustering
- `services/ticket-verification.service.ts` - Flujo de verificación de tickets
- `services/kyc-verification.service.ts` - Flujo de verificación KYC
- `orchestrator.service.ts` - Coordinador principal de flujos
- `orchestrator.controller.ts` - Endpoints REST
- `orchestrator.module.ts` - Módulo NestJS
- `dto/process-message.dto.ts` - DTOs
- `interfaces/orchestrator.types.ts` - Tipos e interfaces

**Endpoints**:
- `GET /orchestrator/health` - Estado de todos los servicios
- `POST /orchestrator/process` - Procesar mensaje (auto-detecta flujo)
- `POST /orchestrator/verify/ticket` - Verificar ticket
- `POST /orchestrator/verify/document` - Verificar documento KYC
- `POST /orchestrator/verify/selfie` - Verificar selfie KYC
- `POST /orchestrator/verify/kyc` - Verificación KYC completa

**WebSocket integrado**: ChatGateway actualizado para procesar mensajes en tiempo real con actualizaciones de estado.

---

### ✅ FASE 7 - Frontend Chat (Next.js) (COMPLETADA)

**Archivos creados en** `apps/frontend/`:

**Configuración:**
- `next.config.js` - Configuración de Next.js con variables de entorno
- `tailwind.config.js` - Configuración de Tailwind con colores Sorti365
- `postcss.config.js` - Configuración PostCSS
- `tsconfig.json` - Configuración TypeScript
- `.env.local.example` - Variables de entorno de ejemplo
- `Dockerfile` - Containerización del frontend

**Tipos:**
- `src/types/chat.types.ts` - Tipos para mensajes, sesiones, estados

**Hooks:**
- `src/hooks/useSocket.ts` - Hook para conexión WebSocket
- `src/hooks/useChat.ts` - Hook principal para chat (sesiones, mensajes, estado)

**Componentes:**
- `src/components/chat/ChatContainer.tsx` - Contenedor principal
- `src/components/chat/ChatHeader.tsx` - Cabecera con estado de conexión
- `src/components/chat/MessageList.tsx` - Lista de mensajes con scroll automático
- `src/components/chat/MessageBubble.tsx` - Burbujas de mensaje (user/assistant)
- `src/components/chat/MessageInput.tsx` - Input con soporte para texto e imágenes
- `src/components/chat/ImagePreview.tsx` - Preview de imágenes adjuntas
- `src/components/chat/TypingIndicator.tsx` - Indicador de escritura con estado de procesamiento
- `src/components/chat/ErrorBanner.tsx` - Banner de errores

**Páginas:**
- `src/app/layout.tsx` - Layout raíz con metadata
- `src/app/page.tsx` - Página principal del chat
- `src/app/globals.css` - Estilos globales y animaciones

**Funcionalidades:**
- WebSocket con reconexión automática
- Soporte para texto e imágenes (hasta 5)
- Indicador de estado de procesamiento en tiempo real
- Diseño responsive
- Colores personalizados Sorti365
- URL param `?playerId=xxx` para usuarios autenticados

---

### ⬜ FASE 8 - Integración y Testing

---

## Variables de Entorno

```env
# Backend NestJS
NODE_ENV=development
PORT=3001

# MongoDB
MONGODB_URI=mongodb://localhost:27017/sorti365-chat

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenAI API (GPT-4 Vision)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# Microservicios Python
OCR_SERVICE_URL=http://localhost:8001
NLP_SERVICE_URL=http://localhost:8002
CLUSTERING_SERVICE_URL=http://localhost:8003

# Sorti365 APIs
SORTI365_API_URL=http://api.sorti365.com
SORTI365_API_KEY=xxxxx
```

---

## Convenciones de Código

### TypeScript (NestJS/Next.js)
- Tipos explícitos, evitar `any`
- Interfaces para objetos, types para uniones
- Nombres en inglés

### Python (FastAPI)
- Type hints obligatorios
- Pydantic para validación
- async/await para endpoints

---

## Referencia Rápida de APIs

### Chat API (Backend)
```
POST   /api/chat/sessions              # Crear sesión
GET    /api/chat/sessions/:id          # Obtener sesión
POST   /api/chat/sessions/:id/messages # Enviar mensaje
GET    /api/chat/sessions/:id/messages # Obtener historial
DELETE /api/chat/sessions/:id          # Cerrar sesión
```

### WebSocket Events
```
# Cliente -> Servidor
chat:join      { sessionId }
chat:message   { sessionId, content, images[] }
chat:typing    { sessionId }

# Servidor -> Cliente
chat:message   { message }
chat:typing    { }
chat:error     { error }
```

---

## Instrucciones para Claude Code

1. **Seguir el orden de las fases**
2. **Un archivo a la vez**
3. **Probar antes de avanzar**
4. **Usar OpenAI en lugar de Anthropic** para el módulo multimodal
5. **Los microservicios Python van en `/services`**, no en `/apps`
