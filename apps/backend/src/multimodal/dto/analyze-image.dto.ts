import { IsString, IsOptional, IsArray, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum AnalysisType {
  TICKET_VERIFICATION = 'ticket_verification',
  KYC_DOCUMENT = 'kyc_document',
  KYC_SELFIE = 'kyc_selfie',
  GENERAL = 'general',
}

export class ImageInput {
  @IsString()
  url?: string;

  @IsString()
  base64?: string;

  @IsString()
  @IsOptional()
  mimeType?: string;
}

export class AnalyzeImageDto {
  @IsEnum(AnalysisType)
  analysisType: AnalysisType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageInput)
  images: ImageInput[];

  @IsString()
  @IsOptional()
  additionalContext?: string;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  playerId?: string;
}
