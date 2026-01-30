import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { SessionStatus } from '../src/chat/dto';

describe('ChatController (e2e)', () => {
  let app: INestApplication;
  let sessionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/chat/sessions (POST)', () => {
    it('should create a new anonymous session', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/chat/sessions')
        .send({})
        .expect(201);

      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('status', SessionStatus.ACTIVE);
      expect(response.body.playerId).toBeNull();

      sessionId = response.body.sessionId;
    });

    it('should create a session with playerId', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/chat/sessions')
        .send({ playerId: 'player-test-123' })
        .expect(201);

      expect(response.body).toHaveProperty('sessionId');
      expect(response.body.playerId).toBe('player-test-123');
    });

    it('should create a session with metadata', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/chat/sessions')
        .send({
          playerId: 'player-test-456',
          metadata: { source: 'web', language: 'es' },
        })
        .expect(201);

      expect(response.body.metadata).toEqual({ source: 'web', language: 'es' });
    });
  });

  describe('/api/chat/sessions/:sessionId (GET)', () => {
    it('should return an existing session', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/chat/sessions/${sessionId}`)
        .expect(200);

      expect(response.body.sessionId).toBe(sessionId);
      expect(response.body.status).toBe(SessionStatus.ACTIVE);
    });

    it('should return 404 for non-existent session', async () => {
      await request(app.getHttpServer())
        .get('/api/chat/sessions/nonexistent-session-id')
        .expect(404);
    });
  });

  describe('/api/chat/sessions/:sessionId/messages (POST)', () => {
    it('should add a text message to session', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/chat/sessions/${sessionId}/messages`)
        .send({
          content: {
            type: 'text',
            text: 'Hola, necesito verificar mi ticket',
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty('messageId');
      expect(response.body.role).toBe('user');
      expect(response.body.content.text).toBe('Hola, necesito verificar mi ticket');
    });

    it('should add a message with image', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/chat/sessions/${sessionId}/messages`)
        .send({
          content: {
            type: 'mixed',
            text: 'Este es mi ticket',
            images: [
              {
                data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                mimeType: 'image/png',
              },
            ],
          },
        })
        .expect(201);

      expect(response.body.content.type).toBe('mixed');
      expect(response.body.content.images).toHaveLength(1);
    });

    it('should reject message with invalid content', async () => {
      await request(app.getHttpServer())
        .post(`/api/chat/sessions/${sessionId}/messages`)
        .send({
          content: {},
        })
        .expect(400);
    });
  });

  describe('/api/chat/sessions/:sessionId/messages (GET)', () => {
    it('should return messages with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/chat/sessions/${sessionId}/messages`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('messages');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 10);
      expect(Array.isArray(response.body.messages)).toBe(true);
    });

    it('should return empty messages for non-existent session', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/chat/sessions/nonexistent/messages')
        .expect(200);

      expect(response.body.messages).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });
  });

  describe('/api/chat/sessions/:sessionId (DELETE)', () => {
    it('should close an active session', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/chat/sessions/${sessionId}`)
        .expect(200);

      expect(response.body.status).toBe(SessionStatus.CLOSED);
    });

    it('should return 404 for non-existent session', async () => {
      await request(app.getHttpServer())
        .delete('/api/chat/sessions/nonexistent-session')
        .expect(404);
    });
  });
});
