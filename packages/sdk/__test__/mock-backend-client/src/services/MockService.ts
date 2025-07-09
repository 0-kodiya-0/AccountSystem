import { MockHttpClient } from '../client/MockHttpClient';
import {
  AccountType,
  ApiErrorCode,
  AuthSDKError,
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
  GetEmailsByTemplateResponse,
  GetLatestEmailResponse,
  GetSendEmailsResponse,
  MockClientConfig,
  MockEmailMessage,
  MockSessionInfo,
  TokenInfoResponse,
  OAuthCacheResponse,
  ProviderInfoResponse,
  SendTestEmailResponse,
  TokenInfoForAccountResponse,
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
  async getTokenInfo(): Promise<TokenInfoResponse> {
    try {
      return await this.httpClient.get<TokenInfoResponse>('/mock/token/info');
    } catch (error) {
      throw this.handleError(error, 'Failed to get token status');
    }
  }

  /**
   * Get token information for specific account
   */
  async getTokenInfoForAccount(accountId: string): Promise<TokenInfoForAccountResponse> {
    try {
      this.validateAccountId(accountId);
      return await this.httpClient.get<TokenInfoForAccountResponse>(`/mock/token/info/${accountId}`);
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
  // OAuth Mock API Methods
  // ============================================================================

  /**
   * Get provider information
   */
  async getOAuthProviderInfo(provider: string): Promise<ProviderInfoResponse> {
    try {
      if (!provider) {
        throw new AuthSDKError('Provider is required', ApiErrorCode.VALIDATION_ERROR);
      }
      return await this.httpClient.get<ProviderInfoResponse>(`/mock/oauth/${provider}/info`);
    } catch (error) {
      throw this.handleError(error, 'Failed to get OAuth provider info');
    }
  }

  /**
   * Clear OAuth mock cache
   */
  async clearOAuthMockCache(): Promise<OAuthCacheResponse> {
    try {
      return await this.httpClient.delete<OAuthCacheResponse>('/mock/oauth/clear');
    } catch (error) {
      throw this.handleError(error, 'Failed to clear OAuth mock cache');
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

  /**
   * Get sent emails with filtering
   */
  async getSentEmails(filters: EmailFilters = {}): Promise<GetSendEmailsResponse> {
    try {
      return await this.httpClient.get<GetSendEmailsResponse>('/mock/email/sent', { params: filters });
    } catch (error) {
      throw this.handleError(error, `Failed to get sent emails with filter ${JSON.stringify(filters)}`);
    }
  }

  /**
   * Get latest email for specific address
   */
  async getLatestEmail(
    email: string,
    options?: {
      template?: EmailTemplate;
      [key: string]: any; // For metadata query params
    },
  ): Promise<GetLatestEmailResponse> {
    try {
      if (!email) {
        throw new AuthSDKError('Email address is required', ApiErrorCode.VALIDATION_ERROR);
      }
      return await this.httpClient.get<GetLatestEmailResponse>(`/mock/email/latest/${email}`, {
        params: options,
      });
    } catch (error) {
      throw this.handleError(error, 'Failed to get the latest email');
    }
  }

  /**
   * Clear sent emails with optional filtering
   */
  async clearSentEmails(metadataFilter?: EmailFilters['metadata']): Promise<ClearEmailResponse> {
    try {
      return await this.httpClient.delete<ClearEmailResponse>('/mock/email/clear', {
        params: metadataFilter,
      });
    } catch (error) {
      throw this.handleError(error, `Failed to clear emails with filter ${JSON.stringify(metadataFilter)}`);
    }
  }

  /**
   * Clear all sent emails
   */
  async clearAllEmails(): Promise<ClearAllEmailsResponse> {
    try {
      return await this.httpClient.delete<ClearAllEmailsResponse>('/mock/email/clear/all');
    } catch (error) {
      throw this.handleError(error, 'Failed to clear all emails');
    }
  }

  /**
   * Test send email
   */
  async testSendEmail(emailData: {
    to: string;
    template: EmailTemplate;
    variables?: Record<string, string>;
    metadata?: MockEmailMessage['metadata'];
  }): Promise<SendTestEmailResponse> {
    try {
      if (!emailData.to || !emailData.template) {
        throw new AuthSDKError('Email address and template are required', ApiErrorCode.VALIDATION_ERROR);
      }
      return await this.httpClient.post<SendTestEmailResponse>('/mock/email/send', emailData);
    } catch (error) {
      throw this.handleError(error, 'Failed to send test email');
    }
  }

  /**
   * Get emails by template type
   */
  async getEmailsByTemplate(
    template: EmailTemplate,
    options?: {
      limit?: number;
      [key: string]: any; // For metadata query params
    },
  ): Promise<GetEmailsByTemplateResponse> {
    try {
      if (!template) {
        throw new AuthSDKError('Template is required', ApiErrorCode.VALIDATION_ERROR);
      }
      return await this.httpClient.get<GetEmailsByTemplateResponse>(`/mock/email/templates/${template}`, {
        params: options,
      });
    } catch (error) {
      throw this.handleError(error, 'Failed to get emails by template');
    }
  }

  /**
   * Search emails by metadata criteria
   */
  async searchEmailsByMetadata(
    filter: EmailFilters['metadata'],
    limit?: number,
  ): Promise<EmailSearchByMetadataResponse> {
    try {
      if (!filter || typeof filter !== 'object') {
        throw new AuthSDKError('Filter object is required', ApiErrorCode.VALIDATION_ERROR);
      }
      return await this.httpClient.post<EmailSearchByMetadataResponse>('/mock/email/search', { filter, limit });
    } catch (error) {
      throw this.handleError(error, 'Failed to search emails by metadata');
    }
  }

  /**
   * Get available email templates
   */
  async getAvailableTemplates(): Promise<GetEmailAvailableTemplatesResponse> {
    try {
      return await this.httpClient.get<GetEmailAvailableTemplatesResponse>('/mock/email/templates');
    } catch (error) {
      throw this.handleError(error, 'Failed to get available templates');
    }
  }

  /**
   * Get metadata insights
   */
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
