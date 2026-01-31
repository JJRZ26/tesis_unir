import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PlayerDocument = Player & Document;

@Schema()
export class PersonalInfo {
  @Prop()
  firstName: string;

  @Prop()
  middleName: string;

  @Prop()
  lastName: string;

  @Prop()
  maternalSurname: string;

  @Prop()
  username: string;

  @Prop()
  email: string;

  @Prop()
  mobileNumber: string;

  @Prop()
  address: string;

  @Prop()
  birthDate: Date;

  @Prop()
  gender: string;

  @Prop()
  documentNumber: string;

  @Prop()
  birthCity: string;

  @Prop()
  zipCode: string;

  @Prop()
  nickname: string;
}

@Schema()
export class AccountInfo {
  @Prop()
  playerId: number;

  @Prop({ type: Types.ObjectId })
  parentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  partnerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  currencyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  comissionPlanId: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  languageId: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  countryId: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  telephoneCodeId: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  agentId: Types.ObjectId;

  @Prop()
  state: number;

  @Prop()
  category: string;

  @Prop()
  fidelityLevel: string;

  @Prop()
  fidelityPoints: number;

  @Prop()
  balance: number;

  @Prop()
  balanceBonus: number;

  @Prop()
  promotionalCode: string;

  @Prop()
  bonusesExcluded: boolean;

  @Prop({ type: Types.ObjectId })
  betShopId: Types.ObjectId;

  @Prop()
  affiliateStatus: string;
}

@Schema()
export class VerificationAndLocks {
  @Prop()
  verify: boolean;

  @Prop()
  emailVerified: boolean;

  @Prop()
  mobileVerified: boolean;

  @Prop()
  accountState: string;

  @Prop()
  loginAttempts: number;

  @Prop()
  failedLoginAttempts: number;

  @Prop()
  exclusionType: string;

  @Prop()
  amlRisk: string;

  @Prop()
  agentGroupDeports: string;
}

@Schema()
export class PagePermission {
  @Prop()
  canBet: boolean;

  @Prop()
  canDeposit: boolean;

  @Prop()
  canLogin: boolean;

  @Prop()
  canWithdraw: boolean;

  @Prop()
  canIncreaseLimit: boolean;

  @Prop()
  canClaimBonuses: boolean;

  @Prop()
  canConnectToSport: boolean;

  @Prop()
  canConnectToCasino: boolean;

  @Prop()
  canConnectToLiveCasino: boolean;

  @Prop()
  canConnectToEsports: boolean;

  @Prop()
  canConnectToVirtual: boolean;

  @Prop()
  canConnectToPromotions: boolean;

  @Prop()
  canUpdateNickname: boolean;

  @Prop()
  updateDate: Date;

  @Prop({ type: Types.ObjectId })
  updateBy: Types.ObjectId;

  @Prop()
  canCashout: boolean;
}

@Schema()
export class Activity {
  @Prop()
  lastLoginDate: Date;
}

@Schema({ collection: 'players', timestamps: true })
export class Player {
  @Prop({ type: Object })
  personalInfo: PersonalInfo;

  @Prop({ type: Object })
  accountInfo: AccountInfo;

  @Prop({ type: Object })
  verificationAndLocks: VerificationAndLocks;

  @Prop({ type: Object })
  pagePermission: PagePermission;

  @Prop({ type: Object })
  activity: Activity;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const PlayerSchema = SchemaFactory.createForClass(Player);

// Crear índices para búsquedas eficientes
PlayerSchema.index({ 'personalInfo.username': 1 });
PlayerSchema.index({ 'personalInfo.email': 1 });
PlayerSchema.index({ 'personalInfo.documentNumber': 1 });
PlayerSchema.index({ 'personalInfo.nickname': 1 });
PlayerSchema.index({ 'accountInfo.playerId': 1 });
