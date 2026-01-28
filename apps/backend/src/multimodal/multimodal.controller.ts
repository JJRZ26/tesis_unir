import { Controller, Post, Body, Get } from '@nestjs/common';
import { MultimodalService } from './multimodal.service';
import { OpenAIService } from './openai.service';
import { AnalyzeImageDto } from './dto/analyze-image.dto';
import { VisionResponseDto } from './dto/vision-response.dto';

@Controller('multimodal')
export class MultimodalController {
  constructor(
    private readonly multimodalService: MultimodalService,
    private readonly openaiService: OpenAIService,
  ) {}

  @Get('status')
  getStatus() {
    return {
      configured: this.openaiService.isConfigured(),
      message: this.openaiService.isConfigured()
        ? 'OpenAI Vision service is ready'
        : 'OpenAI API key not configured',
    };
  }

  @Post('analyze')
  async analyze(@Body() dto: AnalyzeImageDto): Promise<VisionResponseDto> {
    return this.multimodalService.analyzeImage(dto);
  }

  @Post('analyze/ticket')
  async analyzeTicket(
    @Body() body: { images: AnalyzeImageDto['images']; additionalContext?: string },
  ): Promise<VisionResponseDto> {
    return this.multimodalService.analyzeTicket(body.images, body.additionalContext);
  }

  @Post('analyze/document')
  async analyzeDocument(
    @Body() body: { images: AnalyzeImageDto['images']; additionalContext?: string },
  ): Promise<VisionResponseDto> {
    return this.multimodalService.analyzeDocument(body.images, body.additionalContext);
  }

  @Post('analyze/selfie')
  async analyzeSelfie(
    @Body() body: { images: AnalyzeImageDto['images']; additionalContext?: string },
  ): Promise<VisionResponseDto> {
    return this.multimodalService.analyzeSelfie(body.images, body.additionalContext);
  }
}
