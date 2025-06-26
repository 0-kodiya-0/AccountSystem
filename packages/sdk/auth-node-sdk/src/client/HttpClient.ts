import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  HttpClientConfig,
  ApiError,
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
}
