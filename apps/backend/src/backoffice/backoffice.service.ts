import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bet, BetDocument } from './schemas/bet.schema';
import { Player, PlayerDocument } from './schemas/player.schema';

export interface BetSearchResult {
  found: boolean;
  bet?: BetDocument;
  error?: string;
}

export interface PlayerSearchResult {
  found: boolean;
  player?: PlayerDocument;
  error?: string;
}

export interface BetSummary {
  ticketId: string;
  betLocalId: string;
  playerNickname: string;
  amountBet: number;
  currency: string;
  oddsTotal: number;
  totalGain: number;
  betType: string;
  result: string;
  isResulted: boolean;
  date: Date;
  settledAt?: Date;
  eventsCount: number;
  events: EventSummary[];
}

export interface EventSummary {
  sportEventName: string;
  tournamentName: string;
  marketName: string;
  selectionName: string;
  odds: number;
  scheduled: Date;
  result: string;
  isResulted: boolean;
}

@Injectable()
export class BackofficeService {
  private readonly logger = new Logger(BackofficeService.name);

  constructor(
    @InjectModel(Bet.name, 'backoffice')
    private betModel: Model<BetDocument>,
    @InjectModel(Player.name, 'backoffice')
    private playerModel: Model<PlayerDocument>,
  ) {}

  /**
   * Buscar apuesta por betLocalId (el ID corto como "0000001223")
   */
  async findBetByLocalId(betLocalId: string): Promise<BetSearchResult> {
    try {
      // Normalizar el ID (remover ceros a la izquierda si es necesario)
      const normalizedId = betLocalId.replace(/^0+/, '');
      const paddedId = betLocalId.padStart(10, '0');

      this.logger.log(`Searching bet with localId: ${betLocalId} (normalized: ${normalizedId}, padded: ${paddedId})`);

      // Buscar con ambos formatos
      const bet = await this.betModel.findOne({
        $or: [
          { betLocalId: betLocalId },
          { betLocalId: normalizedId },
          { betLocalId: paddedId },
        ],
      }).exec();

      if (!bet) {
        return {
          found: false,
          error: `No se encontró ninguna apuesta con el ID ${betLocalId}`,
        };
      }

      this.logger.log(`Found bet: ${bet._id} with localId: ${bet.betLocalId}`);
      return { found: true, bet };
    } catch (error) {
      this.logger.error(`Error searching bet: ${error.message}`);
      return { found: false, error: error.message };
    }
  }

  /**
   * Buscar apuesta por ticketId completo
   */
  async findBetByTicketId(ticketId: string): Promise<BetSearchResult> {
    try {
      this.logger.log(`Searching bet with ticketId: ${ticketId}`);

      const bet = await this.betModel.findOne({
        'ticket.ticketId': ticketId,
      }).exec();

      if (!bet) {
        return {
          found: false,
          error: `No se encontró ninguna apuesta con el ticket ID ${ticketId}`,
        };
      }

      return { found: true, bet };
    } catch (error) {
      this.logger.error(`Error searching bet: ${error.message}`);
      return { found: false, error: error.message };
    }
  }

  /**
   * Buscar jugador por ObjectId
   */
  async findPlayerById(playerId: string): Promise<PlayerSearchResult> {
    try {
      if (!Types.ObjectId.isValid(playerId)) {
        return { found: false, error: 'ID de jugador inválido' };
      }

      const player = await this.playerModel.findById(playerId).exec();

      if (!player) {
        return {
          found: false,
          error: `No se encontró ningún jugador con el ID ${playerId}`,
        };
      }

      return { found: true, player };
    } catch (error) {
      this.logger.error(`Error searching player: ${error.message}`);
      return { found: false, error: error.message };
    }
  }

  /**
   * Buscar jugador por número de documento
   */
  async findPlayerByDocumentNumber(documentNumber: string): Promise<PlayerSearchResult> {
    try {
      const player = await this.playerModel.findOne({
        'personalInfo.documentNumber': documentNumber,
      }).exec();

      if (!player) {
        return {
          found: false,
          error: `No se encontró ningún jugador con el documento ${documentNumber}`,
        };
      }

      return { found: true, player };
    } catch (error) {
      this.logger.error(`Error searching player: ${error.message}`);
      return { found: false, error: error.message };
    }
  }

  /**
   * Buscar jugador por nickname
   */
  async findPlayerByNickname(nickname: string): Promise<PlayerSearchResult> {
    try {
      const player = await this.playerModel.findOne({
        'personalInfo.nickname': nickname,
      }).exec();

      if (!player) {
        return {
          found: false,
          error: `No se encontró ningún jugador con el nickname ${nickname}`,
        };
      }

      return { found: true, player };
    } catch (error) {
      this.logger.error(`Error searching player: ${error.message}`);
      return { found: false, error: error.message };
    }
  }

  /**
   * Obtener resumen legible de una apuesta
   */
  getBetSummary(bet: BetDocument): BetSummary {
    const events: EventSummary[] = bet.events.map((event) => ({
      sportEventName: event.sportEventName?.es || event.sportEventName?.en || 'N/A',
      tournamentName: event.tournamentName?.es || event.tournamentName?.en || 'N/A',
      marketName: event.nameMarket?.es || event.nameMarket?.en || 'N/A',
      selectionName: event.outcome?.outcomeName?.es || event.outcome?.outcomeName?.en || 'N/A',
      odds: event.outcome?.odds || 0,
      scheduled: event.scheduled,
      result: event.result || 'Pendiente',
      isResulted: event.isResulted || false,
    }));

    return {
      ticketId: bet.ticket?.ticketId || 'N/A',
      betLocalId: bet.betLocalId,
      playerNickname: bet.playerNickname,
      amountBet: bet.amountBet,
      currency: bet.currency,
      oddsTotal: bet.oddsTotal,
      totalGain: bet.totalGain,
      betType: bet.betType,
      result: bet.result || 'Pendiente',
      isResulted: bet.isResulted,
      date: bet.date,
      settledAt: bet.settledAt,
      eventsCount: bet.events.length,
      events,
    };
  }

  /**
   * Verificar si el ticket o algún evento requiere atención humana
   */
  private requiresHumanAttention(bet: BetDocument): { requires: boolean; reason: string } {
    // Ticket cancelado por sistema
    if (bet.result === 'Canceled' || bet.result === 'Cancelled') {
      return {
        requires: true,
        reason: 'El ticket fue cancelado por el sistema. Esto puede deberse a decisiones del departamento de riesgo, políticas de bonos, o situaciones especiales que requieren revisión manual.',
      };
    }

    // Eventos cancelados
    const canceledEvents = bet.events.filter(
      e => e.result === 'Canceled' || e.result === 'Cancelled' || e.result === 'Void'
    );

    if (canceledEvents.length > 0) {
      return {
        requires: true,
        reason: `${canceledEvents.length} evento(s) fueron cancelados/anulados. Esto puede ocurrir por cambios en el evento deportivo, errores en las cuotas, o decisiones del departamento de riesgo.`,
      };
    }

    return { requires: false, reason: '' };
  }

  /**
   * Formatear respuesta de ticket para el chat
   */
  formatBetResponse(bet: BetDocument, question?: string): string {
    const summary = this.getBetSummary(bet);

    let response = `📋 **Información del Ticket #${summary.betLocalId}**\n\n`;

    // Estado general
    const statusEmoji = this.getResultEmoji(summary.result);

    response += `**Estado:** ${statusEmoji} ${this.translateResult(summary.result)}\n`;
    response += `**Tipo:** ${summary.betType}\n`;
    response += `**Monto apostado:** ${summary.amountBet} ${summary.currency}\n`;
    response += `**Cuota total:** ${summary.oddsTotal.toFixed(2)}\n`;

    if (summary.isResulted) {
      response += `**Ganancia:** ${summary.totalGain} ${summary.currency}\n`;
    } else {
      const potentialWin = summary.amountBet * summary.oddsTotal;
      response += `**Ganancia potencial:** ${potentialWin.toFixed(2)} ${summary.currency}\n`;
    }

    response += `**Fecha:** ${this.formatDate(summary.date)}\n`;
    response += `\n**Eventos (${summary.eventsCount}):**\n`;

    // Detalles de cada evento
    summary.events.forEach((event, index) => {
      const eventEmoji = this.getResultEmoji(event.result);

      response += `\n${index + 1}. ${eventEmoji} **${event.sportEventName}**\n`;
      response += `   📅 ${this.formatDate(event.scheduled)}\n`;
      response += `   🏆 ${event.tournamentName}\n`;
      response += `   📊 ${event.marketName}: ${event.selectionName}\n`;
      response += `   💰 Cuota: ${event.odds.toFixed(2)}\n`;
      response += `   📌 Estado: ${this.translateResult(event.result)}\n`;
    });

    // Verificar si requiere atención humana (tickets/eventos cancelados)
    const humanAttention = this.requiresHumanAttention(bet);
    if (humanAttention.requires) {
      response += `\n\n⚠️ **ATENCIÓN ESPECIAL REQUERIDA**\n`;
      response += `${humanAttention.reason}\n\n`;
      response += `🧑‍💼 **Este caso requiere revisión por un operador humano.**\n`;
      response += `Por favor, contacta a nuestro equipo de soporte para obtener más detalles sobre esta situación específica. `;
      response += `Ellos tienen acceso a la información completa del departamento de riesgo y podrán explicarte el motivo exacto.\n\n`;
      response += `📞 Puedes contactarnos a través de:\n`;
      response += `• Chat en vivo con un agente\n`;
      response += `• Correo electrónico de soporte\n`;
      response += `• Llamada telefónica`;
      return response;
    }

    // Si hay una pregunta específica sobre por qué perdió
    if (question && this.isAskingAboutLoss(question)) {
      const lostEvents = summary.events.filter(e => e.result === 'Lost');
      if (lostEvents.length > 0) {
        response += `\n\n❌ **¿Por qué se perdió este ticket?**\n`;
        response += `Tu ticket se resolvió como PERDIDO porque ${lostEvents.length === 1 ? 'la siguiente selección no resultó ganadora' : 'las siguientes selecciones no resultaron ganadoras'}:\n\n`;

        lostEvents.forEach((event, index) => {
          response += `${index + 1}. **${event.sportEventName}**\n`;
          response += `   Tu selección: ${event.selectionName} en el mercado ${event.marketName}\n`;
          response += `   Esta selección se resolvió como PERDIDA.\n\n`;
        });

        if (summary.betType === 'Multiple' || summary.betType === 'Parlay') {
          response += `Como es una apuesta ${summary.betType}, necesitabas que TODOS los eventos resultaran ganadores para ganar el ticket.`;
        }
      }
    }

    // Si pregunta sobre cancelaciones
    if (question && this.isAskingAboutCancellation(question)) {
      response += `\n\nℹ️ Este ticket no tiene eventos cancelados ni fue cancelado por el sistema.`;
    }

    return response;
  }

  /**
   * Obtener emoji según el resultado
   */
  private getResultEmoji(result: string): string {
    const emojis: Record<string, string> = {
      'Won': '✅',
      'Lost': '❌',
      'Void': '⚪',
      'Canceled': '🚫',
      'Cancelled': '🚫',
      'Cashout': '💰',
      'Pending': '⏳',
      'Pendiente': '⏳',
    };
    return emojis[result] || '⏳';
  }

  /**
   * Verificar si el usuario pregunta sobre pérdida
   */
  private isAskingAboutLoss(question: string): boolean {
    const lossKeywords = ['perdido', 'perdió', 'perdi', 'perdida', 'porque perdi', 'por que perdi'];
    return lossKeywords.some(kw => question.toLowerCase().includes(kw));
  }

  /**
   * Verificar si el usuario pregunta sobre cancelación
   */
  private isAskingAboutCancellation(question: string): boolean {
    const cancelKeywords = ['cancelado', 'cancelada', 'anulado', 'anulada', 'cancelaron', 'anularon'];
    return cancelKeywords.some(kw => question.toLowerCase().includes(kw));
  }

  /**
   * Traducir resultado al español
   */
  private translateResult(result: string): string {
    const translations: Record<string, string> = {
      'Won': 'Ganado',
      'Lost': 'Perdido',
      'Void': 'Anulado',
      'Canceled': 'Cancelado',
      'Cancelled': 'Cancelado',
      'Pending': 'Pendiente',
      'Cashout': 'Cashout',
      'Pendiente': 'Pendiente',
    };
    return translations[result] || result;
  }

  /**
   * Formatear fecha
   */
  private formatDate(date: Date): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Buscar apuestas de un jugador
   */
  async findBetsByPlayerId(playerId: string, limit = 10): Promise<BetDocument[]> {
    try {
      if (!Types.ObjectId.isValid(playerId)) {
        return [];
      }

      return this.betModel
        .find({ playerId: new Types.ObjectId(playerId) })
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec();
    } catch (error) {
      this.logger.error(`Error searching player bets: ${error.message}`);
      return [];
    }
  }

  /**
   * Verificar si el jugador está verificado
   */
  isPlayerVerified(player: PlayerDocument): boolean {
    return player.verificationAndLocks?.verify === true;
  }

  /**
   * Obtener nombre completo del jugador
   */
  getPlayerDisplayName(player: PlayerDocument): string {
    const info = player.personalInfo;
    if (info.firstName || info.lastName) {
      return `${info.firstName || ''} ${info.lastName || ''}`.trim();
    }
    return info.nickname || info.username || 'Usuario';
  }
}
