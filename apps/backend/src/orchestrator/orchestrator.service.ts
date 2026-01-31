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
  ProcessingStep,
} from './interfaces/orchestrator.types';
import { MessageRole, ContentType } from '../chat/schemas/chat-message.schema';
import { KYCStep } from '../chat/schemas/chat-session.schema';

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
        } else if (hasText) {
          // Try to extract ticket ID from text
          const ticketIdFromText = this.extractTicketId(dto.content!);

          if (ticketIdFromText) {
            this.logger.log(`Ticket ID extracted from text: ${ticketIdFromText}`);
            response = await this.handleTicketVerificationByText(
              dto.sessionId,
              ticketIdFromText,
              dto.content!,
              onStatusUpdate,
            );
          } else {
            response =
              'Para verificar tu ticket, por favor envía el número de ticket (ej: 0000085426) o una foto del mismo.';
          }
        } else {
          response =
            'Para verificar tu ticket, por favor envía el número de ticket o una foto del mismo.';
        }
        break;

      case FlowType.KYC_DOCUMENT:
      case FlowType.KYC_SELFIE:
        response = await this.handleKYCFlow(
          dto.sessionId,
          dto.playerId,
          hasImages ? dto.images![0].base64! : undefined,
          onStatusUpdate,
        );
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

  /**
   * Handle ticket verification when user provides ticket ID via text (no image)
   */
  private async handleTicketVerificationByText(
    sessionId: string,
    ticketId: string,
    userQuestion: string,
    onStatusUpdate?: (status: ProcessingStatus) => void,
  ): Promise<string> {
    if (onStatusUpdate) {
      onStatusUpdate({
        step: ProcessingStep.QUERYING_API,
        message: 'Buscando ticket en el sistema...',
        progress: 30,
        timestamp: new Date(),
      });
    }

    // Search for the ticket in the backoffice database
    const betResult = await this.backofficeService.findBetByLocalId(ticketId);

    if (!betResult.found || !betResult.bet) {
      return `No encontré ninguna apuesta con el ID ${ticketId}. Por favor verifica que el número sea correcto o envíame una foto del ticket para ayudarte mejor.`;
    }

    if (onStatusUpdate) {
      onStatusUpdate({
        step: ProcessingStep.GENERATING_RESPONSE,
        message: 'Ticket encontrado, procesando información...',
        progress: 70,
        timestamp: new Date(),
      });
    }

    // Save ticket context for follow-up questions
    const betData = JSON.parse(JSON.stringify(betResult.bet));
    await this.chatService.setLastVerifiedTicket(
      sessionId,
      ticketId,
      betData,
    );
    this.logger.log(`Ticket context saved for session ${sessionId}, ticket ${ticketId}`);

    if (onStatusUpdate) {
      onStatusUpdate({
        step: ProcessingStep.COMPLETED,
        message: 'Verificación completada',
        progress: 100,
        timestamp: new Date(),
      });
    }

    // Format response with ticket information
    let response = this.backofficeService.formatBetResponse(betResult.bet, userQuestion);

    // Add follow-up prompt
    response += '\n\n---\n💬 **¿Tienes alguna pregunta sobre este ticket?** Puedo explicarte por qué ganaste o perdiste, detalles de los eventos, o cualquier otra duda. También puedes decir "otra cosa" para cambiar de tema.';

    return response;
  }

  /**
   * Handle the complete KYC flow with 3 steps:
   * 1. Front document - extract and validate document number
   * 2. Back document - validate visibility
   * 3. Selfie - compare face with document
   */
  private async handleKYCFlow(
    sessionId: string,
    playerId: string | undefined,
    imageBase64: string | undefined,
    onStatusUpdate?: (status: ProcessingStatus) => void,
  ): Promise<string> {
    // Check if player is logged in
    if (!playerId) {
      return 'Para verificar tu identidad, necesitas estar logueado en tu cuenta.';
    }

    // Get player info
    const playerResult = await this.backofficeService.findPlayerByAccountPlayerId(playerId);

    if (!playerResult.found || !playerResult.player) {
      return 'No pude verificar tu cuenta en nuestro sistema. Por favor, asegúrate de estar logueado correctamente.';
    }

    const playerName = this.backofficeService.getPlayerDisplayName(playerResult.player);

    // Check if player is already verified
    if (this.backofficeService.isPlayerVerified(playerResult.player)) {
      return `¡Hola ${playerName}! Tu cuenta ya se encuentra **verificada** ✅\n\nNo necesitas realizar el proceso de verificación KYC nuevamente.\n\n¿Hay algo más en lo que pueda ayudarte?\n\n• Verificar tickets de apuestas\n• Consultas sobre tu cuenta`;
    }

    // Get current KYC state
    let kycState = await this.chatService.getKYCState(sessionId);

    // If no KYC process started and no image, show instructions
    if (!kycState && !imageBase64) {
      await this.chatService.initKYCProcess(sessionId);
      return `¡Hola ${playerName}! Para iniciar la verificación KYC, necesito que envíes los siguientes documentos:\n\n1️⃣ **Foto del frente de tu cédula** (documento de identidad)\n2️⃣ **Foto del reverso de tu cédula**\n3️⃣ **Selfie sosteniendo tu cédula**\n\nComencemos con la foto del **frente de tu cédula**. Por favor envíala ahora.`;
    }

    // Initialize KYC if not started
    if (!kycState) {
      await this.chatService.initKYCProcess(sessionId);
      kycState = await this.chatService.getKYCState(sessionId);
    }

    // No image provided but KYC in progress
    if (!imageBase64) {
      switch (kycState!.currentStep) {
        case KYCStep.FRONT_DOCUMENT:
          return `${playerName}, estamos esperando la **foto del frente de tu cédula**. Por favor envíala para continuar.`;
        case KYCStep.BACK_DOCUMENT:
          return `${playerName}, estamos esperando la **foto del reverso de tu cédula**. Por favor envíala para continuar.`;
        case KYCStep.SELFIE:
          return `${playerName}, estamos esperando tu **selfie sosteniendo la cédula**. Por favor envíala para completar la verificación.`;
        default:
          return `${playerName}, ¿en qué puedo ayudarte?`;
      }
    }

    // Process image based on current step
    switch (kycState!.currentStep) {
      case KYCStep.FRONT_DOCUMENT:
      case KYCStep.NOT_STARTED:
        return await this.processKYCFrontDocument(sessionId, playerId, playerName, imageBase64, onStatusUpdate);

      case KYCStep.BACK_DOCUMENT:
        return await this.processKYCBackDocument(sessionId, playerName, imageBase64, onStatusUpdate);

      case KYCStep.SELFIE:
        return await this.processKYCSelfie(sessionId, playerId, playerName, imageBase64, onStatusUpdate);

      case KYCStep.COMPLETED:
        return `¡${playerName}, tu verificación KYC ya fue completada! ✅`;

      default:
        await this.chatService.initKYCProcess(sessionId);
        return await this.processKYCFrontDocument(sessionId, playerId, playerName, imageBase64, onStatusUpdate);
    }
  }

  /**
   * Process Step 1: Front document verification
   */
  private async processKYCFrontDocument(
    sessionId: string,
    playerId: string,
    playerName: string,
    imageBase64: string,
    onStatusUpdate?: (status: ProcessingStatus) => void,
  ): Promise<string> {
    this.logger.log(`Processing KYC front document for session ${sessionId}`);

    const result = await this.kycVerificationService.verifyFrontDocument(
      imageBase64,
      playerId,
      onStatusUpdate,
    );

    if (!result.success) {
      let response = `❌ **Problema con el documento frontal**\n\n`;
      for (const error of result.validationErrors) {
        response += `• ${error}\n`;
      }
      response += `\nPor favor, envía una nueva foto del **frente de tu cédula**.`;
      return response;
    }

    // Save front document data and move to next step
    await this.chatService.updateKYCFrontDocument(sessionId, {
      documentNumber: result.documentNumber!,
      fullName: result.fullName || '',
      dateOfBirth: result.dateOfBirth,
      frontImageBase64: imageBase64,
    });

    return `✅ **Documento frontal verificado**\n\n**Datos extraídos:**\n• Número: ${result.documentNumber}\n• Nombre: ${result.fullName || 'N/A'}\n${result.dateOfBirth ? `• Fecha de nacimiento: ${result.dateOfBirth}\n` : ''}\n---\n\n📸 Ahora envía la **foto del reverso de tu cédula**.`;
  }

  /**
   * Process Step 2: Back document verification
   */
  private async processKYCBackDocument(
    sessionId: string,
    _playerName: string,
    imageBase64: string,
    onStatusUpdate?: (status: ProcessingStatus) => void,
  ): Promise<string> {
    this.logger.log(`Processing KYC back document for session ${sessionId}`);

    const result = await this.kycVerificationService.verifyBackDocument(
      imageBase64,
      onStatusUpdate,
    );

    if (!result.success) {
      let response = `❌ **Problema con el reverso del documento**\n\n`;
      for (const error of result.validationErrors) {
        response += `• ${error}\n`;
      }
      response += `\nPor favor, envía una nueva foto del **reverso de tu cédula**.`;
      return response;
    }

    // Save back document and move to selfie step
    await this.chatService.updateKYCBackDocument(sessionId, imageBase64);

    return `✅ **Reverso del documento verificado**\n\n---\n\n🤳 Ahora envía una **selfie sosteniendo tu cédula**.\n\n**Consejos:**\n• Sostén la cédula junto a tu rostro\n• Asegúrate de que ambos (rostro y cédula) sean visibles\n• Buena iluminación ayuda a la verificación`;
  }

  /**
   * Process Step 3: Selfie verification and complete KYC
   */
  private async processKYCSelfie(
    sessionId: string,
    playerId: string,
    _playerName: string,
    imageBase64: string,
    onStatusUpdate?: (status: ProcessingStatus) => void,
  ): Promise<string> {
    this.logger.log(`Processing KYC selfie for session ${sessionId}`);

    // Get the saved front document image for comparison
    const kycState = await this.chatService.getKYCState(sessionId);

    if (!kycState || !kycState.frontImageBase64 || !kycState.documentNumber) {
      // Reset and start over
      await this.chatService.clearKYCState(sessionId);
      return `❌ Hubo un problema con tu verificación. Por favor, comienza de nuevo enviando la **foto del frente de tu cédula**.`;
    }

    const result = await this.kycVerificationService.verifySelfieWithDocument(
      imageBase64,
      kycState.frontImageBase64,
      kycState.documentNumber,
      onStatusUpdate,
    );

    if (!result.success) {
      let response = `❌ **Problema con la selfie**\n\n`;
      for (const error of result.validationErrors) {
        response += `• ${error}\n`;
      }
      response += `\nPor favor, envía una nueva **selfie sosteniendo tu cédula**.`;
      return response;
    }

    // All steps completed successfully - update player verification status and documentNumber
    const updateResult = await this.backofficeService.setPlayerVerified(playerId, kycState.documentNumber);

    if (!updateResult.success) {
      this.logger.error(`Failed to update player verification: ${updateResult.error}`);
      return `✅ Verificación completada pero hubo un problema al actualizar tu cuenta. Por favor, contacta a soporte.`;
    }

    // Mark KYC as completed in session
    await this.chatService.completeKYCProcess(sessionId);

    return `✅ **¡Verificación KYC Exitosa!**\n\n**Documento verificado:**\n• Número: ${kycState.documentNumber}\n• Nombre: ${kycState.fullName}\n${kycState.dateOfBirth ? `• Fecha de nacimiento: ${kycState.dateOfBirth}\n` : ''}\n🎉 **¡Tu cuenta ha sido verificada correctamente!**\n\nAhora tienes acceso completo a todas las funciones de Sorti365.`
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
