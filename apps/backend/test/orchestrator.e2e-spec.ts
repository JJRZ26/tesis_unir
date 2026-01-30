import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('OrchestratorController (e2e)', () => {
  let app: INestApplication;

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

  describe('/api/orchestrator/health (GET)', () => {
    it('should return health status of all services', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/orchestrator/health')
        .expect(200);

      expect(response.body).toHaveProperty('ocr');
      expect(response.body).toHaveProperty('nlp');
      expect(response.body).toHaveProperty('clustering');
      expect(response.body).toHaveProperty('vision');

      // Each service should have a status
      ['ocr', 'nlp', 'clustering', 'vision'].forEach((service) => {
        expect(response.body[service]).toHaveProperty('status');
      });
    });
  });

  describe('/api/orchestrator/process (POST)', () => {
    it('should process a text message', async () => {
      // First create a session
      const sessionResponse = await request(app.getHttpServer())
        .post('/api/chat/sessions')
        .send({})
        .expect(201);

      const sessionId = sessionResponse.body.sessionId;

      const response = await request(app.getHttpServer())
        .post('/api/orchestrator/process')
        .send({
          sessionId,
          content: 'Hola, necesito ayuda',
          images: [],
        })
        .expect(201);

      expect(response.body).toHaveProperty('response');
      expect(response.body).toHaveProperty('flowType');
    });

    it('should require sessionId', async () => {
      await request(app.getHttpServer())
        .post('/api/orchestrator/process')
        .send({
          content: 'Test message',
        })
        .expect(400);
    });

    it('should require content or images', async () => {
      const sessionResponse = await request(app.getHttpServer())
        .post('/api/chat/sessions')
        .send({})
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/orchestrator/process')
        .send({
          sessionId: sessionResponse.body.sessionId,
        })
        .expect(400);
    });
  });

  describe('/api/orchestrator/verify/ticket (POST)', () => {
    it('should verify a ticket image', async () => {
      // Using a minimal valid base64 PNG
      const testImage =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const response = await request(app.getHttpServer())
        .post('/api/orchestrator/verify/ticket')
        .send({
          imageBase64: testImage,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success');
      // The actual verification might fail with a test image, but the endpoint should work
    });

    it('should require imageBase64', async () => {
      await request(app.getHttpServer())
        .post('/api/orchestrator/verify/ticket')
        .send({})
        .expect(400);
    });
  });

  describe('/api/orchestrator/verify/document (POST)', () => {
    it('should verify a document image', async () => {
      const testImage =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const response = await request(app.getHttpServer())
        .post('/api/orchestrator/verify/document')
        .send({
          imageBase64: testImage,
          playerId: 'player-test-123',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success');
    });

    it('should require playerId for document verification', async () => {
      const testImage =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      await request(app.getHttpServer())
        .post('/api/orchestrator/verify/document')
        .send({
          imageBase64: testImage,
        })
        .expect(400);
    });
  });

  describe('/api/orchestrator/verify/selfie (POST)', () => {
    it('should verify a selfie image', async () => {
      const testImage =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const response = await request(app.getHttpServer())
        .post('/api/orchestrator/verify/selfie')
        .send({
          selfieBase64: testImage,
          documentBase64: testImage,
          playerId: 'player-test-123',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success');
    });
  });

  describe('/api/orchestrator/verify/kyc (POST)', () => {
    it('should perform full KYC verification', async () => {
      const testImage =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const response = await request(app.getHttpServer())
        .post('/api/orchestrator/verify/kyc')
        .send({
          frontDocumentBase64: testImage,
          backDocumentBase64: testImage,
          selfieBase64: testImage,
          playerId: 'player-test-123',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success');
    });

    it('should require all images for full KYC', async () => {
      const testImage =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      await request(app.getHttpServer())
        .post('/api/orchestrator/verify/kyc')
        .send({
          frontDocumentBase64: testImage,
          // Missing backDocumentBase64 and selfieBase64
          playerId: 'player-test-123',
        })
        .expect(400);
    });
  });
});
