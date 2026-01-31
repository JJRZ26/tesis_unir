import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ChatSession,
  ChatSessionDocument,
  SessionStatus,
  SessionContext,
  KYCStep,
  KYCState,
} from './schemas/chat-session.schema';
import {
  ChatMessage,
  ChatMessageDocument,
  MessageRole,
} from './schemas/chat-message.schema';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(ChatSession.name)
    private sessionModel: Model<ChatSessionDocument>,
    @InjectModel(ChatMessage.name)
    private messageModel: Model<ChatMessageDocument>,
  ) {}

  async createSession(
    dto: CreateSessionDto,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<ChatSessionDocument> {
    const session = new this.sessionModel({
      playerId: dto.playerId,
      context: dto.context || SessionContext.GENERAL,
      status: SessionStatus.ACTIVE,
      metadata,
    });

    const savedSession = await session.save();
    this.logger.log(`Session created: ${savedSession._id}`);
    return savedSession;
  }

  async getSession(sessionId: string): Promise<ChatSessionDocument> {
    if (!Types.ObjectId.isValid(sessionId)) {
      throw new NotFoundException('Invalid session ID');
    }

    const session = await this.sessionModel.findById(sessionId).exec();
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  async addMessage(
    sessionId: string,
    dto: SendMessageDto,
  ): Promise<ChatMessageDocument> {
    const session = await this.getSession(sessionId);

    if (session.status === SessionStatus.CLOSED) {
      throw new NotFoundException('Session is closed');
    }

    const message = new this.messageModel({
      sessionId: session._id,
      role: dto.role || MessageRole.USER,
      content: dto.content,
    });

    const savedMessage = await message.save();
    this.logger.log(`Message added to session ${sessionId}: ${savedMessage._id}`);
    return savedMessage;
  }

  async addAssistantMessage(
    sessionId: string,
    text: string,
    metadata?: { processingTimeMs?: number; model?: string; tokensUsed?: number },
  ): Promise<ChatMessageDocument> {
    const session = await this.getSession(sessionId);

    const message = new this.messageModel({
      sessionId: session._id,
      role: MessageRole.ASSISTANT,
      content: {
        type: 'text',
        text,
      },
      metadata,
    });

    return message.save();
  }

  async getMessages(
    sessionId: string,
    limit = 50,
    offset = 0,
  ): Promise<ChatMessageDocument[]> {
    await this.getSession(sessionId);

    return this.messageModel
      .find({ sessionId: new Types.ObjectId(sessionId) })
      .sort({ createdAt: 1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  async closeSession(sessionId: string): Promise<ChatSessionDocument> {
    const session = await this.getSession(sessionId);

    session.status = SessionStatus.CLOSED;
    await session.save();

    this.logger.log(`Session closed: ${sessionId}`);
    return session;
  }

  async getActiveSessions(playerId?: string): Promise<ChatSessionDocument[]> {
    const query: Record<string, unknown> = { status: SessionStatus.ACTIVE };
    if (playerId) {
      query.playerId = playerId;
    }
    return this.sessionModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async setLastVerifiedTicket(
    sessionId: string,
    ticketId: string,
    betData: Record<string, unknown>,
  ): Promise<ChatSessionDocument> {
    const session = await this.getSession(sessionId);

    session.lastVerifiedTicket = {
      ticketId,
      betData,
      verifiedAt: new Date(),
    };
    session.context = SessionContext.TICKET_VERIFICATION;

    await session.save();
    this.logger.log(`Session ${sessionId} context updated with ticket ${ticketId}`);
    return session;
  }

  async getLastVerifiedTicket(sessionId: string): Promise<{
    ticketId: string;
    betData: Record<string, unknown>;
    verifiedAt: Date;
  } | null> {
    const session = await this.getSession(sessionId);
    return session.lastVerifiedTicket || null;
  }

  async clearTicketContext(sessionId: string): Promise<ChatSessionDocument> {
    const session = await this.getSession(sessionId);
    session.lastVerifiedTicket = undefined;
    session.context = SessionContext.GENERAL;
    await session.save();
    this.logger.log(`Session ${sessionId} ticket context cleared`);
    return session;
  }

  // ============= KYC State Methods =============

  async getKYCState(sessionId: string): Promise<KYCState | null> {
    const session = await this.getSession(sessionId);
    return session.kycState || null;
  }

  async initKYCProcess(sessionId: string): Promise<ChatSessionDocument> {
    const session = await this.getSession(sessionId);

    session.kycState = {
      currentStep: KYCStep.FRONT_DOCUMENT,
      startedAt: new Date(),
    };
    session.context = SessionContext.KYC;

    await session.save();
    this.logger.log(`KYC process initiated for session ${sessionId}`);
    return session;
  }

  async updateKYCFrontDocument(
    sessionId: string,
    data: {
      documentNumber: string;
      fullName: string;
      dateOfBirth?: string;
      frontImageBase64?: string;
    },
  ): Promise<ChatSessionDocument> {
    const session = await this.getSession(sessionId);

    if (!session.kycState) {
      session.kycState = {
        currentStep: KYCStep.FRONT_DOCUMENT,
        startedAt: new Date(),
      };
    }

    session.kycState.documentNumber = data.documentNumber;
    session.kycState.fullName = data.fullName;
    session.kycState.dateOfBirth = data.dateOfBirth;
    session.kycState.frontImageVerified = true;
    session.kycState.frontImageBase64 = data.frontImageBase64;
    session.kycState.currentStep = KYCStep.BACK_DOCUMENT;

    await session.save();
    this.logger.log(`KYC front document verified for session ${sessionId}`);
    return session;
  }

  async updateKYCBackDocument(
    sessionId: string,
    backImageBase64?: string,
  ): Promise<ChatSessionDocument> {
    const session = await this.getSession(sessionId);

    if (!session.kycState) {
      throw new Error('KYC process not started');
    }

    session.kycState.backImageVerified = true;
    session.kycState.backImageBase64 = backImageBase64;
    session.kycState.currentStep = KYCStep.SELFIE;

    await session.save();
    this.logger.log(`KYC back document verified for session ${sessionId}`);
    return session;
  }

  async completeKYCProcess(sessionId: string): Promise<ChatSessionDocument> {
    const session = await this.getSession(sessionId);

    if (!session.kycState) {
      throw new Error('KYC process not started');
    }

    session.kycState.selfieVerified = true;
    session.kycState.currentStep = KYCStep.COMPLETED;
    session.kycState.completedAt = new Date();

    await session.save();
    this.logger.log(`KYC process completed for session ${sessionId}`);
    return session;
  }

  async clearKYCState(sessionId: string): Promise<ChatSessionDocument> {
    const session = await this.getSession(sessionId);
    session.kycState = undefined;
    session.context = SessionContext.GENERAL;
    await session.save();
    this.logger.log(`KYC state cleared for session ${sessionId}`);
    return session;
  }
}
