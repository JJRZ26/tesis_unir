import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ImageInputDto {
  @IsString()
  @IsOptional()
  base64?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  mimeType?: string;
}

export class ProcessMessageDto {
  @IsString()
  sessionId: string;

  @IsString()
  @IsOptional()
  playerId?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageInputDto)
  @IsOptional()
  images?: ImageInputDto[];
}

export class VerifyTicketDto {
  @IsString()
  sessionId: string;

  @IsString()
  imageBase64: string;
}

export class VerifyDocumentDto {
  @IsString()
  sessionId: string;

  @IsString()
  playerId: string;

  @IsString()
  frontImageBase64: string;

  @IsString()
  @IsOptional()
  backImageBase64?: string;
}

export class VerifySelfieDto {
  @IsString()
  sessionId: string;

  @IsString()
  playerId: string;

  @IsString()
  selfieImageBase64: string;

  @IsString()
  documentNumber: string;
}

export class FullKYCDto {
  @IsString()
  sessionId: string;

  @IsString()
  playerId: string;

  @IsString()
  frontImageBase64: string;

  @IsString()
  @IsOptional()
  backImageBase64?: string;

  @IsString()
  selfieImageBase64: string;
}
