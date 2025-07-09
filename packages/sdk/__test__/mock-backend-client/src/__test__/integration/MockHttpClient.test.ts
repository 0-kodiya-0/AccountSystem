import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { MockHttpClient } from '../../../src/client/MockHttpClient';
import { ApiErrorCode, AuthSDKError, MockHttpClientConfig } from '../../../src/types';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('MockHttpClient Unit Tests', () => {
  let mockAxiosInstance: Partial<AxiosInstance>;
  let httpClient: MockHttpClient;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const defaultConfig: MockHttpClientConfig = {
    baseUrl: 'http://test.com',
    timeout: 5000,
    enableLogging: false,
    withCredentials: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn(),
        },
        response: {
          use: vi.fn(),
        },
      },
      defaults: {
        headers: {
          set: vi.fn(),
          delete: vi.fn(),
          clear: vi.fn(),
        },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance as AxiosInstance);
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Configuration', () => {
    it('should create client with default values', () => {
      httpClient = new MockHttpClient({ baseUrl: 'http://test.com' });

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://test.com',
        timeout: 30000, // Default timeout
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true, // Default withCredentials
      });
    });

    it('should create client with custom configuration', () => {
      const customConfig: MockHttpClientConfig = {
        baseUrl: 'http://custom.com',
        timeout: 10000,
        enableLogging: true,
        withCredentials: false,
      };

      httpClient = new MockHttpClient(customConfig);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://custom.com',
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
        withCredentials: false,
      });
    });

    it('should create client with default headers', () => {
      const configWithHeaders: MockHttpClientConfig = {
        baseUrl: 'http://test.com',
        defaultHeaders: {
          'X-API-Key': 'test-key',
          'X-Client-Version': '1.0.0',
          Authorization: 'Bearer token',
        },
      };

      httpClient = new MockHttpClient(configWithHeaders);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://test.com',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-key',
          'X-Client-Version': '1.0.0',
          Authorization: 'Bearer token',
        },
        withCredentials: true,
      });
    });

    it('should return configuration copy', () => {
      httpClient = new MockHttpClient(defaultConfig);
      const config = httpClient.getConfig();

      expect(config).toEqual(defaultConfig);

      // Verify it's a copy (mutation doesn't affect original)
      config.timeout = 9999;
      expect(httpClient.getConfig().timeout).toBe(5000);
    });
  });

  describe('HTTP Methods', () => {
    beforeEach(() => {
      httpClient = new MockHttpClient(defaultConfig);
    });

    it('should extract data from successful responses', async () => {
      const mockData = { test: 'data' };
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockAxiosInstance.get = vi.fn().mockResolvedValue(mockResponse);

      const result = await httpClient.get('/test');
      expect(result).toEqual(mockData);
    });

    it('should return full response when using response methods', async () => {
      const mockResponse: AxiosResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config: {} as any,
      };

      mockAxiosInstance.post = vi.fn().mockResolvedValue(mockResponse);

      const result = await httpClient.postResponse('/test', { data: 'test' });
      expect(result).toEqual(mockResponse);
      expect(result.status).toBe(200);
      expect(result.headers).toBeDefined();
    });
  });

  describe('Request Interceptor', () => {
    let requestHandler: (config: any) => any;

    beforeEach(() => {
      const configWithHeaders: MockHttpClientConfig = {
        baseUrl: 'http://test.com',
        enableLogging: true,
        defaultHeaders: {
          'X-Service-ID': 'test-service',
          'X-API-Key': 'test-key',
        },
      };

      httpClient = new MockHttpClient(configWithHeaders);
      const interceptorCall = (mockAxiosInstance.interceptors?.request?.use as any).mock.calls[0];
      requestHandler = interceptorCall[0];
    });

    it('should merge default headers with request headers', () => {
      const mockConfig = {
        method: 'GET',
        url: '/test',
        headers: {
          set: vi.fn(),
          toJSON: vi.fn().mockReturnValue({
            'Content-Type': 'application/json',
            'X-Service-ID': 'test-service',
            'X-API-Key': 'test-key',
          }),
        },
      };

      requestHandler(mockConfig);

      // Should call set for each default header
      expect(mockConfig.headers.set).toHaveBeenCalledWith('X-Service-ID', 'test-service');
      expect(mockConfig.headers.set).toHaveBeenCalledWith('X-API-Key', 'test-key');
    });

    it('should log request when logging enabled', () => {
      const mockConfig = {
        method: 'POST',
        url: '/test',
        headers: {
          set: vi.fn(),
          toJSON: vi.fn().mockReturnValue({ 'Content-Type': 'application/json' }),
        },
      };

      requestHandler(mockConfig);

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[MockClient Request] POST /test',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('should not call set for undefined header values', () => {
      const configWithUndefined: MockHttpClientConfig = {
        baseUrl: 'http://test.com',
        defaultHeaders: {
          'X-Service-ID': 'test-service',
          'X-Optional-Header': undefined,
        },
      };

      httpClient = new MockHttpClient(configWithUndefined);
      const interceptorCall = (mockAxiosInstance.interceptors?.request?.use as any).mock.calls[1];
      const handler = interceptorCall[0];

      const mockConfig = {
        method: 'GET',
        url: '/test',
        headers: {
          set: vi.fn(),
          toJSON: vi.fn().mockReturnValue({}),
        },
      };

      handler(mockConfig);

      expect(mockConfig.headers.set).toHaveBeenCalledWith('X-Service-ID', 'test-service');
      expect(mockConfig.headers.set).not.toHaveBeenCalledWith('X-Optional-Header', undefined);
    });
  });

  describe('Response Interceptor - Success Handler', () => {
    let successHandler: (response: AxiosResponse) => AxiosResponse;

    beforeEach(() => {
      httpClient = new MockHttpClient({ ...defaultConfig, enableLogging: true });
      const interceptorCall = (mockAxiosInstance.interceptors?.response?.use as any).mock.calls[0];
      successHandler = interceptorCall[0];
    });

    it('should log successful responses when logging enabled', () => {
      const mockResponse: AxiosResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { url: '/test' } as any,
      };

      successHandler(mockResponse);
      expect(consoleDebugSpy).toHaveBeenCalledWith('[MockClient Success] 200 /test');
    });

    it('should not log when logging disabled', () => {
      httpClient = new MockHttpClient({ ...defaultConfig, enableLogging: false });
      const interceptorCall = (mockAxiosInstance.interceptors?.response?.use as any).mock.calls[1];
      const noLogHandler = interceptorCall[0];

      const mockResponse: AxiosResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { url: '/test' } as any,
      };

      noLogHandler(mockResponse);
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should extract data from ApiResponse with success=true', () => {
      const mockResponse: AxiosResponse = {
        data: {
          success: true,
          data: { result: 'actual data' },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { url: '/test' } as any,
      };

      const result = successHandler(mockResponse);
      expect(result.data).toEqual({ result: 'actual data' });
    });

    it('should throw AuthSDKError for ApiResponse with success=false', () => {
      const mockResponse: AxiosResponse = {
        data: {
          success: false,
          error: {
            message: 'Test error',
            code: ApiErrorCode.VALIDATION_ERROR,
          },
        },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { url: '/test' } as any,
      };

      expect(() => successHandler(mockResponse)).toThrow(AuthSDKError);

      try {
        successHandler(mockResponse);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthSDKError);
        expect((error as AuthSDKError).message).toBe('Test error');
        expect((error as AuthSDKError).code).toBe(ApiErrorCode.VALIDATION_ERROR);
        expect((error as AuthSDKError).statusCode).toBe(400);
      }
    });

    it('should use defaults for ApiResponse with success=false but no error details', () => {
      const mockResponse: AxiosResponse = {
        data: { success: false },
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: { url: '/test' } as any,
      };

      expect(() => successHandler(mockResponse)).toThrow(AuthSDKError);

      try {
        successHandler(mockResponse);
      } catch (error) {
        expect((error as AuthSDKError).message).toBe('API error');
        expect((error as AuthSDKError).code).toBe(ApiErrorCode.SERVER_ERROR);
      }
    });

    it('should pass through non-ApiResponse data unchanged', () => {
      const mockResponse: AxiosResponse = {
        data: { regular: 'response' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { url: '/test' } as any,
      };

      const result = successHandler(mockResponse);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Response Interceptor - Error Handler', () => {
    let errorHandler: (error: any) => Promise<never>;

    beforeEach(() => {
      httpClient = new MockHttpClient({ ...defaultConfig, enableLogging: true });
      const interceptorCall = (mockAxiosInstance.interceptors?.response?.use as any).mock.calls[0];
      errorHandler = interceptorCall[1];
    });

    it('should log errors when logging enabled', async () => {
      const axiosError = { message: 'Network Error' };

      await expect(errorHandler(axiosError)).rejects.toThrow(AuthSDKError);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[MockClient Error] Network Error');
    });

    it('should not log when logging disabled', async () => {
      httpClient = new MockHttpClient({ ...defaultConfig, enableLogging: false });
      const interceptorCall = (mockAxiosInstance.interceptors?.response?.use as any).mock.calls[1];
      const noLogErrorHandler = interceptorCall[1];

      const axiosError = { message: 'Network Error' };

      await expect(noLogErrorHandler(axiosError)).rejects.toThrow(AuthSDKError);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should transform axios error with response to AuthSDKError', async () => {
      const axiosError = {
        message: 'Request failed',
        response: {
          status: 400,
          data: {
            error: {
              message: 'Validation failed',
              code: ApiErrorCode.VALIDATION_ERROR,
            },
          },
        },
      };

      await expect(errorHandler(axiosError)).rejects.toThrow(AuthSDKError);

      try {
        await errorHandler(axiosError);
      } catch (error) {
        expect((error as AuthSDKError).message).toBe('Validation failed');
        expect((error as AuthSDKError).code).toBe(ApiErrorCode.VALIDATION_ERROR);
        expect((error as AuthSDKError).statusCode).toBe(400);
      }
    });

    it('should handle axios error without response data', async () => {
      const axiosError = {
        message: 'Network Error',
        response: { status: 500 },
      };

      try {
        await errorHandler(axiosError);
      } catch (error) {
        expect((error as AuthSDKError).message).toBe('Network Error');
        expect((error as AuthSDKError).code).toBe(ApiErrorCode.NETWORK_ERROR);
        expect((error as AuthSDKError).statusCode).toBe(500);
      }
    });

    it('should handle axios error without response', async () => {
      const axiosError = { message: 'Network timeout' };

      try {
        await errorHandler(axiosError);
      } catch (error) {
        expect((error as AuthSDKError).message).toBe('Network timeout');
        expect((error as AuthSDKError).code).toBe(ApiErrorCode.NETWORK_ERROR);
        expect((error as AuthSDKError).statusCode).toBe(0);
      }
    });

    it('should provide fallback message when error has no message', async () => {
      const axiosError = { response: { status: 404 } };

      try {
        await errorHandler(axiosError);
      } catch (error) {
        expect((error as AuthSDKError).message).toBe('Request failed');
        expect((error as AuthSDKError).statusCode).toBe(404);
      }
    });
  });

  describe('Error Propagation', () => {
    beforeEach(() => {
      httpClient = new MockHttpClient(defaultConfig);
    });

    it('should propagate errors from HTTP methods', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.get = vi.fn().mockRejectedValue(error);

      await expect(httpClient.get('/test')).rejects.toThrow();
    });

    it('should propagate errors from response methods', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.post = vi.fn().mockRejectedValue(error);

      await expect(httpClient.postResponse('/test', {})).rejects.toThrow();
    });
  });

  describe('Header Management', () => {
    beforeEach(() => {
      httpClient = new MockHttpClient({
        baseUrl: 'http://test.com',
        defaultHeaders: {
          'X-Service-ID': 'test-service',
        },
      });
    });

    it('should support internal service headers', () => {
      const internalConfig: MockHttpClientConfig = {
        baseUrl: 'http://internal.test.com',
        defaultHeaders: {
          'X-Internal-Service-ID': 'internal-service',
          'X-Internal-Service-Name': 'Test Internal Service',
          'X-Internal-Service-Secret': 'secret-123',
        },
      };

      const internalClient = new MockHttpClient(internalConfig);

      expect(mockedAxios.create).toHaveBeenLastCalledWith({
        baseURL: 'http://internal.test.com',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Service-ID': 'internal-service',
          'X-Internal-Service-Name': 'Test Internal Service',
          'X-Internal-Service-Secret': 'secret-123',
        },
        withCredentials: true,
      });
    });

    it('should support authentication headers', () => {
      const authConfig: MockHttpClientConfig = {
        baseUrl: 'http://auth.test.com',
        defaultHeaders: {
          Authorization: 'Bearer token-123',
          'X-API-Key': 'api-key-456',
          'X-Session-ID': 'session-789',
        },
      };

      const authClient = new MockHttpClient(authConfig);

      expect(mockedAxios.create).toHaveBeenLastCalledWith({
        baseURL: 'http://auth.test.com',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-123',
          'X-API-Key': 'api-key-456',
          'X-Session-ID': 'session-789',
        },
        withCredentials: true,
      });
    });

    it('should support tracking headers', () => {
      const trackingConfig: MockHttpClientConfig = {
        baseUrl: 'http://tracking.test.com',
        defaultHeaders: {
          'X-Request-ID': 'req-123',
          'X-Correlation-ID': 'corr-456',
          'X-Trace-ID': 'trace-789',
        },
      };

      const trackingClient = new MockHttpClient(trackingConfig);

      expect(mockedAxios.create).toHaveBeenLastCalledWith({
        baseURL: 'http://tracking.test.com',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': 'req-123',
          'X-Correlation-ID': 'corr-456',
          'X-Trace-ID': 'trace-789',
        },
        withCredentials: true,
      });
    });
  });
});
