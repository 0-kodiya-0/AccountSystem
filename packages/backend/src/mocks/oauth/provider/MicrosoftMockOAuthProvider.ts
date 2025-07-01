import crypto from 'crypto';
import { MockAccount } from '../../../config/mock.config';
import { OAuthProviders } from '../../../feature/account';
import { BaseMockOAuthProvider } from './BaseMockOAuthProvider';
import { MockUserInfoResponse } from '../OAuthMockService';

export class MicrosoftMockOAuthProvider extends BaseMockOAuthProvider {
  constructor() {
    super(OAuthProviders.Microsoft);
  }

  generateIdToken(account: MockAccount): string {
    if (account.provider !== OAuthProviders.Microsoft || account.accountType !== 'oauth') {
      throw new Error('Account is not a Microsoft OAuth account');
    }

    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        iss: 'https://login.microsoftonline.com',
        sub: account.id,
        aud: process.env.MICROSOFT_CLIENT_ID,
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
    return clientId === process.env.MICROSOFT_CLIENT_ID && clientSecret === process.env.MICROSOFT_CLIENT_SECRET;
  }

  getAuthorizationEndpoint(): string {
    return '/mock/oauth/microsoft/authorize';
  }

  getTokenEndpoint(): string {
    return '/mock/oauth/microsoft/token';
  }

  getUserInfoEndpoint(): string {
    return '/mock/oauth/microsoft/userinfo';
  }

  getTokenInfoEndpoint(): string {
    return '/mock/oauth/microsoft/tokeninfo';
  }

  getRevokeEndpoint(): string {
    return '/mock/oauth/microsoft/revoke';
  }
}
