export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  MIXED = 'mixed',
}

export interface ImageContent {
  url?: string;
  base64?: string;
  mimeType?: string;
  filename?: string;
}

export interface MessageContent {
  type: ContentType;
  text?: string;
  images?: ImageContent[];
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: MessageContent;
  createdAt: string;
  flowType?: FlowType;
}

export interface ChatSession {
  id: string;
  userId?: string;
  playerId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export enum FlowType {
  TICKET_VERIFICATION = 'ticket_verification',
  KYC_DOCUMENT = 'kyc_document',
  KYC_SELFIE = 'kyc_selfie',
  GENERAL_QUERY = 'general_query',
}

export enum ProcessingStep {
  ANALYZING_IMAGE = 'analyzing_image',
  EXTRACTING_TEXT = 'extracting_text',
  CLASSIFYING_INTENT = 'classifying_intent',
  QUERYING_API = 'querying_api',
  VERIFYING_DOCUMENT = 'verifying_document',
  COMPARING_FACES = 'comparing_faces',
  GENERATING_RESPONSE = 'generating_response',
}

export interface ProcessingStatus {
  step: ProcessingStep;
  message: string;
  progress?: number;
}

export interface SendMessagePayload {
  sessionId: string;
  playerId?: string;
  content: {
    type: ContentType;
    text?: string;
  };
  images?: Array<{ base64?: string; url?: string }>;
}

export interface JoinSessionPayload {
  sessionId: string;
}

export interface TypingPayload {
  sessionId: string;
}

export interface ChatError {
  message: string;
  code?: string;
}

export interface StatusUpdate {
  sessionId: string;
  step: ProcessingStep;
  message: string;
  progress?: number;
}

export interface PlayerInfo {
  playerId: number;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  username?: string;
  email?: string;
  displayName: string;
  isVerified: boolean;
  balance?: number;
  currency?: string;
}

export interface PlayerInfoResponse {
  found: boolean;
  player: PlayerInfo | null;
}
