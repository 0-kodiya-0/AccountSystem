import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { HttpClientConfig, ApiError, ApiErrorCode } from '../types';

export class HttpClient {
  private client: AxiosInstance;
  private config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    this.config = config;
    this.client = this.createAxiosInstance();
    this.setupInterceptors();
  }

  private createAxiosInstance(): AxiosInstance {
    const baseURL = `${this.config.baseUrl.replace(/\/$/, '')}/internal`;

    return axios.create({
      baseURL,
      timeout: this.config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Service-ID': this.config.serviceId,
        'X-Internal-Service-Secret': this.config.serviceSecret,
      },
      validateStatus: () => true, // Handle all status codes manually
    });
  }

  private setupInterceptors(): void {
    this.client.interceptors.response.use(
      (response) => {
        if (this.config.enableLogging) {
          console.debug(`[API Success] ${response.status} ${response.config.url}`);
        }

        // Handle ApiResponse structure
        if (response.data && typeof response.data === 'object' && 'success' in response.data) {
          if (response.data.success) {
            return { ...response, data: response.data.data };
          } else {
            throw new ApiError(
              response.data.error?.code || ApiErrorCode.SERVER_ERROR,
              response.data.error?.message || 'API error',
              response.status,
            );
          }
        }

        return response;
      },
      (error) => {
        if (this.config.enableLogging) {
          console.error(`[API Error] ${error.message}`);
        }

        throw new ApiError(
          ApiErrorCode.CONNECTION_ERROR,
          error.response?.data?.error?.message || error.message,
          error.response?.status || 503,
        );
      },
    );
  }

  // ========================================================================
  // Core Request Methods
  // ========================================================================

  async get<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request({
      method: 'GET',
      url: endpoint,
      ...config,
    });

    return response.data as T;
  }

  async post<T>(endpoint: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request({
      method: 'POST',
      url: endpoint,
      data,
      ...config,
    });

    return response.data as T;
  }

  async put<T>(endpoint: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request({
      method: 'PUT',
      url: endpoint,
      data,
      ...config,
    });

    return response.data as T;
  }

  async delete<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request({
      method: 'DELETE',
      url: endpoint,
      ...config,
    });

    return response.data as T;
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.client.request({
      method,
      url: endpoint,
      data,
      ...config,
    });

    return response.data as T;
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  isApiError(error: unknown, code?: ApiErrorCode): error is ApiError {
    if (!(error instanceof ApiError)) {
      return false;
    }
    return code ? error.code === code : true;
  }

  isNetworkError(error: unknown): error is ApiError {
    return (
      this.isApiError(error, ApiErrorCode.CONNECTION_ERROR) ||
      this.isApiError(error, ApiErrorCode.TIMEOUT_ERROR) ||
      this.isApiError(error, ApiErrorCode.SERVICE_UNAVAILABLE)
    );
  }

  isAuthError(error: unknown): error is ApiError {
    return (
      this.isApiError(error, ApiErrorCode.AUTH_FAILED) ||
      this.isApiError(error, ApiErrorCode.TOKEN_EXPIRED) ||
      this.isApiError(error, ApiErrorCode.TOKEN_INVALID) ||
      this.isApiError(error, ApiErrorCode.PERMISSION_DENIED)
    );
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unknown error occurred';
  }

  // ========================================================================
  // Configuration Access
  // ========================================================================

  getBaseUrl(): string {
    return this.client.defaults.baseURL || '';
  }

  getTimeout(): number {
    return this.client.defaults.timeout || 30000;
  }

  isLoggingEnabled(): boolean {
    return this.config.enableLogging || false;
  }
}
