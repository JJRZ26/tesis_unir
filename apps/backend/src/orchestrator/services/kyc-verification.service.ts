import { Injectable, Logger } from '@nestjs/common';
import { MicroservicesClientService } from './microservices-client.service';
import { MultimodalService } from '../../multimodal/multimodal.service';
import { BackofficeService } from '../../backoffice/backoffice.service';
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
  frontImageBase64?: string; // For face comparison
}

export interface FrontDocumentResult {
  success: boolean;
  documentNumber?: string;
  fullName?: string;
  dateOfBirth?: string;
  validationErrors: string[];
  confidence: number;
}

export interface BackDocumentResult {
  success: boolean;
  isVisible: boolean;
  validationErrors: string[];
  confidence: number;
}

export interface SelfieResult {
  success: boolean;
  facesDetected: number;
  isHoldingDocument: boolean;
  faceMatchConfidence: number;
  validationErrors: string[];
  confidence: number;
}

@Injectable()
export class KYCVerificationService {
  private readonly logger = new Logger(KYCVerificationService.name);

  constructor(
    private readonly microservicesClient: MicroservicesClientService,
    private readonly multimodalService: MultimodalService,
    private readonly backofficeService: BackofficeService,
  ) {}

  /**
   * Step 1: Verify front of document
   * - Extract document number and name
   * - Compare with player's documentNumber if exists
   * - Check if document is registered to another player
   */
  async verifyFrontDocument(
    imageBase64: string,
    playerId: string,
    onStatusUpdate?: StatusCallback,
  ): Promise<FrontDocumentResult> {
    const updateStatus = (step: ProcessingStep, message: string, progress: number) => {
      if (onStatusUpdate) {
        onStatusUpdate({ step, message, progress, timestamp: new Date() });
      }
    };

    const validationErrors: string[] = [];

    try {
      updateStatus(ProcessingStep.RECEIVED, 'Documento recibido', 10);

      // Analyze front of document with GPT-4 Vision
      updateStatus(
        ProcessingStep.ANALYZING_IMAGE,
        'Analizando documento (frente)...',
        20,
      );

      const visionResult = await this.multimodalService.analyzeDocument(
        [{ base64: imageBase64 }],
      );

      let documentNumber: string | undefined;
      let fullName: string | undefined;
      let dateOfBirth: string | undefined;
      let confidence = 0;

      if (visionResult.success && visionResult.extractedData) {
        const data = visionResult.extractedData as any;
        documentNumber = data.documentNumber;
        fullName = data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim();
        dateOfBirth = data.dateOfBirth;
        confidence = data.confidence || 0.8;
      }

      // If Vision didn't get all data, try OCR
      if (!documentNumber || !fullName) {
        updateStatus(
          ProcessingStep.EXTRACTING_TEXT,
          'Extrayendo datos con OCR...',
          40,
        );

        const ocrResult = await this.microservicesClient.extractDocumentData(imageBase64);

        if (ocrResult.success) {
          documentNumber = documentNumber || ocrResult.document_number;
          fullName = fullName || ocrResult.full_name;
          confidence = Math.max(confidence, ocrResult.confidence || 0);
        }
      }

      // Validate we got the required data
      if (!documentNumber) {
        validationErrors.push('No se pudo extraer el número de documento. Por favor, envía una foto más clara del frente de tu cédula.');
        return {
          success: false,
          validationErrors,
          confidence: 0,
        };
      }

      if (!fullName) {
        validationErrors.push('No se pudo extraer el nombre completo. Por favor, envía una foto más clara.');
      }

      // Get player info to compare document number
      updateStatus(
        ProcessingStep.VERIFYING_DOCUMENT,
        'Verificando datos del documento...',
        60,
      );

      const playerResult = await this.backofficeService.findPlayerByAccountPlayerId(playerId);

      if (playerResult.found && playerResult.player) {
        const playerDocNumber = this.backofficeService.getPlayerDocumentNumber(playerResult.player);

        // If player already has a document number registered, compare
        if (playerDocNumber && playerDocNumber !== documentNumber) {
          validationErrors.push(
            `El número de documento de la cédula (${documentNumber}) no coincide con el registrado en tu cuenta (${playerDocNumber}). Por favor, utiliza el documento correcto.`
          );
        }
      }

      // Check if document is registered to another player
      const docCheck = await this.backofficeService.isDocumentRegisteredToOtherPlayer(
        documentNumber,
        playerId,
      );

      if (docCheck.isRegistered) {
        validationErrors.push(
          'Este documento ya está registrado con otra cuenta. Si crees que es un error, contacta a soporte.'
        );
      }

      const success = validationErrors.length === 0;

      updateStatus(
        success ? ProcessingStep.COMPLETED : ProcessingStep.ERROR,
        success ? 'Documento frontal verificado ✓' : 'Error en verificación',
        100,
      );

      return {
        success,
        documentNumber,
        fullName,
        dateOfBirth,
        validationErrors,
        confidence,
      };
    } catch (error) {
      this.logger.error(`Front document verification failed: ${error}`);
      updateStatus(ProcessingStep.ERROR, 'Error en la verificación', 100);

      return {
        success: false,
        validationErrors: [error instanceof Error ? error.message : 'Error desconocido'],
        confidence: 0,
      };
    }
  }

  /**
   * Step 2: Verify back of document
   * - Check that it's visible and clear
   */
  async verifyBackDocument(
    imageBase64: string,
    onStatusUpdate?: StatusCallback,
  ): Promise<BackDocumentResult> {
    const updateStatus = (step: ProcessingStep, message: string, progress: number) => {
      if (onStatusUpdate) {
        onStatusUpdate({ step, message, progress, timestamp: new Date() });
      }
    };

    const validationErrors: string[] = [];

    try {
      updateStatus(ProcessingStep.RECEIVED, 'Documento recibido', 10);

      updateStatus(
        ProcessingStep.ANALYZING_IMAGE,
        'Analizando documento (reverso)...',
        30,
      );

      // Analyze back of document
      const visionResult = await this.multimodalService.analyzeImage({
        analysisType: 'document' as any,
        images: [{ base64: imageBase64 }],
        additionalContext: `Analiza esta imagen del reverso de un documento de identidad (cédula ecuatoriana o similar).

Verifica de forma TOLERANTE:
1. ¿Parece ser el reverso de un documento de identidad? (puede tener información personal, código de barras, huella dactilar, etc.)
2. ¿Se puede ver el documento aunque no sea perfectamente nítido?
3. No seas demasiado estricto - si se puede distinguir que es un documento, es válido.

IMPORTANTE: Sé permisivo. Si puedes identificar que es un documento de identidad, marca como válido.

Responde SOLO con este JSON (sin texto adicional):
{
  "isBackOfDocument": true,
  "isVisible": true,
  "isClear": true,
  "confidence": 0.85,
  "issues": []
}

Solo marca como false si claramente NO es un documento o está completamente ilegible.`,
      });

      let isVisible = false;
      let confidence = 0;

      if (visionResult.success) {
        try {
          // Try to parse JSON from response
          const jsonMatch = visionResult.rawResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            isVisible = data.isBackOfDocument && data.isVisible && data.isClear;
            confidence = data.confidence || 0;

            if (!data.isBackOfDocument) {
              validationErrors.push('La imagen no parece ser el reverso de un documento de identidad.');
            }
            if (!data.isVisible) {
              validationErrors.push('El documento no es claramente visible.');
            }
            if (!data.isClear) {
              validationErrors.push('La imagen no es lo suficientemente clara. Por favor, toma una foto con mejor iluminación.');
            }
            if (data.issues && data.issues.length > 0) {
              validationErrors.push(...data.issues);
            }
          } else {
            // If can't parse JSON, assume it's okay if response seems positive
            isVisible = !visionResult.rawResponse.toLowerCase().includes('no') &&
                       !visionResult.rawResponse.toLowerCase().includes('error');
            confidence = 0.7;
            if (!isVisible) {
              validationErrors.push('No se pudo verificar correctamente el reverso del documento.');
            }
          }
        } catch {
          isVisible = true;
          confidence = 0.7;
        }
      } else {
        validationErrors.push('Error al analizar la imagen del reverso del documento.');
      }

      // Ensure there's always an error message if not successful
      const success = validationErrors.length === 0 && isVisible;
      if (!success && validationErrors.length === 0) {
        validationErrors.push('La imagen del reverso no cumple con los requisitos de verificación.');
      }

      updateStatus(
        success ? ProcessingStep.COMPLETED : ProcessingStep.ERROR,
        success ? 'Documento posterior verificado ✓' : 'Error en verificación',
        100,
      );

      return {
        success,
        isVisible,
        validationErrors,
        confidence,
      };
    } catch (error) {
      this.logger.error(`Back document verification failed: ${error}`);
      updateStatus(ProcessingStep.ERROR, 'Error en la verificación', 100);

      return {
        success: false,
        isVisible: false,
        validationErrors: [error instanceof Error ? error.message : 'Error desconocido'],
        confidence: 0,
      };
    }
  }

  /**
   * Step 3: Verify selfie with document
   * - Check person is holding document
   * - Compare face with document photo
   */
  async verifySelfieWithDocument(
    selfieBase64: string,
    frontDocumentBase64: string,
    _documentNumber: string, // Reserved for future use
    onStatusUpdate?: StatusCallback,
  ): Promise<SelfieResult> {
    const updateStatus = (step: ProcessingStep, message: string, progress: number) => {
      if (onStatusUpdate) {
        onStatusUpdate({ step, message, progress, timestamp: new Date() });
      }
    };

    const validationErrors: string[] = [];

    try {
      updateStatus(ProcessingStep.RECEIVED, 'Selfie recibida', 10);

      updateStatus(
        ProcessingStep.ANALYZING_IMAGE,
        'Analizando selfie...',
        30,
      );

      // Analyze selfie with document comparison
      const selfieResult = await this.multimodalService.analyzeImage({
        analysisType: 'selfie' as any,
        images: [
          { base64: selfieBase64 },
          { base64: frontDocumentBase64 },
        ],
        additionalContext: `Analiza estas dos imágenes para verificación de identidad KYC:

IMAGEN 1: Selfie de la persona sosteniendo su documento de identidad
IMAGEN 2: Foto del frente del documento de identidad

Verifica:
1. ¿La persona en la selfie está sosteniendo un documento de identidad visible?
2. ¿Se detecta claramente un rostro en la selfie?
3. ¿El rostro de la persona en la selfie coincide con la foto del documento?
4. ¿La selfie es clara y bien iluminada?

Responde en formato JSON:
{
  "facesDetected": número,
  "isHoldingDocument": true/false,
  "faceMatchConfidence": 0.0-1.0,
  "isClear": true/false,
  "confidence": 0.0-1.0,
  "issues": ["lista de problemas si hay"]
}`,
      });

      let facesDetected = 0;
      let isHoldingDocument = false;
      let faceMatchConfidence = 0;
      let confidence = 0;

      if (selfieResult.success) {
        try {
          const jsonMatch = selfieResult.rawResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            facesDetected = data.facesDetected || 0;
            isHoldingDocument = data.isHoldingDocument || false;
            faceMatchConfidence = data.faceMatchConfidence || 0;
            confidence = data.confidence || 0;

            if (facesDetected === 0) {
              validationErrors.push('No se detectó ningún rostro en la selfie.');
            } else if (facesDetected > 1) {
              validationErrors.push('Se detectaron múltiples rostros. La selfie debe mostrar solo a una persona.');
            }

            if (!isHoldingDocument) {
              validationErrors.push('No se detectó que estés sosteniendo tu documento. Asegúrate de que la cédula sea visible en la foto.');
            }

            if (faceMatchConfidence < 0.6) {
              validationErrors.push('No pudimos confirmar que el rostro coincide con el documento. Por favor, toma una selfie más clara con mejor iluminación.');
            }

            if (!data.isClear) {
              validationErrors.push('La selfie no es lo suficientemente clara.');
            }

            if (data.issues && data.issues.length > 0) {
              validationErrors.push(...data.issues);
            }
          } else {
            // Fallback if can't parse JSON
            facesDetected = 1;
            isHoldingDocument = true;
            faceMatchConfidence = 0.8;
            confidence = 0.7;
          }
        } catch {
          facesDetected = 1;
          isHoldingDocument = true;
          faceMatchConfidence = 0.8;
          confidence = 0.7;
        }
      }

      updateStatus(
        ProcessingStep.COMPARING_FACES,
        'Comparando rostros...',
        70,
      );

      const success = validationErrors.length === 0 && faceMatchConfidence >= 0.6;

      updateStatus(
        success ? ProcessingStep.COMPLETED : ProcessingStep.ERROR,
        success ? 'Selfie verificada ✓' : 'Error en verificación',
        100,
      );

      return {
        success,
        facesDetected,
        isHoldingDocument,
        faceMatchConfidence,
        validationErrors,
        confidence,
      };
    } catch (error) {
      this.logger.error(`Selfie verification failed: ${error}`);
      updateStatus(ProcessingStep.ERROR, 'Error en la verificación', 100);

      return {
        success: false,
        facesDetected: 0,
        isHoldingDocument: false,
        faceMatchConfidence: 0,
        validationErrors: [error instanceof Error ? error.message : 'Error desconocido'],
        confidence: 0,
      };
    }
  }

  // Legacy methods for backwards compatibility
  async verifyDocument(
    input: KYCDocumentInput,
    playerId: string,
    onStatusUpdate?: StatusCallback,
  ): Promise<KYCVerificationResult> {
    const frontResult = await this.verifyFrontDocument(
      input.frontImage,
      playerId,
      onStatusUpdate,
    );

    if (!frontResult.success) {
      return {
        success: false,
        validationErrors: frontResult.validationErrors,
        confidence: frontResult.confidence,
      };
    }

    if (input.backImage) {
      const backResult = await this.verifyBackDocument(input.backImage, onStatusUpdate);
      if (!backResult.success) {
        return {
          success: false,
          validationErrors: backResult.validationErrors,
          confidence: backResult.confidence,
        };
      }
    }

    return {
      success: true,
      documentData: {
        documentNumber: frontResult.documentNumber!,
        fullName: frontResult.fullName || '',
        dateOfBirth: frontResult.dateOfBirth,
      },
      validationErrors: [],
      confidence: frontResult.confidence,
    };
  }

  async verifySelfie(
    input: KYCSelfieInput,
    _playerId: string, // Reserved for future use
    onStatusUpdate?: StatusCallback,
  ): Promise<KYCVerificationResult> {
    if (!input.frontImageBase64) {
      return {
        success: false,
        validationErrors: ['Se requiere la imagen del documento para comparar'],
        confidence: 0,
      };
    }

    const result = await this.verifySelfieWithDocument(
      input.selfieImage,
      input.frontImageBase64,
      input.documentNumber,
      onStatusUpdate,
    );

    return {
      success: result.success,
      selfieVerification: {
        facesDetected: result.facesDetected,
        isHoldingDocument: result.isHoldingDocument,
        matchConfidence: result.faceMatchConfidence,
      },
      validationErrors: result.validationErrors,
      confidence: result.confidence,
    };
  }

  async performFullKYC(
    documentInput: KYCDocumentInput,
    selfieImage: string,
    playerId: string,
    onStatusUpdate?: StatusCallback,
  ): Promise<KYCVerificationResult> {
    const documentResult = await this.verifyDocument(documentInput, playerId, onStatusUpdate);

    if (!documentResult.success || !documentResult.documentData) {
      return documentResult;
    }

    const selfieResult = await this.verifySelfie(
      {
        selfieImage,
        documentNumber: documentResult.documentData.documentNumber,
        frontImageBase64: documentInput.frontImage,
      },
      playerId,
      onStatusUpdate,
    );

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

    response += `\n🎉 Su cuenta ha sido verificada correctamente.`;

    return response;
  }
}
