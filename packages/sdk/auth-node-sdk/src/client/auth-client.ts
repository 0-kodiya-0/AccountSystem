import axios, { AxiosInstance, AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios';
import {
  InternalHttpClientConfig,
  ApiResponse,
  InternalApiError,
  ApiErrorCode,
  HealthCheckResponse,
  TokenVerificationResponse,
  TokenInfoResponse,
  UserResponse,
  UserEmailResponse,
  UserExistsResponse,
  SessionInfoResponse,
  SessionAccountsResponse,
  SessionValidationResponse,
} from '../types';

export class InternalHttpClient {
  private client: AxiosInstance;
  private config: InternalHttpClientConfig;

  constructor(config: InternalHttpClientConfig) {
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
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (this.config.enableLogging) {
          console.debug(`[Internal API] ${config.method?.toUpperCase()} ${config.url}`);
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        if (this.config.enableLogging) {
          console.debug(`[Internal API] ${response.status} ${response.config.url}`);
        }

        const apiResponse: ApiResponse = response.data;

        if (apiResponse.success) {
          // Return unwrapped data
          return { ...response, data: apiResponse.data };
        } else {
          // API-level error
          const apiError = apiResponse.error!;
          throw new InternalApiError(apiError.code as ApiErrorCode, apiError.message, response.status, {
            endpoint: response.config.url,
            method: response.config.method?.toUpperCase(),
            ...(apiError.details && { apiDetails: apiError.details }),
          });
        }
      },
      (error: AxiosError) => {
        if (this.config.enableLogging) {
          console.error(`[Internal API Error] ${error.message}`);
        }

        // Network/connection errors
        if (!error.response) {
          if (error.code === 'ECONNABORTED') {
            throw new InternalApiError(
              ApiErrorCode.TIMEOUT_ERROR,
              'Request timeout - internal server did not respond in time',
              408,
            );
          }

          if (error.code === 'ECONNREFUSED') {
            throw new InternalApiError(
              ApiErrorCode.CONNECTION_ERROR,
              'Connection refused - internal server is not running or unreachable',
              503,
            );
          }

          if (error.code === 'ENOTFOUND') {
            throw new InternalApiError(
              ApiErrorCode.CONNECTION_ERROR,
              'DNS resolution failed - check internal server hostname',
              503,
            );
          }

          throw new InternalApiError(ApiErrorCode.CONNECTION_ERROR, `Network error: ${error.message}`, 503);
        }

        // HTTP response errors
        const status = error.response.status;
        const responseData = error.response.data as any;

        // Structured API error response
        if (responseData?.error) {
          const apiError = responseData.error;
          throw new InternalApiError(
            (apiError.code as ApiErrorCode) || this.mapStatusToErrorCode(status),
            apiError.message || 'Internal API error',
            status,
          );
        }

        // Non-structured error response
        const errorMessage =
          typeof responseData === 'string' ? responseData : responseData?.message || `HTTP ${status} error`;

        throw new InternalApiError(this.mapStatusToErrorCode(status), errorMessage, status);
      },
    );
  }

  private mapStatusToErrorCode(status: number): ApiErrorCode {
    const statusMap: Record<number, ApiErrorCode> = {
      400: ApiErrorCode.INVALID_REQUEST,
      401: ApiErrorCode.AUTH_FAILED,
      403: ApiErrorCode.PERMISSION_DENIED,
      404: ApiErrorCode.RESOURCE_NOT_FOUND,
      409: ApiErrorCode.RESOURCE_EXISTS,
      422: ApiErrorCode.VALIDATION_ERROR,
      429: ApiErrorCode.RATE_LIMIT_EXCEEDED,
      500: ApiErrorCode.SERVER_ERROR,
      502: ApiErrorCode.SERVICE_UNAVAILABLE,
      503: ApiErrorCode.SERVICE_UNAVAILABLE,
      504: ApiErrorCode.SERVICE_UNAVAILABLE,
    };

    return statusMap[status] || ApiErrorCode.SERVER_ERROR;
  }

  // ========================================================================
  // Private Request Method
  // ========================================================================

  private async request<T>(
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
  // Public API Methods
  // ========================================================================

  async healthCheck(): Promise<HealthCheckResponse> {
    return this.request('GET', '/health');
  }

  async verifyToken(token: string, tokenType: 'access' | 'refresh' = 'access'): Promise<TokenVerificationResponse> {
    return this.request('POST', '/auth/verify-token', { token, tokenType });
  }

  async getTokenInfo(token: string, tokenType: 'access' | 'refresh' = 'access'): Promise<TokenInfoResponse> {
    return this.request('POST', '/auth/token-info', { token, tokenType });
  }

  async getUserById(accountId: string): Promise<UserResponse> {
    return this.request('GET', `/users/${accountId}`);
  }

  async getUserByEmail(email: string): Promise<UserEmailResponse> {
    return this.request('GET', `/users/search/email/${encodeURIComponent(email)}`);
  }

  async searchUserByEmail(email: string): Promise<UserEmailResponse> {
    return this.request('GET', `/users/search?email=${encodeURIComponent(email)}`);
  }

  async checkUserExists(accountId: string): Promise<UserExistsResponse> {
    return this.request('GET', `/users/${accountId}/exists`);
  }

  async getSessionInfo(sessionCookie?: string): Promise<SessionInfoResponse> {
    return this.request('POST', '/session/info', { sessionCookie });
  }

  async getSessionAccounts(accountIds?: string[], sessionCookie?: string): Promise<SessionAccountsResponse> {
    return this.request('POST', '/session/accounts', { accountIds, sessionCookie });
  }

  async validateSession(accountId?: string, sessionCookie?: string): Promise<SessionValidationResponse> {
    return this.request('POST', '/session/validate', { accountId, sessionCookie });
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  isApiError(error: unknown, code?: ApiErrorCode): error is InternalApiError {
    if (!(error instanceof InternalApiError)) {
      return false;
    }
    return code ? error.code === code : true;
  }

  isNetworkError(error: unknown): error is InternalApiError {
    return (
      this.isApiError(error, ApiErrorCode.CONNECTION_ERROR) ||
      this.isApiError(error, ApiErrorCode.TIMEOUT_ERROR) ||
      this.isApiError(error, ApiErrorCode.SERVICE_UNAVAILABLE)
    );
  }

  isAuthError(error: unknown): error is InternalApiError {
    return (
      this.isApiError(error, ApiErrorCode.AUTH_FAILED) ||
      this.isApiError(error, ApiErrorCode.TOKEN_EXPIRED) ||
      this.isApiError(error, ApiErrorCode.TOKEN_INVALID) ||
      this.isApiError(error, ApiErrorCode.PERMISSION_DENIED)
    );
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof InternalApiError) {
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unknown error occurred';
  }
}
