import { Injectable, Logger } from '@nestjs/common';
import { MicroservicesClientService } from './microservices-client.service';
import { MultimodalService } from '../../multimodal/multimodal.service';
import {
  ProcessingStep,
  ProcessingStatus,
  KYCVerificationResult,
} from '../interfaces/orchestrator.types';

export type StatusCallback = (status: ProcessingStatus) => void;

export interface KYCDocumentInput {
  frontImage: string; // base64
  backImage?: string; // base64
}

export interface KYCSelfieInput {
  selfieImage: string; // base64
  documentNumber: string;
}

@Injectable()
export class KYCVerificationService {
  private readonly logger = new Logger(KYCVerificationService.name);

  constructor(
    private readonly microservicesClient: MicroservicesClientService,
    private readonly multimodalService: MultimodalService,
  ) {}

  async verifyDocument(
    input: KYCDocumentInput,
    playerId: string,
    onStatusUpdate?: StatusCallback,
  ): Promise<KYCVerificationResult> {
    const updateStatus = (step: ProcessingStep, message: string, progress: number) => {
      if (onStatusUpdate) {
        onStatusUpdate({ step, message, progress, timestamp: new Date() });
      }
    };

    const validationErrors: string[] = [];

    try {
      // Step 1: Receive documents
      updateStatus(ProcessingStep.RECEIVED, 'Documentos recibidos', 10);

      // Step 2: Analyze front of document with GPT-4 Vision
      updateStatus(
        ProcessingStep.ANALYZING_IMAGE,
        'Analizando documento (frente)...',
        20,
      );

      const frontVisionResult = await this.multimodalService.analyzeDocument(
        [{ base64: input.frontImage }],
      );

      let documentNumber: string | undefined;
      let fullName: string | undefined;
      let dateOfBirth: string | undefined;
      let expirationDate: string | undefined;
      let confidence = 0;

      if (frontVisionResult.success && frontVisionResult.extractedData) {
        const data = frontVisionResult.extractedData as any;
        documentNumber = data.documentNumber;
        fullName = data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim();
        dateOfBirth = data.dateOfBirth;
        expirationDate = data.expirationDate;
        confidence = data.confidence || 0;
      }

      // Step 3: If Vision didn't get all data, try OCR
      if (!documentNumber || !fullName) {
        updateStatus(
          ProcessingStep.EXTRACTING_TEXT,
          'Extrayendo datos con OCR...',
          40,
        );

        const ocrResult = await this.microservicesClient.extractDocumentData(
          input.frontImage,
        );

        if (ocrResult.success) {
          documentNumber = documentNumber || ocrResult.document_number;
          fullName = fullName || ocrResult.full_name;
          confidence = Math.max(confidence, ocrResult.confidence || 0);
        }
      }

      // Step 4: Analyze back of document if provided
      if (input.backImage) {
        updateStatus(
          ProcessingStep.ANALYZING_IMAGE,
          'Analizando documento (reverso)...',
          50,
        );

        const backVisionResult = await this.multimodalService.analyzeDocument(
          [{ base64: input.backImage }],
        );

        // Extract any additional data from back
        if (backVisionResult.success && backVisionResult.extractedData) {
          const backData = backVisionResult.extractedData as any;
          // Use back data to fill in missing fields
          documentNumber = documentNumber || backData.documentNumber;
          expirationDate = expirationDate || backData.expirationDate;
        }
      }

      // Step 5: Validate extracted data
      updateStatus(
        ProcessingStep.PROCESSING_NLP,
        'Validando información...',
        70,
      );

      if (!documentNumber) {
        validationErrors.push('No se pudo extraer el número de documento');
      }

      if (!fullName) {
        validationErrors.push('No se pudo extraer el nombre completo');
      }

      // Check if document number is already registered to another player
      if (documentNumber) {
        const isRegistered = await this.checkDocumentRegistration(
          documentNumber,
          playerId,
        );
        if (isRegistered) {
          validationErrors.push(
            'Este documento ya está registrado con otro usuario',
          );
        }
      }

      // Check document expiration
      if (expirationDate) {
        const expDate = new Date(expirationDate);
        if (expDate < new Date()) {
          validationErrors.push('El documento está vencido');
        }
      }

      // Step 6: Complete
      const success = validationErrors.length === 0 && !!documentNumber && !!fullName;

      updateStatus(
        success ? ProcessingStep.COMPLETED : ProcessingStep.ERROR,
        success ? 'Documento verificado' : 'Verificación fallida',
        100,
      );

      return {
        success,
        documentData: documentNumber
          ? {
              documentNumber,
              fullName: fullName || '',
              dateOfBirth,
              expirationDate,
            }
          : undefined,
        validationErrors,
        confidence,
      };
    } catch (error) {
      this.logger.error(`Document verification failed: ${error}`);
      updateStatus(ProcessingStep.ERROR, 'Error en la verificación', 100);

      return {
        success: false,
        validationErrors: [
          error instanceof Error ? error.message : 'Error desconocido',
        ],
        confidence: 0,
      };
    }
  }

  async verifySelfie(
    input: KYCSelfieInput,
    playerId: string,
    onStatusUpdate?: StatusCallback,
  ): Promise<KYCVerificationResult> {
    const updateStatus = (step: ProcessingStep, message: string, progress: number) => {
      if (onStatusUpdate) {
        onStatusUpdate({ step, message, progress, timestamp: new Date() });
      }
    };

    const validationErrors: string[] = [];

    try {
      // Step 1: Receive selfie
      updateStatus(ProcessingStep.RECEIVED, 'Selfie recibida', 10);

      // Step 2: Analyze selfie with GPT-4 Vision
      updateStatus(
        ProcessingStep.ANALYZING_IMAGE,
        'Analizando selfie...',
        30,
      );

      const selfieResult = await this.multimodalService.analyzeSelfie(
        [{ base64: input.selfieImage }],
        `El número de documento del usuario es: ${input.documentNumber}`,
      );

      let facesDetected = 0;
      let isHoldingDocument = false;
      let matchConfidence = 0;
      let confidence = 0;

      if (selfieResult.success && selfieResult.extractedData) {
        const data = selfieResult.extractedData as any;
        facesDetected = data.facesDetected || 0;
        isHoldingDocument = data.isHoldingDocument || false;
        matchConfidence = data.matchConfidence || 0;
        confidence = data.confidence || 0;
      }

      // Step 3: Validate selfie
      updateStatus(
        ProcessingStep.PROCESSING_NLP,
        'Validando selfie...',
        60,
      );

      if (facesDetected === 0) {
        validationErrors.push('No se detectó ningún rostro en la imagen');
      } else if (facesDetected > 1) {
        validationErrors.push(
          'Se detectaron múltiples rostros. La selfie debe mostrar solo una persona',
        );
      }

      if (!isHoldingDocument) {
        validationErrors.push(
          'No se detectó que la persona esté sosteniendo un documento',
        );
      }

      if (matchConfidence < 0.6) {
        validationErrors.push(
          'La confianza en la verificación es baja. Por favor, tome una foto más clara',
        );
      }

      // Step 4: Complete
      const success = validationErrors.length === 0;

      updateStatus(
        success ? ProcessingStep.COMPLETED : ProcessingStep.ERROR,
        success ? 'Selfie verificada' : 'Verificación fallida',
        100,
      );

      return {
        success,
        selfieVerification: {
          facesDetected,
          isHoldingDocument,
          matchConfidence,
        },
        validationErrors,
        confidence,
      };
    } catch (error) {
      this.logger.error(`Selfie verification failed: ${error}`);
      updateStatus(ProcessingStep.ERROR, 'Error en la verificación', 100);

      return {
        success: false,
        validationErrors: [
          error instanceof Error ? error.message : 'Error desconocido',
        ],
        confidence: 0,
      };
    }
  }

  async performFullKYC(
    documentInput: KYCDocumentInput,
    selfieImage: string,
    playerId: string,
    onStatusUpdate?: StatusCallback,
  ): Promise<KYCVerificationResult> {
    // Step 1: Verify document
    const documentResult = await this.verifyDocument(
      documentInput,
      playerId,
      onStatusUpdate,
    );

    if (!documentResult.success || !documentResult.documentData) {
      return documentResult;
    }

    // Step 2: Verify selfie
    const selfieResult = await this.verifySelfie(
      {
        selfieImage,
        documentNumber: documentResult.documentData.documentNumber,
      },
      playerId,
      onStatusUpdate,
    );

    // Combine results
    return {
      success: documentResult.success && selfieResult.success,
      documentData: documentResult.documentData,
      selfieVerification: selfieResult.selfieVerification,
      validationErrors: [
        ...documentResult.validationErrors,
        ...selfieResult.validationErrors,
      ],
      confidence: Math.min(documentResult.confidence, selfieResult.confidence),
    };
  }

  private async checkDocumentRegistration(
    documentNumber: string,
    currentPlayerId: string,
  ): Promise<boolean> {
    // In production, this would check the database
    // For now, we'll return false (not registered)
    this.logger.debug(
      `Checking if document ${documentNumber} is registered (excluding player ${currentPlayerId})`,
    );
    return false;
  }

  formatKYCResponse(result: KYCVerificationResult): string {
    if (!result.success) {
      let response = '❌ **Verificación KYC Fallida**\n\n';
      response += '**Problemas encontrados:**\n';
      for (const error of result.validationErrors) {
        response += `• ${error}\n`;
      }
      response += '\nPor favor, corrija los problemas y vuelva a intentar.';
      return response;
    }

    let response = '✅ **Verificación KYC Exitosa**\n\n';

    if (result.documentData) {
      response += `**Documento verificado:**\n`;
      response += `• Número: ${result.documentData.documentNumber}\n`;
      response += `• Nombre: ${result.documentData.fullName}\n`;
      if (result.documentData.dateOfBirth) {
        response += `• Fecha de nacimiento: ${result.documentData.dateOfBirth}\n`;
      }
    }

    if (result.selfieVerification) {
      response += `\n**Selfie verificada:**\n`;
      response += `• Rostros detectados: ${result.selfieVerification.facesDetected}\n`;
      response += `• Documento visible: ${result.selfieVerification.isHoldingDocument ? 'Sí' : 'No'}\n`;
      response += `• Confianza: ${Math.round(result.selfieVerification.matchConfidence * 100)}%\n`;
    }

    response += `\n🎉 Su cuenta ha sido verificada correctamente.`;

    return response;
  }
}
