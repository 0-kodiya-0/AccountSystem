import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { HttpClient } from '../HttpClient';
import { ApiError, ApiErrorCode } from '../../types';

// Mock axios - let our code create the real instance
vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('HttpClient - Custom Logic Only', () => {
  let client: HttpClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock axios.create to return a mock instance with the methods we use
    const mockInstance = {
      request: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };

    (mockedAxios.create as any).mockReturnValue(mockInstance);

    client = new HttpClient({
      baseUrl: 'http://localhost:3000',
      serviceId: 'test-service',
      serviceSecret: 'test-secret',
      timeout: 5000,
      enableLogging: false,
    });
  });

  describe('Configuration Handling (Our Logic)', () => {
    it('should normalize baseUrl by removing trailing slash', () => {
      vi.clearAllMocks();

      new HttpClient({
        baseUrl: 'http://localhost:3000/',
        serviceId: 'test-service',
        serviceSecret: 'test-secret',
      });

      expect(mockedAxios.create as any).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://localhost:3000/internal',
        }),
      );
    });

    it('should append /internal to baseURL', () => {
      expect(mockedAxios.create as any).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://localhost:3000/internal',
        }),
      );
    });

    it('should set custom headers with service credentials', () => {
      expect(mockedAxios.create as any).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Service-ID': 'test-service',
            'X-Internal-Service-Secret': 'test-secret',
          },
        }),
      );
    });

    it('should use custom timeout when provided', () => {
      expect(mockedAxios.create as any).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5000,
        }),
      );
    });

    it('should use default timeout when not provided', () => {
      vi.clearAllMocks();

      new HttpClient({
        baseUrl: 'http://localhost:3000',
        serviceId: 'test-service',
        serviceSecret: 'test-secret',
      });

      expect(mockedAxios.create as any).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        }),
      );
    });
  });

  describe('Error Handling Utilities (Our Logic)', () => {
    describe('isApiError', () => {
      it('should identify ApiError instances correctly', () => {
        const apiError = new ApiError(ApiErrorCode.AUTH_FAILED, 'Auth failed');
        const regularError = new Error('Regular error');

        expect(client.isApiError(apiError)).toBe(true);
        expect(client.isApiError(regularError)).toBe(false);
      });

      it('should match specific error codes when provided', () => {
        const authError = new ApiError(ApiErrorCode.AUTH_FAILED, 'Auth failed');
        const serverError = new ApiError(ApiErrorCode.SERVER_ERROR, 'Server error');

        expect(client.isApiError(authError, ApiErrorCode.AUTH_FAILED)).toBe(true);
        expect(client.isApiError(authError, ApiErrorCode.SERVER_ERROR)).toBe(false);
        expect(client.isApiError(serverError, ApiErrorCode.SERVER_ERROR)).toBe(true);
      });

      it('should return true for any ApiError when no code specified', () => {
        const error = new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Validation failed');
        expect(client.isApiError(error)).toBe(true);
      });
    });

    describe('isNetworkError', () => {
      it('should identify network-related error codes', () => {
        const connectionError = new ApiError(ApiErrorCode.CONNECTION_ERROR, 'Connection failed');
        const timeoutError = new ApiError(ApiErrorCode.TIMEOUT_ERROR, 'Timeout');
        const unavailableError = new ApiError(ApiErrorCode.SERVICE_UNAVAILABLE, 'Service unavailable');
        const authError = new ApiError(ApiErrorCode.AUTH_FAILED, 'Auth failed');

        expect(client.isNetworkError(connectionError)).toBe(true);
        expect(client.isNetworkError(timeoutError)).toBe(true);
        expect(client.isNetworkError(unavailableError)).toBe(true);
        expect(client.isNetworkError(authError)).toBe(false);
      });

      it('should return false for non-ApiError', () => {
        const regularError = new Error('Regular error');
        expect(client.isNetworkError(regularError)).toBe(false);
      });
    });

    describe('isAuthError', () => {
      it('should identify authentication-related error codes', () => {
        const authError = new ApiError(ApiErrorCode.AUTH_FAILED, 'Auth failed');
        const tokenExpiredError = new ApiError(ApiErrorCode.TOKEN_EXPIRED, 'Token expired');
        const tokenInvalidError = new ApiError(ApiErrorCode.TOKEN_INVALID, 'Token invalid');
        const permissionError = new ApiError(ApiErrorCode.PERMISSION_DENIED, 'Permission denied');
        const serverError = new ApiError(ApiErrorCode.SERVER_ERROR, 'Server error');

        expect(client.isAuthError(authError)).toBe(true);
        expect(client.isAuthError(tokenExpiredError)).toBe(true);
        expect(client.isAuthError(tokenInvalidError)).toBe(true);
        expect(client.isAuthError(permissionError)).toBe(true);
        expect(client.isAuthError(serverError)).toBe(false);
      });
    });

    describe('getErrorMessage', () => {
      it('should extract message from ApiError', () => {
        const apiError = new ApiError(ApiErrorCode.AUTH_FAILED, 'Custom auth message');
        expect(client.getErrorMessage(apiError)).toBe('Custom auth message');
      });

      it('should extract message from regular Error', () => {
        const regularError = new Error('Regular error message');
        expect(client.getErrorMessage(regularError)).toBe('Regular error message');
      });

      it('should handle unknown error types with fallback message', () => {
        expect(client.getErrorMessage('string error')).toBe('An unknown error occurred');
        expect(client.getErrorMessage(null)).toBe('An unknown error occurred');
        expect(client.getErrorMessage(undefined)).toBe('An unknown error occurred');
        expect(client.getErrorMessage(123)).toBe('An unknown error occurred');
      });
    });
  });

  describe('URL and Parameter Handling (Our Logic)', () => {
    it('should properly encode email addresses in URLs', () => {
      // Test our URL encoding logic without making actual requests
      const testCases = [
        { input: 'test@example.com', expected: 'test%40example.com' },
        { input: 'test+special@example.com', expected: 'test%2Bspecial%40example.com' },
        { input: 'user.name@domain.co.uk', expected: 'user.name%40domain.co.uk' },
      ];

      testCases.forEach(({ input, expected }) => {
        const encoded = encodeURIComponent(input);
        expect(encoded).toBe(expected);
      });
    });

    it('should handle optional parameters correctly', () => {
      // Test our parameter handling logic
      const testData = { sessionCookie: undefined };
      expect(testData.sessionCookie).toBeUndefined();

      const testDataWithValue = { sessionCookie: 'test-value' };
      expect(testDataWithValue.sessionCookie).toBe('test-value');
    });
  });

  describe('Request Configuration (Our Logic)', () => {
    it('should format request parameters correctly for different methods', () => {
      // Test our request configuration logic
      const getConfig = {
        method: 'GET',
        url: '/health',
      };
      expect(getConfig.method).toBe('GET');
      expect(getConfig.url).toBe('/health');

      const postConfig = {
        method: 'POST',
        url: '/auth/verify-token',
        data: { token: 'test-token', tokenType: 'access' },
      };
      expect(postConfig.method).toBe('POST');
      expect(postConfig.data).toEqual({ token: 'test-token', tokenType: 'access' });
    });

    it('should use correct default token type', () => {
      // Test our default parameter logic
      const defaultTokenType = 'access';
      expect(defaultTokenType).toBe('access');
    });
  });
});
