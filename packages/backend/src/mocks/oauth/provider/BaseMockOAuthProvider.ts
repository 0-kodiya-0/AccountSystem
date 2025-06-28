import { MockOAuthAccount } from '../../../config/mock.config';
import { OAuthProviders } from '../../../feature/account';
import { MockTokenResponse, MockUserInfoResponse } from '../OAuthMockService';

export abstract class BaseMockOAuthProvider {
  protected provider: OAuthProviders;

  constructor(provider: OAuthProviders) {
    this.provider = provider;
  }

  abstract generateIdToken(account: MockOAuthAccount): string;
  abstract getTokenInfo(accessToken: string): any | null;
  abstract getUserInfo(accessToken: string): MockUserInfoResponse | null;
  abstract validateClientCredentials(clientId: string, clientSecret: string): boolean;
  abstract getAuthorizationEndpoint(): string;
  abstract getTokenEndpoint(): string;
  abstract getUserInfoEndpoint(): string;
  abstract getTokenInfoEndpoint(): string;
  abstract getRevokeEndpoint(): string;

  /**
   * Exchange authorization code for tokens
   */
  exchangeAuthorizationCode(code: string, account: MockOAuthAccount): MockTokenResponse {
    return {
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expires_in: account.expiresIn,
      token_type: 'Bearer',
      scope: 'openid email profile',
      id_token: this.generateIdToken(account),
    };
  }

  /**
   * Refresh access token
   */
  refreshAccessToken(refreshToken: string, accounts: MockOAuthAccount[]): MockTokenResponse | null {
    const account = accounts.find((acc) => acc.refreshToken === refreshToken && acc.provider === this.provider);

    if (!account) {
      return null;
    }

    // Generate new access token
    const newAccessToken = `${account.accessToken}_refreshed_${Date.now()}`;

    return {
      access_token: newAccessToken,
      refresh_token: refreshToken, // Keep the same refresh token
      expires_in: account.expiresIn,
      token_type: 'Bearer',
      scope: 'openid email profile',
    };
  }

  /**
   * Revoke token
   */
  revokeToken(token: string, accounts: MockOAuthAccount[]): boolean {
    const account = accounts.find(
      (acc) => (acc.accessToken === token || acc.refreshToken === token) && acc.provider === this.provider,
    );

    return !!account;
  }
}
