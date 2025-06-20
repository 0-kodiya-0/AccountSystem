import {
  GetAccountSessionResponse,
  GetAccountSessionDataResponse,
  LocalLoginRequest,
  LocalLoginResponse,
  PasswordResetRequest,
  ResetPasswordRequest,
  PasswordChangeRequest,
  SessionUpdateResponse,
  PasswordChangeResponse,
  PasswordResetRequestResponse,
  ResetPasswordResponse,
  BackupCodesResponse,
  OAuthProviders,
  OAuthUrlResponse,
  OAuthUrlRequest,
  PermissionUrlResponse,
  PermissionUrlRequest,
  ReauthorizeUrlResponse,
  ReauthorizeUrlRequest,
  TokenRevocationResponse,
  LogoutResponse,
  LogoutAllResponse,
  RequestEmailVerificationRequest,
  RequestEmailVerificationResponse,
  VerifyEmailSignupResponse,
  CompleteProfileRequest,
  CompleteProfileResponse,
  SignupStatusResponse,
  CancelSignupRequest,
  CancelSignupResponse,
  UnifiedTwoFactorVerifyResponse,
  UnifiedTwoFactorVerifyRequest,
  BackupCodesRequest,
  UnifiedTwoFactorSetupResponse,
  TwoFactorStatusResponse,
  UnifiedTwoFactorSetupRequest,
  TokenInfoResponse,
  TokenValidationRequest,
  TokenValidationResponse,
  PasswordResetVerificationRequest,
  PasswordResetVerificationResponse,
  AccountType,
  UnifiedTwoFactorVerifySetupResponse,
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

const validateUrl = (url: string | null | undefined, context: string): void => {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    throw new Error(`Valid URL is required for ${context}`);
  }

  try {
    new URL(url.trim());
  } catch {
    throw new Error(`Invalid URL format for ${context}`);
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

  async getAccountSession(): Promise<GetAccountSessionResponse> {
    return this.httpClient.get('/session');
  }

  async getSessionAccountsData(accountIds?: string[]): Promise<GetAccountSessionDataResponse> {
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

  async requestEmailVerification(data: RequestEmailVerificationRequest): Promise<RequestEmailVerificationResponse> {
    validateRequired(data, 'signup data', 'email verification request');
    validateEmail(data.email, 'email verification request');
    validateUrl(data.callbackUrl, 'email verification request');

    return this.httpClient.post('/auth/signup/request-email', data);
  }

  async verifyEmailForSignup(token: string): Promise<VerifyEmailSignupResponse> {
    validateToken(token, 'verification token', 'email verification');

    return this.httpClient.get(`/auth/signup/verify-email?token=${encodeURIComponent(token)}`);
  }

  async redirectToEmailVerify(token: string, redirectUrl: string): Promise<void> {
    validateToken(token, 'verification token', 'email verification');

    const result = await this.httpClient.get<VerifyEmailSignupResponse>(
      `/auth/signup/verify-email?token=${encodeURIComponent(token)}`,
    );

    // Email verified successfully - redirect to profile completion
    const redirectTo = new URL(redirectUrl, window.location.origin);
    redirectTo.searchParams.set('profileToken', result.profileToken);
    redirectTo.searchParams.set('email', result.email);
    window.location.href = redirectTo.toString();
  }

  async completeProfile(token: string, data: CompleteProfileRequest): Promise<CompleteProfileResponse> {
    validateToken(token, 'profile completion token', 'profile completion');
    validateRequired(data, 'profile data', 'profile completion');
    validateRequired(data.firstName, 'firstName', 'profile completion');
    validateRequired(data.lastName, 'lastName', 'profile completion');
    validateRequired(data.password, 'password', 'profile completion');
    validateRequired(data.confirmPassword, 'confirmPassword', 'profile completion');

    return this.httpClient.post(`/auth/signup/complete-profile?token=${encodeURIComponent(token)}`, data);
  }

  async redirectToCompleteProfile(token: string, data: CompleteProfileRequest, redirectUrl: string): Promise<void> {
    validateToken(token, 'profile completion token', 'profile completion');
    validateRequired(data, 'profile data', 'profile completion');
    validateRequired(data.firstName, 'firstName', 'profile completion');
    validateRequired(data.lastName, 'lastName', 'profile completion');
    validateRequired(data.password, 'password', 'profile completion');
    validateRequired(data.confirmPassword, 'confirmPassword', 'profile completion');

    const result = await this.httpClient.post<CompleteProfileResponse>(
      `/auth/signup/complete-profile?token=${encodeURIComponent(token)}`,
      data,
    );

    // Profile completed successfully - redirect to login or dashboard
    const redirectTo = new URL(redirectUrl, window.location.origin);
    redirectTo.searchParams.set('accountCreated', 'true');
    redirectTo.searchParams.set('accountId', result.accountId);
    redirectTo.searchParams.set('message', encodeURIComponent('Account created successfully! Please log in.'));
    window.location.href = redirectTo.toString();
  }

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

  async cancelSignup(data: CancelSignupRequest): Promise<CancelSignupResponse> {
    validateRequired(data, 'cancel data', 'signup cancellation');
    validateEmail(data.email, 'signup cancellation');

    return this.httpClient.delete('/auth/signup/cancel', data);
  }

  async localLogin(data: LocalLoginRequest): Promise<LocalLoginResponse> {
    validateRequired(data, 'login data', 'local login');

    // Validate email OR username (at least one required)
    if (!data.email && !data.username) {
      throw new Error('Either email or username is required for local login');
    }

    if (data.email) {
      validateEmail(data.email, 'local login');
    }

    validateRequired(data.password, 'password', 'local login');

    return this.httpClient.post('/auth/login', data);
  }

  async redirectToLocalSignin(data: LocalLoginRequest, redirectUrl: string): Promise<void> {
    validateRequired(data, 'login data', 'local login');

    // Validate email OR username (at least one required)
    if (!data.email && !data.username) {
      throw new Error('Either email or username is required for local login');
    }

    if (data.email) {
      validateEmail(data.email, 'local login');
    }

    validateRequired(data.password, 'password', 'local login');

    const result = await this.httpClient.post<LocalLoginResponse>('/auth/login', data);

    if (result.requiresTwoFactor && result.tempToken) {
      // 2FA required - redirect to 2FA page with temp token
      const redirectTo = new URL(redirectUrl, window.location.origin);
      redirectTo.searchParams.set('tempToken', result.tempToken);
      redirectTo.searchParams.set('accountId', result.accountId || '');
      if (redirectUrl) {
        redirectTo.searchParams.set('redirectUrl', redirectUrl);
      }
      window.location.href = redirectTo.toString();
    } else {
      // Login successful - redirect to specified URL or default
      window.location.href = redirectUrl || '/';
    }
  }

  async requestPasswordReset(data: PasswordResetRequest): Promise<PasswordResetRequestResponse> {
    validateRequired(data, 'password reset request data', 'password reset request');
    validateEmail(data.email, 'password reset request');
    validateUrl(data.callbackUrl, 'password reset request');

    return this.httpClient.post('/auth/reset-password-request', data);
  }

  async verifyPasswordReset(data: PasswordResetVerificationRequest): Promise<PasswordResetVerificationResponse> {
    validateRequired(data.token, 'password token verify request data', 'password token verify request');

    return this.httpClient.post('/auth/verify-password-request', data);
  }

  async resetPassword(token: string, data: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    validateToken(token, 'reset token', 'password reset');
    validateRequired(data, 'password reset data', 'password reset');
    validatePassword(data.password, 'password reset');
    validateRequired(data.confirmPassword, 'confirmPassword', 'password reset');

    return this.httpClient.post(`/auth/reset-password?token=${encodeURIComponent(token)}`, data);
  }

  async redirectToResetPassword(token: string, data: ResetPasswordRequest, redirectUrl: string): Promise<void> {
    validateToken(token, 'reset token', 'password reset');
    validateRequired(data, 'password reset data', 'password reset');
    validatePassword(data.password, 'password reset');
    validateRequired(data.confirmPassword, 'confirmPassword', 'password reset');

    await this.httpClient.post<ResetPasswordResponse>(`/auth/reset-password?token=${encodeURIComponent(token)}`, data);

    // Password reset successful - redirect to login
    const redirectTo = new URL(redirectUrl, window.location.origin);
    redirectTo.searchParams.set('passwordReset', 'true');
    redirectTo.searchParams.set(
      'message',
      encodeURIComponent('Password reset successfully! Please log in with your new password.'),
    );
    window.location.href = redirectTo.toString();
  }

  async changePassword(accountId: string, data: PasswordChangeRequest): Promise<PasswordChangeResponse> {
    validateAccountId(accountId, 'password change');
    validateRequired(data, 'password change data', 'password change');
    validatePassword(data.oldPassword, 'password change');
    validatePassword(data.newPassword, 'password change');
    validateRequired(data.confirmPassword, 'confirmPassword', 'password change');

    return this.httpClient.post(`/${accountId}/auth/change-password`, data);
  }

  async getTwoFactorStatus(accountId: string): Promise<TwoFactorStatusResponse> {
    validateAccountId(accountId, '2FA status check');

    return this.httpClient.get(`/${accountId}/twofa/status`);
  }

  async setupTwoFactor(
    accountId: string,
    accountType: AccountType,
    data: UnifiedTwoFactorSetupRequest,
  ): Promise<UnifiedTwoFactorSetupResponse> {
    validateAccountId(accountId, '2FA setup');
    validateRequired(data, '2FA setup data', '2FA setup');

    if (typeof data.enableTwoFactor !== 'boolean') {
      throw new Error('enableTwoFactor must be a boolean for 2FA setup');
    }

    // For local accounts, password is required
    if (accountType === AccountType.Local && data.password !== undefined) {
      validateRequired(data.password, 'password', '2FA setup');
    }

    return this.httpClient.post(`/${accountId}/twofa/setup`, data);
  }

  /**
   * Verify 2FA setup using setup token from the setup step
   * UPDATED: Now requires setupToken parameter
   */
  async verifyTwoFactorSetup(
    accountId: string,
    token: string,
    setupToken: string,
  ): Promise<UnifiedTwoFactorVerifySetupResponse> {
    validateAccountId(accountId, '2FA setup verification');
    validateRequired(token, '2FA verification token', '2FA setup verification');
    validateRequired(setupToken, 'setup token', '2FA setup verification');

    return this.httpClient.post(`/${accountId}/twofa/verify-setup`, {
      token,
      setupToken,
    });
  }

  async generateBackupCodes(accountId: string, data: BackupCodesRequest): Promise<BackupCodesResponse> {
    validateAccountId(accountId, 'backup code generation');
    validateRequired(data, 'backup codes data', 'backup code generation');

    // For local accounts, password is required
    if (data.password !== undefined) {
      validateRequired(data.password, 'password', 'backup code generation');
    }

    return this.httpClient.post(`/${accountId}/twofa/backup-codes`, data);
  }

  async verifyTwoFactorLogin(data: UnifiedTwoFactorVerifyRequest): Promise<UnifiedTwoFactorVerifyResponse> {
    validateRequired(data, '2FA verification data', '2FA verification');
    validateRequired(data.token, '2FA token', '2FA verification');
    validateRequired(data.tempToken, 'temporary token', '2FA verification');

    return this.httpClient.post('/twofa/verify-login', data);
  }

  async redirectToTwoFactorVerify(data: UnifiedTwoFactorVerifyRequest, redirectUrl?: string): Promise<void> {
    validateRequired(data, '2FA verification data', '2FA verification');
    validateRequired(data.token, '2FA token', '2FA verification');
    validateRequired(data.tempToken, 'temporary token', '2FA verification');

    const result = await this.httpClient.post<UnifiedTwoFactorVerifyResponse>('/twofa/verify-login', data);

    if (result.needsAdditionalScopes && result.missingScopes && result.missingScopes.length > 0) {
      // OAuth account needs additional scopes - could redirect to permission request
      // For now, just redirect to the specified URL with a query parameter
      const redirectTo = new URL(redirectUrl || '/', window.location.origin);
      redirectTo.searchParams.set('needsScopes', 'true');
      redirectTo.searchParams.set('accountId', result.accountId);
      redirectTo.searchParams.set('missingScopes', result.missingScopes.join(','));
      window.location.href = redirectTo.toString();
    } else {
      // 2FA successful - redirect to specified URL or default
      window.location.href = redirectUrl || '/';
    }
  }

  async getAccessTokenInfo(accountId: string): Promise<TokenInfoResponse> {
    validateAccountId(accountId, 'access token info');

    return this.httpClient.get(`/${accountId}/tokens/access/info`);
  }

  async getRefreshTokenInfo(accountId: string): Promise<TokenInfoResponse> {
    validateAccountId(accountId, 'refresh token info');

    return this.httpClient.get(`/${accountId}/tokens/refresh/info`);
  }

  async revokeTokens(accountId: string): Promise<TokenRevocationResponse> {
    validateAccountId(accountId, 'token revocation');

    return this.httpClient.post(`/${accountId}/tokens/revoke`);
  }

  async validateToken(accountId: string, data: TokenValidationRequest): Promise<TokenValidationResponse> {
    validateAccountId(accountId, 'token validation');
    validateRequired(data, 'token validation data', 'token validation');
    validateRequired(data.token, 'token', 'token validation');

    if (data.tokenType && !['access', 'refresh'].includes(data.tokenType)) {
      throw new Error('tokenType must be either "access" or "refresh" for token validation');
    }

    return this.httpClient.post(`/${accountId}/tokens/validate`, data);
  }

  async generateOAuthSignupUrl(provider: OAuthProviders, data: OAuthUrlRequest): Promise<OAuthUrlResponse> {
    validateProvider(provider, 'OAuth provider invalid to generate signup URL');
    validateRequired(data, 'OAuth request data', 'OAuth signup URL generation');
    validateUrl(data.callbackUrl, 'OAuth signup URL generation');

    const params = new URLSearchParams();
    params.append('callbackUrl', data.callbackUrl);

    return this.httpClient.get(`/oauth/signup/${provider}?${params.toString()}`);
  }

  async generateOAuthSigninUrl(provider: OAuthProviders, data: OAuthUrlRequest): Promise<OAuthUrlResponse> {
    validateProvider(provider, 'OAuth provider invalid to generate signin URL');
    validateRequired(data, 'OAuth request data', 'OAuth signin URL generation');
    validateUrl(data.callbackUrl, 'OAuth signin URL generation');

    const params = new URLSearchParams();
    params.append('callbackUrl', data.callbackUrl);

    return this.httpClient.get(`/oauth/signin/${provider}?${params.toString()}`);
  }

  async generatePermissionUrl(provider: OAuthProviders, data: PermissionUrlRequest): Promise<PermissionUrlResponse> {
    validateProvider(provider, 'OAuth provider invalid to generate permission URL');
    validateRequired(data, 'permission request data', 'permission URL generation');
    validateAccountId(data.accountId, 'permission URL generation');
    validateArray(data.scopeNames, 'scope names', 'permission URL generation');
    validateUrl(data.callbackUrl, 'permission URL generation');

    const params = new URLSearchParams();
    params.append('accountId', data.accountId);
    params.append('scopeNames', JSON.stringify(data.scopeNames));
    params.append('callbackUrl', data.callbackUrl);

    return this.httpClient.get(`/oauth/permission/${provider}?${params.toString()}`);
  }

  async generateReauthorizeUrl(provider: OAuthProviders, data: ReauthorizeUrlRequest): Promise<ReauthorizeUrlResponse> {
    validateProvider(provider, 'OAuth provider invalid to generate reauthorization URL');
    validateRequired(data, 'reauthorization request data', 'reauthorization URL generation');
    validateAccountId(data.accountId, 'reauthorization URL generation');
    validateUrl(data.callbackUrl, 'reauthorization URL generation');

    const params = new URLSearchParams();
    params.append('accountId', data.accountId);
    params.append('callbackUrl', data.callbackUrl);

    return this.httpClient.get(`/oauth/reauthorize/${provider}?${params.toString()}`);
  }

  redirectToOAuthSignup(provider: OAuthProviders, callbackUrl: string): void {
    validateProvider(provider, 'OAuth signup redirect');
    validateUrl(callbackUrl, 'OAuth signup redirect');

    this.generateOAuthSignupUrl(provider, { callbackUrl })
      .then((response) => {
        window.location.href = response.authorizationUrl;
      })
      .catch((error) => {
        console.error('Failed to generate OAuth signup URL:', error);
        throw error;
      });
  }

  redirectToOAuthSignin(provider: OAuthProviders, callbackUrl: string): void {
    validateProvider(provider, 'OAuth signin redirect');
    validateUrl(callbackUrl, 'OAuth signin redirect');

    this.generateOAuthSigninUrl(provider, { callbackUrl })
      .then((response) => {
        window.location.href = response.authorizationUrl;
      })
      .catch((error) => {
        console.error('Failed to generate OAuth signin URL:', error);
        throw error;
      });
  }

  requestPermission(provider: OAuthProviders, accountId: string, scopeNames: string[], callbackUrl: string): void {
    validateAccountId(accountId, 'permission request');
    validateArray(scopeNames, 'scope names', 'permission request');
    validateUrl(callbackUrl, 'permission request');

    this.generatePermissionUrl(provider, { accountId, scopeNames, callbackUrl })
      .then((response) => {
        window.location.href = response.authorizationUrl;
      })
      .catch((error) => {
        console.error('Failed to generate permission URL:', error);
        throw error;
      });
  }

  reauthorizePermissions(provider: OAuthProviders, accountId: string, callbackUrl: string): void {
    validateAccountId(accountId, 'permission reauthorization');
    validateUrl(callbackUrl, 'permission reauthorization');

    this.generateReauthorizeUrl(provider, { accountId, callbackUrl })
      .then((response) => {
        if (response.authorizationUrl) {
          window.location.href = response.authorizationUrl;
        } else {
          console.log('No reauthorization needed:', response.message);
        }
      })
      .catch((error) => {
        console.error('Failed to generate reauthorization URL:', error);
        throw error;
      });
  }

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

    accountIds.forEach((id, index) => {
      validateAccountId(id, `logout all (account ${index + 1})`);
    });

    const params = new URLSearchParams();
    accountIds.forEach((id) => params.append('accountIds', id));

    return this.httpClient.get(`/account/logout/all?${params.toString()}`);
  }
}
