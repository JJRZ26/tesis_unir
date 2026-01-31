export enum ProcessingStep {
  RECEIVED = 'received',
  ANALYZING_IMAGE = 'analyzing_image',
  EXTRACTING_TEXT = 'extracting_text',
  PROCESSING_NLP = 'processing_nlp',
  QUERYING_API = 'querying_api',
  VERIFYING_DOCUMENT = 'verifying_document',
  COMPARING_FACES = 'comparing_faces',
  GENERATING_RESPONSE = 'generating_response',
  COMPLETED = 'completed',
  ERROR = 'error',
}

export enum FlowType {
  TICKET_VERIFICATION = 'ticket_verification',
  KYC_DOCUMENT = 'kyc_document',
  KYC_SELFIE = 'kyc_selfie',
  GENERAL_QUERY = 'general_query',
}

export interface ProcessingStatus {
  step: ProcessingStep;
  message: string;
  progress: number; // 0-100
  timestamp: Date;
}

export interface TicketVerificationResult {
  success: boolean;
  ticketId?: string;
  ticketData?: {
    status: string;
    amount: number;
    currency: string;
    events: TicketEvent[];
    createdAt: string;
    paidAt?: string;
  };
  // Bet document from backoffice database
  bet?: any;
  userQuestion?: string;
  confidence: number;
  error?: string;
}

export interface TicketEvent {
  eventId: string;
  name: string;
  sport: string;
  selection: string;
  odds: number;
  result?: 'won' | 'lost' | 'pending' | 'void';
}

export interface KYCVerificationResult {
  success: boolean;
  documentData?: {
    documentNumber: string;
    fullName: string;
    dateOfBirth?: string;
    expirationDate?: string;
  };
  selfieVerification?: {
    facesDetected: number;
    isHoldingDocument: boolean;
    matchConfidence: number;
  };
  validationErrors: string[];
  confidence: number;
}

export interface OCRServiceResponse {
  success: boolean;
  text?: string;
  ticket_id?: string;
  document_number?: string;
  full_name?: string;
  confidence?: number;
  error?: string;
  raw_text?: string;
}

export interface NLPServiceResponse {
  text: string;
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  intent: {
    type: string;
    confidence: number;
  };
}

export interface ClusteringServiceResponse {
  results: Array<{
    text: string;
    similarity: number;
  }>;
}
