import { Injectable, Logger } from '@nestjs/common';
import { MicroservicesClientService } from './services/microservices-client.service';
import { TicketVerificationService } from './services/ticket-verification.service';
import { KYCVerificationService } from './services/kyc-verification.service';
import { MultimodalService } from '../multimodal/multimodal.service';
import { ChatService } from '../chat/chat.service';
import { ProcessMessageDto } from './dto/process-message.dto';
import {
  FlowType,
  ProcessingStatus,
  TicketVerificationResult,
  KYCVerificationResult,
} from './interfaces/orchestrator.types';
import { MessageRole, ContentType } from '../chat/schemas/chat-message.schema';

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly microservicesClient: MicroservicesClientService,
    private readonly ticketVerificationService: TicketVerificationService,
    private readonly kycVerificationService: KYCVerificationService,
    private readonly multimodalService: MultimodalService,
    private readonly chatService: ChatService,
  ) {}

  async processMessage(
    dto: ProcessMessageDto,
    onStatusUpdate?: (status: ProcessingStatus) => void,
  ): Promise<{ response: string; flowType: FlowType }> {
    const hasImages = dto.images && dto.images.length > 0;
    const hasText = dto.content && dto.content.trim().length > 0;

    // Determine flow type based on content
    let flowType = FlowType.GENERAL_QUERY;

    if (hasText) {
      // Analyze text to determine intent
      const intent = await this.microservicesClient.classifyIntent(dto.content!);

      if (intent) {
        switch (intent.type) {
          case 'ticket_verification':
            flowType = FlowType.TICKET_VERIFICATION;
            break;
          case 'kyc_start':
          case 'kyc_upload':
            flowType = FlowType.KYC_DOCUMENT;
            break;
          default:
            flowType = FlowType.GENERAL_QUERY;
        }
      }
    }

    // If there are images, analyze them to determine flow
    if (hasImages && flowType === FlowType.GENERAL_QUERY) {
      const imageBase64 = dto.images![0].base64!;

      // Use GPT-4 Vision to analyze what type of image it is
      const visionResult = await this.multimodalService.analyzeImage({
        analysisType: 'general' as any,
        images: [{ base64: imageBase64 }],
        additionalContext:
          'Determina si esta imagen es: 1) Un ticket de apuesta, 2) Un documento de identidad (cédula), 3) Una selfie con documento, o 4) Otro tipo de imagen.',
      });

      if (visionResult.success) {
        const responseText = visionResult.rawResponse.toLowerCase();

        if (
          responseText.includes('ticket') ||
          responseText.includes('apuesta') ||
          responseText.includes('boleto')
        ) {
          flowType = FlowType.TICKET_VERIFICATION;
        } else if (
          responseText.includes('cédula') ||
          responseText.includes('cedula') ||
          responseText.includes('documento') ||
          responseText.includes('identidad')
        ) {
          flowType = FlowType.KYC_DOCUMENT;
        } else if (
          responseText.includes('selfie') ||
          responseText.includes('rostro') ||
          responseText.includes('persona')
        ) {
          flowType = FlowType.KYC_SELFIE;
        }
      }
    }

    // Process based on flow type
    let response: string;

    switch (flowType) {
      case FlowType.TICKET_VERIFICATION:
        if (hasImages) {
          response = await this.handleTicketVerification(
            dto.images![0].base64!,
            onStatusUpdate,
          );
        } else {
          response =
            'Para verificar tu ticket, por favor envía una foto o captura de pantalla del mismo.';
        }
        break;

      case FlowType.KYC_DOCUMENT:
        if (hasImages && dto.playerId) {
          response = await this.handleDocumentVerification(
            dto.images![0].base64!,
            dto.playerId,
            onStatusUpdate,
          );
        } else if (!dto.playerId) {
          response =
            'Para verificar tu identidad, necesitas estar logueado en tu cuenta.';
        } else {
          response =
            'Para iniciar la verificación KYC, por favor envía una foto del frente de tu cédula.';
        }
        break;

      case FlowType.KYC_SELFIE:
        if (hasImages && dto.playerId) {
          response = await this.handleSelfieVerification(
            dto.images![0].base64!,
            dto.playerId,
            onStatusUpdate,
          );
        } else {
          response =
            'Por favor, envía una selfie sosteniendo tu documento de identidad.';
        }
        break;

      default:
        response = await this.handleGeneralQuery(dto.content || '', dto.images);
        break;
    }

    // Save assistant response to chat history
    await this.chatService.addMessage(dto.sessionId, {
      role: MessageRole.ASSISTANT,
      content: { type: ContentType.TEXT, text: response },
    });

    return { response, flowType };
  }

  private async handleTicketVerification(
    imageBase64: string,
    onStatusUpdate?: (status: ProcessingStatus) => void,
  ): Promise<string> {
    const result = await this.ticketVerificationService.verifyTicket(
      imageBase64,
      onStatusUpdate,
    );
    return this.ticketVerificationService.formatTicketResponse(result);
  }

  private async handleDocumentVerification(
    imageBase64: string,
    playerId: string,
    onStatusUpdate?: (status: ProcessingStatus) => void,
  ): Promise<string> {
    const result = await this.kycVerificationService.verifyDocument(
      { frontImage: imageBase64 },
      playerId,
      onStatusUpdate,
    );
    return this.kycVerificationService.formatKYCResponse(result);
  }

  private async handleSelfieVerification(
    imageBase64: string,
    playerId: string,
    onStatusUpdate?: (status: ProcessingStatus) => void,
  ): Promise<string> {
    // For selfie verification, we need the document number
    // In a real scenario, this would come from the session/previous steps
    const result = await this.kycVerificationService.verifySelfie(
      { selfieImage: imageBase64, documentNumber: 'pending' },
      playerId,
      onStatusUpdate,
    );
    return this.kycVerificationService.formatKYCResponse(result);
  }

  private async handleGeneralQuery(
    text: string,
    images?: ProcessMessageDto['images'],
  ): Promise<string> {
    // For general queries, use GPT-4 Vision if there are images
    if (images && images.length > 0) {
      const visionResult = await this.multimodalService.analyzeImage({
        analysisType: 'general' as any,
        images: images.map((img) => ({ base64: img.base64 })),
        additionalContext: text,
      });

      if (visionResult.success) {
        return visionResult.rawResponse;
      }
    }

    // For text-only queries, analyze intent and provide appropriate response
    if (text) {
      const nlpResult = await this.microservicesClient.analyzeText(text);

      if (nlpResult) {
        // Check for common intents
        switch (nlpResult.intent.type) {
          case 'greeting':
            return '¡Hola! Soy el asistente virtual de Sorti365. ¿En qué puedo ayudarte hoy? Puedo ayudarte a:\n\n• Verificar tickets de apuestas (envía una foto)\n• Verificar tu identidad (KYC)\n• Responder preguntas sobre tu cuenta';

          case 'farewell':
            return '¡Hasta luego! Si necesitas algo más, no dudes en escribirme. ¡Buena suerte! 🍀';

          case 'account_query':
            return 'Para consultas sobre tu cuenta, por favor proporciona más detalles sobre lo que necesitas. Puedo ayudarte con:\n\n• Estado de tu cuenta\n• Historial de apuestas\n• Verificación de identidad';

          case 'bet_history':
            return 'Para ver tu historial de apuestas, por favor accede a tu cuenta en la aplicación de Sorti365. Si tienes un ticket específico que quieres verificar, envíame una foto del mismo.';

          case 'complaint':
            return 'Lamento que estés teniendo problemas. Por favor, describe tu situación con más detalle para que pueda ayudarte mejor. Si es un problema urgente, te recomiendo contactar a nuestro equipo de soporte.';

          default:
            return `Entiendo que quieres saber sobre "${text}". ¿Podrías darme más detalles? Puedo ayudarte con:\n\n• Verificación de tickets\n• Verificación de identidad (KYC)\n• Información general sobre Sorti365`;
        }
      }
    }

    return 'Hola, soy el asistente de Sorti365. ¿En qué puedo ayudarte? Puedes enviarme fotos de tickets para verificarlos o iniciar tu proceso de verificación de identidad.';
  }

  async getServicesHealth(): Promise<{
    ocr: boolean;
    nlp: boolean;
    clustering: boolean;
    openai: boolean;
  }> {
    const pythonServices = await this.microservicesClient.checkAllServicesHealth();

    return {
      ...pythonServices,
      openai: true, // OpenAI is checked differently through multimodal service
    };
  }
}
