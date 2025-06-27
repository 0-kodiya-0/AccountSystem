import { describe, test, expect, vi, beforeEach, MockedFunction } from 'vitest';
import axios, { CreateAxiosDefaults, AxiosInstance } from 'axios';
import { HttpClient } from '../HttpClient';
import { AuthSDKError, ApiErrorCode, SDKConfig } from '../../types';

// Mock axios with proper typing
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('HttpClient', () => {
  let httpClient: HttpClient;
  let mockAxiosInstance: any;

  const defaultConfig: SDKConfig = {
    backendUrl: 'https://api.example.com',
    timeout: 30000,
    withCredentials: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock axios instance
    mockAxiosInstance = {
      interceptors: {
        response: {
          use: vi.fn(),
        },
      },
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    };

    // Fix: Mock axios.create to return the mocked instance
    (
      mockedAxios.create as unknown as MockedFunction<(config?: CreateAxiosDefaults<any>) => AxiosInstance>
    ).mockReturnValue(mockAxiosInstance as AxiosInstance);
  });

  describe('Configuration and Setup', () => {
    test('should initialize with correct configuration', () => {
      httpClient = new HttpClient(defaultConfig);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.example.com',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true,
      });
    });

    test('should apply proxy URLs correctly', () => {
      const configWithProxy: SDKConfig = {
        ...defaultConfig,
        backendProxyUrl: '/api/v1',
      };

      httpClient = new HttpClient(configWithProxy);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.example.com/api/v1',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true,
      });
    });

    test('should use default timeout when not provided', () => {
      const configWithoutTimeout: SDKConfig = {
        backendUrl: 'https://api.example.com',
      };

      httpClient = new HttpClient(configWithoutTimeout);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.example.com',
        timeout: 30000, // default
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true, // default
      });
    });

    test('should set withCredentials to false when explicitly disabled', () => {
      const configWithoutCredentials: SDKConfig = {
        ...defaultConfig,
        withCredentials: false,
      };

      httpClient = new HttpClient(configWithoutCredentials);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.example.com',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: false,
      });
    });

    test('should set up interceptors properly', () => {
      httpClient = new HttpClient(defaultConfig);

      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(
        expect.any(Function), // success handler
        expect.any(Function), // error handler
      );
    });
  });

  describe('Response Handling', () => {
    beforeEach(() => {
      httpClient = new HttpClient(defaultConfig);
    });

    test('should handle successful ApiResponse structure', async () => {
      const mockResponse = {
        status: 200,
        config: { url: '/test' },
        data: {
          success: true,
          data: { id: '123', name: 'Test' },
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      // Get the success interceptor handler
      const successHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];

      // Test the interceptor
      const result = successHandler(mockResponse);

      expect(result).toEqual({
        ...mockResponse,
        data: { id: '123', name: 'Test' }, // extracted data
      });
    });

    test('should extract data from successful responses', async () => {
      const expectedData = { id: '123', name: 'Test User' };
      const mockResponse = {
        status: 200,
        config: { url: '/users/123' },
        data: {
          success: true,
          data: expectedData,
        },
      };

      mockAxiosInstance.get.mockResolvedValue({
        ...mockResponse,
        data: expectedData, // After interceptor processing
      });

      const result = await httpClient.get('/users/123');

      expect(result).toEqual(expectedData);
    });

    test('should throw AuthSDKError on API errors with success: false', () => {
      const mockResponse = {
        status: 400,
        config: { url: '/test' },
        data: {
          success: false,
          error: {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Invalid input data',
          },
        },
      };

      // Get the success interceptor handler
      const successHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];

      expect(() => {
        successHandler(mockResponse);
      }).toThrow(AuthSDKError);

      try {
        successHandler(mockResponse);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(AuthSDKError);
        expect((error as AuthSDKError).message).toBe('Invalid input data');
        expect((error as AuthSDKError).code).toBe(ApiErrorCode.VALIDATION_ERROR);
      }
    });

    test('should handle network errors', () => {
      const networkError = {
        message: 'Network Error',
        code: 'NETWORK_ERROR',
        response: undefined,
      };

      // Get the error interceptor handler
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      expect(() => {
        errorHandler(networkError);
      }).toThrow(AuthSDKError);

      try {
        errorHandler(networkError);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(AuthSDKError);
        expect((error as AuthSDKError).message).toBe('Network Error');
        expect((error as AuthSDKError).code).toBe(ApiErrorCode.NETWORK_ERROR);
      }
    });

    test('should handle timeout errors', () => {
      const timeoutError = {
        message: 'timeout of 30000ms exceeded',
        code: 'ECONNABORTED',
        response: undefined,
      };

      // Get the error interceptor handler
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      expect(() => {
        errorHandler(timeoutError);
      }).toThrow(AuthSDKError);

      try {
        errorHandler(timeoutError);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(AuthSDKError);
        expect((error as AuthSDKError).message).toBe('timeout of 30000ms exceeded');
        expect((error as AuthSDKError).code).toBe(ApiErrorCode.NETWORK_ERROR);
      }
    });

    test('should handle errors with response data', () => {
      const errorWithResponse = {
        message: 'Request failed',
        response: {
          status: 401,
          data: {
            error: {
              code: ApiErrorCode.AUTH_FAILED,
              message: 'Authentication failed',
            },
          },
        },
      };

      // Get the error interceptor handler
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      expect(() => {
        errorHandler(errorWithResponse);
      }).toThrow(AuthSDKError);

      try {
        errorHandler(errorWithResponse);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(AuthSDKError);
        expect((error as AuthSDKError).message).toBe('Authentication failed');
        expect((error as AuthSDKError).code).toBe(ApiErrorCode.AUTH_FAILED);
        expect((error as AuthSDKError).statusCode).toBe(401);
      }
    });

    test('should handle errors without specific error data', () => {
      const genericError = {
        message: 'Something went wrong',
        response: {
          status: 500,
          data: {},
        },
      };

      // Get the error interceptor handler
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      expect(() => {
        errorHandler(genericError);
      }).toThrow(AuthSDKError);

      try {
        errorHandler(genericError);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(AuthSDKError);
        expect((error as AuthSDKError).message).toBe('Something went wrong');
        expect((error as AuthSDKError).code).toBe(ApiErrorCode.NETWORK_ERROR);
        expect((error as AuthSDKError).statusCode).toBe(500);
      }
    });

    test('should handle regular responses without ApiResponse structure', () => {
      const regularResponse = {
        status: 200,
        config: { url: '/test' },
        data: { id: '123', name: 'Direct data' },
      };

      // Get the success interceptor handler
      const successHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];

      const result = successHandler(regularResponse);

      expect(result).toEqual(regularResponse);
    });
  });

  describe('Logging', () => {
    test('should log successful requests when logging enabled', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      const configWithLogging: SDKConfig = {
        ...defaultConfig,
        enableLogging: true,
      };

      httpClient = new HttpClient(configWithLogging);

      const mockResponse = {
        status: 200,
        config: { url: '/test' },
        data: { success: true, data: {} },
      };

      // Get the success interceptor handler
      const successHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];
      successHandler(mockResponse);

      expect(consoleSpy).toHaveBeenCalledWith('[API Success] 200 /test');

      consoleSpy.mockRestore();
    });

    test('should log errors when logging enabled', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const configWithLogging: SDKConfig = {
        ...defaultConfig,
        enableLogging: true,
      };

      httpClient = new HttpClient(configWithLogging);

      const error = {
        message: 'Test error',
      };

      // Get the error interceptor handler
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      try {
        errorHandler(error);
      } catch (e) {
        // Expected to throw
      }

      expect(consoleSpy).toHaveBeenCalledWith('[API Error] Test error');

      consoleSpy.mockRestore();
    });

    test('should not log when logging disabled', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      const configWithoutLogging: SDKConfig = {
        ...defaultConfig,
        enableLogging: false,
      };

      httpClient = new HttpClient(configWithoutLogging);

      const mockResponse = {
        status: 200,
        config: { url: '/test' },
        data: { success: true, data: {} },
      };

      // Get the success interceptor handler
      const successHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];
      successHandler(mockResponse);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
