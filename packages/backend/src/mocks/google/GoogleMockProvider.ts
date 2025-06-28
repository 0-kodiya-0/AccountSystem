import crypto from 'crypto';
import { MockOAuthAccount, OAuthMockConfig } from '../../config/mock.config';
import { OAuthProviders } from '../../feature/account/Account.types';
import { MockTokenResponse, MockUserInfoResponse } from '../oauth/OAuthMockService';
import { logger } from '../../utils/logger';

export interface GoogleTokenInfo {
  issued_to: string;
  audience: string;
  user_id: string;
  scope: string;
  expires_in: number;
  email: string;
  verified_email: boolean;
  access_type: string;
}

export interface GoogleUserInfo extends MockUserInfoResponse {
  locale?: string;
  hd?: string; // hosted domain for G Suite accounts
}

export class GoogleMockProvider {
  private config: OAuthMockConfig;

  constructor(config: OAuthMockConfig) {
    this.config = config;
  }

  // ============================================================================
  // Google-Specific Token Operations
  // ============================================================================

  /**
   * Generate Google-specific ID Token (JWT)
   */
  generateGoogleIdToken(account: MockOAuthAccount): string {
    if (account.provider !== OAuthProviders.Google) {
      throw new Error('Account is not a Google account');
    }

    const header = btoa(
      JSON.stringify({
        alg: 'RS256',
        typ: 'JWT',
        kid: 'mock_google_key_id',
      }),
    );

    const now = Math.floor(Date.now() / 1000);
    const payload = btoa(
      JSON.stringify({
        iss: 'https://accounts.google.com',
        sub: account.id,
        aud: process.env.GOOGLE_CLIENT_ID,
        azp: process.env.GOOGLE_CLIENT_ID,
        email: account.email,
        email_verified: account.emailVerified,
        name: account.name,
        given_name: account.firstName,
        family_name: account.lastName,
        picture: account.imageUrl,
        locale: 'en',
        iat: now,
        exp: now + 3600,
        // Google-specific claims
        hd: account.email.includes('@') ? account.email.split('@')[1] : undefined,
      }),
    );

    const signature = crypto.createHash('sha256').update(`${header}.${payload}`).digest('base64url');

    return `${header}.${payload}.${signature}`;
  }

  /**
   * Get Google-specific token info
   */
  getGoogleTokenInfo(accessToken: string, accounts: MockOAuthAccount[]): GoogleTokenInfo | null {
    const account = accounts.find((acc) => acc.accessToken === accessToken && acc.provider === OAuthProviders.Google);

    if (!account) {
      return null;
    }

    return {
      issued_to: process.env.GOOGLE_CLIENT_ID || '',
      audience: process.env.GOOGLE_CLIENT_ID || '',
      user_id: account.id,
      scope:
        'openid email profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      expires_in: account.expiresIn,
      email: account.email,
      verified_email: account.emailVerified,
      access_type: 'offline',
    };
  }

  /**
   * Get Google-specific user info
   */
  getGoogleUserInfo(accessToken: string, accounts: MockOAuthAccount[]): GoogleUserInfo | null {
    const account = accounts.find((acc) => acc.accessToken === accessToken && acc.provider === OAuthProviders.Google);

    if (!account) {
      return null;
    }

    return {
      id: account.id,
      email: account.email,
      name: account.name,
      picture: account.imageUrl,
      given_name: account.firstName,
      family_name: account.lastName,
      email_verified: account.emailVerified,
      locale: 'en',
      hd: account.email.includes('@') ? account.email.split('@')[1] : undefined,
    };
  }

  /**
   * Exchange Google authorization code for tokens
   */
  exchangeGoogleAuthorizationCode(code: string, account: MockOAuthAccount): MockTokenResponse {
    if (account.provider !== OAuthProviders.Google) {
      throw new Error('Account is not a Google account');
    }

    return {
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expires_in: account.expiresIn,
      token_type: 'Bearer',
      scope: 'openid email profile',
      id_token: this.generateGoogleIdToken(account),
    };
  }

  /**
   * Refresh Google access token
   */
  refreshGoogleAccessToken(refreshToken: string, accounts: MockOAuthAccount[]): MockTokenResponse | null {
    const account = accounts.find((acc) => acc.refreshToken === refreshToken && acc.provider === OAuthProviders.Google);

    if (!account) {
      return null;
    }

    // Generate new access token with timestamp
    const newAccessToken = `${account.accessToken}_refreshed_${Date.now()}`;

    if (this.config.logRequests) {
      logger.info(`Google mock token refreshed for account: ${account.email}`);
    }

    return {
      access_token: newAccessToken,
      refresh_token: refreshToken, // Keep the same refresh token
      expires_in: account.expiresIn,
      token_type: 'Bearer',
      scope: 'openid email profile',
      // Note: ID token not typically included in refresh response
    };
  }

  /**
   * Revoke Google token
   */
  revokeGoogleToken(token: string, accounts: MockOAuthAccount[]): boolean {
    const account = accounts.find(
      (acc) => (acc.accessToken === token || acc.refreshToken === token) && acc.provider === OAuthProviders.Google,
    );

    if (!account) {
      return false;
    }

    if (this.config.logRequests) {
      logger.info(`Google mock token revoked for account: ${account.email}`, {
        tokenPrefix: token.substring(0, 10) + '...',
      });
    }

    return true;
  }

  // ============================================================================
  // Google-Specific Validation
  // ============================================================================

  /**
   * Validate Google client credentials
   */
  validateGoogleClientCredentials(clientId: string, clientSecret: string): boolean {
    return clientId === process.env.GOOGLE_CLIENT_ID && clientSecret === process.env.GOOGLE_CLIENT_SECRET;
  }

  /**
   * Validate Google authorization request
   */
  validateGoogleAuthorizationRequest(params: {
    client_id: string;
    response_type: string;
    scope: string;
    state: string;
    redirect_uri: string;
    access_type?: string;
    prompt?: string;
    login_hint?: string;
    include_granted_scopes?: string;
  }): { valid: boolean; error?: string } {
    const { client_id, response_type, scope, state, redirect_uri } = params;

    // Validate required parameters
    if (!client_id || !response_type || !scope || !state || !redirect_uri) {
      return { valid: false, error: 'Missing required parameters' };
    }

    // Validate client_id
    if (client_id !== process.env.GOOGLE_CLIENT_ID) {
      return { valid: false, error: 'Invalid client_id' };
    }

    // Validate response_type
    if (response_type !== 'code') {
      return { valid: false, error: 'Unsupported response_type' };
    }

    // Validate scope contains required scopes
    const requiredScopes = ['email', 'profile'];
    const providedScopes = scope.split(' ');
    const hasRequiredScopes = requiredScopes.every(
      (required) => providedScopes.includes(required) || providedScopes.some((provided) => provided.includes(required)),
    );

    if (!hasRequiredScopes) {
      return { valid: false, error: 'Missing required scopes' };
    }

    return { valid: true };
  }

  // ============================================================================
  // Google-Specific Endpoints
  // ============================================================================

  getGoogleEndpoints(): {
    authorization: string;
    token: string;
    userinfo: string;
    tokeninfo: string;
    revoke: string;
  } {
    return {
      authorization: '/oauth-mock/google/authorize',
      token: '/oauth-mock/google/token',
      userinfo: '/oauth-mock/google/userinfo',
      tokeninfo: '/oauth-mock/google/tokeninfo',
      revoke: '/oauth-mock/google/revoke',
    };
  }

  // ============================================================================
  // Google-Specific Error Handling
  // ============================================================================

  /**
   * Generate Google-style error response
   */
  generateGoogleErrorResponse(
    error: string,
    errorDescription?: string,
  ): {
    error: string;
    error_description?: string;
  } {
    const googleErrorMap: Record<string, string> = {
      invalid_request:
        'The request is missing a required parameter, includes an invalid parameter value, includes a parameter more than once, or is otherwise malformed.',
      unauthorized_client: 'The client is not authorized to request an authorization code using this method.',
      access_denied: 'The resource owner or authorization server denied the request.',
      unsupported_response_type:
        'The authorization server does not support obtaining an authorization code using this method.',
      invalid_scope: 'The requested scope is invalid, unknown, or malformed.',
      server_error:
        'The authorization server encountered an unexpected condition that prevented it from fulfilling the request.',
      temporarily_unavailable:
        'The authorization server is currently unable to handle the request due to a temporary overloading or maintenance of the server.',
      invalid_client: 'Client authentication failed.',
      invalid_grant:
        'The provided authorization grant is invalid, expired, revoked, does not match the redirection URI used in the authorization request, or was issued to another client.',
      unsupported_grant_type: 'The authorization grant type is not supported by the authorization server.',
    };

    return {
      error,
      error_description: errorDescription || googleErrorMap[error] || 'An error occurred',
    };
  }

  /**
   * Handle Google-specific account selection logic
   */
  selectGoogleAccount(
    accounts: MockOAuthAccount[],
    loginHint?: string,
    mockAccountEmail?: string,
  ): MockOAuthAccount | null {
    const googleAccounts = accounts.filter((acc) => acc.provider === OAuthProviders.Google);

    if (googleAccounts.length === 0) {
      return null;
    }

    // Priority order: mockAccountEmail -> loginHint -> first active account
    if (mockAccountEmail) {
      const account = googleAccounts.find((acc) => acc.email === mockAccountEmail);
      if (account) return account;
    }

    if (loginHint) {
      const account = googleAccounts.find((acc) => acc.email === loginHint);
      if (account) return account;
    }

    // Return first active account or first account if none are marked as active
    const activeAccount = googleAccounts.find((acc) => acc.status === 'active' || !acc.status);
    return activeAccount || googleAccounts[0];
  }

  // ============================================================================
  // Google-Specific Scope Handling
  // ============================================================================

  /**
   * Parse and validate Google scopes
   */
  parseGoogleScopes(scopeString: string): {
    valid: boolean;
    scopes: string[];
    normalizedScopes: string[];
    error?: string;
  } {
    const scopes = scopeString.split(' ').filter((s) => s.trim());
    const normalizedScopes: string[] = [];

    for (const scope of scopes) {
      if (scope === 'openid' || scope === 'email' || scope === 'profile') {
        normalizedScopes.push(scope);
      } else if (scope.startsWith('https://www.googleapis.com/auth/')) {
        normalizedScopes.push(scope);
      } else {
        // Try to normalize common scope names
        switch (scope) {
          case 'userinfo.email':
            normalizedScopes.push('https://www.googleapis.com/auth/userinfo.email');
            break;
          case 'userinfo.profile':
            normalizedScopes.push('https://www.googleapis.com/auth/userinfo.profile');
            break;
          default:
            // For mock purposes, allow any scope
            normalizedScopes.push(`https://www.googleapis.com/auth/${scope}`);
        }
      }
    }

    // Ensure minimum required scopes
    if (
      !normalizedScopes.includes('email') &&
      !normalizedScopes.includes('https://www.googleapis.com/auth/userinfo.email')
    ) {
      normalizedScopes.push('https://www.googleapis.com/auth/userinfo.email');
    }

    if (
      !normalizedScopes.includes('profile') &&
      !normalizedScopes.includes('https://www.googleapis.com/auth/userinfo.profile')
    ) {
      normalizedScopes.push('https://www.googleapis.com/auth/userinfo.profile');
    }

    return {
      valid: true,
      scopes,
      normalizedScopes,
    };
  }

  // ============================================================================
  // Google-Specific Utilities
  // ============================================================================

  /**
   * Generate Google authorization URL
   */
  generateGoogleAuthorizationUrl(params: {
    clientId: string;
    redirectUri: string;
    scope: string;
    state: string;
    accessType?: string;
    prompt?: string;
    loginHint?: string;
    includeGrantedScopes?: boolean;
  }): string {
    const baseUrl = '/oauth-mock/google/authorize';
    const urlParams = new URLSearchParams();

    urlParams.append('client_id', params.clientId);
    urlParams.append('response_type', 'code');
    urlParams.append('scope', params.scope);
    urlParams.append('state', params.state);
    urlParams.append('redirect_uri', params.redirectUri);

    if (params.accessType) {
      urlParams.append('access_type', params.accessType);
    }

    if (params.prompt) {
      urlParams.append('prompt', params.prompt);
    }

    if (params.loginHint) {
      urlParams.append('login_hint', params.loginHint);
    }

    if (params.includeGrantedScopes) {
      urlParams.append('include_granted_scopes', 'true');
    }

    return `${baseUrl}?${urlParams.toString()}`;
  }

  /**
   * Simulate Google-specific delays and errors
   */
  async simulateGoogleBehavior(email?: string): Promise<void> {
    // Simulate network delay
    if (this.config.simulateDelay) {
      await new Promise((resolve) => setTimeout(resolve, this.config.delayMs));
    }

    // Check for Google-specific error conditions
    if (email) {
      // Simulate Google account suspended
      if (email.includes('suspended')) {
        throw new Error('Google account suspended');
      }

      // Simulate Google account not found
      if (email.includes('notfound')) {
        throw new Error('Google account not found');
      }

      // Simulate Google rate limiting
      if (email.includes('ratelimit')) {
        throw new Error('Rate limit exceeded');
      }
    }

    // General error simulation
    if (this.config.simulateErrors && Math.random() < this.config.errorRate) {
      const errors = ['server_error', 'temporarily_unavailable', 'invalid_request'];
      const randomError = errors[Math.floor(Math.random() * errors.length)];
      throw new Error(randomError);
    }
  }

  // ============================================================================
  // Google Account Status Checks
  // ============================================================================

  /**
   * Check if Google account meets requirements
   */
  validateGoogleAccountStatus(account: MockOAuthAccount): {
    valid: boolean;
    error?: string;
    errorCode?: string;
  } {
    if (account.provider !== OAuthProviders.Google) {
      return { valid: false, error: 'Not a Google account', errorCode: 'invalid_account' };
    }

    if (account.status === 'suspended') {
      return {
        valid: false,
        error: 'Google account is suspended',
        errorCode: 'account_suspended',
      };
    }

    if (account.status === 'inactive') {
      return {
        valid: false,
        error: 'Google account is inactive',
        errorCode: 'account_inactive',
      };
    }

    if (!account.emailVerified) {
      return {
        valid: false,
        error: 'Google account email is not verified',
        errorCode: 'email_not_verified',
      };
    }

    return { valid: true };
  }

  /**
   * Get Google account capabilities based on account type
   */
  getGoogleAccountCapabilities(account: MockOAuthAccount): {
    canSignIn: boolean;
    canSignUp: boolean;
    requiresTwoFactor: boolean;
    supportedScopes: string[];
  } {
    const baseScopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    // Add additional scopes based on account type or email domain
    const additionalScopes: string[] = [];

    if (account.email.includes('@company.com') || account.email.includes('@enterprise.com')) {
      additionalScopes.push(
        'https://www.googleapis.com/auth/admin.directory.user.readonly',
        'https://www.googleapis.com/auth/admin.directory.group.readonly',
      );
    }

    return {
      canSignIn: account.status !== 'suspended' && account.status !== 'inactive',
      canSignUp: account.status !== 'suspended',
      requiresTwoFactor: account.twoFactorEnabled || false,
      supportedScopes: [...baseScopes, ...additionalScopes],
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: OAuthMockConfig): void {
    this.config = config;
  }
}
