import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { AxiosError } from 'axios';
import {
  OCRServiceResponse,
  NLPServiceResponse,
  ClusteringServiceResponse,
} from '../interfaces/orchestrator.types';

@Injectable()
export class MicroservicesClientService implements OnModuleInit {
  private readonly logger = new Logger(MicroservicesClientService.name);

  private ocrServiceUrl: string;
  private nlpServiceUrl: string;
  private clusteringServiceUrl: string;
  private requestTimeout: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  onModuleInit() {
    this.ocrServiceUrl = this.configService.get<string>('orchestrator.ocrServiceUrl')!;
    this.nlpServiceUrl = this.configService.get<string>('orchestrator.nlpServiceUrl')!;
    this.clusteringServiceUrl = this.configService.get<string>(
      'orchestrator.clusteringServiceUrl',
    )!;
    this.requestTimeout = this.configService.get<number>('orchestrator.requestTimeout')!;

    this.logger.log('Microservices client initialized');
    this.logger.debug(`OCR Service: ${this.ocrServiceUrl}`);
    this.logger.debug(`NLP Service: ${this.nlpServiceUrl}`);
    this.logger.debug(`Clustering Service: ${this.clusteringServiceUrl}`);
  }

  // ==================== OCR Service ====================

  async extractText(imageBase64: string): Promise<OCRServiceResponse> {
    return this.callOcrService('/api/ocr/extract', {
      image: { base64: imageBase64 },
    });
  }

  async extractTicketData(imageBase64: string): Promise<OCRServiceResponse> {
    return this.callOcrService('/api/ocr/extract/ticket', {
      base64: imageBase64,
    });
  }

  async extractDocumentData(imageBase64: string): Promise<OCRServiceResponse> {
    return this.callOcrService('/api/ocr/extract/document', {
      base64: imageBase64,
    });
  }

  async checkOcrHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.ocrServiceUrl}/api/ocr/health`).pipe(
          timeout(5000),
          catchError(() => {
            throw new Error('OCR service unavailable');
          }),
        ),
      );
      return response.data?.status === 'healthy';
    } catch {
      return false;
    }
  }

  private async callOcrService(
    endpoint: string,
    data: any,
  ): Promise<OCRServiceResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.ocrServiceUrl}${endpoint}`, data).pipe(
          timeout(this.requestTimeout),
          catchError((error: AxiosError) => {
            this.logger.error(`OCR service error: ${error.message}`);
            throw error;
          }),
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`OCR service call failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OCR service error',
      };
    }
  }

  // ==================== NLP Service ====================

  async analyzeText(text: string): Promise<NLPServiceResponse | null> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .post(`${this.nlpServiceUrl}/api/nlp/analyze`, { text })
          .pipe(
            timeout(this.requestTimeout),
            catchError((error: AxiosError) => {
              this.logger.error(`NLP service error: ${error.message}`);
              throw error;
            }),
          ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`NLP service call failed: ${error}`);
      return null;
    }
  }

  async classifyIntent(text: string): Promise<{ type: string; confidence: number } | null> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .post(`${this.nlpServiceUrl}/api/nlp/intent`, { text })
          .pipe(
            timeout(this.requestTimeout),
            catchError((error: AxiosError) => {
              this.logger.error(`NLP service error: ${error.message}`);
              throw error;
            }),
          ),
      );
      return response.data?.intent;
    } catch (error) {
      this.logger.error(`NLP intent classification failed: ${error}`);
      return null;
    }
  }

  async extractEntities(
    text: string,
  ): Promise<Array<{ type: string; value: string; confidence: number }>> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .post(`${this.nlpServiceUrl}/api/nlp/entities`, { text })
          .pipe(
            timeout(this.requestTimeout),
            catchError((error: AxiosError) => {
              this.logger.error(`NLP service error: ${error.message}`);
              throw error;
            }),
          ),
      );
      return response.data?.entities || [];
    } catch (error) {
      this.logger.error(`NLP entity extraction failed: ${error}`);
      return [];
    }
  }

  async checkNlpHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.nlpServiceUrl}/api/nlp/health`).pipe(
          timeout(5000),
          catchError(() => {
            throw new Error('NLP service unavailable');
          }),
        ),
      );
      return response.data?.status === 'healthy';
    } catch {
      return false;
    }
  }

  // ==================== Clustering Service ====================

  async findSimilarQueries(
    query: string,
    existingQueries: string[],
    topK: number = 5,
  ): Promise<ClusteringServiceResponse | null> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .post(`${this.clusteringServiceUrl}/api/clustering/similar`, {
            query,
            texts: existingQueries,
            top_k: topK,
            threshold: 0.6,
          })
          .pipe(
            timeout(this.requestTimeout),
            catchError((error: AxiosError) => {
              this.logger.error(`Clustering service error: ${error.message}`);
              throw error;
            }),
          ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Clustering service call failed: ${error}`);
      return null;
    }
  }

  async checkClusteringHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .get(`${this.clusteringServiceUrl}/api/clustering/health`)
          .pipe(
            timeout(5000),
            catchError(() => {
              throw new Error('Clustering service unavailable');
            }),
          ),
      );
      return response.data?.status === 'healthy';
    } catch {
      return false;
    }
  }

  // ==================== Health Check All ====================

  async checkAllServicesHealth(): Promise<{
    ocr: boolean;
    nlp: boolean;
    clustering: boolean;
  }> {
    const [ocr, nlp, clustering] = await Promise.all([
      this.checkOcrHealth(),
      this.checkNlpHealth(),
      this.checkClusteringHealth(),
    ]);

    return { ocr, nlp, clustering };
  }
}
