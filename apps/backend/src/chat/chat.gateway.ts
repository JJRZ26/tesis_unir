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
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

interface JoinPayload {
  sessionId: string;
}

interface MessagePayload {
  sessionId: string;
  content: SendMessageDto['content'];
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

  constructor(private readonly chatService: ChatService) {}

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
      const message = await this.chatService.addMessage(payload.sessionId, {
        content: payload.content,
      });

      const messageResponse = {
        id: message._id,
        sessionId: message.sessionId,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      };

      this.server
        .to(`session:${payload.sessionId}`)
        .emit('chat:message', messageResponse);

      this.logger.log(`Message sent in session ${payload.sessionId}`);
      return { event: 'chat:message:sent', data: messageResponse };
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
