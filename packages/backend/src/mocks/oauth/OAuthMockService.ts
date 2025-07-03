import crypto from 'crypto';
import { LRUCache } from 'lru-cache';
import {
  getOAuthMockConfig,
  getAccountsMockConfig,
  OAuthMockConfig,
  MockAccount,
  getNonDefaultAccounts,
  getAllMockAccounts,
  getDefaultAccounts,
} from '../../config/mock.config';
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

// Cache for authorization codes (5 minutes TTL)
const authCodeCache = new LRUCache<
  string,
  { state: string; account: MockAccount; provider: OAuthProviders; expiresAt: string }
>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
  updateAgeOnGet: false,
  allowStale: false,
});

// Cache for generated tokens (1 hour TTL)
const tokenCache = new LRUCache<
  string,
  { account: MockAccount; provider: OAuthProviders; expiresAt: string; refreshToken: string }
>({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour
  updateAgeOnGet: false,
  allowStale: false,
});

class OAuthMockService {
  private static instance: OAuthMockService | null = null;
  private providers: Map<OAuthProviders, BaseMockOAuthProvider>;

  private constructor() {
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

  // ============================================================================
  // Configuration Methods
  // ============================================================================

  private getOAuthConfig(): OAuthMockConfig {
    return getOAuthMockConfig();
  }

  private getAccountsConfig(): MockAccount[] {
    const accountsConfig = getAccountsMockConfig();
    return accountsConfig.accounts || [];
  }

  isEnabled(): boolean {
    const config = this.getOAuthConfig();
    return config.enabled && process.env.NODE_ENV !== 'production';
  }

  refreshConfig(): void {
    // Config is loaded fresh each time from the config manager
    if (this.getOAuthConfig().logRequests) {
      logger.info('OAuth mock service configuration refreshed');
    }
  }

  getConfig(): OAuthMockConfig {
    return this.getOAuthConfig();
  }

  getProvider(provider: OAuthProviders): BaseMockOAuthProvider | undefined {
    return this.providers.get(provider);
  }

  getSupportedProviders(): OAuthProviders[] {
    const config = this.getOAuthConfig();
    const supportedProviders: OAuthProviders[] = [];

    if (config.providers?.google?.enabled) {
      supportedProviders.push(OAuthProviders.Google);
    }
    if (config.providers?.microsoft?.enabled) {
      supportedProviders.push(OAuthProviders.Microsoft);
    }
    if (config.providers?.facebook?.enabled) {
      supportedProviders.push(OAuthProviders.Facebook);
    }

    return supportedProviders;
  }

  // ============================================================================
  // Account Management Methods (Now from Accounts Config)
  // ============================================================================

  findMockAccount(email: string, provider?: OAuthProviders): MockAccount | null {
    const accounts = getAllMockAccounts();

    if (provider) {
      return (
        accounts.find((acc) => acc.email === email && acc.provider === provider && acc.accountType === 'oauth') || null
      );
    }

    return accounts.find((acc) => acc.email === email) || null;
  }

  getAllMockAccounts(provider?: OAuthProviders): MockAccount[] {
    const accounts = getAllMockAccounts();

    if (provider) {
      return accounts.filter((acc) => acc.provider === provider && acc.accountType === 'oauth');
    }

    return accounts.filter((acc) => acc.accountType === 'oauth');
  }

  getNonDefaultAccounts(provider?: OAuthProviders): MockAccount[] {
    const accounts = getNonDefaultAccounts();

    if (provider) {
      return accounts.filter((acc) => acc.provider === provider && acc.accountType === 'oauth');
    }

    return accounts.filter((acc) => acc.accountType === 'oauth');
  }

  getDefaultAccounts(provider?: OAuthProviders): MockAccount[] {
    const accounts = getDefaultAccounts();

    if (provider) {
      return accounts.filter((acc) => acc.provider === provider && acc.accountType === 'oauth');
    }

    return accounts.filter((acc) => acc.accountType === 'oauth');
  }

  // ============================================================================
  // Error Simulation Methods
  // ============================================================================

  shouldSimulateError(email?: string): boolean {
    const config = this.getOAuthConfig();

    if (email && config.failOnEmails.includes(email)) {
      return true;
    }

    if (!config.simulateErrors) {
      return false;
    }

    return Math.random() < config.errorRate;
  }

  isEmailBlocked(email: string): boolean {
    const config = this.getOAuthConfig();
    return config.blockEmails.includes(email);
  }

  async simulateDelay(): Promise<void> {
    const config = this.getOAuthConfig();
    if (config.simulateDelay) {
      await new Promise((resolve) => setTimeout(resolve, config.delayMs));
    }
  }

  // ============================================================================
  // Authorization Code Methods
  // ============================================================================

  generateAuthorizationCode(state: string, account: MockAccount, provider: OAuthProviders): string {
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    authCodeCache.set(code, {
      state,
      account,
      provider,
      expiresAt: expiresAt.toISOString(),
    });

    const config = this.getOAuthConfig();
    if (config.logRequests) {
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

    // Generate dynamic tokens
    const accessToken = this.generateAccessToken(account, provider);
    const refreshToken = this.generateRefreshToken(account, provider);

    // Store tokens in cache
    tokenCache.set(accessToken, {
      account,
      provider,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour
      refreshToken,
    });

    const tokens: MockTokenResponse = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'openid email profile',
      id_token: providerInstance.generateIdToken(account),
    };

    const userInfo: MockUserInfoResponse = {
      id: account.id,
      email: account.email,
      name: account.name,
      picture: account.imageUrl,
      given_name: account.firstName,
      family_name: account.lastName,
      email_verified: account.emailVerified,
    };

    const config = this.getOAuthConfig();
    if (config.logRequests) {
      logger.info(`Mock tokens exchanged for code: ${code}`, {
        provider,
        accountEmail: account.email,
        accessToken: accessToken.substring(0, 10) + '...',
      });
    }

    return { tokens, userInfo };
  }

  // ============================================================================
  // Token Generation Methods
  // ============================================================================

  private generateAccessToken(account: MockAccount, provider: OAuthProviders): string {
    const timestamp = Date.now();
    const randomPart = crypto.randomBytes(16).toString('hex');
    return `mock_${provider}_access_${account.id}_${timestamp}_${randomPart}`;
  }

  private generateRefreshToken(account: MockAccount, provider: OAuthProviders): string {
    const timestamp = Date.now();
    const randomPart = crypto.randomBytes(16).toString('hex');
    return `mock_${provider}_refresh_${account.id}_${timestamp}_${randomPart}`;
  }

  // ============================================================================
  // Token Operations
  // ============================================================================

  getTokenInfo(accessToken: string, provider: OAuthProviders) {
    const tokenData = tokenCache.get(accessToken);

    if (!tokenData || tokenData.provider !== provider) {
      return null;
    }

    // Check if expired
    if (new Date(tokenData.expiresAt) < new Date()) {
      tokenCache.delete(accessToken);
      return null;
    }

    const { account } = tokenData;

    // Basic token info structure
    return {
      issued_to: this.getClientId(provider),
      audience: this.getClientId(provider),
      user_id: account.id,
      scope: 'openid email profile',
      expires_in: Math.floor((new Date(tokenData.expiresAt).getTime() - Date.now()) / 1000),
      email: account.email,
      verified_email: account.emailVerified,
      access_type: 'offline',
    };
  }

  getUserInfo(accessToken: string, provider: OAuthProviders): MockUserInfoResponse | null {
    const tokenData = tokenCache.get(accessToken);

    if (!tokenData || tokenData.provider !== provider) {
      return null;
    }

    // Check if expired
    if (new Date(tokenData.expiresAt) < new Date()) {
      tokenCache.delete(accessToken);
      return null;
    }

    const { account } = tokenData;

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
    // Find token data by refresh token
    let tokenData: any = null;
    let currentAccessToken: string | null = null;

    for (const [accessToken, data] of tokenCache.entries()) {
      if (data.refreshToken === refreshToken && data.provider === provider) {
        tokenData = data;
        currentAccessToken = accessToken;
        break;
      }
    }

    if (!tokenData) {
      return null;
    }

    // Generate new access token
    const newAccessToken = this.generateAccessToken(tokenData.account, provider);
    const newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    // Remove old token and add new one
    if (currentAccessToken) {
      tokenCache.delete(currentAccessToken);
    }

    tokenCache.set(newAccessToken, {
      account: tokenData.account,
      provider,
      expiresAt: newExpiresAt,
      refreshToken, // Keep the same refresh token
    });

    const config = this.getOAuthConfig();
    if (config.logRequests) {
      logger.info(`Mock token refreshed for account: ${tokenData.account.email}`);
    }

    return {
      access_token: newAccessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'openid email profile',
    };
  }

  revokeToken(token: string, provider: OAuthProviders): boolean {
    // Try to find and remove access token
    const tokenData = tokenCache.get(token);
    if (tokenData && tokenData.provider === provider) {
      tokenCache.delete(token);

      const config = this.getOAuthConfig();
      if (config.logRequests) {
        logger.info(`Mock access token revoked: ${token.substring(0, 10)}...`);
      }
      return true;
    }

    // Try to find and remove by refresh token
    for (const [accessToken, data] of tokenCache.entries()) {
      if (data.refreshToken === token && data.provider === provider) {
        tokenCache.delete(accessToken);

        const config = this.getOAuthConfig();
        if (config.logRequests) {
          logger.info(`Mock refresh token revoked: ${token.substring(0, 10)}...`);
        }
        return true;
      }
    }

    return false;
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
    mockAccounts: number;
    accountsByProvider: Record<string, number>;
    supportedProviders: OAuthProviders[];
    enabledProviders: OAuthProviders[];
    activeTokens: number;
    activeCodes: number;
    config: OAuthMockConfig;
  } {
    const accountsByProvider: Record<string, number> = {};
    const accounts = this.getAccountsConfig();

    for (const provider of Object.values(OAuthProviders)) {
      accountsByProvider[provider] = accounts.filter((acc) => acc.provider === provider).length;
    }

    return {
      mockAccounts: accounts.length,
      accountsByProvider,
      supportedProviders: Array.from(this.providers.keys()),
      enabledProviders: this.getSupportedProviders(),
      activeTokens: tokenCache.size,
      activeCodes: authCodeCache.size,
      config: this.getOAuthConfig(),
    };
  }

  clearCaches(): void {
    tokenCache.clear();
    authCodeCache.clear();
    logger.info('OAuth mock service caches cleared');
  }
}

export const oauthMockService = OAuthMockService.getInstance();
