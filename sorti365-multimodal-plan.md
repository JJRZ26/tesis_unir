# Plan de Desarrollo: Sistema Conversacional Multimodal Sorti365

## Visión General del Proyecto

Sistema de chat inteligente multimodal para atención al cliente en casa de apuestas que procesa texto e imágenes para:
1. **Verificación de tickets de apuestas** - Extraer ticketId de capturas, consultar estado de eventos/mercados
2. **Verificación de identidad (KYC)** - Procesar fotos de cédula y selfie, extraer datos, validar identidad

---

## Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                    (Next.js + TypeScript)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Chat Interface                        │   │
│  │  - Área de mensajes (texto + imágenes)                  │   │
│  │  - Input de texto                                        │   │
│  │  - Upload de imágenes (drag & drop)                     │   │
│  │  - Preview de imágenes antes de enviar                  │   │
│  │  - URL param: ?playerId=XXX                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│                    (NestJS + TypeScript)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Gateway    │  │   Chat       │  │   Multimodal         │  │
│  │   (REST/WS)  │──│   Service    │──│   Processor          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   OCR        │  │   Vision     │  │   LLM Integration    │  │
│  │   Service    │  │   Service    │  │   (Claude API)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   MongoDB    │  │   Redis      │  │   External APIs      │  │
│  │   (Chats,    │  │   (Cache,    │  │   (Sorti365 API      │  │
│  │   Sessions)  │  │   Sessions)  │  │   tickets, players)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## FASE 1: Configuración del Entorno Base
**Duración estimada: 1-2 días**

### Objetivos
- Configurar monorepo con estructura de carpetas
- Configurar Docker para desarrollo local
- Configurar variables de entorno

### Tareas
1. Crear estructura de carpetas del monorepo
2. Configurar Docker Compose con MongoDB y Redis
3. Crear archivos de configuración base (.env, .gitignore, etc.)
4. Configurar ESLint, Prettier, TypeScript base

### Estructura de Carpetas
```
sorti365-chat/
├── apps/
│   ├── frontend/          # Next.js 15 + TypeScript
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── types/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── backend/           # NestJS + TypeScript
│       ├── src/
│       │   ├── modules/
│       │   │   ├── chat/
│       │   │   ├── multimodal/
│       │   │   ├── ocr/
│       │   │   ├── vision/
│       │   │   └── llm/
│       │   ├── common/
│       │   └── config/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── shared/            # Tipos compartidos
│       ├── src/
│       │   └── types/
│       └── package.json
│
├── docker/
│   ├── docker-compose.yml
│   └── docker-compose.dev.yml
│
├── .env.example
├── package.json           # Root package.json (workspaces)
└── README.md
```

---

## FASE 2: Backend - Estructura Base NestJS
**Duración estimada: 2-3 días**

### Objetivos
- Crear proyecto NestJS con estructura modular
- Configurar conexión a MongoDB
- Configurar conexión a Redis
- Implementar módulo de configuración

### Tareas
1. Inicializar proyecto NestJS
2. Configurar módulos base (Config, Database, Cache)
3. Implementar health checks
4. Configurar logging estructurado
5. Implementar manejo global de errores

### Módulos a crear
```typescript
// Estructura de módulos
src/
├── modules/
│   ├── config/           # ConfigModule - variables de entorno
│   ├── database/         # DatabaseModule - MongoDB connection
│   ├── cache/            # CacheModule - Redis connection
│   └── health/           # HealthModule - health checks
├── common/
│   ├── filters/          # Exception filters
│   ├── interceptors/     # Logging, transform interceptors
│   ├── guards/           # Auth guards (para futuro)
│   └── decorators/       # Custom decorators
└── main.ts
```

---

## FASE 3: Backend - Módulo de Chat
**Duración estimada: 3-4 días**

### Objetivos
- Implementar API REST para chat
- Implementar WebSocket para tiempo real
- Gestionar sesiones de chat
- Almacenar historial de conversaciones

### Tareas
1. Crear ChatModule con controladores y servicios
2. Implementar endpoints REST:
   - POST /chat/sessions - Crear sesión
   - GET /chat/sessions/:id - Obtener sesión
   - POST /chat/sessions/:id/messages - Enviar mensaje
   - GET /chat/sessions/:id/messages - Obtener historial
3. Implementar WebSocket Gateway
4. Crear schemas de MongoDB (Session, Message)
5. Implementar servicio de gestión de sesiones

### Schemas MongoDB
```typescript
// chat-session.schema.ts
{
  playerId: string;           // ID del jugador (opcional, de URL)
  status: 'active' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    userAgent: string;
    ip: string;
    context: string;          // 'ticket_verification' | 'kyc' | 'general'
  }
}

// chat-message.schema.ts
{
  sessionId: ObjectId;
  role: 'user' | 'assistant' | 'system';
  content: {
    type: 'text' | 'image' | 'mixed';
    text?: string;
    images?: [{
      url: string;
      base64?: string;
      analysis?: object;      // Resultado del análisis de imagen
    }];
  };
  metadata: {
    processingTime: number;
    tokensUsed?: number;
    confidence?: number;
  };
  createdAt: Date;
}
```

---

## FASE 4: Backend - Módulo de Procesamiento Multimodal
**Duración estimada: 4-5 días**

### Objetivos
- Integrar con Claude API para procesamiento multimodal
- Implementar análisis de imágenes
- Crear prompts especializados por caso de uso

### Tareas
1. Crear MultimodalModule
2. Implementar cliente de Claude API
3. Crear servicio de análisis de imágenes
4. Implementar prompts para:
   - Extracción de ticketId de capturas
   - Extracción de datos de cédula
   - Comparación facial básica
   - Validación de calidad de imagen
5. Crear sistema de caché de respuestas

### Prompts Especializados
```typescript
// prompts/ticket-analysis.prompt.ts
export const TICKET_ANALYSIS_PROMPT = `
Eres un asistente especializado en analizar capturas de tickets de apuestas deportivas.

Tu tarea es:
1. Identificar si la imagen contiene un ticket de apuesta válido
2. Extraer el ID del ticket (formato: números, puede incluir letras)
3. Identificar cualquier información visible sobre:
   - Eventos/partidos
   - Mercados de apuesta
   - Cuotas
   - Estado del ticket

Responde en formato JSON:
{
  "isValidTicket": boolean,
  "ticketId": string | null,
  "confidence": number (0-1),
  "extractedData": {
    "events": [],
    "markets": [],
    "status": string | null
  },
  "imageQuality": "good" | "acceptable" | "poor",
  "issues": []
}
`;

// prompts/kyc-analysis.prompt.ts
export const KYC_DOCUMENT_PROMPT = `
Eres un asistente especializado en verificación de identidad (KYC).

Analiza la imagen de documento de identidad y extrae:
1. Número de identificación/cédula
2. Nombres completos
3. Fecha de nacimiento (si visible)
4. Validez del documento

Responde en formato JSON:
{
  "isValidDocument": boolean,
  "documentType": "cedula_frontal" | "cedula_posterior" | "selfie_con_documento" | "unknown",
  "extractedData": {
    "documentNumber": string | null,
    "fullName": string | null,
    "dateOfBirth": string | null
  },
  "imageQuality": "good" | "acceptable" | "poor",
  "confidence": number (0-1),
  "issues": []
}
`;
```

---

## FASE 5: Backend - Servicios de OCR y Visión
**Duración estimada: 3-4 días**

### Objetivos
- Implementar OCR con Tesseract como fallback
- Implementar validación de calidad de imagen
- Crear servicio de comparación facial básica

### Tareas
1. Crear OCRModule con Tesseract
2. Implementar preprocesamiento de imágenes con Sharp
3. Crear VisionModule para:
   - Validación de calidad de imagen
   - Detección de tipo de documento
   - Extracción de regiones de interés
4. Implementar comparación facial básica (si las imágenes muestran la misma persona)

### Estructura
```typescript
// ocr/ocr.service.ts
- preprocessImage(buffer: Buffer): Promise<Buffer>
- extractText(buffer: Buffer, options?: OCROptions): Promise<OCRResult>
- extractFromRegion(buffer: Buffer, region: Region): Promise<string>

// vision/vision.service.ts
- analyzeImageQuality(buffer: Buffer): Promise<QualityResult>
- detectDocumentType(buffer: Buffer): Promise<DocumentType>
- extractFace(buffer: Buffer): Promise<FaceData | null>
- compareFaces(face1: Buffer, face2: Buffer): Promise<SimilarityResult>
```

---

## FASE 6: Backend - Lógica de Negocio Específica
**Duración estimada: 3-4 días**

### Objetivos
- Implementar flujo de verificación de tickets
- Implementar flujo de verificación KYC
- Crear integración con APIs externas de Sorti365

### Tareas
1. Crear TicketVerificationModule:
   - Consultar estado de ticket por ID
   - Obtener información de eventos/mercados
   - Generar respuestas contextuales
2. Crear KYCVerificationModule:
   - Validar que documento no esté registrado
   - Verificar coincidencia de datos
   - Gestionar flujo de verificación paso a paso
3. Crear mocks/simuladores de APIs externas para desarrollo

### Flujos de Negocio
```typescript
// ticket-verification/ticket-verification.service.ts
async verifyTicket(sessionId: string, imageBuffer: Buffer): Promise<TicketVerificationResult> {
  // 1. Analizar imagen con Claude
  // 2. Extraer ticketId
  // 3. Consultar API de Sorti365
  // 4. Analizar estado de eventos/mercados
  // 5. Generar respuesta contextual
}

// kyc-verification/kyc-verification.service.ts
async processKYCStep(
  sessionId: string, 
  playerId: string,
  step: 'cedula_frontal' | 'cedula_posterior' | 'selfie',
  imageBuffer: Buffer
): Promise<KYCStepResult> {
  // 1. Validar calidad de imagen
  // 2. Extraer datos según tipo
  // 3. Validar contra datos existentes
  // 4. Actualizar estado de verificación
  // 5. Determinar siguiente paso o completar
}
```

---

## FASE 7: Frontend - Chat Interface
**Duración estimada: 4-5 días**

### Objetivos
- Crear interfaz de chat responsive
- Implementar upload de imágenes con preview
- Conectar con backend via REST/WebSocket
- Manejar estados de carga y errores

### Tareas
1. Inicializar proyecto Next.js 15 con App Router
2. Configurar Tailwind CSS
3. Crear componentes:
   - ChatContainer
   - MessageList
   - MessageBubble (texto e imágenes)
   - ChatInput
   - ImageUploader
   - ImagePreview
4. Implementar hooks:
   - useChat (gestión de mensajes)
   - useWebSocket (conexión en tiempo real)
   - useImageUpload (manejo de archivos)
5. Implementar página principal con parámetro playerId
6. Agregar estados de carga y manejo de errores

### Componentes Principales
```typescript
// components/chat/ChatContainer.tsx
- Contenedor principal del chat
- Maneja estado de sesión
- Coordina MessageList y ChatInput

// components/chat/MessageList.tsx
- Lista de mensajes con scroll automático
- Renderiza MessageBubble para cada mensaje
- Muestra indicador de "escribiendo..."

// components/chat/MessageBubble.tsx
- Renderiza mensaje de usuario o asistente
- Soporta texto, imágenes o ambos
- Muestra timestamp y estado

// components/chat/ChatInput.tsx
- Input de texto con auto-resize
- Botón de enviar
- Integración con ImageUploader

// components/chat/ImageUploader.tsx
- Drag & drop de imágenes
- Click para seleccionar
- Validación de formato/tamaño
- Preview antes de enviar
```

---

## FASE 8: Integración y Testing
**Duración estimada: 3-4 días**

### Objetivos
- Integrar frontend con backend
- Crear tests unitarios y de integración
- Probar flujos completos

### Tareas
1. Configurar CORS y proxy para desarrollo
2. Implementar tests unitarios de servicios
3. Implementar tests de integración de APIs
4. Crear tests E2E básicos
5. Probar flujos completos:
   - Verificación de ticket
   - Verificación KYC
6. Documentar API con Swagger

---

## FASE 9: Refinamiento y Optimización
**Duración estimada: 2-3 días**

### Objetivos
- Optimizar rendimiento
- Mejorar UX basado en pruebas
- Preparar para producción

### Tareas
1. Optimizar imágenes (compresión, resize)
2. Implementar rate limiting
3. Mejorar manejo de errores y mensajes al usuario
4. Agregar logging y monitoreo
5. Documentar despliegue

---

## Tecnologías Principales

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS
- **Estado**: React hooks + Context
- **HTTP**: Fetch API / Axios
- **WebSocket**: Socket.io-client

### Backend
- **Framework**: NestJS
- **Lenguaje**: TypeScript
- **Base de datos**: MongoDB (Mongoose)
- **Cache**: Redis
- **OCR**: Tesseract.js (fallback)
- **Procesamiento de imágenes**: Sharp
- **LLM**: Claude API (Anthropic)

### DevOps
- **Contenedores**: Docker + Docker Compose
- **CI/CD**: GitHub Actions (futuro)

---

## Variables de Entorno Necesarias

```env
# Backend
NODE_ENV=development
PORT=3001

# MongoDB
MONGODB_URI=mongodb://localhost:27017/sorti365-chat

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Claude API
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Sorti365 APIs (mock en desarrollo)
SORTI365_API_URL=http://localhost:3002
SORTI365_API_KEY=dev-key

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

---

## Comandos para Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servicios Docker (MongoDB, Redis)
docker-compose -f docker/docker-compose.dev.yml up -d

# Iniciar backend en modo desarrollo
cd apps/backend && npm run start:dev

# Iniciar frontend en modo desarrollo
cd apps/frontend && npm run dev

# Ejecutar tests
npm run test

# Ejecutar linting
npm run lint
```

---

## Orden de Implementación Recomendado

1. **FASE 1** - Configuración del entorno (día 1-2)
2. **FASE 2** - Backend base NestJS (día 3-5)
3. **FASE 3** - Módulo de Chat (día 6-9)
4. **FASE 4** - Procesamiento Multimodal (día 10-14)
5. **FASE 7** - Frontend básico (día 15-19) ← Paralelizable
6. **FASE 5** - OCR y Visión (día 20-23)
7. **FASE 6** - Lógica de negocio (día 24-27)
8. **FASE 8** - Integración y Testing (día 28-31)
9. **FASE 9** - Refinamiento (día 32-34)

**Total estimado: 5-6 semanas de desarrollo**

---

## Próximo Paso Inmediato

Comenzar con **FASE 1**: Crear la estructura del monorepo y configurar Docker.

¿Listo para empezar?
