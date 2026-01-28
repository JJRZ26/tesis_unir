# Sorti365 Multimodal Chat

Sistema conversacional multimodal para atención al cliente con procesamiento de texto e imágenes.

## Quick Start

### Requisitos
- Node.js 20+
- Docker y Docker Compose
- API Key de Anthropic (Claude)

### Instalación

```bash
# 1. Clonar e instalar dependencias
git clone <repo>
cd sorti365-chat
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tu ANTHROPIC_API_KEY

# 3. Levantar servicios (MongoDB + Redis)
npm run docker:up

# 4. Iniciar desarrollo
npm run dev
```

## Estructura

```
sorti365-chat/
├── apps/
│   ├── backend/     # NestJS API
│   └── frontend/    # Next.js 15 Chat UI
├── packages/
│   └── shared/      # Tipos compartidos
└── docker/          # Docker Compose
```

## Casos de Uso

### 1. Verificación de Tickets
Usuario envía captura de ticket → Sistema extrae ticketId → Consulta estado → Responde

### 2. Verificación KYC
Usuario envía fotos de cédula + selfie → Sistema valida identidad → Aprueba o rechaza

## Documentación

- [Plan de Desarrollo](./sorti365-multimodal-plan.md)
- [Configuración Claude Code](./CLAUDE.md)
- [Tareas del Proyecto](./sorti365-tasks.json)

## Desarrollo

```bash
npm run dev           # Todo
npm run dev:backend   # Solo backend
npm run dev:frontend  # Solo frontend
npm run docker:up     # Servicios
npm run test          # Tests
```

## Para Claude Code

Usa estos archivos como contexto:
1. `CLAUDE.md` - Configuración y convenciones
2. `sorti365-tasks.json` - Tareas estructuradas
3. `sorti365-multimodal-plan.md` - Plan detallado

Comando para empezar:
```
Lee CLAUDE.md y sorti365-tasks.json, luego ejecuta la tarea 1.1
```
