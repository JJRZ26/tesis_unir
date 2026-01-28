import { AnalysisType } from './analyze-image.dto';

export class ExtractedTicketData {
  ticketId?: string;
  amount?: number;
  currency?: string;
  date?: string;
  events?: string[];
  status?: string;
  confidence: number;
}

export class ExtractedDocumentData {
  documentType?: string;
  documentNumber?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  expirationDate?: string;
  nationality?: string;
  confidence: number;
}

export class FaceVerificationData {
  facesDetected: number;
  matchConfidence?: number;
  isHoldingDocument: boolean;
  documentVisible: boolean;
  confidence: number;
}

export class VisionResponseDto {
  success: boolean;
  analysisType: AnalysisType;
  rawResponse: string;
  extractedData?: ExtractedTicketData | ExtractedDocumentData | FaceVerificationData;
  error?: string;
  processingTimeMs: number;
  model: string;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}
