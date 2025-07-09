import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiErrorCode, AuthSDKError, MockHttpClientConfig } from '../types';

export class MockHttpClient {
  private client: AxiosInstance;
  private config: MockHttpClientConfig;

  constructor(config: MockHttpClientConfig) {
    this.config = {
      timeout: 30000,
      enableLogging: false,
      withCredentials: true,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.defaultHeaders || {}),
      },
      withCredentials: this.config.withCredentials,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor to ensure default headers are always included
    this.client.interceptors.request.use(
      (config) => {
        // Merge default headers with request-specific headers
        if (this.config.defaultHeaders) {
          Object.entries(this.config.defaultHeaders).forEach(([key, value]) => {
            if (value !== undefined) {
              config.headers.set(key, value);
            }
          });
        }

        if (this.config.enableLogging) {
          console.debug(`[MockClient Request] ${config.method?.toUpperCase()} ${config.url}`, {
            headers: config.headers.toJSON(),
          });
        }

        return config;
      },
      (error) => {
        if (this.config.enableLogging) {
          console.error(`[MockClient Request Error] ${error.message}`);
        }
        return Promise.reject(error);
      },
    );

    this.client.interceptors.response.use(
      (response) => {
        if (this.config.enableLogging) {
          console.debug(`[MockClient Success] ${response.status} ${response.config.url}`);
        }

        // Handle ApiResponse structure
        if (response.data && typeof response.data === 'object' && 'success' in response.data) {
          if (response.data.success) {
            return { ...response, data: response.data.data };
          } else {
            throw new AuthSDKError(
              response.data.error?.message || 'API error',
              response.data.error?.code || ApiErrorCode.SERVER_ERROR,
              response.status,
            );
          }
        }

        return response;
      },
      (error) => {
        if (this.config.enableLogging) {
          console.error(`[MockClient Error] ${error.message}`);
        }

        throw new AuthSDKError(
          error.response?.data?.error?.message || error.message || 'Request failed',
          error.response?.data?.error?.code || ApiErrorCode.NETWORK_ERROR,
          error.response?.status || 0,
        );
      },
    );
  }

  // Convenient methods that auto-extract data
  async get<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(endpoint, config);
    return response.data as T;
  }

  async post<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(endpoint, data, config);
    return response.data as T;
  }

  async put<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(endpoint, data, config);
    return response.data as T;
  }

  async delete<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(endpoint, config);
    return response.data as T;
  }

  async patch<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(endpoint, data, config);
    return response.data as T;
  }

  // Full response methods when you need metadata
  async getResponse<T>(endpoint: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(endpoint, config);
  }

  async postResponse<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(endpoint, data, config);
  }

  async putResponse<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put<T>(endpoint, data, config);
  }

  async deleteResponse<T>(endpoint: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(endpoint, config);
  }

  async patchResponse<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(endpoint, data, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): MockHttpClientConfig {
    return { ...this.config };
  }
}
