import { Injectable, Logger } from '@nestjs/common';
import { MicroservicesClientService } from './services/microservices-client.service';
import { TicketVerificationService } from './services/ticket-verification.service';
import { KYCVerificationService } from './services/kyc-verification.service';
import { MultimodalService } from '../multimodal/multimodal.service';
import { ChatService } from '../chat/chat.service';
import { BackofficeService } from '../backoffice/backoffice.service';
import { ProcessMessageDto } from './dto/process-message.dto';
import {
  FlowType,
  ProcessingStatus,
} from './interfaces/orchestrator.types';
import { MessageRole, ContentType } from '../chat/schemas/chat-message.schema';

// Keywords that indicate user wants to exit ticket context
const EXIT_CONTEXT_KEYWORDS = [
  'otra cosa', 'otro tema', 'cambiar', 'salir', 'consulta general',
  'nuevo ticket', 'otra apuesta', 'diferente', 'no, gracias', 'eso es todo',
  'nada más', 'nada mas', 'listo', 'ok gracias', 'ok, gracias'
];

// Keywords that indicate follow-up question about ticket
const TICKET_FOLLOWUP_KEYWORDS = [
  'por qué', 'porque', 'por que', 'perdí', 'perdi', 'gané', 'gane',
  'explica', 'entiendo', 'cómo', 'como', 'qué pasó', 'que paso',
  'resultado', 'evento', 'partido', 'cuota', 'monto', 'apuesta',
  'detalle', 'más info', 'mas info', 'dime más', 'dime mas'
];

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly microservicesClient: MicroservicesClientService,
    private readonly ticketVerificationService: TicketVerificationService,
    private readonly kycVerificationService: KYCVerificationService,
    private readonly multimodalService: MultimodalService,
    private readonly chatService: ChatService,
    private readonly backofficeService: BackofficeService,
  ) {}

  async processMessage(
    dto: ProcessMessageDto,
    onStatusUpdate?: (status: ProcessingStatus) => void,
  ): Promise<{ response: string; flowType: FlowType }> {
    const hasImages = dto.images && dto.images.length > 0;
    const hasText = dto.content && dto.content.trim().length > 0;
    const textLower = (dto.content || '').toLowerCase();

    // Check if there's an active ticket context
    const ticketContext = await this.chatService.getLastVerifiedTicket(dto.sessionId);

    // If user wants to exit ticket context
    if (ticketContext && hasText) {
      const wantsToExit = EXIT_CONTEXT_KEYWORDS.some(kw => textLower.includes(kw));
      if (wantsToExit) {
        await this.chatService.clearTicketContext(dto.sessionId);
        const response = '¡Perfecto! He salido del contexto del ticket. ¿En qué más puedo ayudarte?\n\n• Verificar otro ticket (envía foto o ID)\n• Verificación de identidad (KYC)\n• Consulta general';

        await this.chatService.addMessage(dto.sessionId, {
          role: MessageRole.ASSISTANT,
          content: { type: ContentType.TEXT, text: response },
        });

        return { response, flowType: FlowType.GENERAL_QUERY };
      }
    }

    // If there's active ticket context and user has a follow-up question (no new image)
    if (ticketContext && hasText && !hasImages) {
      const isFollowUp = TICKET_FOLLOWUP_KEYWORDS.some(kw => textLower.includes(kw));

      if (isFollowUp) {
        this.logger.log(`Processing follow-up question for ticket ${ticketContext.ticketId}`);

        const response = await this.multimodalService.generateTicketContextResponse(
          dto.content!,
          ticketContext.betData,
        );

        await this.chatService.addMessage(dto.sessionId, {
          role: MessageRole.ASSISTANT,
          content: { type: ContentType.TEXT, text: response },
        });

        return { response, flowType: FlowType.TICKET_VERIFICATION };
      }
    }

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
          const verificationResult = await this.handleTicketVerificationWithContext(
            dto.sessionId,
            dto.images![0].base64!,
            onStatusUpdate,
            dto.content,
          );
          response = verificationResult;
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

  /**
   * Handle ticket verification and save context for follow-up questions
   */
  private async handleTicketVerificationWithContext(
    sessionId: string,
    imageBase64: string,
    onStatusUpdate?: (status: ProcessingStatus) => void,
    userQuestion?: string,
  ): Promise<string> {
    const result = await this.ticketVerificationService.verifyTicket(
      imageBase64,
      onStatusUpdate,
      userQuestion,
    );

    // If verification was successful and we have bet data, save context
    if (result.success && result.bet && result.ticketId) {
      await this.chatService.setLastVerifiedTicket(
        sessionId,
        result.ticketId,
        result.bet as Record<string, unknown>,
      );
      this.logger.log(`Ticket context saved for session ${sessionId}, ticket ${result.ticketId}`);
    }

    // Format response and add follow-up prompt
    let response = this.ticketVerificationService.formatTicketResponse(result);

    if (result.success) {
      response += '\n\n---\n💬 **¿Tienes alguna pregunta sobre este ticket?** Puedo explicarte por qué ganaste o perdiste, detalles de los eventos, o cualquier otra duda. También puedes decir "otra cosa" para cambiar de tema.';
    }

    return response;
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

  /**
   * Extraer ID de ticket del texto del usuario
   * Busca patrones como: 000085426, #85426, ticket 85426, id 85426, etc.
   */
  private extractTicketId(text: string): string | null {
    // Patrones para detectar IDs de tickets
    const patterns = [
      /(?:ticket|id|#|número|numero)\s*[:=]?\s*(\d{4,10})/i,
      /(\d{8,10})/,  // Números de 8-10 dígitos
      /(?:^|\s)(0{2,}\d{4,})/,  // Números que empiezan con ceros como 0000001223
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private async handleGeneralQuery(
    text: string,
    images?: ProcessMessageDto['images'],
  ): Promise<string> {
    // Primero, verificar si el usuario está preguntando por un ticket específico
    const ticketId = this.extractTicketId(text);

    if (ticketId) {
      this.logger.log(`Detected ticket ID in text: ${ticketId}`);

      // Buscar el ticket en la base de datos del backoffice
      const betResult = await this.backofficeService.findBetByLocalId(ticketId);

      if (betResult.found && betResult.bet) {
        // Formatear respuesta con la información real del ticket
        return this.backofficeService.formatBetResponse(betResult.bet, text);
      } else {
        return `No encontré ninguna apuesta con el ID ${ticketId}. Por favor verifica que el número sea correcto o envíame una foto del ticket para ayudarte mejor.`;
      }
    }

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
      // Verificar si mencionan un ticket pero sin ID
      const ticketKeywords = ['ticket', 'apuesta', 'boleto', 'jugada'];
      const mentionsTicket = ticketKeywords.some(kw => text.toLowerCase().includes(kw));

      if (mentionsTicket) {
        return '¿Quieres que revise un ticket? Por favor proporciona el ID del ticket (el número que aparece en tu comprobante) o envíame una foto del mismo.';
      }

      const nlpResult = await this.microservicesClient.analyzeText(text);

      if (nlpResult) {
        // Check for common intents
        switch (nlpResult.intent.type) {
          case 'greeting':
            return '¡Hola! Soy el asistente virtual de Sorti365. ¿En qué puedo ayudarte hoy? Puedo ayudarte a:\n\n• Verificar tickets de apuestas (envía el ID o una foto)\n• Verificar tu identidad (KYC)\n• Responder preguntas sobre tu cuenta';

          case 'farewell':
            return '¡Hasta luego! Si necesitas algo más, no dudes en escribirme. ¡Buena suerte! 🍀';

          case 'account_query':
            return 'Para consultas sobre tu cuenta, por favor proporciona más detalles sobre lo que necesitas. Puedo ayudarte con:\n\n• Estado de tu cuenta\n• Historial de apuestas\n• Verificación de identidad';

          case 'bet_history':
            return 'Para ver tu historial de apuestas, por favor accede a tu cuenta en la aplicación de Sorti365. Si tienes un ticket específico que quieres verificar, proporciona el ID o envíame una foto del mismo.';

          case 'complaint':
            return 'Lamento que estés teniendo problemas. Por favor, describe tu situación con más detalle para que pueda ayudarte mejor. Si es un problema urgente, te recomiendo contactar a nuestro equipo de soporte.';

          default:
            return `Entiendo que quieres saber sobre "${text}". ¿Podrías darme más detalles? Puedo ayudarte con:\n\n• Verificación de tickets (proporciona el ID)\n• Verificación de identidad (KYC)\n• Información general sobre Sorti365`;
        }
      }
    }

    return 'Hola, soy el asistente de Sorti365. ¿En qué puedo ayudarte? Puedes enviarme el ID de un ticket o una foto para verificarlo, o iniciar tu proceso de verificación de identidad.';
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
