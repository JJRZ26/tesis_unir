import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { orchestratorConfig } from './orchestrator.config';
import { OrchestratorService } from './orchestrator.service';
import { OrchestratorController } from './orchestrator.controller';
import { MicroservicesClientService } from './services/microservices-client.service';
import { TicketVerificationService } from './services/ticket-verification.service';
import { KYCVerificationService } from './services/kyc-verification.service';
import { MultimodalModule } from '../multimodal/multimodal.module';
import { ChatModule } from '../chat/chat.module';
import { BackofficeModule } from '../backoffice/backoffice.module';

@Module({
  imports: [
    ConfigModule.forFeature(orchestratorConfig),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    MultimodalModule,
    forwardRef(() => ChatModule),
    BackofficeModule,
  ],
  controllers: [OrchestratorController],
  providers: [
    OrchestratorService,
    MicroservicesClientService,
    TicketVerificationService,
    KYCVerificationService,
  ],
  exports: [OrchestratorService, MicroservicesClientService],
})
export class OrchestratorModule {}
