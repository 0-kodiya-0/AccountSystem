import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { InternalApiError, ApiErrorCode, InternalSocketClient, InternalHttpClient } from '../../src';

describe('Error Handling Scenarios', () => {
  const baseUrl = 'https://api.example.com';
  const config = {
    baseUrl,
    serviceId: 'test-service',
    serviceSecret: 'test-secret',
    timeout: 5000,
    enableLogging: false,
  };

  let httpClient: InternalHttpClient;
  let socketClient: InternalSocketClient;

  beforeEach(() => {
    httpClient = new InternalHttpClient(config);
    socketClient = new InternalSocketClient({
      ...config,
      serviceName: 'Test Service',
    });
  });

  afterEach(() => {
    nock.cleanAll();
    socketClient.disconnect();
  });

  describe('HTTP Client Error Scenarios', () => {
    describe('Network Errors', () => {
      it('should handle connection timeout', async () => {
        nock(baseUrl)
          .get('/internal/health')
          .delayConnection(6000) // Longer than timeout
          .reply(200, { success: true });

        await expect(httpClient.healthCheck()).rejects.toThrow(InternalApiError);

        try {
          await httpClient.healthCheck();
        } catch (error) {
          expect(error).toBeInstanceOf(InternalApiError);
          expect((error as InternalApiError).code).toBe(ApiErrorCode.TIMEOUT_ERROR);
          expect((error as InternalApiError).message).toContain('timeout');
        }
      });

      it('should handle connection refused (ECONNREFUSED)', async () => {
        const invalidClient = new InternalHttpClient({
          ...config,
          baseUrl: 'http://localhost:99999',
        });

        await expect(invalidClient.healthCheck()).rejects.toThrow(InternalApiError);

        try {
          await invalidClient.healthCheck();
        } catch (error) {
          expect((error as InternalApiError).code).toBe(ApiErrorCode.CONNECTION_ERROR);
          expect((error as InternalApiError).message).toContain('Connection refused');
        }
      });

      it('should handle DNS resolution failure (ENOTFOUND)', async () => {
        const invalidClient = new InternalHttpClient({
          ...config,
          baseUrl: 'http://nonexistent.domain.invalid',
        });

        await expect(invalidClient.healthCheck()).rejects.toThrow(InternalApiError);

        try {
          await invalidClient.healthCheck();
        } catch (error) {
          expect((error as InternalApiError).code).toBe(ApiErrorCode.CONNECTION_ERROR);
          expect((error as InternalApiError).message).toContain('DNS resolution failed');
        }
      });

      it('should handle generic network errors', async () => {
        // Simulate a network error by not setting up any nock intercept
        // and using a non-existent domain
        const invalidClient = new InternalHttpClient({
          ...config,
          baseUrl: 'http://192.0.2.1', // Test IP that should not exist
        });

        await expect(invalidClient.healthCheck()).rejects.toThrow(InternalApiError);
      });
    });

    describe('HTTP Status Errors', () => {
      it('should handle 400 Bad Request', async () => {
        nock(baseUrl)
          .post('/internal/auth/verify-token')
          .reply(400, {
            success: false,
            error: { code: 'INVALID_REQUEST', message: 'Invalid request format' },
          });

        await expect(httpClient.verifyToken('invalid')).rejects.toThrow(InternalApiError);

        try {
          await httpClient.verifyToken('invalid');
        } catch (error) {
          expect((error as InternalApiError).code).toBe(ApiErrorCode.INVALID_REQUEST);
          expect((error as InternalApiError).statusCode).toBe(400);
        }
      });

      it('should handle 401 Unauthorized', async () => {
        nock(baseUrl)
          .post('/internal/auth/verify-token')
          .reply(401, {
            success: false,
            error: { code: 'AUTH_FAILED', message: 'Authentication failed' },
          });

        await expect(httpClient.verifyToken('invalid')).rejects.toThrow(InternalApiError);

        try {
          await httpClient.verifyToken('invalid');
        } catch (error) {
          expect((error as InternalApiError).code).toBe(ApiErrorCode.AUTH_FAILED);
          expect((error as InternalApiError).statusCode).toBe(401);
        }
      });

      it('should handle 403 Forbidden', async () => {
        nock(baseUrl)
          .get('/internal/users/forbidden')
          .reply(403, {
            success: false,
            error: { code: 'PERMISSION_DENIED', message: 'Access denied' },
          });

        await expect(httpClient.getUserById('forbidden')).rejects.toThrow(InternalApiError);

        try {
          await httpClient.getUserById('forbidden');
        } catch (error) {
          expect((error as InternalApiError).code).toBe(ApiErrorCode.PERMISSION_DENIED);
          expect((error as InternalApiError).statusCode).toBe(403);
        }
      });

      it('should handle 404 Not Found', async () => {
        nock(baseUrl)
          .get('/internal/users/notfound')
          .reply(404, {
            success: false,
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });

        await expect(httpClient.getUserById('notfound')).rejects.toThrow(InternalApiError);

        try {
          await httpClient.getUserById('notfound');
        } catch (error) {
          expect((error as InternalApiError).code).toBe(ApiErrorCode.USER_NOT_FOUND);
          expect((error as InternalApiError).statusCode).toBe(404);
        }
      });

      it('should handle 429 Rate Limited', async () => {
        nock(baseUrl)
          .get('/internal/health')
          .reply(429, {
            success: false,
            error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
          });

        await expect(httpClient.healthCheck()).rejects.toThrow(InternalApiError);

        try {
          await httpClient.healthCheck();
        } catch (error) {
          expect((error as InternalApiError).code).toBe(ApiErrorCode.RATE_LIMIT_EXCEEDED);
          expect((error as InternalApiError).statusCode).toBe(429);
        }
      });

      it('should handle 500 Internal Server Error', async () => {
        nock(baseUrl)
          .get('/internal/health')
          .reply(500, {
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Internal server error' },
          });

        await expect(httpClient.healthCheck()).rejects.toThrow(InternalApiError);

        try {
          await httpClient.healthCheck();
        } catch (error) {
          expect((error as InternalApiError).code).toBe(ApiErrorCode.SERVER_ERROR);
          expect((error as InternalApiError).statusCode).toBe(500);
        }
      });

      it('should handle 502 Bad Gateway', async () => {
        nock(baseUrl).get('/internal/health').reply(502, 'Bad Gateway');

        await expect(httpClient.healthCheck()).rejects.toThrow(InternalApiError);

        try {
          await httpClient.healthCheck();
        } catch (error) {
          expect((error as InternalApiError).code).toBe(ApiErrorCode.SERVICE_UNAVAILABLE);
          expect((error as InternalApiError).statusCode).toBe(502);
        }
      });

      it('should handle 503 Service Unavailable', async () => {
        nock(baseUrl).get('/internal/health').reply(503, 'Service Unavailable');

        await expect(httpClient.healthCheck()).rejects.toThrow(InternalApiError);

        try {
          await httpClient.healthCheck();
        } catch (error) {
          expect((error as InternalApiError).code).toBe(ApiErrorCode.SERVICE_UNAVAILABLE);
          expect((error as InternalApiError).statusCode).toBe(503);
        }
      });
    });

    describe('Response Format Errors', () => {
      it('should handle malformed JSON responses', async () => {
        nock(baseUrl).get('/internal/health').reply(200, 'invalid json response');

        await expect(httpClient.healthCheck()).rejects.toThrow();
      });

      it('should handle empty responses', async () => {
        nock(baseUrl).get('/internal/health').reply(200, '');

        await expect(httpClient.healthCheck()).rejects.toThrow();
      });

      it('should handle non-API response format', async () => {
        nock(baseUrl).get('/internal/health').reply(200, { message: 'Not an API response' }); // Missing success field

        await expect(httpClient.healthCheck()).rejects.toThrow();
      });

      it('should handle API error responses without details', async () => {
        nock(baseUrl)
          .get('/internal/health')
          .reply(400, {
            success: false,
            error: { code: 'UNKNOWN_ERROR' }, // Missing message
          });

        await expect(httpClient.healthCheck()).rejects.toThrow(InternalApiError);
      });
    });
  });

  describe('Socket Client Error Scenarios', () => {
    it('should handle connection failures', async () => {
      const invalidSocketClient = new InternalSocketClient({
        ...config,
        baseUrl: 'http://localhost:99999',
        serviceName: 'Test Service',
        timeout: 1000,
      });

      await expect(invalidSocketClient.connect()).rejects.toThrow('Socket connection failed');
    });

    it('should handle authentication failures', async () => {
      const invalidAuthClient = new InternalSocketClient({
        ...config,
        serviceName: 'Test Service',
        serviceId: '', // Invalid credentials
        serviceSecret: '',
      });

      await expect(invalidAuthClient.connect()).rejects.toThrow();
    });

    it('should handle operations without connection', () => {
      expect(() => {
        socketClient.verifyToken('token', 'access', () => {});
      }).toThrow('Socket not connected');

      expect(() => {
        socketClient.getUserById('123', () => {});
      }).toThrow('Socket not connected');

      expect(() => {
        socketClient.healthCheck(() => {});
      }).toThrow('Socket not connected');
    });

    it('should handle socket disconnection during operation', async () => {
      // This test requires a real socket server setup
      // For now, we'll test the state management
      expect(socketClient.isConnected()).toBe(false);
      expect(socketClient.getReconnectAttempts()).toBe(0);
    });
  });

  describe('Error Utility Functions', () => {
    it('should correctly identify error types', () => {
      const apiError = new InternalApiError(ApiErrorCode.TOKEN_INVALID, 'Invalid token');
      const networkError = new InternalApiError(ApiErrorCode.CONNECTION_ERROR, 'Connection failed');
      const timeoutError = new InternalApiError(ApiErrorCode.TIMEOUT_ERROR, 'Timeout');
      const serviceError = new InternalApiError(ApiErrorCode.SERVICE_UNAVAILABLE, 'Service down');
      const authError = new InternalApiError(ApiErrorCode.AUTH_FAILED, 'Auth failed');
      const tokenExpiredError = new InternalApiError(ApiErrorCode.TOKEN_EXPIRED, 'Token expired');
      const permissionError = new InternalApiError(ApiErrorCode.PERMISSION_DENIED, 'Permission denied');
      const genericError = new Error('Generic error');

      // Test isApiError
      expect(httpClient.isApiError(apiError)).toBe(true);
      expect(httpClient.isApiError(apiError, ApiErrorCode.TOKEN_INVALID)).toBe(true);
      expect(httpClient.isApiError(apiError, ApiErrorCode.AUTH_FAILED)).toBe(false);
      expect(httpClient.isApiError(genericError)).toBe(false);

      // Test isNetworkError
      expect(httpClient.isNetworkError(networkError)).toBe(true);
      expect(httpClient.isNetworkError(timeoutError)).toBe(true);
      expect(httpClient.isNetworkError(serviceError)).toBe(true);
      expect(httpClient.isNetworkError(apiError)).toBe(false);

      // Test isAuthError
      expect(httpClient.isAuthError(authError)).toBe(true);
      expect(httpClient.isAuthError(tokenExpiredError)).toBe(true);
      expect(httpClient.isAuthError(apiError)).toBe(true);
      expect(httpClient.isAuthError(permissionError)).toBe(true);
      expect(httpClient.isAuthError(networkError)).toBe(false);

      // Test getErrorMessage
      expect(httpClient.getErrorMessage(apiError)).toBe('Invalid token');
      expect(httpClient.getErrorMessage(genericError)).toBe('Generic error');
      expect(httpClient.getErrorMessage('string error')).toBe('An unknown error occurred');
      expect(httpClient.getErrorMessage(null)).toBe('An unknown error occurred');
      expect(httpClient.getErrorMessage(undefined)).toBe('An unknown error occurred');
    });

    it('should handle InternalApiError serialization', () => {
      const error = new InternalApiError(ApiErrorCode.TOKEN_INVALID, 'Invalid token', 401, {
        endpoint: '/auth/verify',
        method: 'POST',
      });

      const serialized = error.toJSON();

      expect(serialized).toEqual({
        name: 'InternalApiError',
        code: ApiErrorCode.TOKEN_INVALID,
        message: 'Invalid token',
        statusCode: 401,
        timestamp: error.timestamp,
        details: { endpoint: '/auth/verify', method: 'POST' },
      });

      expect(error.name).toBe('InternalApiError');
      expect(error.code).toBe(ApiErrorCode.TOKEN_INVALID);
      expect(error.statusCode).toBe(401);
      expect(error.details).toEqual({ endpoint: '/auth/verify', method: 'POST' });
      expect(error.timestamp).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle extremely large responses', async () => {
      const largeResponse = {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          server: 'internal-api',
          version: '1.0.0',
          features: { test: true },
          endpoints: { test: '/test' },
          services: { test: 'available' },
          largeArray: new Array(10000).fill('data'),
          largeString: 'x'.repeat(1000000),
        },
      };

      nock(baseUrl).get('/internal/health').reply(200, largeResponse);

      const result = await httpClient.healthCheck();
      expect((result as any).largeArray).toHaveLength(10000);
      expect((result as any).largeString).toHaveLength(1000000);
    });

    it('should handle responses with special characters', async () => {
      const specialResponse = {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          server: 'internal-api',
          version: '1.0.0',
          features: { test: true },
          endpoints: { test: '/test' },
          services: { test: 'available' },
          unicode: '🚀 Unicode test 測試 тест',
          specialChars: '<>!@#$%^&*()_+-=[]{}|;:,.<>?',
          nullBytes: 'test\x00null\x00bytes',
          emojis: '👍😀🎉💯',
        },
      };

      nock(baseUrl).get('/internal/health').reply(200, specialResponse);

      const result = await httpClient.healthCheck();
      expect((result as any).unicode).toBe('🚀 Unicode test 測試 тест');
      expect((result as any).specialChars).toBe('<>!@#$%^&*()_+-=[]{}|;:,.<>?');
      expect((result as any).emojis).toBe('👍😀🎉💯');
    });

    it('should handle concurrent requests', async () => {
      // Set up multiple interceptors
      for (let i = 0; i < 10; i++) {
        nock(baseUrl)
          .get('/internal/health')
          .reply(200, { success: true, data: { status: 'healthy', id: i } });
      }

      const promises = Array.from({ length: 10 }, (_, i) => httpClient.healthCheck());

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect((result as any).id).toBe(index);
      });
    });

    it('should handle request cancellation scenarios', async () => {
      // Note: This is a simplified test as actual cancellation
      // would require AbortController implementation
      nock(baseUrl)
        .get('/internal/health')
        .delayConnection(1000)
        .reply(200, { success: true, data: { status: 'healthy' } });

      const promise = httpClient.healthCheck();

      // Simulate some condition that would cause cancellation
      // In real scenarios, this might be component unmount, navigation, etc.

      // For this test, we'll just ensure the promise still resolves
      await expect(promise).resolves.toBeDefined();
    });
  });
});
