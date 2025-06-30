import { MockHttpClient } from '../client/MockHttpClient';
import {
  AccountType,
  ApiErrorCode,
  AuthSDKError,
  BatchCreateTokensRequest,
  BatchCreateTokensResponse,
  ClearTokensResponse,
  CorruptSessionRequest,
  CorruptSessionResponse,
  CreateExpiredTokenRequest,
  CreateExpiredTokenResponse,
  CreateMalformedTokenRequest,
  CreateMalformedTokenResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  CreateTokenPairRequest,
  CreateTokenPairResponse,
  CreateTokenRequest,
  CreateTokenResponse,
  GenerateSessionsRequest,
  GenerateSessionsResponse,
  MockClientConfig,
  MockSessionInfo,
  MockSessionStatus,
  MockTokenStatus,
  TokenInfo,
  UpdateSessionRequest,
  UpdateSessionResponse,
  ValidateSessionRequest,
  ValidateSessionResponse,
  ValidateTokenRequest,
  ValidateTokenResponse,
} from '../types';

export class MockService {
  private httpClient: MockHttpClient;

  constructor(config: MockClientConfig) {
    this.httpClient = new MockHttpClient(config);
  }

  // ============================================================================
  // Session Mock API Methods
  // ============================================================================

  /**
   * Get current session mock status
   */
  async getSessionStatus(): Promise<MockSessionStatus> {
    try {
      return await this.httpClient.get<MockSessionStatus>('/session-mock/status');
    } catch (error) {
      throw this.handleError(error, 'Failed to get session status');
    }
  }

  /**
   * Get detailed session information
   */
  async getSessionInfo(): Promise<MockSessionInfo> {
    try {
      return await this.httpClient.get<MockSessionInfo>('/session-mock/info');
    } catch (error) {
      throw this.handleError(error, 'Failed to get session info');
    }
  }

  /**
   * Create a new mock session token
   */
  async createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
    try {
      this.validateCreateSessionRequest(request);
      return await this.httpClient.post<CreateSessionResponse>('/session-mock/create', request);
    } catch (error) {
      throw this.handleError(error, 'Failed to create session');
    }
  }

  /**
   * Update existing session token
   */
  async updateSession(request: UpdateSessionRequest): Promise<UpdateSessionResponse> {
    try {
      this.validateUpdateSessionRequest(request);
      return await this.httpClient.put<UpdateSessionResponse>('/session-mock/update', request);
    } catch (error) {
      throw this.handleError(error, 'Failed to update session');
    }
  }

  /**
   * Validate a session token
   */
  async validateSession(request: ValidateSessionRequest): Promise<ValidateSessionResponse> {
    try {
      if (!request.token) {
        throw new AuthSDKError('Token is required', ApiErrorCode.VALIDATION_ERROR);
      }
      return await this.httpClient.post<ValidateSessionResponse>('/session-mock/validate', request);
    } catch (error) {
      throw this.handleError(error, 'Failed to validate session');
    }
  }

  /**
   * Clear current session
   */
  async clearSession(): Promise<{ message: string; cleared: boolean }> {
    try {
      return await this.httpClient.delete<{ message: string; cleared: boolean }>('/session-mock/clear');
    } catch (error) {
      throw this.handleError(error, 'Failed to clear session');
    }
  }

  /**
   * Generate multiple mock sessions for testing
   */
  async generateSessions(request: GenerateSessionsRequest = {}): Promise<GenerateSessionsResponse> {
    try {
      if (request.count && request.count > 10) {
        throw new AuthSDKError('Cannot generate more than 10 sessions', ApiErrorCode.VALIDATION_ERROR);
      }
      return await this.httpClient.post<GenerateSessionsResponse>('/session-mock/generate', request);
    } catch (error) {
      throw this.handleError(error, 'Failed to generate sessions');
    }
  }

  /**
   * Corrupt session for testing error scenarios
   */
  async corruptSession(request: CorruptSessionRequest = {}): Promise<CorruptSessionResponse> {
    try {
      return await this.httpClient.post<CorruptSessionResponse>('/session-mock/corrupt', request);
    } catch (error) {
      throw this.handleError(error, 'Failed to corrupt session');
    }
  }

  // ============================================================================
  // Token Mock API Methods
  // ============================================================================

  /**
   * Get current token mock status
   */
  async getTokenStatus(): Promise<MockTokenStatus> {
    try {
      return await this.httpClient.get<MockTokenStatus>('/token-mock/status');
    } catch (error) {
      throw this.handleError(error, 'Failed to get token status');
    }
  }

  /**
   * Get token information for specific account
   */
  async getTokenInfo(accountId: string): Promise<TokenInfo> {
    try {
      this.validateAccountId(accountId);
      return await this.httpClient.get<TokenInfo>(`/token-mock/info/${accountId}`);
    } catch (error) {
      throw this.handleError(error, 'Failed to get token info');
    }
  }

  /**
   * Create mock access token
   */
  async createAccessToken(request: CreateTokenRequest): Promise<CreateTokenResponse> {
    try {
      this.validateCreateTokenRequest(request);
      return await this.httpClient.post<CreateTokenResponse>('/token-mock/access/create', request);
    } catch (error) {
      throw this.handleError(error, 'Failed to create access token');
    }
  }

  /**
   * Create mock refresh token
   */
  async createRefreshToken(request: CreateTokenRequest): Promise<CreateTokenResponse> {
    try {
      this.validateCreateTokenRequest(request);
      return await this.httpClient.post<CreateTokenResponse>('/token-mock/refresh/create', request);
    } catch (error) {
      throw this.handleError(error, 'Failed to create refresh token');
    }
  }

  /**
   * Create token pair (access + refresh)
   */
  async createTokenPair(request: CreateTokenPairRequest): Promise<CreateTokenPairResponse> {
    try {
      this.validateCreateTokenPairRequest(request);
      return await this.httpClient.post<CreateTokenPairResponse>('/token-mock/pair/create', request);
    } catch (error) {
      throw this.handleError(error, 'Failed to create token pair');
    }
  }

  /**
   * Validate any token
   */
  async validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    try {
      if (!request.token) {
        throw new AuthSDKError('Token is required', ApiErrorCode.VALIDATION_ERROR);
      }
      return await this.httpClient.post<ValidateTokenResponse>('/token-mock/validate', request);
    } catch (error) {
      throw this.handleError(error, 'Failed to validate token');
    }
  }

  /**
   * Create expired token for testing
   */
  async createExpiredToken(request: CreateExpiredTokenRequest): Promise<CreateExpiredTokenResponse> {
    try {
      this.validateAccountId(request.accountId);
      if (!Object.values(AccountType).includes(request.accountType)) {
        throw new AuthSDKError('Invalid account type', ApiErrorCode.VALIDATION_ERROR);
      }
      return await this.httpClient.post<CreateExpiredTokenResponse>('/token-mock/expired/create', request);
    } catch (error) {
      throw this.handleError(error, 'Failed to create expired token');
    }
  }

  /**
   * Create malformed token for testing
   */
  async createMalformedToken(request: CreateMalformedTokenRequest = {}): Promise<CreateMalformedTokenResponse> {
    try {
      return await this.httpClient.post<CreateMalformedTokenResponse>('/token-mock/malformed/create', request);
    } catch (error) {
      throw this.handleError(error, 'Failed to create malformed token');
    }
  }

  /**
   * Create tokens for multiple accounts
   */
  async batchCreateTokens(request: BatchCreateTokensRequest): Promise<BatchCreateTokensResponse> {
    try {
      this.validateBatchCreateTokensRequest(request);
      return await this.httpClient.post<BatchCreateTokensResponse>('/token-mock/batch/create', request);
    } catch (error) {
      throw this.handleError(error, 'Failed to batch create tokens');
    }
  }

  /**
   * Clear all tokens for an account
   */
  async clearTokens(accountId: string): Promise<ClearTokensResponse> {
    try {
      this.validateAccountId(accountId);
      return await this.httpClient.delete<ClearTokensResponse>(`/token-mock/clear/${accountId}`);
    } catch (error) {
      throw this.handleError(error, 'Failed to clear tokens');
    }
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /**
   * Setup complete test environment with session and tokens
   */
  async setupTestEnvironment(options: {
    accountIds: string[];
    currentAccountId?: string;
    accountType?: AccountType;
    setCookies?: boolean;
  }): Promise<{
    session: CreateSessionResponse;
    tokens: BatchCreateTokensResponse;
  }> {
    try {
      const { accountIds, currentAccountId, accountType = AccountType.Local, setCookies = true } = options;

      // Create session
      const session = await this.createSession({
        accountIds,
        currentAccountId: currentAccountId || accountIds[0],
      });

      // Create tokens for all accounts
      const accounts = accountIds.map((id) => ({
        accountId: id,
        accountType,
      }));

      const tokens = await this.batchCreateTokens({
        accounts,
        setCookies,
      });

      return { session, tokens };
    } catch (error) {
      throw this.handleError(error, 'Failed to setup test environment');
    }
  }

  /**
   * Clear entire test environment
   */
  async clearTestEnvironment(accountIds: string[]): Promise<{
    session: { message: string; cleared: boolean };
    tokens: ClearTokensResponse[];
  }> {
    try {
      // Clear session
      const session = await this.clearSession();

      // Clear tokens for all accounts (run in parallel)
      const tokens = await Promise.all(accountIds.map((accountId) => this.clearTokens(accountId)));

      return { session, tokens };
    } catch (error) {
      throw this.handleError(error, 'Failed to clear test environment');
    }
  }

  /**
   * Simulate authentication flow
   */
  async simulateAuth(
    accountId: string,
    accountType: AccountType = AccountType.Local,
    options: {
      includeRefreshToken?: boolean;
      setCookies?: boolean;
      oauthTokens?: {
        accessToken: string;
        refreshToken: string;
      };
    } = {},
  ): Promise<{
    session: CreateSessionResponse;
    accessToken: CreateTokenResponse;
    refreshToken?: CreateTokenResponse;
  }> {
    try {
      const { includeRefreshToken = true, setCookies = true, oauthTokens } = options;

      // Create session
      const session = await this.createSession({
        accountIds: [accountId],
        currentAccountId: accountId,
      });

      // Create access token
      const accessTokenRequest: CreateTokenRequest = {
        accountId,
        accountType,
        setCookie: setCookies,
      };

      if (accountType === AccountType.OAuth && oauthTokens) {
        accessTokenRequest.oauthAccessToken = oauthTokens.accessToken;
      }

      const accessToken = await this.createAccessToken(accessTokenRequest);

      const result: any = { session, accessToken };

      // Create refresh token if requested
      if (includeRefreshToken) {
        const refreshTokenRequest: CreateTokenRequest = {
          accountId,
          accountType,
          setCookie: setCookies,
        };

        if (accountType === AccountType.OAuth && oauthTokens) {
          refreshTokenRequest.oauthRefreshToken = oauthTokens.refreshToken;
        }

        result.refreshToken = await this.createRefreshToken(refreshTokenRequest);
      }

      return result;
    } catch (error) {
      throw this.handleError(error, 'Failed to simulate auth');
    }
  }

  // ============================================================================
  // Validation Methods
  // ============================================================================

  private validateAccountId(accountId: string): void {
    if (!accountId || typeof accountId !== 'string') {
      throw new AuthSDKError('Account ID is required', ApiErrorCode.VALIDATION_ERROR);
    }
    if (accountId.length !== 24) {
      throw new AuthSDKError('Invalid account ID format', ApiErrorCode.VALIDATION_ERROR);
    }
  }

  private validateCreateSessionRequest(request: CreateSessionRequest): void {
    if (!request.accountIds || !Array.isArray(request.accountIds) || request.accountIds.length === 0) {
      throw new AuthSDKError('Account IDs array is required', ApiErrorCode.VALIDATION_ERROR);
    }

    request.accountIds.forEach((id) => this.validateAccountId(id));

    if (request.currentAccountId) {
      this.validateAccountId(request.currentAccountId);
      if (!request.accountIds.includes(request.currentAccountId)) {
        throw new AuthSDKError('Current account ID must be in account IDs array', ApiErrorCode.VALIDATION_ERROR);
      }
    }
  }

  private validateUpdateSessionRequest(request: UpdateSessionRequest): void {
    const validActions = ['add', 'remove', 'setCurrent'];
    if (!request.action || !validActions.includes(request.action)) {
      throw new AuthSDKError('Invalid action. Must be: add, remove, setCurrent', ApiErrorCode.VALIDATION_ERROR);
    }

    if (request.action === 'add' || request.action === 'remove') {
      if (!request.accountId) {
        throw new AuthSDKError(`Account ID is required for ${request.action} action`, ApiErrorCode.VALIDATION_ERROR);
      }
      this.validateAccountId(request.accountId);
    }

    if (request.action === 'setCurrent') {
      if (!request.currentAccountId) {
        throw new AuthSDKError('Current account ID is required for setCurrent action', ApiErrorCode.VALIDATION_ERROR);
      }
      this.validateAccountId(request.currentAccountId);
    }
  }

  private validateCreateTokenRequest(request: CreateTokenRequest): void {
    this.validateAccountId(request.accountId);

    if (!Object.values(AccountType).includes(request.accountType)) {
      throw new AuthSDKError('Invalid account type', ApiErrorCode.VALIDATION_ERROR);
    }

    if (request.accountType === AccountType.OAuth) {
      if (!request.oauthAccessToken && !request.oauthRefreshToken) {
        throw new AuthSDKError('OAuth tokens are required for OAuth accounts', ApiErrorCode.VALIDATION_ERROR);
      }
    }
  }

  private validateCreateTokenPairRequest(request: CreateTokenPairRequest): void {
    this.validateAccountId(request.accountId);

    if (!Object.values(AccountType).includes(request.accountType)) {
      throw new AuthSDKError('Invalid account type', ApiErrorCode.VALIDATION_ERROR);
    }

    if (request.accountType === AccountType.OAuth) {
      if (!request.oauthAccessToken || !request.oauthRefreshToken) {
        throw new AuthSDKError(
          'OAuth access and refresh tokens are required for OAuth accounts',
          ApiErrorCode.VALIDATION_ERROR,
        );
      }
    }
  }

  private validateBatchCreateTokensRequest(request: BatchCreateTokensRequest): void {
    if (!request.accounts || !Array.isArray(request.accounts) || request.accounts.length === 0) {
      throw new AuthSDKError('Accounts array is required', ApiErrorCode.VALIDATION_ERROR);
    }

    if (request.accounts.length > 10) {
      throw new AuthSDKError('Cannot create tokens for more than 10 accounts', ApiErrorCode.VALIDATION_ERROR);
    }

    request.accounts.forEach((account, index) => {
      try {
        this.validateAccountId(account.accountId);
        if (!Object.values(AccountType).includes(account.accountType)) {
          throw new AuthSDKError('Invalid account type', ApiErrorCode.VALIDATION_ERROR);
        }
      } catch (error) {
        throw new AuthSDKError(
          `Invalid account at index ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ApiErrorCode.VALIDATION_ERROR,
        );
      }
    });
  }

  private handleError(error: any, context: string): AuthSDKError {
    if (error instanceof AuthSDKError) {
      return error;
    }

    return new AuthSDKError(
      `${context}: ${error?.message || 'Unknown error'}`,
      error?.code || ApiErrorCode.UNKNOWN_ERROR,
      error?.statusCode || 0,
    );
  }
}
