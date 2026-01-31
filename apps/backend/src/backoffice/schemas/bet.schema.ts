import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BetDocument = Bet & Document;

@Schema({ collection: 'bets' })
export class BetOutcome {
  @Prop()
  _id: string;

  @Prop()
  specifiers: string;

  @Prop()
  odds: number;

  @Prop()
  oddsUS: number;

  @Prop()
  active: boolean;

  @Prop()
  isPlayerOutcome: boolean;

  @Prop({ type: Object })
  outcomeName: { es: string; en: string };
}

@Schema()
export class BetEvent {
  @Prop()
  eventId: string;

  @Prop()
  marketId: number;

  @Prop({ type: Object })
  nameMarket: { es: string; en: string };

  @Prop({ type: Object })
  outcome: BetOutcome;

  @Prop()
  producerId: number;

  @Prop()
  producerName: string;

  @Prop()
  scheduled: Date;

  @Prop({ type: Object })
  sportEventName: { es: string; en: string };

  @Prop()
  sportId: string;

  @Prop()
  statusEventSport: string;

  @Prop()
  statusMarketLine: string;

  @Prop()
  specifiersMarketLine: string;

  @Prop()
  tournamentId: string;

  @Prop({ type: Object })
  tournamentName: { es: string; en: string };

  @Prop()
  categoryId: string;

  @Prop()
  previewOdd: number;

  @Prop()
  isBettingOpen: string;

  @Prop()
  isResulted: boolean;

  @Prop()
  result: string;

  @Prop()
  voidFactor: number;

  @Prop()
  isBetBuilder: boolean;
}

@Schema()
export class BetTicket {
  @Prop()
  signature: string;

  @Prop()
  correlationId: string;

  @Prop()
  ticketId: string;
}

@Schema({ collection: 'bets', timestamps: true })
export class Bet {
  @Prop({ type: Types.ObjectId })
  playerId: Types.ObjectId;

  @Prop()
  betLocalId: string;

  @Prop({ type: Object })
  ticket: BetTicket;

  @Prop({ type: [Object] })
  events: BetEvent[];

  @Prop()
  amountBet: number;

  @Prop()
  oddsTotal: number;

  @Prop()
  totalGain: number;

  @Prop()
  systemQtyGroup: number;

  @Prop()
  bonusTicketPercentage: number;

  @Prop()
  playerBalance: number;

  @Prop()
  type: string;

  @Prop()
  isResulted: boolean;

  @Prop()
  result: string;

  @Prop()
  betType: string;

  @Prop()
  ipAddress: string;

  @Prop()
  platform: string;

  @Prop()
  currency: string;

  @Prop()
  playerNickname: string;

  @Prop()
  date: Date;

  @Prop()
  settledAt: Date;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const BetSchema = SchemaFactory.createForClass(Bet);

// Crear índices para búsquedas eficientes
BetSchema.index({ betLocalId: 1 });
BetSchema.index({ playerId: 1 });
BetSchema.index({ 'ticket.ticketId': 1 });
BetSchema.index({ playerNickname: 1 });
