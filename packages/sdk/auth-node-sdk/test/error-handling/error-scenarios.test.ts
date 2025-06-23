import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InternalApiError, ApiErrorCode, InternalSocketClient, InternalHttpClient } from '../../src';

describe('Error Handling Scenarios', () => {
  const baseUrl = 'https://api.example.com';
  const config = {
    baseUrl,
    serviceId: 'test-service',
    serviceSecret: 'test-secret',
    serviceName: 'Test Service',
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
    socketClient.disconnect();
  });

  describe('Socket Client Error Scenarios', () => {
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

  describe('Error Class Construction', () => {
    it('should create error with all parameters', () => {
      const error = new InternalApiError(ApiErrorCode.VALIDATION_ERROR, 'Validation failed', 422, { field: 'email' });

      expect(error.code).toBe(ApiErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(422);
      expect(error.details).toEqual({ field: 'email' });
      expect(error.name).toBe('InternalApiError');
      expect(error.timestamp).toBeDefined();
    });

    it('should create error with minimal parameters', () => {
      const error = new InternalApiError(ApiErrorCode.SERVER_ERROR, 'Server error');

      expect(error.code).toBe(ApiErrorCode.SERVER_ERROR);
      expect(error.message).toBe('Server error');
      expect(error.statusCode).toBe(500); // Default
      expect(error.details).toBeUndefined();
    });

    it('should preserve error stack trace', () => {
      const error = new InternalApiError(ApiErrorCode.TOKEN_INVALID, 'Invalid token');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('InternalApiError');
    });
  });

  describe('HTTP Client Status Code Mapping', () => {
    it('should map status codes to correct error codes', () => {
      const client = new InternalHttpClient(config);
      const mapStatusToErrorCode = client['mapStatusToErrorCode'];

      expect(mapStatusToErrorCode(400)).toBe(ApiErrorCode.INVALID_REQUEST);
      expect(mapStatusToErrorCode(401)).toBe(ApiErrorCode.AUTH_FAILED);
      expect(mapStatusToErrorCode(403)).toBe(ApiErrorCode.PERMISSION_DENIED);
      expect(mapStatusToErrorCode(404)).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      expect(mapStatusToErrorCode(409)).toBe(ApiErrorCode.RESOURCE_EXISTS);
      expect(mapStatusToErrorCode(422)).toBe(ApiErrorCode.VALIDATION_ERROR);
      expect(mapStatusToErrorCode(429)).toBe(ApiErrorCode.RATE_LIMIT_EXCEEDED);
      expect(mapStatusToErrorCode(500)).toBe(ApiErrorCode.SERVER_ERROR);
      expect(mapStatusToErrorCode(502)).toBe(ApiErrorCode.SERVICE_UNAVAILABLE);
      expect(mapStatusToErrorCode(503)).toBe(ApiErrorCode.SERVICE_UNAVAILABLE);
      expect(mapStatusToErrorCode(504)).toBe(ApiErrorCode.SERVICE_UNAVAILABLE);
      expect(mapStatusToErrorCode(999)).toBe(ApiErrorCode.SERVER_ERROR); // Default case
    });
  });

  describe('HTTP Client Configuration', () => {
    it('should create client with correct axios configuration', () => {
      const client = new InternalHttpClient(config);
      const axiosInstance = client['client'];

      expect(axiosInstance.defaults.baseURL).toBe('https://api.example.com/internal');
      expect(axiosInstance.defaults.timeout).toBe(5000);
      expect(axiosInstance.defaults.headers['Content-Type']).toBe('application/json');
      expect(axiosInstance.defaults.headers['X-Internal-Service-ID']).toBe('test-service');
      expect(axiosInstance.defaults.headers['X-Internal-Service-Secret']).toBe('test-secret');
    });

    it('should handle default timeout when not specified', () => {
      const clientWithDefaults = new InternalHttpClient({
        baseUrl: 'https://api.example.com',
        serviceId: 'test-service',
        serviceSecret: 'test-secret',
      });

      const axiosInstance = clientWithDefaults['client'];
      expect(axiosInstance.defaults.timeout).toBe(30000);
    });

    it('should handle baseUrl with trailing slash', () => {
      const clientWithSlash = new InternalHttpClient({
        ...config,
        baseUrl: 'https://api.example.com/',
      });

      const axiosInstance = clientWithSlash['client'];
      expect(axiosInstance.defaults.baseURL).toBe('https://api.example.com/internal');
    });
  });

  describe('Socket Client Configuration', () => {
    it('should create socket client with correct configuration', () => {
      const client = new InternalSocketClient(config);

      expect(client['config']).toMatchObject({
        baseUrl: config.baseUrl,
        serviceId: config.serviceId,
        serviceName: config.serviceName,
        serviceSecret: config.serviceSecret,
        namespace: '/internal-socket',
        timeout: 30000,
        enableLogging: false,
        autoConnect: true,
        maxReconnectAttempts: 5,
      });
    });

    it('should handle custom configuration options', () => {
      const customConfig = {
        ...config,
        namespace: '/custom',
        timeout: 5000,
        enableLogging: true,
        autoConnect: false,
        maxReconnectAttempts: 3,
      };

      const client = new InternalSocketClient(customConfig);
      expect(client['config']).toMatchObject(customConfig);
    });

    it('should track connection state correctly', () => {
      const client = new InternalSocketClient(config);

      expect(client.isConnected()).toBe(false);
      expect(client.getReconnectAttempts()).toBe(0);
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle undefined error messages', () => {
      const error = new InternalApiError(ApiErrorCode.SERVER_ERROR, undefined as any);
      expect(error.message).toBeDefined();
    });

    it('should handle null error details', () => {
      const error = new InternalApiError(ApiErrorCode.SERVER_ERROR, 'Error', 500, null as any);
      expect(error.details).toBeNull();
    });

    it('should handle error toJSON with circular references', () => {
      const circularDetails: any = { self: null };
      circularDetails.self = circularDetails;

      const error = new InternalApiError(ApiErrorCode.SERVER_ERROR, 'Error', 500, circularDetails);

      // Should not throw when serializing
      expect(() => error.toJSON()).not.toThrow();
    });
  });
});
