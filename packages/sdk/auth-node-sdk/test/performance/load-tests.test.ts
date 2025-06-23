import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { InternalHttpClient, InternalApiSdk } from '../../src';
import { mockTokenVerificationResponse, mockUserResponse } from '../helpers/mock-data';

describe('Performance and Load Tests', () => {
  const baseUrl = 'https://api.example.com';
  const config = {
    baseUrl,
    serviceId: 'test-service',
    serviceSecret: 'test-secret',
    timeout: 10000,
    enableLogging: false,
  };

  let httpClient: InternalHttpClient;

  beforeEach(() => {
    httpClient = new InternalHttpClient(config);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('HTTP Client Performance with Mocked Responses', () => {
    it('should handle high-frequency requests efficiently', async () => {
      const requestCount = 100;
      const startTime = Date.now();

      // Set up interceptors for all requests
      for (let i = 0; i < requestCount; i++) {
        nock(baseUrl)
          .post('/internal/auth/verify-token')
          .reply(200, { success: true, data: mockTokenVerificationResponse });
      }

      const promises: Promise<any>[] = Array.from({ length: requestCount }, (_, i) =>
        httpClient.verifyToken(`token_${i}`, 'access'),
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(requestCount);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      const avgResponseTime = duration / requestCount;
      expect(avgResponseTime).toBeLessThan(50); // Average response time should be under 50ms
    });

    it('should handle concurrent requests to different endpoints', async () => {
      const requestCount = 50;
      const startTime = Date.now();

      // Set up interceptors for different endpoints
      for (let i = 0; i < requestCount; i++) {
        nock(baseUrl)
          .post('/internal/auth/verify-token')
          .reply(200, { success: true, data: mockTokenVerificationResponse });

        nock(baseUrl)
          .get(`/internal/users/user_${i}`)
          .reply(200, {
            success: true,
            data: { ...mockUserResponse, user: { ...mockUserResponse.user, _id: `user_${i}` } },
          });

        nock(baseUrl)
          .get('/internal/health')
          .reply(200, { success: true, data: { status: 'healthy' } });
      }

      const promises: Promise<any>[] = [];

      for (let i = 0; i < requestCount; i++) {
        promises.push(
          httpClient.verifyToken(`token_${i}`, 'access'),
          httpClient.getUserById(`user_${i}`),
          httpClient.healthCheck(),
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(requestCount * 3);
      expect(duration).toBeLessThan(8000); // Should complete within 8 seconds
    });
  });

  describe('SDK Middleware Performance', () => {
    it('should process authentication middleware efficiently', async () => {
      const sdk = new InternalApiSdk({
        httpClient,
        enableLogging: false,
      });

      // Mock the HTTP client methods
      vi.spyOn(httpClient, 'verifyToken').mockResolvedValue(mockTokenVerificationResponse);
      vi.spyOn(httpClient, 'getUserById').mockResolvedValue(mockUserResponse);

      const requestCount = 100;
      const startTime = Date.now();

      const promises = Array.from({ length: requestCount }, async () => {
        const mockReq = {
          headers: { authorization: 'Bearer valid_token' },
          cookies: {},
          internalApi: { http: httpClient },
        } as any;

        const mockRes = {} as any;

        return new Promise<void>((resolve, reject) => {
          const middleware = sdk.verifyAccessToken();
          middleware(mockReq, mockRes, (error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      });

      await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000); // Should be very fast with mocked HTTP

      const avgProcessingTime = duration / requestCount;
      expect(avgProcessingTime).toBeLessThan(20); // Should be very fast
    });

    it('should handle middleware chain efficiently', async () => {
      const sdk = new InternalApiSdk({
        httpClient,
        enableLogging: false,
      });

      // Mock all required methods
      vi.spyOn(httpClient, 'verifyToken').mockResolvedValue(mockTokenVerificationResponse);
      vi.spyOn(httpClient, 'getUserById').mockResolvedValue(mockUserResponse);
      vi.spyOn(httpClient, 'checkUserExists').mockResolvedValue({
        exists: true,
        accountId: '507f1f77bcf86cd799439011',
      });

      const middlewares = sdk.authenticate();
      const requestCount = 50;
      const startTime = Date.now();

      const promises = Array.from({ length: requestCount }, async () => {
        const mockReq = {
          headers: { authorization: 'Bearer valid_token' },
          cookies: {},
        } as any;

        const mockRes = {} as any;

        // Execute all middleware in sequence
        for (const middleware of middlewares) {
          await new Promise<void>((resolve, reject) => {
            middleware(mockReq, mockRes, (error) => {
              if (error) reject(error);
              else resolve();
            });
          });
        }
      });

      await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(3000);

      const avgProcessingTime = duration / requestCount;
      expect(avgProcessingTime).toBeLessThan(60); // Should be reasonably fast
    });
  });

  describe('Resource Management', () => {
    it('should properly clean up mocked HTTP connections', async () => {
      const requestCount = 50;

      // Set up interceptors
      for (let i = 0; i < requestCount; i++) {
        nock(baseUrl)
          .get('/internal/health')
          .reply(200, { success: true, data: { status: 'healthy' } });
      }

      // Make requests
      const promises = Array.from({ length: requestCount }, () => httpClient.healthCheck());

      await Promise.all(promises);

      // Verify all nock interceptors were used
      expect(nock.isDone()).toBe(true);

      // Check that no interceptors are pending
      expect(nock.pendingMocks()).toHaveLength(0);
    });
  });
});
