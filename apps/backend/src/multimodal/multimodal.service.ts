import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { AnalyzeImageDto, AnalysisType } from './dto/analyze-image.dto';
import {
  VisionResponseDto,
  ExtractedTicketData,
  ExtractedDocumentData,
  FaceVerificationData,
} from './dto/vision-response.dto';
import { VisionContent, ANALYSIS_PROMPTS } from './interfaces/vision.types';

@Injectable()
export class MultimodalService {
  private readonly logger = new Logger(MultimodalService.name);

  constructor(private readonly openaiService: OpenAIService) {}

  async analyzeImage(dto: AnalyzeImageDto): Promise<VisionResponseDto> {
    const startTime = Date.now();

    if (!this.openaiService.isConfigured()) {
      return {
        success: false,
        analysisType: dto.analysisType,
        rawResponse: '',
        error: 'OpenAI service not configured',
        processingTimeMs: Date.now() - startTime,
        model: 'none',
      };
    }

    if (!dto.images || dto.images.length === 0) {
      throw new BadRequestException('At least one image is required');
    }

    try {
      const content = this.buildVisionContent(dto);
      const prompts = ANALYSIS_PROMPTS[dto.analysisType];

      const result = await this.openaiService.analyzeWithVision(content, {
        systemPrompt: prompts.systemPrompt,
        temperature: 0.3, // Lower temperature for more consistent extraction
      });

      const extractedData = this.parseResponse(dto.analysisType, result.content);

      return {
        success: true,
        analysisType: dto.analysisType,
        rawResponse: result.content,
        extractedData,
        processingTimeMs: Date.now() - startTime,
        model: result.model,
        tokensUsed: {
          prompt: result.usage.promptTokens,
          completion: result.usage.completionTokens,
          total: result.usage.totalTokens,
        },
      };
    } catch (error) {
      this.logger.error(`Error analyzing image: ${error.message}`, error.stack);

      return {
        success: false,
        analysisType: dto.analysisType,
        rawResponse: '',
        error: error.message,
        processingTimeMs: Date.now() - startTime,
        model: 'unknown',
      };
    }
  }

  async analyzeTicket(
    images: AnalyzeImageDto['images'],
    additionalContext?: string,
  ): Promise<VisionResponseDto> {
    return this.analyzeImage({
      analysisType: AnalysisType.TICKET_VERIFICATION,
      images,
      additionalContext,
    });
  }

  async analyzeDocument(
    images: AnalyzeImageDto['images'],
    additionalContext?: string,
  ): Promise<VisionResponseDto> {
    return this.analyzeImage({
      analysisType: AnalysisType.KYC_DOCUMENT,
      images,
      additionalContext,
    });
  }

  async analyzeSelfie(
    images: AnalyzeImageDto['images'],
    additionalContext?: string,
  ): Promise<VisionResponseDto> {
    return this.analyzeImage({
      analysisType: AnalysisType.KYC_SELFIE,
      images,
      additionalContext,
    });
  }

  /**
   * Generate a contextual response about a verified ticket
   * Uses GPT-4 with web search to answer user questions based on ticket/bet data
   * Can search the internet for match results if the user asks
   */
  async generateTicketContextResponse(
    userQuestion: string,
    betData: Record<string, unknown>,
  ): Promise<string> {
    if (!this.openaiService.isConfigured()) {
      return 'Lo siento, no puedo procesar tu pregunta en este momento.';
    }

    try {
      // Extract event names for potential web search
      const events = (betData as any).selections || [];
      const eventNames = events.map((e: any) => e.eventName || e.event_name || '').filter(Boolean);

      const systemPrompt = `Eres un asistente de atención al cliente de Sorti365, una casa de apuestas deportivas.
El usuario acaba de verificar un ticket y tiene preguntas sobre él.

DATOS DEL TICKET:
${JSON.stringify(betData, null, 2)}

EVENTOS EN EL TICKET:
${eventNames.join(', ')}

Tu tarea:
1. Responder las preguntas del usuario basándote en los datos del ticket
2. Si el usuario pregunta por el RESULTADO/MARCADOR de un partido (ej: "¿cuánto quedó?", "¿cuál fue el resultado?"), USA LA HERRAMIENTA DE BÚSQUEDA WEB para buscar el resultado real del partido
3. Busca en internet: "[nombre del partido] resultado [fecha aproximada]" para obtener el marcador
4. Si no encuentras el resultado en la búsqueda, sé honesto y di que no pudiste encontrar esa información
5. Sé empático y profesional
6. Al final, pregunta si tiene alguna otra duda sobre el ticket o si desea ayuda con algo más

Formato de respuesta:
- Sé conciso pero informativo
- Usa emojis relevantes
- Cuando encuentres el marcador, preséntalo claramente (ej: "El partido terminó Bolonia 1 - 2 Atalanta")
- Si no encuentras la info, sugiere consultar sitios deportivos`;

      // Use chat with web search capability
      const result = await this.openaiService.chatWithWebSearch([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuestion },
      ]);

      return result.content;
    } catch (error) {
      this.logger.error(`Error generating ticket context response: ${error.message}`);

      // Fallback to regular chat without web search
      try {
        const fallbackPrompt = `Eres un asistente de Sorti365. El usuario pregunta sobre su ticket.

DATOS DEL TICKET:
${JSON.stringify(betData, null, 2)}

Pregunta del usuario: ${userQuestion}

Responde basándote en los datos disponibles. Si preguntan por el marcador exacto de un partido, indica honestamente que no tienes acceso a esa información en tiempo real, pero explica el resultado de la apuesta (Won/Lost) según los datos del ticket.`;

        const fallbackResult = await this.openaiService.chat([
          { role: 'user', content: fallbackPrompt },
        ]);

        return fallbackResult.content;
      } catch (fallbackError) {
        this.logger.error(`Fallback also failed: ${fallbackError.message}`);
        return 'Lo siento, hubo un error al procesar tu pregunta. ¿Podrías reformularla?';
      }
    }
  }

  private buildVisionContent(dto: AnalyzeImageDto): VisionContent[] {
    const content: VisionContent[] = [];
    const prompts = ANALYSIS_PROMPTS[dto.analysisType];

    // Add text prompt
    let textPrompt = prompts.userPrompt;
    if (dto.additionalContext) {
      textPrompt += `\n\nContexto adicional: ${dto.additionalContext}`;
    }

    content.push({
      type: 'text',
      text: textPrompt,
    });

    // Add images
    for (const image of dto.images) {
      if (image.base64) {
        content.push({
          type: 'image_url',
          image_url: {
            url: this.openaiService.buildImageUrl(image.base64, image.mimeType),
            detail: 'high',
          },
        });
      } else if (image.url) {
        content.push({
          type: 'image_url',
          image_url: {
            url: image.url,
            detail: 'high',
          },
        });
      }
    }

    return content;
  }

  private parseResponse(
    analysisType: AnalysisType,
    content: string,
  ): ExtractedTicketData | ExtractedDocumentData | FaceVerificationData | undefined {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('No JSON found in response');
        return undefined;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      switch (analysisType) {
        case AnalysisType.TICKET_VERIFICATION:
          return this.validateTicketData(parsed);
        case AnalysisType.KYC_DOCUMENT:
          return this.validateDocumentData(parsed);
        case AnalysisType.KYC_SELFIE:
          return this.validateSelfieData(parsed);
        default:
          return parsed;
      }
    } catch (error) {
      this.logger.warn(`Failed to parse response as JSON: ${error.message}`);
      return undefined;
    }
  }

  private validateTicketData(data: any): ExtractedTicketData {
    return {
      ticketId: data.ticketId || undefined,
      amount: typeof data.amount === 'number' ? data.amount : undefined,
      currency: data.currency || undefined,
      date: data.date || undefined,
      events: Array.isArray(data.events) ? data.events : undefined,
      status: data.status || undefined,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
    };
  }

  private validateDocumentData(data: any): ExtractedDocumentData {
    return {
      documentType: data.documentType || undefined,
      documentNumber: data.documentNumber || undefined,
      fullName: data.fullName || undefined,
      firstName: data.firstName || undefined,
      lastName: data.lastName || undefined,
      dateOfBirth: data.dateOfBirth || undefined,
      expirationDate: data.expirationDate || undefined,
      nationality: data.nationality || undefined,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
    };
  }

  private validateSelfieData(data: any): FaceVerificationData {
    return {
      facesDetected: typeof data.facesDetected === 'number' ? data.facesDetected : 0,
      matchConfidence:
        typeof data.matchConfidence === 'number' ? data.matchConfidence : undefined,
      isHoldingDocument: Boolean(data.isHoldingDocument),
      documentVisible: Boolean(data.documentVisible),
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
    };
  }
}
