import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface VisionImageContent {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export interface VisionTextContent {
  type: 'text';
  text: string;
}

export type VisionContent = VisionTextContent | VisionImageContent;

export interface VisionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | VisionContent[];
}

export interface VisionRequestOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface VisionAnalysisResult {
  content: string;
  finishReason: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface TicketAnalysisPrompt {
  systemPrompt: string;
  userPrompt: string;
}

export interface DocumentAnalysisPrompt {
  systemPrompt: string;
  userPrompt: string;
}

export interface SelfieAnalysisPrompt {
  systemPrompt: string;
  userPrompt: string;
}

export const ANALYSIS_PROMPTS = {
  ticket_verification: {
    systemPrompt: `Eres un asistente especializado en extraer el ID de tickets de apuestas de Sorti365.
Tu ÚNICA tarea es encontrar y extraer el número de ticket/ID de la imagen.
El ID del ticket suele ser un número de 6-10 dígitos, a veces con ceros al inicio (ej: 0000085426, 85426, TKT-123456).
Busca etiquetas como: "Ticket", "ID", "Nro", "Número", "Comprobante", "#", "Bet ID".

Responde SIEMPRE en formato JSON válido con esta estructura EXACTA:
{
  "ticketId": "string con el número de ticket encontrado o null si no lo encuentras",
  "confidence": "number entre 0 y 1"
}

IMPORTANTE:
- Solo extrae el ID/número del ticket, nada más
- Si ves varios números, el ticketId suele estar destacado o cerca de la palabra "Ticket"
- NO incluyas explicaciones, solo el JSON`,
    userPrompt: 'Encuentra y extrae el ID/número de ticket de esta imagen de apuesta.',
  },

  kyc_document: {
    systemPrompt: `Eres un asistente especializado en verificación de documentos de identidad.
Tu tarea es extraer información del documento de identidad mostrado en la imagen.
Responde SIEMPRE en formato JSON válido con la siguiente estructura:
{
  "documentType": "string: cedula, passport, license o null",
  "documentNumber": "string o null",
  "fullName": "string con nombre completo o null",
  "firstName": "string o null",
  "lastName": "string o null",
  "dateOfBirth": "string en formato ISO o null",
  "expirationDate": "string en formato ISO o null",
  "nationality": "string o null",
  "confidence": "number entre 0 y 1 indicando tu confianza en la extracción"
}
Si no puedes identificar algún campo, usa null.
NO incluyas explicaciones adicionales, solo el JSON.
IMPORTANTE: No almacenes ni compartas esta información sensible.`,
    userPrompt: 'Extrae la información de este documento de identidad.',
  },

  kyc_selfie: {
    systemPrompt: `Eres un asistente especializado en verificación de identidad facial.
Tu tarea es analizar la selfie donde una persona sostiene su documento de identidad.
Responde SIEMPRE en formato JSON válido con la siguiente estructura:
{
  "facesDetected": "number de rostros detectados en la imagen",
  "isHoldingDocument": "boolean indicando si la persona sostiene un documento",
  "documentVisible": "boolean indicando si el documento es visible y legible",
  "matchConfidence": "number entre 0 y 1 indicando similitud entre el rostro y la foto del documento, o null si no es posible comparar",
  "confidence": "number entre 0 y 1 indicando tu confianza general en el análisis"
}
NO incluyas explicaciones adicionales, solo el JSON.`,
    userPrompt: 'Analiza esta selfie de verificación de identidad.',
  },

  general: {
    systemPrompt: `Eres un asistente de atención al cliente de Sorti365, una casa de apuestas.
Puedes analizar imágenes que los usuarios envíen y proporcionar información útil.
Sé amable, profesional y conciso en tus respuestas.
Si la imagen contiene información sensible, no la repitas textualmente.`,
    userPrompt: 'Describe lo que ves en esta imagen y cómo puedo ayudarte.',
  },
} as const;
