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
│           ├── orchestrator/     ⬜ FASE 6
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

### ⬜ FASE 5 - Microservicios Python - SIGUIENTE
- 5a: OCR Service (Puerto 8001)
- 5b: NLP Service (Puerto 8002)
- 5c: Clustering Service (Puerto 8003)

---

### ⬜ FASE 6 - Orquestador y Lógica de Negocio (NestJS)

### ⬜ FASE 7 - Frontend Chat (Next.js)

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
