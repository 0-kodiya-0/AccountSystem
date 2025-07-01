import crypto from 'crypto';
import { MockOAuthAccount } from '../../../config/mock.config';
import { OAuthProviders } from '../../../feature/account';
import { BaseMockOAuthProvider } from './BaseMockOAuthProvider';
import { MockUserInfoResponse } from '../OAuthMockService';

export class GoogleMockOAuthProvider extends BaseMockOAuthProvider {
  constructor() {
    super(OAuthProviders.Google);
  }

  generateIdToken(account: MockOAuthAccount): string {
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        iss: 'https://accounts.google.com',
        sub: account.id,
        aud: process.env.GOOGLE_CLIENT_ID,
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
    // This would be implemented by the main service
    return null;
  }

  getUserInfo(accessToken: string): MockUserInfoResponse | null {
    // This would be implemented by the main service
    return null;
  }

  validateClientCredentials(clientId: string, clientSecret: string): boolean {
    return clientId === process.env.GOOGLE_CLIENT_ID && clientSecret === process.env.GOOGLE_CLIENT_SECRET;
  }

  getAuthorizationEndpoint(): string {
    return '/mock/oauth/google/authorize';
  }

  getTokenEndpoint(): string {
    return '/mock/oauth/google/token';
  }

  getUserInfoEndpoint(): string {
    return '/mock/oauth/google/userinfo';
  }

  getTokenInfoEndpoint(): string {
    return '/mock/oauth/google/tokeninfo';
  }

  getRevokeEndpoint(): string {
    return '/mock/oauth/google/revoke';
  }
}
