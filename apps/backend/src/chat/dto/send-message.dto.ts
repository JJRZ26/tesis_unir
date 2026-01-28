import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContentType, MessageRole } from '../schemas/chat-message.schema';

export class ImageDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  base64?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  filename?: string;
}

export class MessageContentDto {
  @IsEnum(ContentType)
  type: ContentType;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageDto)
  images?: ImageDto[];
}

export class SendMessageDto {
  @IsOptional()
  @IsEnum(MessageRole)
  role?: MessageRole;

  @ValidateNested()
  @Type(() => MessageContentDto)
  content: MessageContentDto;
}
