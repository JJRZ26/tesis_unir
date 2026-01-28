import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatMessageDocument = ChatMessage & Document;

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

@Schema({ _id: false })
export class ImageContent {
  @Prop()
  url?: string;

  @Prop()
  base64?: string;

  @Prop()
  mimeType?: string;

  @Prop()
  filename?: string;
}

@Schema({ _id: false })
export class MessageContent {
  @Prop({ type: String, enum: ContentType, required: true })
  type: ContentType;

  @Prop()
  text?: string;

  @Prop({ type: [ImageContent] })
  images?: ImageContent[];
}

@Schema({ _id: false })
export class MessageMetadata {
  @Prop()
  processingTimeMs?: number;

  @Prop()
  model?: string;

  @Prop()
  tokensUsed?: number;
}

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'chat_messages' })
export class ChatMessage {
  @Prop({ type: Types.ObjectId, ref: 'ChatSession', required: true, index: true })
  sessionId: Types.ObjectId;

  @Prop({ type: String, enum: MessageRole, required: true })
  role: MessageRole;

  @Prop({ type: MessageContent, required: true })
  content: MessageContent;

  @Prop({ type: MessageMetadata })
  metadata?: MessageMetadata;

  createdAt: Date;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
