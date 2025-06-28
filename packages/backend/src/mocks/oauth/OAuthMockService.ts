import crypto from 'crypto';
import { LRUCache } from 'lru-cache';
import { getOAuthMockConfig, MockOAuthAccount, OAuthMockConfig } from '../../config/mock.config';
import { OAuthProviders } from '../../feature/account/Account.types';
import { logger } from '../../utils/logger';
import { BaseMockOAuthProvider } from './provider/BaseMockOAuthProvider';
import { GoogleMockOAuthProvider } from './provider/GoogleMockOAuthProvider';
import { MicrosoftMockOAuthProvider } from './provider/MicrosoftMockOAuthProvider';
import { FacebookMockOAuthProvider } from './provider/FacebookMockOAuthProvider';

// ============================================================================
// Base Interfaces and Types
// ============================================================================

export interface MockOAuthState {
  state: string;
  provider: OAuthProviders;
  authType: 'signup' | 'signin' | 'permission';
  callbackUrl: string;
  expiresAt: string;
  createdAt: string;
  mockAccountEmail?: string;
  scopes?: string[];
}

export interface MockTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

export interface MockUserInfoResponse {
  id: string;
  email: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  email_verified: boolean;
}

export interface MockAuthorizationRequest {
  client_id: string;
  response_type: string;
  scope: string;
  state: string;
  redirect_uri: string;
  access_type?: string;
  prompt?: string;
  login_hint?: string;
  include_granted_scopes?: string;
}

// Cache for OAuth states (10 minutes TTL)
const stateCache = new LRUCache<string, MockOAuthState>({
  max: 1000,
  ttl: 1000 * 60 * 10, // 10 minutes
  updateAgeOnGet: false,
  allowStale: false,
});

// Cache for authorization codes (5 minutes TTL)
const authCodeCache = new LRUCache<
  string,
  { state: string; account: MockOAuthAccount; provider: OAuthProviders; expiresAt: string }
>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
  updateAgeOnGet: false,
  allowStale: false,
});

class OAuthMockService {
  private static instance: OAuthMockService | null = null;
  private config: OAuthMockConfig;
  private providers: Map<OAuthProviders, BaseMockOAuthProvider>;

  private constructor() {
    this.config = this.loadConfig();
    this.providers = new Map();
    this.initializeProviders();
  }

  static getInstance(): OAuthMockService {
    if (!OAuthMockService.instance) {
      OAuthMockService.instance = new OAuthMockService();
    }
    return OAuthMockService.instance;
  }

  private initializeProviders(): void {
    this.providers.set(OAuthProviders.Google, new GoogleMockOAuthProvider());
    this.providers.set(OAuthProviders.Microsoft, new MicrosoftMockOAuthProvider());
    this.providers.set(OAuthProviders.Facebook, new FacebookMockOAuthProvider());
  }

  private loadConfig(): OAuthMockConfig {
    return getOAuthMockConfig();
  }

  // ============================================================================
  // General Service Methods
  // ============================================================================

  isEnabled(): boolean {
    return this.config.enabled && process.env.NODE_ENV !== 'production';
  }

  refreshConfig(): void {
    this.config = this.loadConfig();
    if (this.config.logRequests) {
      logger.info('OAuth mock configuration refreshed', this.config);
    }
  }

  getConfig(): OAuthMockConfig {
    return { ...this.config };
  }

  getProvider(provider: OAuthProviders): BaseMockOAuthProvider | undefined {
    return this.providers.get(provider);
  }

  getSupportedProviders(): OAuthProviders[] {
    return Array.from(this.providers.keys());
  }

  // ============================================================================
  // State Management Methods
  // ============================================================================

  saveOAuthState(
    provider: OAuthProviders,
    authType: 'signup' | 'signin' | 'permission',
    callbackUrl: string,
    mockAccountEmail?: string,
    scopes?: string[],
  ): string {
    const state = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const stateData: MockOAuthState = {
      state,
      provider,
      authType,
      callbackUrl,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      mockAccountEmail,
      scopes,
    };

    stateCache.set(state, stateData);

    if (this.config.logRequests) {
      logger.info(`Mock OAuth state saved: ${state}`, {
        provider,
        authType,
        mockAccountEmail,
      });
    }

    return state;
  }

  getOAuthState(state: string): MockOAuthState | null {
    const stateData = stateCache.get(state);

    if (!stateData) {
      return null;
    }

    // Check if expired
    if (new Date(stateData.expiresAt) < new Date()) {
      stateCache.delete(state);
      return null;
    }

    return stateData;
  }

  removeOAuthState(state: string): void {
    stateCache.delete(state);
  }

  // ============================================================================
  // Account Management Methods
  // ============================================================================

  findMockAccount(email: string, provider?: OAuthProviders): MockOAuthAccount | null {
    let account = this.config.mockAccounts.find((acc) => acc.email === email);

    if (provider) {
      account = this.config.mockAccounts.find((acc) => acc.email === email && acc.provider === provider);
    }

    return account || null;
  }

  getAllMockAccounts(provider?: OAuthProviders): MockOAuthAccount[] {
    if (provider) {
      return this.config.mockAccounts.filter((acc) => acc.provider === provider);
    }
    return [...this.config.mockAccounts];
  }

  // ============================================================================
  // Error Simulation Methods
  // ============================================================================

  shouldSimulateError(email?: string): boolean {
    if (email && this.config.failOnEmails.includes(email)) {
      return true;
    }

    if (!this.config.simulateErrors) {
      return false;
    }

    return Math.random() < this.config.errorRate;
  }

  isEmailBlocked(email: string): boolean {
    return this.config.blockEmails.includes(email);
  }

  async simulateDelay(): Promise<void> {
    if (this.config.simulateDelay) {
      await new Promise((resolve) => setTimeout(resolve, this.config.delayMs));
    }
  }

  // ============================================================================
  // Authorization Code Methods
  // ============================================================================

  generateAuthorizationCode(state: string, account: MockOAuthAccount, provider: OAuthProviders): string {
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    authCodeCache.set(code, {
      state,
      account,
      provider,
      expiresAt: expiresAt.toISOString(),
    });

    if (this.config.logRequests) {
      logger.info(`Mock authorization code generated: ${code}`, {
        state,
        provider,
        accountEmail: account.email,
      });
    }

    return code;
  }

  exchangeAuthorizationCode(
    code: string,
    provider: OAuthProviders,
  ): {
    tokens: MockTokenResponse;
    userInfo: MockUserInfoResponse;
  } | null {
    const codeData = authCodeCache.get(code);

    if (!codeData || codeData.provider !== provider) {
      return null;
    }

    // Check if expired
    if (new Date(codeData.expiresAt) < new Date()) {
      authCodeCache.delete(code);
      return null;
    }

    const { account } = codeData;

    // Remove the code (one-time use)
    authCodeCache.delete(code);

    const providerInstance = this.getProvider(provider);
    if (!providerInstance) {
      return null;
    }

    const tokens = providerInstance.exchangeAuthorizationCode(code, account);

    const userInfo: MockUserInfoResponse = {
      id: account.id,
      email: account.email,
      name: account.name,
      picture: account.imageUrl,
      given_name: account.firstName,
      family_name: account.lastName,
      email_verified: account.emailVerified,
    };

    if (this.config.logRequests) {
      logger.info(`Mock tokens exchanged for code: ${code}`, {
        provider,
        accountEmail: account.email,
        accessToken: account.accessToken.substring(0, 10) + '...',
      });
    }

    return { tokens, userInfo };
  }

  // ============================================================================
  // Token Operations (Provider-Agnostic)
  // ============================================================================

  getTokenInfo(accessToken: string, provider: OAuthProviders): any | null {
    const account = this.config.mockAccounts.find(
      (acc) => acc.accessToken === accessToken && acc.provider === provider,
    );

    if (!account) {
      return null;
    }

    // Basic token info structure (can be customized per provider)
    return {
      issued_to: this.getClientId(provider),
      audience: this.getClientId(provider),
      user_id: account.id,
      scope: 'openid email profile',
      expires_in: account.expiresIn,
      email: account.email,
      verified_email: account.emailVerified,
      access_type: 'offline',
    };
  }

  getUserInfo(accessToken: string, provider: OAuthProviders): MockUserInfoResponse | null {
    const account = this.config.mockAccounts.find(
      (acc) => acc.accessToken === accessToken && acc.provider === provider,
    );

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
    };
  }

  refreshAccessToken(refreshToken: string, provider: OAuthProviders): MockTokenResponse | null {
    const providerInstance = this.getProvider(provider);
    if (!providerInstance) {
      return null;
    }

    const accounts = this.getAllMockAccounts(provider);
    return providerInstance.refreshAccessToken(refreshToken, accounts);
  }

  revokeToken(token: string, provider: OAuthProviders): boolean {
    const providerInstance = this.getProvider(provider);
    if (!providerInstance) {
      return false;
    }

    const accounts = this.getAllMockAccounts(provider);
    const success = providerInstance.revokeToken(token, accounts);

    if (success && this.config.logRequests) {
      logger.info(`Mock token revoked: ${token.substring(0, 10)}...`, {
        provider,
      });
    }

    return success;
  }

  // ============================================================================
  // Provider-Specific Helper Methods
  // ============================================================================

  private getClientId(provider: OAuthProviders): string {
    switch (provider) {
      case OAuthProviders.Google:
        return process.env.GOOGLE_CLIENT_ID || '';
      case OAuthProviders.Microsoft:
        return process.env.MICROSOFT_CLIENT_ID || '';
      case OAuthProviders.Facebook:
        return process.env.FACEBOOK_CLIENT_ID || '';
      default:
        return '';
    }
  }

  validateClientCredentials(clientId: string, clientSecret: string, provider: OAuthProviders): boolean {
    const providerInstance = this.getProvider(provider);
    if (!providerInstance) {
      return false;
    }

    return providerInstance.validateClientCredentials(clientId, clientSecret);
  }

  // ============================================================================
  // Statistics and Management Methods
  // ============================================================================

  getStats(): {
    activeStates: number;
    activeCodes: number;
    mockAccounts: number;
    accountsByProvider: Record<string, number>;
    supportedProviders: OAuthProviders[];
    config: OAuthMockConfig;
  } {
    const accountsByProvider: Record<string, number> = {};

    for (const provider of this.getSupportedProviders()) {
      accountsByProvider[provider] = this.getAllMockAccounts(provider).length;
    }

    return {
      activeStates: stateCache.size,
      activeCodes: authCodeCache.size,
      mockAccounts: this.config.mockAccounts.length,
      accountsByProvider,
      supportedProviders: this.getSupportedProviders(),
      config: this.config,
    };
  }

  clearCache(): void {
    stateCache.clear();
    authCodeCache.clear();

    if (this.config.logRequests) {
      logger.info('OAuth mock cache cleared');
    }
  }
}

export const oauthMockService = OAuthMockService.getInstance();
