import { MockAccount } from '../../../config/mock.config';
import { OAuthProviders } from '../../../feature/account';
import { MockTokenResponse, MockUserInfoResponse } from '../OAuthMockService';
import crypto from 'crypto';

export abstract class BaseMockOAuthProvider {
  protected provider: OAuthProviders;

  constructor(provider: OAuthProviders) {
    this.provider = provider;
  }

  abstract generateIdToken(account: MockAccount): string;
  abstract getTokenInfo(accessToken: string): any | null;
  abstract getUserInfo(accessToken: string): MockUserInfoResponse | null;
  abstract validateClientCredentials(clientId: string, clientSecret: string): boolean;
  abstract getAuthorizationEndpoint(): string;
  abstract getTokenEndpoint(): string;
  abstract getUserInfoEndpoint(): string;
  abstract getTokenInfoEndpoint(): string;
  abstract getRevokeEndpoint(): string;

  /**
   * Exchange authorization code for tokens - now generates dynamic tokens
   */
  exchangeAuthorizationCode(code: string, account: MockAccount): MockTokenResponse {
    // Generate dynamic tokens instead of using static ones
    const timestamp = Date.now();
    const randomPart = crypto.randomBytes(8).toString('hex');

    const accessToken = `mock_${this.provider}_access_${account.id}_${timestamp}_${randomPart}`;
    const refreshToken = `mock_${this.provider}_refresh_${account.id}_${timestamp}_${randomPart}`;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'openid email profile',
      id_token: this.generateIdToken(account),
    };
  }

  /**
   * Refresh access token - now generates dynamic tokens
   */
  refreshAccessToken(refreshToken: string, accounts: MockAccount[]): MockTokenResponse | null {
    // Extract account ID from refresh token pattern
    const tokenMatch = refreshToken.match(new RegExp(`mock_${this.provider}_refresh_([^_]+)_`));
    if (!tokenMatch) {
      return null;
    }

    const accountId = tokenMatch[1];
    const account = accounts.find(
      (acc) => acc.id === accountId && acc.provider === this.provider && acc.accountType === 'oauth',
    );

    if (!account) {
      return null;
    }

    // Generate new access token
    const timestamp = Date.now();
    const randomPart = crypto.randomBytes(8).toString('hex');
    const newAccessToken = `mock_${this.provider}_access_${account.id}_${timestamp}_${randomPart}`;

    return {
      access_token: newAccessToken,
      refresh_token: refreshToken, // Keep the same refresh token
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'openid email profile',
    };
  }

  /**
   * Revoke token - now validates dynamic tokens
   */
  revokeToken(token: string, accounts: MockAccount[]): boolean {
    // Check if token follows our mock token pattern for this provider
    const isAccessToken = token.includes(`mock_${this.provider}_access_`);
    const isRefreshToken = token.includes(`mock_${this.provider}_refresh_`);

    if (!isAccessToken && !isRefreshToken) {
      return false;
    }

    // Extract account ID from token
    const tokenMatch = token.match(new RegExp(`mock_${this.provider}_(?:access|refresh)_([^_]+)_`));
    if (!tokenMatch) {
      return false;
    }

    const accountId = tokenMatch[1];
    const account = accounts.find(
      (acc) => acc.id === accountId && acc.provider === this.provider && acc.accountType === 'oauth',
    );

    return !!account;
  }
}
