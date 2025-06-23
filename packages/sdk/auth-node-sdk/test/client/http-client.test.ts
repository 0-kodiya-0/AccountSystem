import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { InternalHttpClient } from '../../src';
import { InternalApiError, ApiErrorCode } from '../../src';
import {
  mockTokenVerificationResponse,
  mockUserResponse,
  mockHealthResponse,
  mockSessionResponse,
} from '../helpers/mock-data';

describe('InternalHttpClient', () => {
  const baseUrl = 'https://api.example.com';
  const config = {
    baseUrl,
    serviceId: 'test-service',
    serviceSecret: 'test-secret',
    timeout: 5000,
    enableLogging: false,
  };

  let client: InternalHttpClient;

  beforeEach(() => {
    client = new InternalHttpClient(config);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('constructor and configuration', () => {
    it('should create client with correct configuration', () => {
      expect(client).toBeInstanceOf(InternalHttpClient);
      expect(client['config']).toEqual(config);
    });

    it('should set correct default headers', () => {
      const axiosInstance = client['client'];
      expect(axiosInstance.defaults.headers['Content-Type']).toBe('application/json');
      expect(axiosInstance.defaults.headers['X-Internal-Service-ID']).toBe('test-service');
      expect(axiosInstance.defaults.headers['X-Internal-Service-Secret']).toBe('test-secret');
    });

    it('should configure correct base URL and timeout', () => {
      const axiosInstance = client['client'];
      expect(axiosInstance.defaults.baseURL).toBe('https://api.example.com/internal');
      expect(axiosInstance.defaults.timeout).toBe(5000);
    });
  });

  describe('healthCheck', () => {
    it('should perform health check successfully', async () => {
      nock(baseUrl).get('/internal/health').reply(200, { success: true, data: mockHealthResponse });

      const result = await client.healthCheck();
      expect(result).toEqual(mockHealthResponse);
    });

    it('should handle health check failure', async () => {
      nock(baseUrl)
        .get('/internal/health')
        .reply(503, { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Service down' } });

      await expect(client.healthCheck()).rejects.toThrow(InternalApiError);
    });
  });

  describe('verifyToken', () => {
    it('should verify access token successfully', async () => {
      const token = 'valid_access_token';

      nock(baseUrl)
        .post('/internal/auth/verify-token', { token, tokenType: 'access' })
        .reply(200, { success: true, data: mockTokenVerificationResponse });

      const result = await client.verifyToken(token, 'access');
      expect(result).toEqual(mockTokenVerificationResponse);
    });

    it('should verify refresh token successfully', async () => {
      const token = 'valid_refresh_token';
      const refreshResponse = { ...mockTokenVerificationResponse, isRefreshToken: true };

      nock(baseUrl)
        .post('/internal/auth/verify-token', { token, tokenType: 'refresh' })
        .reply(200, { success: true, data: refreshResponse });

      const result = await client.verifyToken(token, 'refresh');
      expect(result).toEqual(refreshResponse);
    });

    it('should handle invalid token', async () => {
      const token = 'invalid_token';

      nock(baseUrl)
        .post('/internal/auth/verify-token', { token, tokenType: 'access' })
        .reply(401, {
          success: false,
          error: { code: 'TOKEN_INVALID', message: 'Invalid token' },
        });

      await expect(client.verifyToken(token)).rejects.toThrow(InternalApiError);
    });
  });

  describe('getUserById', () => {
    it('should get user by ID successfully', async () => {
      const accountId = '507f1f77bcf86cd799439011';

      nock(baseUrl).get(`/internal/users/${accountId}`).reply(200, { success: true, data: mockUserResponse });

      const result = await client.getUserById(accountId);
      expect(result).toEqual(mockUserResponse);
    });

    it('should handle user not found', async () => {
      const accountId = 'nonexistent_id';

      nock(baseUrl)
        .get(`/internal/users/${accountId}`)
        .reply(404, {
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });

      await expect(client.getUserById(accountId)).rejects.toThrow(InternalApiError);
    });
  });

  describe('getUserByEmail', () => {
    it('should get user by email successfully', async () => {
      const email = 'test@example.com';
      const userEmailResponse = { ...mockUserResponse, email };

      nock(baseUrl)
        .get(`/internal/users/search/email/${encodeURIComponent(email)}`)
        .reply(200, { success: true, data: userEmailResponse });

      const result = await client.getUserByEmail(email);
      expect(result).toEqual(userEmailResponse);
    });

    it('should handle special characters in email', async () => {
      const email = 'test+special@example.com';
      const userEmailResponse = { ...mockUserResponse, email };

      nock(baseUrl)
        .get(`/internal/users/search/email/${encodeURIComponent(email)}`)
        .reply(200, { success: true, data: userEmailResponse });

      const result = await client.getUserByEmail(email);
      expect(result).toEqual(userEmailResponse);
    });
  });

  describe('searchUserByEmail', () => {
    it('should search user by email successfully', async () => {
      const email = 'test@example.com';
      const userEmailResponse = { ...mockUserResponse, email };

      nock(baseUrl)
        .get('/internal/users/search')
        .query({ email })
        .reply(200, { success: true, data: userEmailResponse });

      const result = await client.searchUserByEmail(email);
      expect(result).toEqual(userEmailResponse);
    });
  });

  describe('checkUserExists', () => {
    it('should check if user exists', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const existsResponse = { exists: true, accountId };

      nock(baseUrl).get(`/internal/users/${accountId}/exists`).reply(200, { success: true, data: existsResponse });

      const result = await client.checkUserExists(accountId);
      expect(result).toEqual(existsResponse);
    });

    it('should return false for non-existent user', async () => {
      const accountId = 'nonexistent_id';
      const existsResponse = { exists: false, accountId };

      nock(baseUrl).get(`/internal/users/${accountId}/exists`).reply(200, { success: true, data: existsResponse });

      const result = await client.checkUserExists(accountId);
      expect(result).toEqual(existsResponse);
    });
  });

  describe('session management', () => {
    it('should get session info successfully', async () => {
      nock(baseUrl).post('/internal/session/info', {}).reply(200, { success: true, data: mockSessionResponse });

      const result = await client.getSessionInfo();
      expect(result).toEqual(mockSessionResponse);
    });

    it('should get session info with cookie', async () => {
      const sessionCookie = 'session_cookie_value';

      nock(baseUrl)
        .post('/internal/session/info', { sessionCookie })
        .reply(200, { success: true, data: mockSessionResponse });

      const result = await client.getSessionInfo(sessionCookie);
      expect(result).toEqual(mockSessionResponse);
    });

    it('should get session accounts', async () => {
      const accountIds = ['507f1f77bcf86cd799439011'];
      const accountsResponse = { accounts: [mockUserResponse.user], count: 1 };

      nock(baseUrl)
        .post('/internal/session/accounts', { accountIds })
        .reply(200, { success: true, data: accountsResponse });

      const result = await client.getSessionAccounts(accountIds);
      expect(result).toEqual(accountsResponse);
    });

    it('should validate session', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const validationResponse = {
        session: mockSessionResponse.session,
        accountId,
        isAccountInSession: true,
        isCurrentAccount: true,
      };

      nock(baseUrl)
        .post('/internal/session/validate', { accountId })
        .reply(200, { success: true, data: validationResponse });

      const result = await client.validateSession(accountId);
      expect(result).toEqual(validationResponse);
    });
  });

  describe('error handling', () => {
    it('should handle network timeout', async () => {
      nock(baseUrl)
        .get('/internal/health')
        .delayConnection(6000) // Longer than timeout
        .reply(200, { success: true, data: mockHealthResponse });

      await expect(client.healthCheck()).rejects.toThrow(InternalApiError);
    });

    it('should handle connection refused', async () => {
      // No nock intercept - should cause ECONNREFUSED
      const client = new InternalHttpClient({
        ...config,
        baseUrl: 'http://localhost:99999', // Invalid port
      });

      await expect(client.healthCheck()).rejects.toThrow(InternalApiError);
    });

    it('should handle DNS errors', async () => {
      const client = new InternalHttpClient({
        ...config,
        baseUrl: 'http://nonexistent.domain.invalid',
      });

      await expect(client.healthCheck()).rejects.toThrow(InternalApiError);
    });

    it('should handle server errors', async () => {
      nock(baseUrl)
        .get('/internal/health')
        .reply(500, { error: { code: 'SERVER_ERROR', message: 'Internal server error' } });

      await expect(client.healthCheck()).rejects.toThrow(InternalApiError);
    });

    it('should handle malformed JSON responses', async () => {
      nock(baseUrl).get('/internal/health').reply(200, 'invalid json');

      await expect(client.healthCheck()).rejects.toThrow();
    });
  });

  describe('utility methods', () => {
    it('should identify API errors correctly', () => {
      const apiError = new InternalApiError(ApiErrorCode.TOKEN_INVALID, 'Invalid token');
      const networkError = new InternalApiError(ApiErrorCode.CONNECTION_ERROR, 'Connection failed');
      const authError = new InternalApiError(ApiErrorCode.AUTH_FAILED, 'Auth failed');
      const genericError = new Error('Generic error');

      expect(client.isApiError(apiError)).toBe(true);
      expect(client.isApiError(apiError, ApiErrorCode.TOKEN_INVALID)).toBe(true);
      expect(client.isApiError(apiError, ApiErrorCode.AUTH_FAILED)).toBe(false);
      expect(client.isApiError(genericError)).toBe(false);

      expect(client.isNetworkError(networkError)).toBe(true);
      expect(client.isNetworkError(apiError)).toBe(false);

      expect(client.isAuthError(authError)).toBe(true);
      expect(client.isAuthError(networkError)).toBe(false);

      expect(client.getErrorMessage(apiError)).toBe('Invalid token');
      expect(client.getErrorMessage(genericError)).toBe('Generic error');
      expect(client.getErrorMessage('string error')).toBe('An unknown error occurred');
    });
  });
});
