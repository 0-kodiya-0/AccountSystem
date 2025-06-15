import {
  GetAccountSessionResponse,
  GetAccountSessionDataResponse,
  LocalLoginRequest,
  LocalLoginResponse,
  TwoFactorVerifyRequest,
  PasswordResetRequest,
  ResetPasswordRequest,
  PasswordChangeRequest,
  TwoFactorSetupRequest,
  TwoFactorSetupResponse,
  SessionUpdateResponse,
  PasswordChangeResponse,
  PasswordResetRequestResponse,
  ResetPasswordResponse,
  TwoFactorSetupVerificationResponse,
  BackupCodesResponse,
  OAuthProviders,
  OAuthUrlResponse,
  PermissionUrlResponse,
  ReauthorizeUrlResponse,
  LocalTokenInfoResponse,
  OAuthTokenInfoResponse,
  OAuthRefreshTokenInfoResponse,
  TokenRevocationResponse,
  LogoutResponse,
  LogoutAllResponse,
  EmailVerificationResponse,
  // NEW: Two-step signup types
  RequestEmailVerificationRequest,
  RequestEmailVerificationResponse,
  VerifyEmailSignupResponse,
  CompleteProfileRequest,
  CompleteProfileResponse,
  SignupStatusResponse,
  CancelSignupRequest,
  CancelSignupResponse,
  // NEW: OAuth 2FA types
  OAuthTwoFactorSetupRequest,
  OAuthTwoFactorSetupResponse,
  OAuthTwoFactorVerifyRequest,
  OAuthTwoFactorVerifyResponse,
} from '../types';
import { HttpClient } from '../client/HttpClient';

const validateAccountId = (accountId: string | null | undefined, context: string): void => {
  if (!accountId || typeof accountId !== 'string' || accountId.trim() === '') {
    throw new Error(`Valid accountId is required for ${context}`);
  }

  // Check if it's a valid MongoDB ObjectId format (24 hex characters)
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  if (!objectIdRegex.test(accountId.trim())) {
    throw new Error(`Invalid accountId format for ${context}. Must be a valid ObjectId.`);
  }
};

const validateToken = (token: string | null | undefined, tokenType: string, context: string): void => {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw new Error(`Valid ${tokenType} is required for ${context}`);
  }

  // Basic token format validation - should be at least 10 characters
  if (token.trim().length < 10) {
    throw new Error(`${tokenType} too short for ${context}. Minimum 10 characters required.`);
  }

  // Check for suspicious characters (tokens should be alphanumeric + common symbols)
  const tokenRegex = /^[a-zA-Z0-9._-]+$/;
  if (!tokenRegex.test(token.trim())) {
    throw new Error(`${tokenType} contains invalid characters for ${context}`);
  }
};

const validateEmail = (email: string | null | undefined, context: string): void => {
  if (!email || typeof email !== 'string' || email.trim() === '') {
    throw new Error(`Valid email is required for ${context}`);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const trimmedEmail = email.trim();

  if (!emailRegex.test(trimmedEmail)) {
    throw new Error(`Invalid email format for ${context}`);
  }

  // Additional email validation
  if (trimmedEmail.length > 320) {
    // RFC 5321 limit
    throw new Error(`Email too long for ${context}. Maximum 320 characters allowed.`);
  }

  if (trimmedEmail.length < 3) {
    // Minimum reasonable email length
    throw new Error(`Email too short for ${context}. Minimum 3 characters required.`);
  }
};

const validateRequired = (value: any, fieldName: string, context: string): void => {
  if (value === null || value === undefined) {
    throw new Error(`${fieldName} is required for ${context}`);
  }

  if (typeof value === 'string' && value.trim() === '') {
    throw new Error(`${fieldName} cannot be empty for ${context}`);
  }

  if (Array.isArray(value) && value.length === 0) {
    throw new Error(`${fieldName} cannot be an empty array for ${context}`);
  }

  if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
    throw new Error(`${fieldName} cannot be an empty object for ${context}`);
  }
};

const validateProvider = (provider: OAuthProviders | string, context: string): void => {
  if (!provider || typeof provider !== 'string') {
    throw new Error(`Valid OAuth provider is required for ${context}`);
  }

  const validProviders = Object.values(OAuthProviders);
  if (!validProviders.includes(provider as OAuthProviders)) {
    throw new Error(
      `Invalid OAuth provider '${provider}' for ${context}. Valid providers: ${validProviders.join(', ')}`,
    );
  }
};

const validateArray = (array: any[], fieldName: string, context: string, minLength: number = 1): void => {
  if (!Array.isArray(array)) {
    throw new Error(`${fieldName} must be an array for ${context}`);
  }

  if (array.length < minLength) {
    throw new Error(`${fieldName} must contain at least ${minLength} item(s) for ${context}`);
  }

  // Check for null/undefined items
  if (array.some((item) => item === null || item === undefined)) {
    throw new Error(`${fieldName} cannot contain null or undefined items for ${context}`);
  }

  // For string arrays, check for empty strings
  if (array.every((item) => typeof item === 'string')) {
    if (array.some((item) => item.trim() === '')) {
      throw new Error(`${fieldName} cannot contain empty strings for ${context}`);
    }
  }
};

const validatePassword = (password: string | null | undefined, context: string): void => {
  if (!password || typeof password !== 'string') {
    throw new Error(`Valid password is required for ${context}`);
  }

  if (password.length < 8) {
    throw new Error(`Password too short for ${context}. Minimum 8 characters required.`);
  }

  if (password.length > 128) {
    throw new Error(`Password too long for ${context}. Maximum 128 characters allowed.`);
  }
};

export class AuthService {
  constructor(private httpClient: HttpClient) {}

  // ============================================================================
  // Session Management (with validation)
  // ============================================================================

  async getAccountSession(): Promise<GetAccountSessionResponse> {
    return this.httpClient.get('/session');
  }

  async getSessionAccountsData(accountIds?: string[]): Promise<GetAccountSessionDataResponse> {
    // Validate accountIds if provided
    if (accountIds && accountIds.length > 0) {
      validateArray(accountIds, 'account IDs', 'session accounts data', 1);
      accountIds.forEach((id, index) => {
        validateAccountId(id, `session accounts data (account ${index + 1})`);
      });
    }

    const params = new URLSearchParams();
    if (accountIds && accountIds.length > 0) {
      accountIds.forEach((id) => params.append('accountIds', id));
    }
    const queryString = params.toString();
    return this.httpClient.get(`/session/accounts${queryString ? `?${queryString}` : ''}`);
  }

  async setCurrentAccountInSession(accountId: string | null): Promise<SessionUpdateResponse> {
    // Allow null for clearing current account, but validate if provided
    if (accountId !== null) {
      validateAccountId(accountId, 'set current account in session');
    }

    return this.httpClient.post('/session/current', { accountId });
  }

  async addAccountToSession(accountId: string, setAsCurrent: boolean = true): Promise<SessionUpdateResponse> {
    validateAccountId(accountId, 'add account to session');

    if (typeof setAsCurrent !== 'boolean') {
      throw new Error('setAsCurrent must be a boolean for add account to session');
    }

    return this.httpClient.post('/session/add', { accountId, setAsCurrent });
  }

  async removeAccountFromSession(accountId: string): Promise<SessionUpdateResponse> {
    validateAccountId(accountId, 'remove account from session');

    return this.httpClient.post('/session/remove', { accountId });
  }

  // ============================================================================
  // Two-Step Signup Flow (with validation)
  // ============================================================================

  /**
   * Step 1: Request email verification for signup
   */
  async requestEmailVerification(data: RequestEmailVerificationRequest): Promise<RequestEmailVerificationResponse> {
    validateRequired(data, 'signup data', 'email verification request');
    validateEmail(data.email, 'email verification request');

    return this.httpClient.post('/auth/signup/request-email', data);
  }

  /**
   * Step 2: Verify email and get profile completion token
   */
  async verifyEmailForSignup(token: string): Promise<VerifyEmailSignupResponse> {
    validateToken(token, 'verification token', 'email verification');

    return this.httpClient.get(`/auth/signup/verify-email?token=${encodeURIComponent(token)}`);
  }

  /**
   * Step 3: Complete profile and create account
   */
  async completeProfile(token: string, data: CompleteProfileRequest): Promise<CompleteProfileResponse> {
    validateToken(token, 'profile completion token', 'profile completion');
    validateRequired(data, 'profile data', 'profile completion');
    validateRequired(data.firstName, 'firstName', 'profile completion');
    validateRequired(data.lastName, 'lastName', 'profile completion');
    validateRequired(data.password, 'password', 'profile completion');
    validateRequired(data.confirmPassword, 'confirmPassword', 'profile completion');

    return this.httpClient.post(`/auth/signup/complete-profile?token=${encodeURIComponent(token)}`, data);
  }

  /**
   * Get current signup step status
   */
  async getSignupStatus(email?: string, token?: string): Promise<SignupStatusResponse> {
    const params = new URLSearchParams();
    if (email) {
      validateEmail(email, 'signup status check');
      params.append('email', email);
    }
    if (token) {
      validateToken(token, 'status token', 'signup status check');
      params.append('token', token);
    }

    const queryString = params.toString();
    return this.httpClient.get(`/auth/signup/status${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Cancel signup process
   */
  async cancelSignup(data: CancelSignupRequest): Promise<CancelSignupResponse> {
    validateRequired(data, 'cancel data', 'signup cancellation');
    validateEmail(data.email, 'signup cancellation');

    return this.httpClient.delete('/auth/signup/cancel', data);
  }

  // ============================================================================
  // Local Authentication (with validation)
  // ============================================================================

  async localLogin(data: LocalLoginRequest): Promise<LocalLoginResponse> {
    validateRequired(data, 'login data', 'local login');
    validateEmail(data.email, 'local login');
    validateRequired(data.password, 'password', 'local login');

    return this.httpClient.post('/auth/login', data);
  }

  async verifyTwoFactor(data: TwoFactorVerifyRequest): Promise<LocalLoginResponse> {
    validateRequired(data, '2FA verification data', '2FA verification');
    validateRequired(data.token, '2FA token', '2FA verification');
    validateRequired(data.tempToken, 'temporary token', '2FA verification');

    return this.httpClient.post('/auth/verify-two-factor', data);
  }

  async requestPasswordReset(data: PasswordResetRequest): Promise<PasswordResetRequestResponse> {
    validateRequired(data, 'password reset request data', 'password reset request');
    validateEmail(data.email, 'password reset request');

    return this.httpClient.post('/auth/reset-password-request', data);
  }

  async resetPassword(token: string, data: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    validateToken(token, 'reset token', 'password reset');
    validateRequired(data, 'password reset data', 'password reset');
    validatePassword(data.password, 'password reset');
    validateRequired(data.confirmPassword, 'confirmPassword', 'password reset');

    return this.httpClient.post(`/auth/reset-password?token=${encodeURIComponent(token)}`, data);
  }

  async changePassword(accountId: string, data: PasswordChangeRequest): Promise<PasswordChangeResponse> {
    validateAccountId(accountId, 'password change');
    validateRequired(data, 'password change data', 'password change');
    validatePassword(data.oldPassword, 'password change');
    validatePassword(data.newPassword, 'password change');
    validateRequired(data.confirmPassword, 'confirmPassword', 'password change');

    return this.httpClient.post(`/${accountId}/auth/change-password`, data);
  }

  // ============================================================================
  // Two-Factor Authentication (Local Auth) - with validation
  // ============================================================================

  async setupTwoFactor(accountId: string, data: TwoFactorSetupRequest): Promise<TwoFactorSetupResponse> {
    validateAccountId(accountId, '2FA setup');
    validateRequired(data, '2FA setup data', '2FA setup');
    validateRequired(data.password, 'password', '2FA setup');

    if (typeof data.enableTwoFactor !== 'boolean') {
      throw new Error('enableTwoFactor must be a boolean for 2FA setup');
    }

    return this.httpClient.post(`/${accountId}/auth/setup-two-factor`, data);
  }

  async verifyTwoFactorSetup(accountId: string, token: string): Promise<TwoFactorSetupVerificationResponse> {
    validateAccountId(accountId, '2FA setup verification');
    validateToken(token, '2FA verification token', '2FA setup verification');

    return this.httpClient.post(`/${accountId}/auth/verify-two-factor-setup`, { token });
  }

  async generateBackupCodes(accountId: string, password: string): Promise<BackupCodesResponse> {
    validateAccountId(accountId, 'backup code generation');
    validateRequired(password, 'password', 'backup code generation');

    return this.httpClient.post(`/${accountId}/auth/generate-backup-codes`, { password });
  }

  // ============================================================================
  // Token Information (Local Auth) - with validation
  // ============================================================================

  async getLocalTokenInfo(accountId: string): Promise<LocalTokenInfoResponse> {
    validateAccountId(accountId, 'local token info');

    return this.httpClient.get(`/${accountId}/auth/token`);
  }

  async getLocalRefreshTokenInfo(accountId: string): Promise<LocalTokenInfoResponse> {
    validateAccountId(accountId, 'local refresh token info');

    return this.httpClient.get(`/${accountId}/auth/refresh/token`);
  }

  // ============================================================================
  // OAuth Authentication (with validation)
  // ============================================================================

  async generateOAuthSignupUrl(provider: OAuthProviders): Promise<OAuthUrlResponse> {
    validateProvider(provider, 'OAuth provider invalid to generate signup URL');

    return this.httpClient.get(`/oauth/signup/${provider}`);
  }

  async generateOAuthSigninUrl(provider: OAuthProviders): Promise<OAuthUrlResponse> {
    validateProvider(provider, 'OAuth provider invalid to generate signin URL');

    return this.httpClient.get(`/oauth/signin/${provider}`);
  }

  async generatePermissionUrl(
    provider: OAuthProviders,
    accountId: string,
    scopeNames: string[],
  ): Promise<PermissionUrlResponse> {
    validateProvider(provider, 'OAuth provider invalid to generate permission URL');
    validateAccountId(accountId, 'permission URL generation');
    validateArray(scopeNames, 'scope names', 'permission URL generation');

    const params = new URLSearchParams();
    params.append('accountId', accountId);
    params.append('scopeNames', JSON.stringify(scopeNames));

    return this.httpClient.get(`/oauth/permission/${provider}?${params.toString()}`);
  }

  async generateReauthorizeUrl(provider: OAuthProviders, accountId: string): Promise<ReauthorizeUrlResponse> {
    validateProvider(provider, 'OAuth provider invalid to generate reauthorization URL');
    validateAccountId(accountId, 'reauthorization URL generation');

    const params = new URLSearchParams();
    params.append('accountId', accountId);

    return this.httpClient.get(`/oauth/reauthorize/${provider}?${params.toString()}`);
  }

  // ============================================================================
  // OAuth Two-Factor Authentication (with validation)
  // ============================================================================

  /**
   * Set up two-factor authentication for OAuth account (no password required)
   */
  async setupOAuthTwoFactor(accountId: string, data: OAuthTwoFactorSetupRequest): Promise<OAuthTwoFactorSetupResponse> {
    validateAccountId(accountId, 'OAuth 2FA setup');
    validateRequired(data, 'OAuth 2FA setup data', 'OAuth 2FA setup');

    if (typeof data.enableTwoFactor !== 'boolean') {
      throw new Error('enableTwoFactor must be a boolean for OAuth 2FA setup');
    }

    return this.httpClient.post(`/${accountId}/oauth/setup-two-factor`, data);
  }

  /**
   * Verify and enable 2FA for OAuth account
   */
  async verifyOAuthTwoFactorSetup(accountId: string, token: string): Promise<TwoFactorSetupVerificationResponse> {
    validateAccountId(accountId, 'OAuth 2FA setup verification');
    validateToken(token, '2FA verification token', 'OAuth 2FA setup verification');

    return this.httpClient.post(`/${accountId}/oauth/verify-two-factor-setup`, { token });
  }

  /**
   * Generate new backup codes for OAuth account (no password required)
   */
  async generateOAuthBackupCodes(accountId: string): Promise<BackupCodesResponse> {
    validateAccountId(accountId, 'OAuth backup code generation');

    return this.httpClient.post(`/${accountId}/oauth/generate-backup-codes`);
  }

  /**
   * Verify OAuth two-factor authentication during signin
   */
  async verifyOAuthTwoFactor(data: OAuthTwoFactorVerifyRequest): Promise<OAuthTwoFactorVerifyResponse> {
    validateRequired(data, 'OAuth 2FA verification data', 'OAuth 2FA verification');
    validateRequired(data.token, '2FA token', 'OAuth 2FA verification');
    validateRequired(data.tempToken, 'temporary token', 'OAuth 2FA verification');

    return this.httpClient.post('/oauth/verify-two-factor', data);
  }

  // ============================================================================
  // OAuth Token Management (with validation)
  // ============================================================================

  async getOAuthTokenInfo(accountId: string): Promise<OAuthTokenInfoResponse> {
    validateAccountId(accountId, 'OAuth token info');

    return this.httpClient.get(`/${accountId}/oauth/token`);
  }

  async getOAuthRefreshTokenInfo(accountId: string): Promise<OAuthRefreshTokenInfoResponse> {
    validateAccountId(accountId, 'OAuth refresh token info');

    return this.httpClient.get(`/${accountId}/oauth/refresh/token`);
  }

  async revokeOAuthTokens(accountId: string): Promise<TokenRevocationResponse> {
    validateAccountId(accountId, 'OAuth token revocation');

    return this.httpClient.post(`/${accountId}/oauth/revoke`);
  }

  // ============================================================================
  // Browser Navigation Methods (with validation)
  // ============================================================================

  redirectToOAuthSignup(provider: OAuthProviders): void {
    validateProvider(provider, 'OAuth signup redirect');

    this.generateOAuthSignupUrl(provider)
      .then((response) => {
        window.location.href = response.authorizationUrl;
      })
      .catch((error) => {
        console.error('Failed to generate OAuth signup URL:', error);
      });
  }

  redirectToOAuthSignin(provider: OAuthProviders): void {
    validateProvider(provider, 'OAuth signin redirect');

    this.generateOAuthSigninUrl(provider)
      .then((response) => {
        window.location.href = response.authorizationUrl;
      })
      .catch((error) => {
        console.error('Failed to generate OAuth signin URL:', error);
      });
  }

  requestGooglePermission(accountId: string, scopeNames: string[]): void {
    validateAccountId(accountId, 'Google permission request');
    validateArray(scopeNames, 'scope names', 'Google permission request');

    this.generatePermissionUrl(OAuthProviders.Google, accountId, scopeNames)
      .then((response) => {
        window.location.href = response.authorizationUrl;
      })
      .catch((error) => {
        console.error('Failed to generate permission URL:', error);
      });
  }

  reauthorizePermissions(accountId: string): void {
    validateAccountId(accountId, 'permission reauthorization');

    this.generateReauthorizeUrl(OAuthProviders.Google, accountId)
      .then((response) => {
        if (response.authorizationUrl) {
          window.location.href = response.authorizationUrl;
        } else {
          console.log('No reauthorization needed:', response.message);
        }
      })
      .catch((error) => {
        console.error('Failed to generate reauthorization URL:', error);
      });
  }

  // ============================================================================
  // Logout Methods (with validation)
  // ============================================================================

  async logout(accountId: string, clearClientAccountState: boolean = true): Promise<LogoutResponse> {
    validateAccountId(accountId, 'logout');

    if (typeof clearClientAccountState !== 'boolean') {
      throw new Error('clearClientAccountState must be a boolean for logout');
    }

    const params = new URLSearchParams();
    params.append('accountId', accountId);
    params.append('clearClientAccountState', clearClientAccountState.toString());

    return this.httpClient.get(`/account/logout?${params.toString()}`);
  }

  async logoutAll(accountIds: string[]): Promise<LogoutAllResponse> {
    validateArray(accountIds, 'account IDs', 'logout all');

    // Validate each account ID
    accountIds.forEach((id, index) => {
      validateAccountId(id, `logout all (account ${index + 1})`);
    });

    const params = new URLSearchParams();
    accountIds.forEach((id) => params.append('accountIds', id));

    return this.httpClient.get(`/account/logout/all?${params.toString()}`);
  }
}
