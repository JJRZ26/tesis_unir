import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { ProcessingStatus } from '../orchestrator/interfaces/orchestrator.types';

interface JoinPayload {
  sessionId: string;
}

interface MessagePayload {
  sessionId: string;
  playerId?: string;
  content: SendMessageDto['content'];
  images?: Array<{ base64?: string; url?: string }>;
}

interface TypingPayload {
  sessionId: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    @Inject(forwardRef(() => OrchestratorService))
    private readonly orchestratorService: OrchestratorService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinPayload,
  ) {
    try {
      const session = await this.chatService.getSession(payload.sessionId);
      client.join(`session:${payload.sessionId}`);
      this.logger.log(`Client ${client.id} joined session ${payload.sessionId}`);

      return {
        event: 'chat:joined',
        data: {
          sessionId: session._id,
          status: session.status,
        },
      };
    } catch (error) {
      this.logger.error(`Error joining session: ${error.message}`);
      client.emit('chat:error', { message: 'Failed to join session' });
    }
  }

  @SubscribeMessage('chat:message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MessagePayload,
  ) {
    try {
      // Save user message
      const userMessage = await this.chatService.addMessage(payload.sessionId, {
        content: payload.content,
      });

      const userMessageResponse = {
        id: userMessage._id,
        sessionId: userMessage.sessionId,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      };

      // Emit user message to all clients in session
      this.server
        .to(`session:${payload.sessionId}`)
        .emit('chat:message', userMessageResponse);

      this.logger.log(`User message sent in session ${payload.sessionId}`);

      // Emit typing indicator while processing
      this.server
        .to(`session:${payload.sessionId}`)
        .emit('chat:typing', { sessionId: payload.sessionId });

      // Process message with orchestrator
      const onStatusUpdate = (status: ProcessingStatus) => {
        this.server.to(`session:${payload.sessionId}`).emit('chat:status', {
          sessionId: payload.sessionId,
          ...status,
        });
      };

      const { response, flowType } = await this.orchestratorService.processMessage(
        {
          sessionId: payload.sessionId,
          playerId: payload.playerId,
          content: payload.content?.text,
          images: payload.images,
        },
        onStatusUpdate,
      );

      // Get the saved assistant message
      const messages = await this.chatService.getMessages(payload.sessionId, 1, 0);
      const assistantMessage = messages[0];

      const assistantMessageResponse = {
        id: assistantMessage._id,
        sessionId: assistantMessage.sessionId,
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
        flowType,
      };

      // Emit assistant response
      this.server
        .to(`session:${payload.sessionId}`)
        .emit('chat:message', assistantMessageResponse);

      this.logger.log(`Assistant response sent in session ${payload.sessionId}`);
      return { event: 'chat:message:sent', data: assistantMessageResponse };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      client.emit('chat:error', { message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingPayload,
  ) {
    client.to(`session:${payload.sessionId}`).emit('chat:typing', {
      sessionId: payload.sessionId,
    });
  }

  emitToSession(sessionId: string, event: string, data: unknown) {
    this.server.to(`session:${sessionId}`).emit(event, data);
  }
}
