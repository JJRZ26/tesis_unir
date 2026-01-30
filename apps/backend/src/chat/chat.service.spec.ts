import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ChatService } from './chat.service';
import { ChatSession } from './schemas/chat-session.schema';
import { ChatMessage } from './schemas/chat-message.schema';
import { CacheService } from '../cache/cache.service';
import { SessionStatus, MessageRole, ContentType } from './dto';

describe('ChatService', () => {
  let service: ChatService;
  let sessionModel: any;
  let messageModel: any;
  let cacheService: any;

  const mockSession = {
    _id: 'session-123',
    sessionId: 'session-123',
    playerId: 'player-456',
    status: SessionStatus.ACTIVE,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(this),
    toObject: jest.fn().mockReturnValue({
      sessionId: 'session-123',
      playerId: 'player-456',
      status: SessionStatus.ACTIVE,
    }),
  };

  const mockMessage = {
    _id: 'message-789',
    messageId: 'message-789',
    sessionId: 'session-123',
    role: MessageRole.USER,
    content: { type: ContentType.TEXT, text: 'Hello' },
    createdAt: new Date(),
    save: jest.fn().mockResolvedValue(this),
    toObject: jest.fn().mockReturnValue({
      messageId: 'message-789',
      sessionId: 'session-123',
      role: MessageRole.USER,
      content: { type: ContentType.TEXT, text: 'Hello' },
    }),
  };

  const mockSessionModel = {
    create: jest.fn().mockResolvedValue(mockSession),
    findOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockSession),
    }),
    findOneAndUpdate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockSession),
    }),
  };

  const mockMessageModel = {
    create: jest.fn().mockResolvedValue(mockMessage),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([mockMessage]),
          }),
        }),
      }),
    }),
    countDocuments: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    }),
  };

  const mockCacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getModelToken(ChatSession.name),
          useValue: mockSessionModel,
        },
        {
          provide: getModelToken(ChatMessage.name),
          useValue: mockMessageModel,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    sessionModel = module.get(getModelToken(ChatSession.name));
    messageModel = module.get(getModelToken(ChatMessage.name));
    cacheService = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const dto = { playerId: 'player-456' };
      const result = await service.createSession(dto);

      expect(sessionModel.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.playerId).toBe('player-456');
    });

    it('should create anonymous session when no playerId', async () => {
      const dto = {};
      const result = await service.createSession(dto);

      expect(sessionModel.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('getSession', () => {
    it('should return session from cache if available', async () => {
      const cachedSession = { sessionId: 'session-123', playerId: 'player-456' };
      mockCacheService.get.mockResolvedValueOnce(cachedSession);

      const result = await service.getSession('session-123');

      expect(cacheService.get).toHaveBeenCalledWith('session:session-123');
      expect(result).toEqual(cachedSession);
      expect(sessionModel.findOne).not.toHaveBeenCalled();
    });

    it('should return session from database if not in cache', async () => {
      mockCacheService.get.mockResolvedValueOnce(null);

      const result = await service.getSession('session-123');

      expect(cacheService.get).toHaveBeenCalledWith('session:session-123');
      expect(sessionModel.findOne).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null if session not found', async () => {
      mockCacheService.get.mockResolvedValueOnce(null);
      mockSessionModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.getSession('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('addMessage', () => {
    it('should add a message to a session', async () => {
      const dto = {
        sessionId: 'session-123',
        role: MessageRole.USER,
        content: { type: ContentType.TEXT, text: 'Hello' },
      };

      const result = await service.addMessage(dto);

      expect(messageModel.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.role).toBe(MessageRole.USER);
    });
  });

  describe('getMessages', () => {
    it('should return paginated messages', async () => {
      const result = await service.getMessages('session-123', 1, 20);

      expect(messageModel.find).toHaveBeenCalled();
      expect(result.messages).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('closeSession', () => {
    it('should close an active session', async () => {
      const result = await service.closeSession('session-123');

      expect(sessionModel.findOneAndUpdate).toHaveBeenCalled();
      expect(cacheService.delete).toHaveBeenCalledWith('session:session-123');
      expect(result).toBeDefined();
    });
  });
});
