# CLAUDE.md - Configuración del Proyecto Sorti365 Multimodal Chat (ACTUALIZADO)

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

## Estructura del Proyecto ACTUALIZADA

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
│           ├── modules/
│           │   ├── config/       ✅ Completado
│           │   ├── database/     ✅ Completado
│           │   ├── cache/        ✅ Completado
│           │   ├── health/       ✅ Completado
│           │   ├── chat/         ⬜ FASE 3
│           │   ├── multimodal/   ⬜ FASE 4 (OpenAI GPT-4 Vision)
│           │   └── orchestrator/ ⬜ FASE 6 (llama a Python services)
│           └── common/           ✅ Completado
│
├── services/                     # ⬜ NUEVO - Microservicios Python
│   ├── ocr-service/              # FASE 5a
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── api/
│   │   │   ├── services/
│   │   │   └── utils/
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   ├── nlp-service/              # FASE 5b
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── api/
│   │   │   ├── services/
│   │   │   └── models/
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   └── clustering-service/       # FASE 5c
│       ├── app/
│       │   ├── main.py
│       │   ├── api/
│       │   └── algorithms/
│       ├── requirements.txt
│       └── Dockerfile
│
├── packages/
│   └── shared/                   # Tipos compartidos
│
├── docker/
│   ├── docker-compose.dev.yml    ✅ Actualizar para Python services
│   └── docker-compose.prod.yml
│
└── package.json
```

---

## Fases de Desarrollo ACTUALIZADAS

### ✅ FASE 1 - Configuración del Entorno (COMPLETADA)
### ✅ FASE 2 - Backend Base NestJS (COMPLETADA)

---

### ⬜ FASE 3 - Módulo de Chat (NestJS)
**Objetivo**: API REST + WebSocket para chat

**Tareas**:
1. Crear schemas MongoDB (ChatSession, ChatMessage)
2. Crear DTOs (CreateSession, SendMessage, etc.)
3. Implementar ChatService
4. Implementar ChatController (REST)
5. Implementar ChatGateway (WebSocket)
6. Crear ChatModule

---

### ⬜ FASE 4 - Módulo Multimodal con OpenAI (NestJS)
**Objetivo**: Integrar GPT-4 Vision para análisis de imágenes

**Tareas**:
1. Instalar `openai` SDK
2. Crear OpenAIService (cliente configurado)
3. Crear prompts para análisis de tickets
4. Crear prompts para análisis KYC
5. Implementar MultimodalService
6. Crear MultimodalModule

**Configuración OpenAI**:
```typescript
// Usar GPT-4 Vision para análisis de imágenes
const response = await openai.chat.completions.create({
  model: "gpt-4o", // o "gpt-4-vision-preview"
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Analiza esta imagen..." },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
      ]
    }
  ]
});
```

---

### ⬜ FASE 5 - Microservicios Python
**Objetivo**: Crear servicios especializados de ML

#### FASE 5a - OCR Service (Python/FastAPI)
- Tesseract OCR con preprocesamiento OpenCV
- Endpoints: POST /extract-text, POST /extract-ticket-id
- Puerto: 8001

#### FASE 5b - NLP Service (Python/FastAPI)
- spaCy para análisis lingüístico
- BERT para embeddings semánticos
- Endpoints: POST /analyze, POST /extract-entities, POST /embeddings
- Puerto: 8002

#### FASE 5c - Clustering Service (Python/FastAPI)
- DBSCAN, K-means, HDBSCAN
- Endpoints: POST /cluster, POST /find-similar
- Puerto: 8003

---

### ⬜ FASE 6 - Orquestador y Lógica de Negocio (NestJS)
**Objetivo**: Coordinar todos los servicios

**Tareas**:
1. Crear OrchestratorService (llama a Python services)
2. Crear TicketVerificationService
3. Crear KYCVerificationService
4. Integrar con ChatService

---

### ⬜ FASE 7 - Frontend Chat (Next.js)
**Objetivo**: Interfaz de chat con upload de imágenes

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

# Microservicios Python (URLs internas)
OCR_SERVICE_URL=http://localhost:8001
NLP_SERVICE_URL=http://localhost:8002
CLUSTERING_SERVICE_URL=http://localhost:8003

# Sorti365 APIs (para consultar tickets, jugadores)
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
- Docstrings en funciones públicas

### Estilos
- Tailwind CSS (frontend)
- No CSS modules

---

## Próxima Tarea

**FASE 3 - Tarea 3.1**: Crear schemas de MongoDB para Chat

Archivos a crear:
- `apps/backend/src/modules/chat/schemas/chat-session.schema.ts`
- `apps/backend/src/modules/chat/schemas/chat-message.schema.ts`

---

## Instrucciones para Claude Code

1. **Seguir el orden de las fases**
2. **Un archivo a la vez**
3. **Probar antes de avanzar**
4. **Usar OpenAI en lugar de Anthropic** para el módulo multimodal
5. **Los microservicios Python van en `/services`**, no en `/apps`
