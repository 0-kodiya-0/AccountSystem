import { HttpClient } from '../client/HttpClient';
import { GoogleTokenInfo, TokenCheckResponse } from '../types';

export class GoogleService {
  constructor(private httpClient: HttpClient) {}

  requestGooglePermission(accountId: string, scopeNames: string[]): void {
    const params = new URLSearchParams();
    params.append('accountId', accountId);

    const scopes = Array.isArray(scopeNames)
      ? scopeNames.join(',')
      : scopeNames;
    window.location.href = `${this.httpClient.getRedirectBaseUrl()}/oauth/permission/${scopes}?${params.toString()}`;
  }

  reauthorizePermissions(accountId: string): void {
    const params = new URLSearchParams();
    params.append('accountId', accountId);

    window.location.href = `${this.httpClient.getRedirectBaseUrl()}/oauth/permission/reauthorize?${params.toString()}`;
  }

  // Google API
  async getGoogleTokenInfo(accountId: string): Promise<GoogleTokenInfo> {
    return this.httpClient.get(`/${accountId}/google/token`);
  }

  async checkGoogleScopes(
    accountId: string,
    scopeNames: string[],
  ): Promise<TokenCheckResponse> {
    const params = new URLSearchParams();
    params.append('scopes', JSON.stringify(scopeNames));

    return this.httpClient.get(
      `/${accountId}/google/token/check?${params.toString()}`,
    );
  }
}
