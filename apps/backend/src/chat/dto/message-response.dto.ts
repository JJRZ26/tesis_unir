import { ContentType, MessageRole } from '../schemas/chat-message.schema';

export class ImageResponseDto {
  url?: string;
  mimeType?: string;
  filename?: string;
}

export class MessageContentResponseDto {
  type: ContentType;
  text?: string;
  images?: ImageResponseDto[];
}

export class MessageMetadataResponseDto {
  processingTimeMs?: number;
  model?: string;
  tokensUsed?: number;
}

export class MessageResponseDto {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: MessageContentResponseDto;
  metadata?: MessageMetadataResponseDto;
  createdAt: Date;
}

export class SessionResponseDto {
  id: string;
  playerId?: string;
  status: string;
  context: string;
  createdAt: Date;
  updatedAt: Date;
}
