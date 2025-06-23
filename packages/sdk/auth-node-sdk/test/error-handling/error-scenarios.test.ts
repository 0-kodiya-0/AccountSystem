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
    });

    describe('HTTP Status Errors', () => {
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
    });

    describe('Response Format Errors', () => {
      it('should handle malformed JSON responses', async () => {
        nock(baseUrl).get('/internal/health').reply(200, 'invalid json response');

        await expect(httpClient.healthCheck()).rejects.toThrow();
      });

      it('should handle non-API response format', async () => {
        nock(baseUrl).get('/internal/health').reply(200, { message: 'Not an API response' }); // Missing success field

        await expect(httpClient.healthCheck()).rejects.toThrow();
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
});
