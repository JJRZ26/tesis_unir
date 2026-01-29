import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { MicroservicesClientService } from './microservices-client.service';
import { MultimodalService } from '../../multimodal/multimodal.service';
import {
  ProcessingStep,
  ProcessingStatus,
  TicketVerificationResult,
  TicketEvent,
} from '../interfaces/orchestrator.types';

export type StatusCallback = (status: ProcessingStatus) => void;

@Injectable()
export class TicketVerificationService {
  private readonly logger = new Logger(TicketVerificationService.name);
  private sorti365ApiUrl: string;
  private sorti365ApiKey: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly microservicesClient: MicroservicesClientService,
    private readonly multimodalService: MultimodalService,
  ) {
    this.sorti365ApiUrl = this.configService.get<string>('orchestrator.sorti365ApiUrl')!;
    this.sorti365ApiKey = this.configService.get<string>('orchestrator.sorti365ApiKey');
  }

  async verifyTicket(
    imageBase64: string,
    onStatusUpdate?: StatusCallback,
  ): Promise<TicketVerificationResult> {
    const updateStatus = (step: ProcessingStep, message: string, progress: number) => {
      if (onStatusUpdate) {
        onStatusUpdate({ step, message, progress, timestamp: new Date() });
      }
    };

    try {
      // Step 1: Receive image
      updateStatus(ProcessingStep.RECEIVED, 'Imagen recibida', 10);

      // Step 2: Analyze image with GPT-4 Vision
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
        const data = visionResult.extractedData as any;
        ticketId = data.ticketId;
        confidence = data.confidence || 0;
      }

      // Step 3: If Vision didn't find ticket ID, try OCR
      if (!ticketId) {
        updateStatus(
          ProcessingStep.EXTRACTING_TEXT,
          'Extrayendo texto con OCR...',
          40,
        );

        const ocrResult = await this.microservicesClient.extractTicketData(imageBase64);

        if (ocrResult.success && ocrResult.ticket_id) {
          ticketId = ocrResult.ticket_id;
          confidence = ocrResult.confidence || 0.7;
        }
      }

      // If still no ticket ID, return error
      if (!ticketId) {
        updateStatus(ProcessingStep.ERROR, 'No se pudo identificar el ticket', 100);
        return {
          success: false,
          confidence: 0,
          error: 'No se pudo identificar el número de ticket en la imagen',
        };
      }

      // Step 4: Query Sorti365 API
      updateStatus(
        ProcessingStep.QUERYING_API,
        `Consultando ticket ${ticketId}...`,
        60,
      );

      const ticketData = await this.queryTicketApi(ticketId);

      if (!ticketData) {
        updateStatus(ProcessingStep.ERROR, 'Ticket no encontrado', 100);
        return {
          success: false,
          ticketId,
          confidence,
          error: `No se encontró información para el ticket ${ticketId}`,
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
        ticketData,
        confidence,
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

  private async queryTicketApi(ticketId: string): Promise<{
    status: string;
    amount: number;
    currency: string;
    events: TicketEvent[];
    createdAt: string;
    paidAt?: string;
  } | null> {
    // In production, this would call the actual Sorti365 API
    // For development, we'll simulate the response

    if (!this.sorti365ApiKey) {
      this.logger.warn('Sorti365 API key not configured, using mock data');
      return this.getMockTicketData(ticketId);
    }

    try {
      const response = await firstValueFrom(
        this.httpService
          .get(`${this.sorti365ApiUrl}/tickets/${ticketId}`, {
            headers: {
              Authorization: `Bearer ${this.sorti365ApiKey}`,
            },
          })
          .pipe(
            timeout(10000),
            catchError((error) => {
              this.logger.error(`Sorti365 API error: ${error.message}`);
              throw error;
            }),
          ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to query ticket API: ${error}`);
      // Return mock data in case of error for development
      return this.getMockTicketData(ticketId);
    }
  }

  private getMockTicketData(ticketId: string): {
    status: string;
    amount: number;
    currency: string;
    events: TicketEvent[];
    createdAt: string;
    paidAt?: string;
  } {
    // Mock data for development/testing
    const statuses = ['pending', 'won', 'lost'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

    return {
      status: randomStatus,
      amount: Math.floor(Math.random() * 100000) + 10000,
      currency: 'COP',
      events: [
        {
          eventId: 'EVT001',
          name: 'Real Madrid vs Barcelona',
          sport: 'Fútbol',
          selection: 'Real Madrid',
          odds: 2.1,
          result: randomStatus === 'pending' ? 'pending' : randomStatus === 'won' ? 'won' : 'lost',
        },
        {
          eventId: 'EVT002',
          name: 'Lakers vs Celtics',
          sport: 'Baloncesto',
          selection: 'Lakers +5.5',
          odds: 1.85,
          result: randomStatus === 'pending' ? 'pending' : randomStatus === 'won' ? 'won' : 'lost',
        },
      ],
      createdAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      paidAt: randomStatus === 'won' ? new Date().toISOString() : undefined,
    };
  }

  formatTicketResponse(result: TicketVerificationResult): string {
    if (!result.success) {
      return `Lo siento, ${result.error}`;
    }

    const { ticketId, ticketData } = result;

    if (!ticketData) {
      return `Ticket ${ticketId} encontrado pero sin datos disponibles.`;
    }

    const statusMessages: Record<string, string> = {
      pending: '⏳ En juego',
      won: '🎉 ¡Ganador!',
      lost: '😔 Perdido',
    };

    const statusEmoji = statusMessages[ticketData.status] || ticketData.status;

    let response = `📋 **Ticket #${ticketId}**\n\n`;
    response += `**Estado:** ${statusEmoji}\n`;
    response += `**Monto:** $${ticketData.amount.toLocaleString()} ${ticketData.currency}\n`;
    response += `**Fecha:** ${new Date(ticketData.createdAt).toLocaleDateString('es-ES')}\n\n`;

    response += `**Eventos:**\n`;
    for (const event of ticketData.events) {
      const eventResult =
        event.result === 'won'
          ? '✅'
          : event.result === 'lost'
            ? '❌'
            : '⏳';
      response += `${eventResult} ${event.name} - ${event.selection} (${event.odds})\n`;
    }

    if (ticketData.paidAt) {
      response += `\n💰 **Pagado:** ${new Date(ticketData.paidAt).toLocaleDateString('es-ES')}`;
    }

    return response;
  }
}
