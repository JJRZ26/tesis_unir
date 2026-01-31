# Sorti365 Multimodal Chat

Sistema Conversacional Multimodal para atención al cliente de Sorti365. Procesa texto e imágenes para verificación de tickets y procesos KYC.

---

## 📋 Requisitos Previos

- **Docker Desktop** - [Descargar aquí](https://www.docker.com/products/docker-desktop/)
- **Node.js 20+** - [Descargar aquí](https://nodejs.org/)
- **OpenAI API Key** - Con acceso a GPT-4 Vision

---

## 🚀 Guía de Instalación y Ejecución

### Paso 1: Clonar el repositorio (si no lo tienes)

```bash
git clone <url-del-repositorio>
cd tesis_unir
```

### Paso 2: Configurar variables de entorno

Copia el archivo de ejemplo y edítalo con tu API Key de OpenAI:

**Windows (PowerShell):**

```powershell
copy .env.example .env
```

**Linux/Mac:**

```bash
cp .env.example .env
```

Abre el archivo `.env` y reemplaza la línea de `OPENAI_API_KEY` con tu clave real:

```env
OPENAI_API_KEY=sk-proj-TU_API_KEY_REAL_AQUI
```

### Paso 3: Instalar dependencias de Node.js

```bash
npm install
```

### Paso 4: Levantar servicios con Docker

**⚠️ IMPORTANTE: Asegúrate de que Docker Desktop esté abierto y corriendo.**

```bash
docker-compose -f docker/docker-compose.dev.yml up -d
```

**Primera ejecución:** Tardará 10-20 minutos porque descarga:

- Imágenes de Docker (MongoDB, Redis, Python)
- Modelos de IA (~500MB para NLP)
- Dependencias de Python

### Paso 5: Verificar que los servicios están corriendo

```bash
docker ps
```

Deberías ver estos contenedores:

```
CONTAINER ID   IMAGE                    STATUS    PORTS                     NAMES
xxxx           sorti365-clustering      Up        0.0.0.0:8003->8003/tcp   sorti365-clustering
xxxx           sorti365-nlp             Up        0.0.0.0:8002->8002/tcp   sorti365-nlp
xxxx           sorti365-ocr             Up        0.0.0.0:8001->8001/tcp   sorti365-ocr
xxxx           redis:7-alpine           Up        0.0.0.0:6379->6379/tcp   sorti365-redis
xxxx           mongo:7                  Up        0.0.0.0:27017->27017/tcp sorti365-mongodb
```

### Paso 6: Iniciar el Backend y Frontend

```bash
npm run dev
```

Esto inicia:

- **Backend NestJS** en http://localhost:3001
- **Frontend Next.js** en http://localhost:3000

### Paso 7: Abrir la aplicación

Abre tu navegador y ve a: **http://localhost:3000**

---

## 🔍 URLs del Sistema

| Servicio               | URL                              | Descripción              |
| ---------------------- | -------------------------------- | ------------------------ |
| **Frontend**           | http://localhost:3000            | Interfaz de chat         |
| **Backend API**        | http://localhost:3001            | API REST + WebSocket     |
| **Health Check**       | http://localhost:3001/api/health | Estado del backend       |
| **OCR Swagger**        | http://localhost:8001/docs       | Documentación OCR        |
| **NLP Swagger**        | http://localhost:8002/docs       | Documentación NLP        |
| **Clustering Swagger** | http://localhost:8003/docs       | Documentación Clustering |

---

## 📝 Comandos Útiles

### Docker

```bash
# Levantar todos los servicios
docker-compose -f docker/docker-compose.dev.yml up -d

# Ver logs de todos los servicios
docker-compose -f docker/docker-compose.dev.yml logs -f

# Ver logs de un servicio específico
docker-compose -f docker/docker-compose.dev.yml logs -f nlp-service

# Detener todos los servicios
docker-compose -f docker/docker-compose.dev.yml down

# Detener y eliminar volúmenes (borra datos de MongoDB)
docker-compose -f docker/docker-compose.dev.yml down -v

# Reiniciar un servicio
docker-compose -f docker/docker-compose.dev.yml restart nlp-service

# Reconstruir imágenes (después de cambios en Dockerfile)
docker-compose -f docker/docker-compose.dev.yml up -d --build
```

### Desarrollo

```bash
# Iniciar frontend + backend en modo desarrollo
npm run dev

# Solo backend
npm run dev:backend

# Solo frontend
npm run dev:frontend

# Compilar para producción
npm run build

# Ejecutar tests
npm run test
```

---

## 🧪 Probar el Sistema

### Opción 1: Interfaz Web

1. Abre http://localhost:3000 o http://localhost:3000?playerId=13332
2. Escribe "Hola, necesito ayuda" y envía
3. Sube una imagen de un ticket de apuestas
4. El sistema analizará la imagen y responderá

### Opción 2: Probar APIs con curl (PowerShell)

```powershell
# Health check del backend
curl http://localhost:3001/api/health

# Health check de microservicios
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health
```

### Opción 3: Script de integración

```powershell
# Windows PowerShell
.\scripts\integration-test.ps1
```

---

## 🏗️ Arquitectura

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
│  - REST API + WebSocket para chat                               │
│  - Integración con OpenAI GPT-4 Vision                          │
│  - Orquestación de microservicios                               │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  OCR Service     │ │  NLP Service     │ │ Clustering Svc   │
│  Puerto: 8001    │ │  Puerto: 8002    │ │  Puerto: 8003    │
│  - Tesseract     │ │  - spaCy         │ │  - K-means       │
│  - OpenCV        │ │  - BERT español  │ │  - HDBSCAN       │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## ❓ Preguntas Frecuentes

### ¿Necesito entrenar algún modelo?

**NO.** Todos los modelos son pre-entrenados y se descargan automáticamente:

- **spaCy**: Modelo de español para extracción de entidades
- **Sentence-BERT**: Para clasificación de intenciones
- **GPT-4 Vision**: Servicio de OpenAI para análisis de imágenes

### ¿Por qué tarda tanto la primera vez?

La primera ejecución descarga:

- Imágenes de Docker (~2GB)
- Modelo spaCy español (~40MB)
- Modelo Sentence-BERT (~500MB)
- Dependencias de Python

Las siguientes ejecuciones serán mucho más rápidas.

### ¿Qué hago si un servicio no inicia?

1. Verifica los logs: `docker-compose -f docker/docker-compose.dev.yml logs -f <servicio>`
2. Reinicia el servicio: `docker-compose -f docker/docker-compose.dev.yml restart <servicio>`
3. Si persiste, reconstruye: `docker-compose -f docker/docker-compose.dev.yml up -d --build`

---

## 🔧 Solución de Problemas

### "Connection refused" en microservicios

- Espera 2-3 minutos después de `docker-compose up`
- Los modelos de IA tardan en cargar

### "OpenAI API error"

- Verifica que tu API key es válida en `.env`
- Asegúrate de tener créditos y acceso a GPT-4 Vision

### "Port already in use"

```powershell
# Ver qué proceso usa el puerto (ej: 3001)
netstat -ano | findstr :3001

# Matar el proceso
taskkill /PID <PID> /F
```

### Frontend no conecta al backend

- Verifica que el backend está corriendo en http://localhost:3001
- Revisa la consola del navegador (F12) para errores CORS

---

## 📁 Estructura del Proyecto

```
tesis_unir/
├── apps/
│   ├── frontend/          # Next.js 15 - Interfaz de chat
│   └── backend/           # NestJS - API Gateway
├── services/
│   ├── ocr-service/       # Python - Extracción de texto (OCR)
│   ├── nlp-service/       # Python - Análisis de lenguaje natural
│   └── clustering-service/ # Python - Agrupación de textos
├── docker/
│   └── docker-compose.dev.yml  # Configuración Docker
├── scripts/               # Scripts de utilidad
├── .env                   # Variables de entorno (crear desde .env.example)
├── .env.example           # Ejemplo de variables de entorno
├── CLAUDE.md              # Documentación técnica del proyecto
└── package.json           # Configuración del monorepo
```

---

## 🎯 Casos de Uso

### 1. Verificación de Tickets

Usuario envía captura de ticket → Sistema extrae ticketId con OCR/Vision → Consulta estado → Responde con información

### 2. Verificación KYC

Usuario envía fotos de cédula + selfie → Sistema valida identidad con GPT-4 Vision → Aprueba o rechaza

---

## 📄 Licencia

Este proyecto es parte de una tesis universitaria para UNIR.
