import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ChatSessionDocument = ChatSession & Document;

export enum SessionStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
}

export enum SessionContext {
  TICKET_VERIFICATION = 'ticket_verification',
  KYC = 'kyc',
  GENERAL = 'general',
}

@Schema({ _id: false })
export class SessionMetadata {
  @Prop()
  userAgent?: string;

  @Prop()
  ipAddress?: string;
}

@Schema({ _id: false })
export class LastVerifiedTicket {
  @Prop()
  ticketId: string;

  @Prop({ type: Object })
  betData: Record<string, unknown>;

  @Prop()
  verifiedAt: Date;
}

@Schema({ timestamps: true, collection: 'chat_sessions' })
export class ChatSession {
  @Prop()
  playerId?: string;

  @Prop({ type: String, enum: SessionStatus, default: SessionStatus.ACTIVE })
  status: SessionStatus;

  @Prop({ type: String, enum: SessionContext, default: SessionContext.GENERAL })
  context: SessionContext;

  @Prop({ type: SessionMetadata })
  metadata?: SessionMetadata;

  @Prop({ type: LastVerifiedTicket })
  lastVerifiedTicket?: LastVerifiedTicket;

  createdAt: Date;
  updatedAt: Date;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
