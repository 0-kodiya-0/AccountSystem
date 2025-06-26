import { HttpClient } from '../client/HttpClient';
import {
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

export class ApiService {
  private httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  // ========================================================================
  // Health & Status
  // ========================================================================

  async healthCheck(): Promise<HealthCheckResponse> {
    return this.httpClient.get('/health');
  }

  // ========================================================================
  // Authentication & Token Management
  // ========================================================================

  async verifyToken(token: string, tokenType: 'access' | 'refresh' = 'access'): Promise<TokenVerificationResponse> {
    return this.httpClient.post('/auth/verify-token', { token, tokenType });
  }

  async getTokenInfo(token: string, tokenType: 'access' | 'refresh' = 'access'): Promise<TokenInfoResponse> {
    return this.httpClient.post('/auth/token-info', { token, tokenType });
  }

  // ========================================================================
  // User Management
  // ========================================================================

  async getUserById(accountId: string): Promise<UserResponse> {
    return this.httpClient.get(`/users/${accountId}`);
  }

  async getUserByEmail(email: string): Promise<UserEmailResponse> {
    return this.httpClient.get(`/users/search/email/${encodeURIComponent(email)}`);
  }

  async searchUserByEmail(email: string): Promise<UserEmailResponse> {
    return this.httpClient.get(`/users/search?email=${encodeURIComponent(email)}`);
  }

  async checkUserExists(accountId: string): Promise<UserExistsResponse> {
    return this.httpClient.get(`/users/${accountId}/exists`);
  }

  // ========================================================================
  // Session Management
  // ========================================================================

  async getSessionInfo(sessionCookie?: string): Promise<SessionInfoResponse> {
    return this.httpClient.post('/session/info', { sessionCookie });
  }

  async getSessionAccounts(accountIds?: string[], sessionCookie?: string): Promise<SessionAccountsResponse> {
    return this.httpClient.post('/session/accounts', { accountIds, sessionCookie });
  }

  async validateSession(accountId?: string, sessionCookie?: string): Promise<SessionValidationResponse> {
    return this.httpClient.post('/session/validate', { accountId, sessionCookie });
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Check if the API service is healthy and reachable
   */
  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.healthCheck();
      return health.status === 'healthy' || health.status === 'ok';
    } catch (error) {
      return false;
    }
  }
}
