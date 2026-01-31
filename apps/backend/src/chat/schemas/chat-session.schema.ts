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

export enum KYCStep {
  NOT_STARTED = 'not_started',
  FRONT_DOCUMENT = 'front_document',
  BACK_DOCUMENT = 'back_document',
  SELFIE = 'selfie',
  COMPLETED = 'completed',
}

@Schema({ _id: false })
export class KYCState {
  @Prop({ type: String, enum: KYCStep, default: KYCStep.NOT_STARTED })
  currentStep: KYCStep;

  @Prop()
  documentNumber?: string;

  @Prop()
  fullName?: string;

  @Prop()
  dateOfBirth?: string;

  @Prop()
  frontImageVerified?: boolean;

  @Prop()
  backImageVerified?: boolean;

  @Prop()
  selfieVerified?: boolean;

  @Prop()
  frontImageBase64?: string;

  @Prop()
  backImageBase64?: string;

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;
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

  @Prop({ type: KYCState })
  kycState?: KYCState;

  createdAt: Date;
  updatedAt: Date;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
