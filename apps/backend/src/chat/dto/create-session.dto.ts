import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SessionContext } from '../schemas/chat-session.schema';

export class CreateSessionDto {
  @IsOptional()
  @IsString()
  playerId?: string;

  @IsOptional()
  @IsEnum(SessionContext)
  context?: SessionContext;
}
