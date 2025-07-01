import crypto from 'crypto';
import { MockOAuthAccount } from '../../../config/mock.config';
import { OAuthProviders } from '../../../feature/account';
import { MockUserInfoResponse } from '../OAuthMockService';
import { BaseMockOAuthProvider } from './BaseMockOAuthProvider';

export class FacebookMockOAuthProvider extends BaseMockOAuthProvider {
  constructor() {
    super(OAuthProviders.Facebook);
  }

  generateIdToken(account: MockOAuthAccount): string {
    // Facebook doesn't use ID tokens in the same way, but for consistency
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        iss: 'https://www.facebook.com',
        sub: account.id,
        aud: process.env.FACEBOOK_CLIENT_ID,
        email: account.email,
        email_verified: account.emailVerified,
        name: account.name,
        given_name: account.firstName,
        family_name: account.lastName,
        picture: account.imageUrl,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
    const signature = crypto.createHash('sha256').update(`${header}.${payload}`).digest('base64');

    return `${header}.${payload}.${signature}`;
  }

  getTokenInfo(accessToken: string): any | null {
    return null;
  }

  getUserInfo(accessToken: string): MockUserInfoResponse | null {
    return null;
  }

  validateClientCredentials(clientId: string, clientSecret: string): boolean {
    return clientId === process.env.FACEBOOK_CLIENT_ID && clientSecret === process.env.FACEBOOK_CLIENT_SECRET;
  }

  getAuthorizationEndpoint(): string {
    return '/mock/oauth/facebook/authorize';
  }

  getTokenEndpoint(): string {
    return '/mock/oauth/facebook/token';
  }

  getUserInfoEndpoint(): string {
    return '/mock/oauth/facebook/userinfo';
  }

  getTokenInfoEndpoint(): string {
    return '/mock/oauth/facebook/tokeninfo';
  }

  getRevokeEndpoint(): string {
    return '/mock/oauth/facebook/revoke';
  }
}
