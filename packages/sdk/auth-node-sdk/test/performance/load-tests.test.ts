import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { InternalHttpClient, InternalSocketClient, InternalApiSdk } from '../../src';
import { TestSocketServer } from '../helpers/socket-server';
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
  let socketClient: InternalSocketClient;
  let testServer: TestSocketServer;
  let serverPort: number;

  beforeEach(async () => {
    httpClient = new InternalHttpClient(config);

    testServer = new TestSocketServer();
    serverPort = await testServer.start();

    socketClient = new InternalSocketClient({
      ...config,
      baseUrl: `http://localhost:${serverPort}`,
      serviceName: 'Performance Test Service',
    });
  });

  afterEach(async () => {
    nock.cleanAll();
    socketClient.disconnect();
    await testServer.stop();
  });

  describe('HTTP Client Performance', () => {
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

      console.log(
        `Completed ${requestCount} requests in ${duration}ms (avg: ${avgResponseTime.toFixed(2)}ms per request)`,
      );
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

      console.log(`Completed ${requestCount * 3} mixed requests in ${duration}ms`);
    });

    it('should handle memory efficiently with large responses', async () => {
      const largeData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        server: 'internal-api',
        version: '1.0.0',
        features: { test: true },
        endpoints: { test: '/test' },
        services: { test: 'available' },
        users: Array.from({ length: 1000 }, (_, i) => ({
          id: `user_${i}`,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          data: 'x'.repeat(1000), // 1KB of data per user
        })),
      };

      nock(baseUrl).get('/internal/health').reply(200, { success: true, data: largeData });

      const initialMemory = process.memoryUsage().heapUsed;

      // Make the request multiple times to test memory usage
      for (let i = 0; i < 10; i++) {
        nock(baseUrl).get('/internal/health').reply(200, { success: true, data: largeData });

        await httpClient.healthCheck();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle request timeouts gracefully under load', async () => {
      const requestCount = 20;
      const timeoutCount = 5;

      // Set up some requests to timeout
      for (let i = 0; i < timeoutCount; i++) {
        nock(baseUrl)
          .get('/internal/health')
          .delayConnection(6000) // Longer than client timeout
          .reply(200, { success: true });
      }

      // Set up some requests to succeed
      for (let i = 0; i < requestCount - timeoutCount; i++) {
        nock(baseUrl)
          .get('/internal/health')
          .reply(200, { success: true, data: { status: 'healthy' } });
      }

      const promises = Array.from({ length: requestCount }, () =>
        httpClient.healthCheck().catch((error) => ({ error: error.message })),
      );

      const results = await Promise.all(promises);

      const successCount = results.filter((r) => !('error' in r)).length;
      const timeoutErrors = results.filter((r) => 'error' in r && r.error.includes('timeout')).length;

      expect(successCount).toBe(requestCount - timeoutCount);
      expect(timeoutErrors).toBe(timeoutCount);

      console.log(`${successCount} successful, ${timeoutErrors} timed out`);
    });
  });

  describe('Socket Client Performance', () => {
    beforeEach(async () => {
      await socketClient.connect();
    });

    it('should handle rapid sequential requests', async () => {
      const requestCount = 50;
      const startTime = Date.now();

      const promises = Array.from(
        { length: requestCount },
        (_, i) =>
          new Promise((resolve, reject) => {
            socketClient.verifyToken(`token_${i}`, 'access', (response) => {
              if (response.success) {
                resolve(response.data);
              } else {
                reject(new Error(response.error?.message));
              }
            });
          }),
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(requestCount);
      expect(duration).toBeLessThan(3000); // Socket should be faster than HTTP

      const avgResponseTime = duration / requestCount;
      console.log(
        `Socket: Completed ${requestCount} requests in ${duration}ms (avg: ${avgResponseTime.toFixed(
          2,
        )}ms per request)`,
      );
    });

    it('should maintain connection stability under load', async () => {
      const requestCount = 100;
      let successCount = 0;
      let errorCount = 0;

      const promises = Array.from(
        { length: requestCount },
        (_, i) =>
          new Promise<void>((resolve) => {
            socketClient.getUserById(`user_${i}`, (response) => {
              if (response.success) {
                successCount++;
              } else {
                errorCount++;
              }
              resolve();
            });
          }),
      );

      await Promise.all(promises);

      expect(socketClient.isConnected()).toBe(true);
      expect(successCount + errorCount).toBe(requestCount);
      expect(successCount).toBeGreaterThan(requestCount * 0.9); // At least 90% success rate

      console.log(
        `Socket stability: ${successCount}/${requestCount} successful (${((successCount / requestCount) * 100).toFixed(
          1,
        )}%)`,
      );
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
      console.log(
        `Middleware: Processed ${requestCount} requests in ${duration}ms (avg: ${avgProcessingTime.toFixed(
          2,
        )}ms per request)`,
      );
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
      vi.spyOn(httpClient, 'getSessionInfo').mockResolvedValue({
        session: {
          accountIds: ['507f1f77bcf86cd799439011'],
          currentAccountId: '507f1f77bcf86cd799439011',
          sessionId: 'session_123',
          createdAt: '2024-01-01T00:00:00.000Z',
          lastActivity: '2024-01-01T01:00:00.000Z',
        },
      });

      const middlewares = sdk.authorize();
      const requestCount = 50;
      const startTime = Date.now();

      const promises = Array.from({ length: requestCount }, async () => {
        const mockReq = {
          headers: { authorization: 'Bearer valid_token' },
          cookies: { account_session: 'session_cookie' },
          params: { accountId: '507f1f77bcf86cd799439011' },
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
      console.log(
        `Full middleware chain: Processed ${requestCount} requests in ${duration}ms (avg: ${avgProcessingTime.toFixed(
          2,
        )}ms per request)`,
      );
    });
  });

  describe('Resource Management', () => {
    it('should properly clean up HTTP connections', async () => {
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

    it('should handle client recreation efficiently', async () => {
      const clientCount = 10;
      const requestsPerClient = 5;

      const startTime = Date.now();

      for (let i = 0; i < clientCount; i++) {
        const client = new InternalHttpClient({
          ...config,
          serviceId: `service_${i}`,
        });

        // Set up interceptors for this client
        for (let j = 0; j < requestsPerClient; j++) {
          nock(baseUrl)
            .get('/internal/health')
            .reply(200, { success: true, data: { status: 'healthy', client: i, request: j } });
        }

        // Make requests with this client
        const promises = Array.from({ length: requestsPerClient }, (_, j) => client.healthCheck());

        await Promise.all(promises);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const totalRequests = clientCount * requestsPerClient;

      expect(duration).toBeLessThan(5000);
      console.log(`Client recreation: ${clientCount} clients, ${totalRequests} total requests in ${duration}ms`);
    });

    it('should handle socket connection lifecycle efficiently', async () => {
      const connectionCount = 5;
      const requestsPerConnection = 10;

      const startTime = Date.now();

      for (let i = 0; i < connectionCount; i++) {
        const client = new InternalSocketClient({
          ...config,
          baseUrl: `http://localhost:${serverPort}`,
          serviceName: `Performance Test Service ${i}`,
        });

        await client.connect();
        expect(client.isConnected()).toBe(true);

        // Make requests
        const promises = Array.from(
          { length: requestsPerConnection },
          (_, j) =>
            new Promise<void>((resolve) => {
              client.healthCheck((response) => {
                expect(response.success).toBe(true);
                resolve();
              });
            }),
        );

        await Promise.all(promises);

        client.disconnect();
        expect(client.isConnected()).toBe(false);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const totalRequests = connectionCount * requestsPerConnection;

      expect(duration).toBeLessThan(8000);
      console.log(`Socket lifecycle: ${connectionCount} connections, ${totalRequests} total requests in ${duration}ms`);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle errors efficiently without memory leaks', async () => {
      const errorCount = 100;
      const startTime = Date.now();

      // Set up interceptors that will return errors
      for (let i = 0; i < errorCount; i++) {
        nock(baseUrl)
          .get('/internal/health')
          .reply(500, { success: false, error: { code: 'SERVER_ERROR', message: `Error ${i}` } });
      }

      const promises = Array.from({ length: errorCount }, (_, i) =>
        httpClient.healthCheck().catch((error) => ({ errorIndex: i, message: error.message })),
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(errorCount);
      expect(results.every((r) => 'errorIndex' in r)).toBe(true);
      expect(duration).toBeLessThan(3000);

      console.log(`Error handling: ${errorCount} errors processed in ${duration}ms`);
    });
  });
});
