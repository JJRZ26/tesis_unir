import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ChatService } from './chat.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('sessions')
  async createSession(
    @Body() dto: CreateSessionDto,
    @Req() req: Request,
  ) {
    const metadata = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.socket.remoteAddress,
    };
    const session = await this.chatService.createSession(dto, metadata);
    return {
      id: session._id,
      playerId: session.playerId,
      status: session.status,
      context: session.context,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    const session = await this.chatService.getSession(id);
    return {
      id: session._id,
      playerId: session.playerId,
      status: session.status,
      context: session.context,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  @Post('sessions/:id/messages')
  async sendMessage(
    @Param('id') sessionId: string,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.chatService.addMessage(sessionId, dto);
    return {
      id: message._id,
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      metadata: message.metadata,
      createdAt: message.createdAt,
    };
  }

  @Get('sessions/:id/messages')
  async getMessages(
    @Param('id') sessionId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const messages = await this.chatService.getMessages(
      sessionId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
    return messages.map((msg) => ({
      id: msg._id,
      sessionId: msg.sessionId,
      role: msg.role,
      content: msg.content,
      metadata: msg.metadata,
      createdAt: msg.createdAt,
    }));
  }

  @Delete('sessions/:id')
  async closeSession(@Param('id') id: string) {
    const session = await this.chatService.closeSession(id);
    return {
      id: session._id,
      status: session.status,
      message: 'Session closed successfully',
    };
  }
}
