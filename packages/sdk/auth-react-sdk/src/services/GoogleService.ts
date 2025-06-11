import { HttpClient } from '../client/HttpClient';
import { GoogleTokenInfo, TokenCheckResponse } from '../types';

export class GoogleService {
  constructor(private httpClient: HttpClient) {}

  // Google API
  async getGoogleTokenInfo(accountId: string): Promise<GoogleTokenInfo> {
    return this.httpClient.get(`/${accountId}/google/token`);
  }

  async checkGoogleScopes(accountId: string, scopeNames: string[]): Promise<TokenCheckResponse> {
    const params = new URLSearchParams();
    params.append('scopes', JSON.stringify(scopeNames));

    return this.httpClient.get(`/${accountId}/google/token/check?${params.toString()}`);
  }
}
