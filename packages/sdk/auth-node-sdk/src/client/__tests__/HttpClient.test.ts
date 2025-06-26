import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../../client/HttpClient';
import { ApiError, ApiErrorCode, HttpClientConfig } from '../../types';

// Mock axios - we only test our configuration and processing logic
const mockAxiosInstance = {
  request: vi.fn(),
  defaults: {
    baseURL: '',
    timeout: 30000,
  },
  interceptors: {
    response: { use: vi.fn() },
  },
};

const mockAxios = {
  create: vi.fn(() => mockAxiosInstance),
};

vi.mock('axios', () => ({
  default: mockAxios,
}));

describe('HttpClient', () => {
  let httpClient: HttpClient;
  let config: HttpClientConfig;

  beforeEach(() => {
    config = {
      baseUrl: 'https://api.example.com',
      serviceId: 'test-service-123',
      serviceSecret: 'super-secret-key',
      timeout: 10000,
      enableLogging: false,
    };

    vi.clearAllMocks();

    // Reset mock defaults
    mockAxiosInstance.defaults = {
      baseURL: '',
      timeout: 30000,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor and configuration processing', () => {
    it('should transform baseUrl to include /internal suffix', () => {
      new HttpClient(config);

      expect(mockAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.example.com/internal',
        }),
      );
    });

    it('should strip trailing slash from baseUrl before adding /internal', () => {
      const configWithSlash = { ...config, baseUrl: 'https://api.example.com/' };

      new HttpClient(configWithSlash);

      expect(mockAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.example.com/internal',
        }),
      );
    });
  });

  describe('response interceptor logic', () => {
    let successInterceptor: (response: any) => any;
    let errorInterceptor: (error: any) => any;

    beforeEach(() => {
      httpClient = new HttpClient(config);
      const interceptorCall = mockAxiosInstance.interceptors.response.use.mock.calls[0];
      successInterceptor = interceptorCall[0];
      errorInterceptor = interceptorCall[1];
    });

    describe('success interceptor', () => {
      it('should detect and unwrap successful ApiResponse structure', () => {
        const mockResponse = {
          data: {
            success: true,
            data: { userId: '123', name: 'John' },
          },
          status: 200,
          config: { url: '/users/123' },
        };

        const result = successInterceptor(mockResponse);

        expect(result).toEqual({
          ...mockResponse,
          data: { userId: '123', name: 'John' },
        });
      });

      it('should throw ApiError for failed ApiResponse', () => {
        const mockResponse = {
          data: {
            success: false,
            error: {
              code: ApiErrorCode.USER_NOT_FOUND,
              message: 'User does not exist',
            },
          },
          status: 404,
          config: { url: '/users/456' },
        };

        expect(() => successInterceptor(mockResponse)).toThrow(ApiError);

        try {
          successInterceptor(mockResponse);
        } catch (error: any) {
          expect(error.code).toBe(ApiErrorCode.USER_NOT_FOUND);
          expect(error.message).toBe('User does not exist');
          expect(error.statusCode).toBe(404);
        }
      });

      it('should handle malformed failed ApiResponse with defaults', () => {
        const mockResponse = {
          data: { success: false }, // Missing error details
          status: 400,
          config: { url: '/test' },
        };

        expect(() => successInterceptor(mockResponse)).toThrow(ApiError);

        try {
          successInterceptor(mockResponse);
        } catch (error: any) {
          expect(error.code).toBe(ApiErrorCode.SERVER_ERROR);
          expect(error.message).toBe('API error');
          expect(error.statusCode).toBe(400);
        }
      });

      it('should pass through non-ApiResponse structures unchanged', () => {
        const mockResponse = {
          data: { customField: 'value', anotherField: 42 },
          status: 200,
          config: { url: '/custom-endpoint' },
        };

        const result = successInterceptor(mockResponse);

        expect(result).toBe(mockResponse);
      });

      it('should handle null or undefined response data', () => {
        const mockResponseNull = {
          data: null,
          status: 204,
          config: { url: '/delete' },
        };

        const mockResponseUndefined = {
          data: undefined,
          status: 204,
          config: { url: '/delete' },
        };

        expect(successInterceptor(mockResponseNull)).toBe(mockResponseNull);
        expect(successInterceptor(mockResponseUndefined)).toBe(mockResponseUndefined);
      });

      it('should not log when logging is disabled', () => {
        const consoleSpy = vi.spyOn(console, 'debug');

        const mockResponse = {
          data: { success: true, data: {} },
          status: 200,
          config: { url: '/test' },
        };

        successInterceptor(mockResponse);

        expect(consoleSpy).not.toHaveBeenCalled();
      });

      it('should log successful requests when logging is enabled', () => {
        const consoleSpy = vi.spyOn(console, 'debug');
        const loggingConfig = { ...config, enableLogging: true };

        new HttpClient(loggingConfig);
        const loggingInterceptorCall = mockAxiosInstance.interceptors.response.use.mock.calls[1];
        const loggingSuccessInterceptor = loggingInterceptorCall[0];

        const mockResponse = {
          data: { success: true, data: {} },
          status: 200,
          config: { url: '/test-endpoint' },
        };

        loggingSuccessInterceptor(mockResponse);

        expect(consoleSpy).toHaveBeenCalledWith('[API Success] 200 /test-endpoint');
      });
    });

    describe('error interceptor', () => {
      it('should transform network errors to ApiError with CONNECTION_ERROR', () => {
        const networkError = {
          message: 'Network Error',
          code: 'ECONNREFUSED',
        };

        expect(() => errorInterceptor(networkError)).toThrow(ApiError);

        try {
          errorInterceptor(networkError);
        } catch (error: any) {
          expect(error.code).toBe(ApiErrorCode.CONNECTION_ERROR);
          expect(error.message).toBe('Network Error');
          expect(error.statusCode).toBe(503);
        }
      });

      it('should use error response data when available', () => {
        const httpError = {
          message: 'Request failed with status code 401',
          response: {
            status: 401,
            data: {
              error: {
                code: ApiErrorCode.TOKEN_EXPIRED,
                message: 'Access token has expired',
              },
            },
          },
        };

        expect(() => errorInterceptor(httpError)).toThrow(ApiError);

        try {
          errorInterceptor(httpError);
        } catch (error: any) {
          expect(error.code).toBe(ApiErrorCode.CONNECTION_ERROR);
          expect(error.message).toBe('Access token has expired');
          expect(error.statusCode).toBe(401);
        }
      });

      it('should fallback to error message when response data unavailable', () => {
        const simpleError = {
          message: 'Timeout of 5000ms exceeded',
        };

        expect(() => errorInterceptor(simpleError)).toThrow(ApiError);

        try {
          errorInterceptor(simpleError);
        } catch (error: any) {
          expect(error.message).toBe('Timeout of 5000ms exceeded');
          expect(error.statusCode).toBe(503);
        }
      });

      it('should not log when logging is disabled', () => {
        const consoleSpy = vi.spyOn(console, 'error');

        const error = { message: 'Test error' };

        expect(() => errorInterceptor(error)).toThrow();
        expect(consoleSpy).not.toHaveBeenCalled();
      });

      it('should log errors when logging is enabled', () => {
        const consoleSpy = vi.spyOn(console, 'error');
        const loggingConfig = { ...config, enableLogging: true };

        new HttpClient(loggingConfig);
        const loggingInterceptorCall = mockAxiosInstance.interceptors.response.use.mock.calls[1];
        const loggingErrorInterceptor = loggingInterceptorCall[1];

        const error = { message: 'Test error message' };

        expect(() => loggingErrorInterceptor(error)).toThrow();
        expect(consoleSpy).toHaveBeenCalledWith('[API Error] Test error message');
      });
    });
  });

  describe('HTTP method wrappers', () => {
    beforeEach(() => {
      httpClient = new HttpClient(config);
      mockAxiosInstance.request.mockResolvedValue({ data: 'mock-response' });
    });

    describe('get method', () => {
      it('should return response data', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: { status: 'ok' } });

        const result = await httpClient.get('/health');

        expect(result).toEqual({ status: 'ok' });
      });
    });

    describe('post method', () => {
      it('should handle POST without data', async () => {
        await httpClient.post('/actions/trigger');

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: '/actions/trigger',
          data: undefined,
        });
      });
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      httpClient = new HttpClient(config);
    });

    describe('isApiError type guard', () => {
      it('should correctly identify ApiError instances', () => {
        const apiError = new ApiError(ApiErrorCode.AUTH_FAILED, 'Auth failed');
        const regularError = new Error('Regular error');

        expect(httpClient.isApiError(apiError)).toBe(true);
        expect(httpClient.isApiError(regularError)).toBe(false);
        expect(httpClient.isApiError(null)).toBe(false);
      });

      it('should check specific error codes when provided', () => {
        const authError = new ApiError(ApiErrorCode.AUTH_FAILED, 'Auth failed');

        expect(httpClient.isApiError(authError, ApiErrorCode.AUTH_FAILED)).toBe(true);
        expect(httpClient.isApiError(authError, ApiErrorCode.VALIDATION_ERROR)).toBe(false);
      });
    });

    describe('isNetworkError detection', () => {
      it('should identify network-related error codes', () => {
        const networkErrors = [
          new ApiError(ApiErrorCode.CONNECTION_ERROR, 'Connection failed'),
          new ApiError(ApiErrorCode.TIMEOUT_ERROR, 'Request timeout'),
          new ApiError(ApiErrorCode.SERVICE_UNAVAILABLE, 'Service down'),
        ];

        networkErrors.forEach((error) => {
          expect(httpClient.isNetworkError(error)).toBe(true);
        });
      });

      it('should not identify non-network errors', () => {
        const nonNetworkErrors = [
          new ApiError(ApiErrorCode.AUTH_FAILED, 'Auth failed'),
          new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Invalid data'),
          new ApiError(ApiErrorCode.USER_NOT_FOUND, 'User not found'),
          new Error('Regular error'),
          null,
          undefined,
        ];

        nonNetworkErrors.forEach((error) => {
          expect(httpClient.isNetworkError(error)).toBe(false);
        });
      });
    });

    describe('isAuthError detection', () => {
      it('should identify authentication-related error codes', () => {
        const authErrors = [
          new ApiError(ApiErrorCode.AUTH_FAILED, 'Auth failed'),
          new ApiError(ApiErrorCode.TOKEN_EXPIRED, 'Token expired'),
          new ApiError(ApiErrorCode.TOKEN_INVALID, 'Invalid token'),
          new ApiError(ApiErrorCode.PERMISSION_DENIED, 'No permission'),
        ];

        authErrors.forEach((error) => {
          expect(httpClient.isAuthError(error)).toBe(true);
        });
      });

      it('should not identify non-auth errors', () => {
        const nonAuthErrors = [
          new ApiError(ApiErrorCode.CONNECTION_ERROR, 'Network error'),
          new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Invalid data'),
          new ApiError(ApiErrorCode.SERVER_ERROR, 'Server error'),
          new Error('Regular error'),
          null,
          undefined,
        ];

        nonAuthErrors.forEach((error) => {
          expect(httpClient.isAuthError(error)).toBe(false);
        });
      });
    });

    describe('getErrorMessage extraction', () => {
      it('should extract message from different error types', () => {
        const apiError = new ApiError(ApiErrorCode.AUTH_FAILED, 'Custom API error message');
        const regularError = new Error('Regular error message');
        const stringError = 'String error message';
        const unknownError = { someProperty: 'value' };

        expect(httpClient.getErrorMessage(apiError)).toBe('Custom API error message');
        expect(httpClient.getErrorMessage(regularError)).toBe('Regular error message');
        expect(httpClient.getErrorMessage(stringError)).toBe('String error message');
        expect(httpClient.getErrorMessage(unknownError)).toBe('An unknown error occurred');
        expect(httpClient.getErrorMessage(null)).toBe('An unknown error occurred');
      });
    });
  });
});
