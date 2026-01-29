import { Controller, Post, Get, Body } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { TicketVerificationService } from './services/ticket-verification.service';
import { KYCVerificationService } from './services/kyc-verification.service';
import {
  ProcessMessageDto,
  VerifyTicketDto,
  VerifyDocumentDto,
  VerifySelfieDto,
  FullKYCDto,
} from './dto/process-message.dto';

@Controller('orchestrator')
export class OrchestratorController {
  constructor(
    private readonly orchestratorService: OrchestratorService,
    private readonly ticketVerificationService: TicketVerificationService,
    private readonly kycVerificationService: KYCVerificationService,
  ) {}

  @Get('health')
  async getHealth() {
    const servicesHealth = await this.orchestratorService.getServicesHealth();
    const allHealthy = Object.values(servicesHealth).every((v) => v);

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      services: servicesHealth,
    };
  }

  @Post('process')
  async processMessage(@Body() dto: ProcessMessageDto) {
    const result = await this.orchestratorService.processMessage(dto);
    return {
      success: true,
      response: result.response,
      flowType: result.flowType,
    };
  }

  @Post('verify/ticket')
  async verifyTicket(@Body() dto: VerifyTicketDto) {
    const result = await this.ticketVerificationService.verifyTicket(
      dto.imageBase64,
    );
    return {
      success: result.success,
      data: result,
      formattedResponse: this.ticketVerificationService.formatTicketResponse(result),
    };
  }

  @Post('verify/document')
  async verifyDocument(@Body() dto: VerifyDocumentDto) {
    const result = await this.kycVerificationService.verifyDocument(
      {
        frontImage: dto.frontImageBase64,
        backImage: dto.backImageBase64,
      },
      dto.playerId,
    );
    return {
      success: result.success,
      data: result,
      formattedResponse: this.kycVerificationService.formatKYCResponse(result),
    };
  }

  @Post('verify/selfie')
  async verifySelfie(@Body() dto: VerifySelfieDto) {
    const result = await this.kycVerificationService.verifySelfie(
      {
        selfieImage: dto.selfieImageBase64,
        documentNumber: dto.documentNumber,
      },
      dto.playerId,
    );
    return {
      success: result.success,
      data: result,
      formattedResponse: this.kycVerificationService.formatKYCResponse(result),
    };
  }

  @Post('verify/kyc')
  async fullKYC(@Body() dto: FullKYCDto) {
    const result = await this.kycVerificationService.performFullKYC(
      {
        frontImage: dto.frontImageBase64,
        backImage: dto.backImageBase64,
      },
      dto.selfieImageBase64,
      dto.playerId,
    );
    return {
      success: result.success,
      data: result,
      formattedResponse: this.kycVerificationService.formatKYCResponse(result),
    };
  }
}
