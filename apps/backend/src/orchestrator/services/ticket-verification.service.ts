import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { MicroservicesClientService } from './microservices-client.service';
import { MultimodalService } from '../../multimodal/multimodal.service';
import { BackofficeService } from '../../backoffice/backoffice.service';
import {
  ProcessingStep,
  ProcessingStatus,
  TicketVerificationResult,
} from '../interfaces/orchestrator.types';

export type StatusCallback = (status: ProcessingStatus) => void;

@Injectable()
export class TicketVerificationService {
  private readonly logger = new Logger(TicketVerificationService.name);

  constructor(
    private readonly microservicesClient: MicroservicesClientService,
    private readonly multimodalService: MultimodalService,
    @Inject(forwardRef(() => BackofficeService))
    private readonly backofficeService: BackofficeService,
  ) {}

  async verifyTicket(
    imageBase64: string,
    onStatusUpdate?: StatusCallback,
    userQuestion?: string,
  ): Promise<TicketVerificationResult> {
    const updateStatus = (step: ProcessingStep, message: string, progress: number) => {
      if (onStatusUpdate) {
        onStatusUpdate({ step, message, progress, timestamp: new Date() });
      }
    };

    try {
      // Step 1: Receive image
      updateStatus(ProcessingStep.RECEIVED, 'Imagen recibida', 10);

      // Step 2: Analyze image with GPT-4 Vision to extract ticket ID
      updateStatus(
        ProcessingStep.ANALYZING_IMAGE,
        'Analizando imagen con IA...',
        20,
      );

      const visionResult = await this.multimodalService.analyzeTicket(
        [{ base64: imageBase64 }],
      );

      let ticketId: string | undefined;
      let confidence = 0;

      if (visionResult.success && visionResult.extractedData) {
        const data = visionResult.extractedData as { ticketId?: string; confidence?: number };
        ticketId = data.ticketId || undefined;
        confidence = data.confidence || 0;
        this.logger.log(`GPT-4 Vision extracted ticketId: ${ticketId} with confidence: ${confidence}`);
      }

      // Step 3: If Vision didn't find ticket ID, try OCR as fallback
      if (!ticketId) {
        updateStatus(
          ProcessingStep.EXTRACTING_TEXT,
          'Extrayendo texto con OCR...',
          40,
        );

        try {
          const ocrResult = await this.microservicesClient.extractTicketData(imageBase64);

          if (ocrResult.success && ocrResult.ticket_id) {
            ticketId = ocrResult.ticket_id;
            confidence = ocrResult.confidence || 0.7;
            this.logger.log(`OCR extracted ticketId: ${ticketId}`);
          }
        } catch (ocrError) {
          this.logger.warn(`OCR fallback failed: ${ocrError}`);
        }
      }

      // If still no ticket ID, return error
      if (!ticketId) {
        updateStatus(ProcessingStep.ERROR, 'No se pudo identificar el ticket', 100);
        return {
          success: false,
          confidence: 0,
          error: 'No se pudo identificar el número de ticket en la imagen. Por favor, asegúrate de que el número del ticket sea visible y legible.',
        };
      }

      // Step 4: Query Backoffice database
      updateStatus(
        ProcessingStep.QUERYING_API,
        `Consultando ticket ${ticketId}...`,
        60,
      );

      const betResult = await this.backofficeService.findBetByLocalId(ticketId);

      if (!betResult.found || !betResult.bet) {
        updateStatus(ProcessingStep.ERROR, 'Ticket no encontrado', 100);
        return {
          success: false,
          ticketId,
          confidence,
          error: `No se encontró ninguna apuesta con el ID ${ticketId}. Por favor verifica que el número sea correcto.`,
        };
      }

      // Step 5: Generate response
      updateStatus(
        ProcessingStep.GENERATING_RESPONSE,
        'Generando respuesta...',
        80,
      );

      // Step 6: Complete
      updateStatus(ProcessingStep.COMPLETED, 'Verificación completada', 100);

      return {
        success: true,
        ticketId,
        bet: betResult.bet,
        confidence,
        userQuestion,
      };
    } catch (error) {
      this.logger.error(`Ticket verification failed: ${error}`);
      updateStatus(ProcessingStep.ERROR, 'Error en la verificación', 100);

      return {
        success: false,
        confidence: 0,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  formatTicketResponse(result: TicketVerificationResult): string {
    if (!result.success) {
      return `Lo siento, ${result.error}`;
    }

    // If we have a bet from backoffice, use its formatting
    if (result.bet) {
      return this.backofficeService.formatBetResponse(result.bet, result.userQuestion);
    }

    // Fallback if somehow we have success but no bet data
    return `Ticket ${result.ticketId} encontrado pero sin datos disponibles.`;
  }
}
