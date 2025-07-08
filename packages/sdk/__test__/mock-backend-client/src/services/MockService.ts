import { MockHttpClient } from '../client/MockHttpClient';
import {
  AccountType,
  ApiErrorCode,
  AuthSDKError,
  BatchCreateTokensRequest,
  BatchCreateTokensResponse,
  ClearAllEmailsResponse,
  ClearEmailResponse,
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
  EmailFilters,
  EmailSearchByMetadataResponse,
  EmailTemplate,
  GenerateSessionsRequest,
  GenerateSessionsResponse,
  GetEmailAvailableTemplatesResponse,
  GetEmailMetadataInsightsResponse,
  GetEmailsByFlowResponse,
  GetEmailsByTemplateResponse,
  GetEmailsByTestIdResponse,
  GetEmailStatusResponse,
  GetLatestEmailResponse,
  GetSendEmailsResponse,
  MockClientConfig,
  MockEmailMessage,
  MockSessionInfo,
  MockSessionStatus,
  MockTokenStatus,
  SendTestEmailResponse,
  TokenInfo,
  TwoFAAccountGenerateCodeResponse,
  TwoFAAccountSecretResponse,
  TwoFACacheStatsResponse,
  TwoFAGenerateBackupCodesRequest,
  TwoFAGenerateBackupCodesResponse,
  TwoFAGenerateCodeResponse,
  TwoFASetupTokenDataResponse,
  TwoFASetupTokensResponse,
  TwoFATempTokenDataResponse,
  TwoFATempTokensResponse,
  TwoFAValidateTokenResponse,
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
      return await this.httpClient.get<MockSessionStatus>('/mock/session/status');
    } catch (error) {
      throw this.handleError(error, 'Failed to get session status');
    }
  }

  /**
   * Get detailed session information
   */
  async getSessionInfo(): Promise<MockSessionInfo> {
    try {
      return await this.httpClient.get<MockSessionInfo>('/mock/session/info');
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
      return await this.httpClient.post<CreateSessionResponse>('/mock/session/create', request);
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
      return await this.httpClient.put<UpdateSessionResponse>('/mock/session/update', request);
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
      return await this.httpClient.post<ValidateSessionResponse>('/mock/session/validate', request);
    } catch (error) {
      throw this.handleError(error, 'Failed to validate session');
    }
  }

  /**
   * Clear current session
   */
  async clearSession(): Promise<{ message: string; cleared: boolean }> {
    try {
      return await this.httpClient.delete<{ message: string; cleared: boolean }>('/mock/session/clear');
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
      return await this.httpClient.post<GenerateSessionsResponse>('/mock/session/generate', request);
    } catch (error) {
      throw this.handleError(error, 'Failed to generate sessions');
    }
  }

  /**
   * Corrupt session for testing error scenarios
   */
  async corruptSession(request: CorruptSessionRequest = {}): Promise<CorruptSessionResponse> {
    try {
      return await this.httpClient.post<CorruptSessionResponse>('/mock/session/corrupt', request);
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
      return await this.httpClient.get<MockTokenStatus>('/mock/token/status');
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
      return await this.httpClient.get<TokenInfo>(`/mock/token/info/${accountId}`);
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
      return await this.httpClient.post<CreateTokenResponse>('/mock/token/access/create', request);
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
      return await this.httpClient.post<CreateTokenResponse>('/mock/token/refresh/create', request);
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
      return await this.httpClient.post<CreateTokenPairResponse>('/mock/token/pair/create', request);
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
      return await this.httpClient.post<ValidateTokenResponse>('/mock/token/validate', request);
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
      return await this.httpClient.post<CreateExpiredTokenResponse>('/mock/token/expired/create', request);
    } catch (error) {
      throw this.handleError(error, 'Failed to create expired token');
    }
  }

  /**
   * Create malformed token for testing
   */
  async createMalformedToken(request: CreateMalformedTokenRequest = {}): Promise<CreateMalformedTokenResponse> {
    try {
      return await this.httpClient.post<CreateMalformedTokenResponse>('/mock/token/malformed/create', request);
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
      return await this.httpClient.post<BatchCreateTokensResponse>('/mock/token/batch/create', request);
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
      return await this.httpClient.delete<ClearTokensResponse>(`/mock/token/clear/${accountId}`);
    } catch (error) {
      throw this.handleError(error, 'Failed to clear tokens');
    }
  }

  // ============================================================================
  // TwoFA Mock API Methods
  // ============================================================================

  /**
   * Generate TOTP code for a given secret (simulates authenticator app)
   */
  async generateTotpCode(secret: string): Promise<TwoFAGenerateCodeResponse> {
    try {
      if (!secret) {
        throw new AuthSDKError('Secret is required', ApiErrorCode.VALIDATION_ERROR);
      }
      return await this.httpClient.get<TwoFAGenerateCodeResponse>(`/mock/twofa/generate-code/${secret}`);
    } catch (error) {
      throw this.handleError(error, 'Failed to generate TOTP code');
    }
  }

  /**
   * Get the 2FA secret for an account (for testing purposes)
   */
  async getAccountSecret(accountId: string): Promise<TwoFAAccountSecretResponse> {
    try {
      this.validateAccountId(accountId);
      return await this.httpClient.get<TwoFAAccountSecretResponse>(`/mock/twofa/account/${accountId}/secret`);
    } catch (error) {
      throw this.handleError(error, 'Failed to get account 2FA secret');
    }
  }

  /**
   * Generate TOTP code for an account using its stored secret
   */
  async generateAccountTotpCode(accountId: string): Promise<TwoFAAccountGenerateCodeResponse> {
    try {
      this.validateAccountId(accountId);
      return await this.httpClient.get<TwoFAAccountGenerateCodeResponse>(
        `/mock/twofa/account/${accountId}/generate-code`,
      );
    } catch (error) {
      throw this.handleError(error, 'Failed to generate account TOTP code');
    }
  }

  /**
   * Validate a TOTP token against a secret (simulates authenticator verification)
   */
  async validateTotpToken(secret: string, token: string): Promise<TwoFAValidateTokenResponse> {
    try {
      if (!secret || !token) {
        throw new AuthSDKError('Secret and token are required', ApiErrorCode.VALIDATION_ERROR);
      }
      if (token.length !== 6) {
        throw new AuthSDKError('Token must be 6 characters long', ApiErrorCode.VALIDATION_ERROR);
      }
      return await this.httpClient.get<TwoFAValidateTokenResponse>(`/mock/twofa/validate-token/${secret}/${token}`);
    } catch (error) {
      throw this.handleError(error, 'Failed to validate TOTP token');
    }
  }

  /**
   * Get 2FA cache statistics (temp tokens, setup tokens)
   */
  async getTwoFACacheStats(): Promise<TwoFACacheStatsResponse> {
    try {
      return await this.httpClient.get<TwoFACacheStatsResponse>('/mock/twofa/cache/stats');
    } catch (error) {
      throw this.handleError(error, 'Failed to get 2FA cache stats');
    }
  }

  /**
   * Get all temporary tokens (for debugging login flows)
   */
  async getTwoFATempTokens(): Promise<TwoFATempTokensResponse> {
    try {
      return await this.httpClient.get<TwoFATempTokensResponse>('/mock/twofa/cache/temp-tokens');
    } catch (error) {
      throw this.handleError(error, 'Failed to get 2FA temp tokens');
    }
  }

  /**
   * Get all setup tokens (for debugging setup flows)
   */
  async getTwoFASetupTokens(): Promise<TwoFASetupTokensResponse> {
    try {
      return await this.httpClient.get<TwoFASetupTokensResponse>('/mock/twofa/cache/setup-tokens');
    } catch (error) {
      throw this.handleError(error, 'Failed to get 2FA setup tokens');
    }
  }

  /**
   * Get specific temporary token data
   */
  async getTwoFATempTokenData(token: string): Promise<TwoFATempTokenDataResponse> {
    try {
      if (!token) {
        throw new AuthSDKError('Token is required', ApiErrorCode.VALIDATION_ERROR);
      }
      return await this.httpClient.get<TwoFATempTokenDataResponse>(`/mock/twofa/cache/temp-token/${token}`);
    } catch (error) {
      throw this.handleError(error, 'Failed to get temp token data');
    }
  }

  /**
   * Get specific setup token data
   */
  async getTwoFASetupTokenData(token: string): Promise<TwoFASetupTokenDataResponse> {
    try {
      if (!token) {
        throw new AuthSDKError('Token is required', ApiErrorCode.VALIDATION_ERROR);
      }
      return await this.httpClient.get<TwoFASetupTokenDataResponse>(`/mock/twofa/cache/setup-token/${token}`);
    } catch (error) {
      throw this.handleError(error, 'Failed to get setup token data');
    }
  }

  /**
   * Generate mock backup codes (for testing backup code flows)
   */
  async generateTwoFABackupCodes(
    request: TwoFAGenerateBackupCodesRequest = {},
  ): Promise<TwoFAGenerateBackupCodesResponse> {
    try {
      if (request.count && (request.count < 1 || request.count > 20)) {
        throw new AuthSDKError('Count must be between 1 and 20', ApiErrorCode.VALIDATION_ERROR);
      }
      return await this.httpClient.post<TwoFAGenerateBackupCodesResponse>('/mock/twofa/generate-backup-codes', request);
    } catch (error) {
      throw this.handleError(error, 'Failed to generate backup codes');
    }
  }

  // ============================================================================
  // Email API Methods
  // ============================================================================

  async getStatus(): Promise<GetEmailStatusResponse> {
    try {
      return await this.httpClient.get<GetEmailStatusResponse>('/mock/email/status');
    } catch (error) {
      throw this.handleError(error, 'Failed to get status for email');
    }
  }

  async getSentEmails(filter: EmailFilters): Promise<GetSendEmailsResponse> {
    try {
      return await this.httpClient.get<GetSendEmailsResponse>('/mock/email/sent', { params: filter });
    } catch (error) {
      throw this.handleError(error, `Failed to get send email for ${JSON.stringify(filter)} filter`);
    }
  }

  async getLatestEmail(
    email: string,
    options?: {
      template?: EmailTemplate;
      metadataQuery?: EmailFilters['metadata'];
    },
  ): Promise<GetLatestEmailResponse> {
    try {
      return await this.httpClient.get<GetLatestEmailResponse>(`/mock/email/latest/${email}`, {
        params: options,
      });
    } catch (error) {
      throw this.handleError(error, 'Failed to get the latest email');
    }
  }

  async clearSentEmails(filter?: EmailFilters['metadata']): Promise<ClearEmailResponse> {
    try {
      return await this.httpClient.delete<ClearEmailResponse>('/mock/email/clear', { params: filter });
    } catch (error) {
      throw this.handleError(error, `Failed to clear email for ${JSON.stringify(filter)} filter`);
    }
  }

  async clearAllEmails(): Promise<ClearAllEmailsResponse> {
    try {
      return await this.httpClient.delete<ClearAllEmailsResponse>('/mock/email/clear/all');
    } catch (error) {
      throw this.handleError(error, 'Failed to clear all emails');
    }
  }

  async testSendEmail(emailMessage: MockEmailMessage): Promise<SendTestEmailResponse> {
    try {
      return await this.httpClient.post<SendTestEmailResponse>('/mock/email/send', emailMessage);
    } catch (error) {
      throw this.handleError(error, 'Failed to send a test email');
    }
  }

  async getEmailsByTemplate(
    template: EmailTemplate,
    options?: {
      limit?: number;
      metadataQuery?: EmailFilters['metadata'];
    },
  ): Promise<GetEmailsByTemplateResponse> {
    try {
      return await this.httpClient.get<GetEmailsByTemplateResponse>(`/mock/email/templates/${template}`, {
        params: options,
      });
    } catch (error) {
      throw this.handleError(error, 'Failed to get by template');
    }
  }

  async searchEmailsByMetadata(
    filter: EmailFilters['metadata'],
    limit?: number,
  ): Promise<EmailSearchByMetadataResponse> {
    try {
      return await this.httpClient.post<EmailSearchByMetadataResponse>('/mock/email/search', { filter, limit });
    } catch (error) {
      throw this.handleError(error, 'Failed to search email by metadata');
    }
  }

  async getAvailableTemplates(): Promise<GetEmailAvailableTemplatesResponse> {
    try {
      return await this.httpClient.get<GetEmailAvailableTemplatesResponse>('/mock/email/template');
    } catch (error) {
      throw this.handleError(error, 'No available templates');
    }
  }

  async getMetadataInsights(): Promise<GetEmailMetadataInsightsResponse> {
    try {
      return await this.httpClient.get<GetEmailMetadataInsightsResponse>('/mock/email/metadata/insights');
    } catch (error) {
      throw this.handleError(error, 'Failed to get metadata insights');
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
