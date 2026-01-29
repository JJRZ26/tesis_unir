import { registerAs } from '@nestjs/config';

export const orchestratorConfig = registerAs('orchestrator', () => ({
  ocrServiceUrl: process.env.OCR_SERVICE_URL || 'http://localhost:8001',
  nlpServiceUrl: process.env.NLP_SERVICE_URL || 'http://localhost:8002',
  clusteringServiceUrl: process.env.CLUSTERING_SERVICE_URL || 'http://localhost:8003',
  sorti365ApiUrl: process.env.SORTI365_API_URL || 'http://api.sorti365.com',
  sorti365ApiKey: process.env.SORTI365_API_KEY,
  requestTimeout: parseInt(process.env.SERVICE_REQUEST_TIMEOUT || '30000', 10),
}));

export interface OrchestratorConfig {
  ocrServiceUrl: string;
  nlpServiceUrl: string;
  clusteringServiceUrl: string;
  sorti365ApiUrl: string;
  sorti365ApiKey: string | undefined;
  requestTimeout: number;
}
