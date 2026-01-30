import { Test, TestingModule } from '@nestjs/testing';
import { OrchestratorService } from './orchestrator.service';
import { MicroservicesClientService } from './services/microservices-client.service';
import { TicketVerificationService } from './services/ticket-verification.service';
import { KYCVerificationService } from './services/kyc-verification.service';
import { MultimodalService } from '../multimodal/multimodal.service';
import { ChatService } from '../chat/chat.service';
import { FlowType } from './interfaces/orchestrator.types';
import { ImageType } from '../multimodal/interfaces/vision.types';

describe('OrchestratorService', () => {
  let service: OrchestratorService;

  const mockMicroservicesClient = {
    checkAllServicesHealth: jest.fn().mockResolvedValue({
      ocr: { status: 'healthy' },
      nlp: { status: 'healthy' },
      clustering: { status: 'healthy' },
    }),
    analyzeTextWithNLP: jest.fn().mockResolvedValue({
      intent: { type: 'greeting', confidence: 0.9 },
      entities: [],
    }),
  };

  const mockTicketVerification = {
    verifyTicket: jest.fn().mockResolvedValue({
      success: true,
      ticketId: 'TKT-123',
      status: 'active',
    }),
  };

  const mockKYCVerification = {
    verifyDocument: jest.fn().mockResolvedValue({
      success: true,
      documentNumber: '123456789',
      fullName: 'Juan Pérez',
    }),
    verifySelfie: jest.fn().mockResolvedValue({
      success: true,
      faceMatch: true,
      confidence: 0.92,
    }),
    performFullKYC: jest.fn().mockResolvedValue({
      success: true,
      verified: true,
    }),
  };

  const mockMultimodalService = {
    analyzeImage: jest.fn().mockResolvedValue({
      imageType: ImageType.TICKET,
      confidence: 0.9,
    }),
    getServiceStatus: jest.fn().mockReturnValue({ available: true }),
  };

  const mockChatService = {
    addMessage: jest.fn().mockResolvedValue({
      messageId: 'msg-123',
      content: { text: 'Test response' },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        {
          provide: MicroservicesClientService,
          useValue: mockMicroservicesClient,
        },
        {
          provide: TicketVerificationService,
          useValue: mockTicketVerification,
        },
        {
          provide: KYCVerificationService,
          useValue: mockKYCVerification,
        },
        {
          provide: MultimodalService,
          useValue: mockMultimodalService,
        },
        {
          provide: ChatService,
          useValue: mockChatService,
        },
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkServicesHealth', () => {
    it('should return health status of all services', async () => {
      const result = await service.checkServicesHealth();

      expect(mockMicroservicesClient.checkAllServicesHealth).toHaveBeenCalled();
      expect(result).toHaveProperty('ocr');
      expect(result).toHaveProperty('nlp');
      expect(result).toHaveProperty('clustering');
    });
  });

  describe('processMessage', () => {
    it('should process text-only message', async () => {
      const dto = {
        sessionId: 'session-123',
        content: 'Hola, necesito ayuda',
        images: [],
      };

      const result = await service.processMessage(dto);

      expect(mockMicroservicesClient.analyzeTextWithNLP).toHaveBeenCalled();
      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('flowType');
    });

    it('should detect ticket verification flow from image', async () => {
      mockMultimodalService.analyzeImage.mockResolvedValueOnce({
        imageType: ImageType.TICKET,
        confidence: 0.95,
      });

      const dto = {
        sessionId: 'session-123',
        content: 'Este es mi ticket',
        images: [{ data: 'base64data', mimeType: 'image/jpeg' }],
      };

      const result = await service.processMessage(dto);

      expect(mockMultimodalService.analyzeImage).toHaveBeenCalled();
      expect(result.flowType).toBe(FlowType.TICKET_VERIFICATION);
    });

    it('should detect KYC flow from document image', async () => {
      mockMultimodalService.analyzeImage.mockResolvedValueOnce({
        imageType: ImageType.ID_DOCUMENT,
        confidence: 0.9,
      });

      const dto = {
        sessionId: 'session-123',
        playerId: 'player-456',
        content: 'Aquí está mi cédula',
        images: [{ data: 'base64data', mimeType: 'image/jpeg' }],
      };

      const result = await service.processMessage(dto);

      expect(result.flowType).toBe(FlowType.KYC_VERIFICATION);
    });
  });

  describe('verifyTicket', () => {
    it('should verify ticket from image', async () => {
      const result = await service.verifyTicket('base64imagedata');

      expect(mockTicketVerification.verifyTicket).toHaveBeenCalledWith(
        'base64imagedata',
        undefined,
      );
      expect(result.success).toBe(true);
    });
  });

  describe('verifyDocument', () => {
    it('should verify KYC document', async () => {
      const result = await service.verifyDocument('base64imagedata', 'player-123');

      expect(mockKYCVerification.verifyDocument).toHaveBeenCalledWith(
        'base64imagedata',
        'player-123',
        undefined,
      );
      expect(result.success).toBe(true);
    });
  });

  describe('verifySelfie', () => {
    it('should verify selfie against document', async () => {
      const result = await service.verifySelfie(
        'selfieBase64',
        'documentBase64',
        'player-123',
      );

      expect(mockKYCVerification.verifySelfie).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('performFullKYC', () => {
    it('should perform complete KYC verification', async () => {
      const result = await service.performFullKYC(
        'frontDoc',
        'backDoc',
        'selfie',
        'player-123',
      );

      expect(mockKYCVerification.performFullKYC).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });
});
