import { Test, TestingModule } from '@nestjs/testing';
import { MultimodalService } from './multimodal.service';
import { OpenAIService } from './openai.service';
import { ImageType } from './interfaces/vision.types';

describe('MultimodalService', () => {
  let service: MultimodalService;
  let openaiService: any;

  const mockOpenAIService = {
    isAvailable: jest.fn().mockReturnValue(true),
    analyzeImage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MultimodalService,
        {
          provide: OpenAIService,
          useValue: mockOpenAIService,
        },
      ],
    }).compile();

    service = module.get<MultimodalService>(MultimodalService);
    openaiService = module.get<OpenAIService>(OpenAIService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeImage', () => {
    it('should analyze an image with custom prompt', async () => {
      const mockResponse = {
        analysis: 'This is a test image',
        confidence: 0.95,
      };
      mockOpenAIService.analyzeImage.mockResolvedValue(mockResponse);

      const result = await service.analyzeImage(
        'base64imagedata',
        'image/png',
        'Describe this image',
      );

      expect(openaiService.analyzeImage).toHaveBeenCalledWith(
        'base64imagedata',
        'image/png',
        'Describe this image',
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('analyzeTicket', () => {
    it('should extract ticket information from image', async () => {
      const mockResponse = {
        imageType: ImageType.TICKET,
        ticketId: 'TKT-123456',
        confidence: 0.92,
        extractedData: {
          ticketId: 'TKT-123456',
          date: '2024-01-15',
          amount: '50.00',
        },
      };
      mockOpenAIService.analyzeImage.mockResolvedValue(mockResponse);

      const result = await service.analyzeTicket('base64imagedata', 'image/jpeg');

      expect(openaiService.analyzeImage).toHaveBeenCalled();
      expect(result.imageType).toBe(ImageType.TICKET);
    });

    it('should handle image without ticket', async () => {
      const mockResponse = {
        imageType: ImageType.OTHER,
        confidence: 0.3,
        extractedData: null,
      };
      mockOpenAIService.analyzeImage.mockResolvedValue(mockResponse);

      const result = await service.analyzeTicket('base64imagedata', 'image/jpeg');

      expect(result.imageType).toBe(ImageType.OTHER);
    });
  });

  describe('analyzeDocument', () => {
    it('should extract document information', async () => {
      const mockResponse = {
        imageType: ImageType.ID_DOCUMENT,
        documentNumber: '1234567890',
        fullName: 'Juan Pérez',
        confidence: 0.88,
      };
      mockOpenAIService.analyzeImage.mockResolvedValue(mockResponse);

      const result = await service.analyzeDocument('base64imagedata', 'image/png');

      expect(openaiService.analyzeImage).toHaveBeenCalled();
      expect(result.imageType).toBe(ImageType.ID_DOCUMENT);
    });
  });

  describe('analyzeSelfie', () => {
    it('should analyze selfie with document', async () => {
      const mockResponse = {
        imageType: ImageType.SELFIE_WITH_DOCUMENT,
        faceDetected: true,
        documentVisible: true,
        confidence: 0.85,
      };
      mockOpenAIService.analyzeImage.mockResolvedValue(mockResponse);

      const result = await service.analyzeSelfie('base64imagedata', 'image/jpeg');

      expect(openaiService.analyzeImage).toHaveBeenCalled();
      expect(result.faceDetected).toBe(true);
    });
  });

  describe('getServiceStatus', () => {
    it('should return service status', () => {
      mockOpenAIService.isAvailable.mockReturnValue(true);

      const status = service.getServiceStatus();

      expect(status.available).toBe(true);
      expect(status.provider).toBe('openai');
    });

    it('should return unavailable when OpenAI is not configured', () => {
      mockOpenAIService.isAvailable.mockReturnValue(false);

      const status = service.getServiceStatus();

      expect(status.available).toBe(false);
    });
  });
});
