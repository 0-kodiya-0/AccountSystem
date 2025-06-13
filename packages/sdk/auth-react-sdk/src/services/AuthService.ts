import {
  GetAccountSessionResponse,
  GetAccountSessionDataResponse,
  LocalSignupRequest,
  LocalLoginRequest,
  LocalLoginResponse,
  TwoFactorVerifyRequest,
  PasswordResetRequest,
  ResetPasswordRequest,
  PasswordChangeRequest,
  TwoFactorSetupRequest,
  TwoFactorSetupResponse,
  SessionUpdateResponse,
  PasswordChangeResponse,
  PasswordResetRequestResponse,
  ResetPasswordResponse,
  TwoFactorSetupVerificationResponse,
  BackupCodesResponse,
  OAuthProviders,
  OAuthUrlResponse,
  PermissionUrlResponse,
  ReauthorizeUrlResponse,
  LocalTokenInfoResponse,
  OAuthTokenInfoResponse,
  OAuthRefreshTokenInfoResponse,
  TokenRevocationResponse,
  LogoutResponse,
  LogoutAllResponse,
  EmailVerificationResponse,
  LocalSignupResponse,
} from '../types';
import { HttpClient } from '../client/HttpClient';

export class AuthService {
  constructor(private httpClient: HttpClient) {}

  // Session Management
  async getAccountSession(): Promise<GetAccountSessionResponse> {
    return this.httpClient.get('/session');
  }

  async getSessionAccountsData(accountIds?: string[]): Promise<GetAccountSessionDataResponse> {
    const params = new URLSearchParams();
    if (accountIds && accountIds.length > 0) {
      accountIds.forEach((id) => params.append('accountIds', id));
    }
    const queryString = params.toString();
    return this.httpClient.get(`/session/accounts${queryString ? `?${queryString}` : ''}`);
  }

  async setCurrentAccountInSession(accountId: string | null): Promise<SessionUpdateResponse> {
    return this.httpClient.post('/session/current', { accountId });
  }

  async addAccountToSession(accountId: string, setAsCurrent: boolean = true): Promise<SessionUpdateResponse> {
    return this.httpClient.post('/session/add', { accountId, setAsCurrent });
  }

  async removeAccountFromSession(accountId: string): Promise<SessionUpdateResponse> {
    return this.httpClient.post('/session/remove', { accountId });
  }

  // Local Authentication
  async localSignup(data: LocalSignupRequest): Promise<LocalSignupResponse> {
    return this.httpClient.post('/auth/signup', data);
  }

  async localLogin(data: LocalLoginRequest): Promise<LocalLoginResponse> {
    return this.httpClient.post('/auth/login', data);
  }

  async verifyTwoFactor(data: TwoFactorVerifyRequest): Promise<LocalLoginResponse> {
    return this.httpClient.post('/auth/verify-two-factor', data);
  }

  async verifyEmail(token: string): Promise<EmailVerificationResponse> {
    return this.httpClient.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  }

  async requestPasswordReset(data: PasswordResetRequest): Promise<PasswordResetRequestResponse> {
    return this.httpClient.post('/auth/reset-password-request', data);
  }

  async resetPassword(token: string, data: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    return this.httpClient.post(`/auth/reset-password?token=${encodeURIComponent(token)}`, data);
  }

  async changePassword(accountId: string, data: PasswordChangeRequest): Promise<PasswordChangeResponse> {
    return this.httpClient.post(`/${accountId}/auth/change-password`, data);
  }

  async setupTwoFactor(accountId: string, data: TwoFactorSetupRequest): Promise<TwoFactorSetupResponse> {
    return this.httpClient.post(`/${accountId}/auth/setup-two-factor`, data);
  }

  async verifyTwoFactorSetup(accountId: string, token: string): Promise<TwoFactorSetupVerificationResponse> {
    return this.httpClient.post(`/${accountId}/auth/verify-two-factor-setup`, {
      token,
    });
  }

  async generateBackupCodes(accountId: string, password: string): Promise<BackupCodesResponse> {
    return this.httpClient.post(`/${accountId}/auth/generate-backup-codes`, {
      password,
    });
  }

  // Token Information
  async getLocalTokenInfo(accountId: string): Promise<LocalTokenInfoResponse> {
    return this.httpClient.get(`/${accountId}/auth/token`);
  }

  async getLocalRefreshTokenInfo(accountId: string): Promise<LocalTokenInfoResponse> {
    return this.httpClient.get(`/${accountId}/auth/refresh/token`);
  }

  // OAuth Authentication
  async generateOAuthSignupUrl(provider: OAuthProviders): Promise<OAuthUrlResponse> {
    return this.httpClient.get(`/oauth/signup/${provider}`);
  }

  async generateOAuthSigninUrl(provider: OAuthProviders): Promise<OAuthUrlResponse> {
    return this.httpClient.get(`/oauth/signin/${provider}`);
  }

  async generatePermissionUrl(
    provider: OAuthProviders,
    accountId: string,
    scopeNames: string[],
  ): Promise<PermissionUrlResponse> {
    const params = new URLSearchParams();
    params.append('accountId', accountId);
    params.append('scopeNames', JSON.stringify(scopeNames));

    return this.httpClient.get(`/oauth/permission/${provider}?${params.toString()}`);
  }

  async generateReauthorizeUrl(provider: OAuthProviders, accountId: string): Promise<ReauthorizeUrlResponse> {
    const params = new URLSearchParams();
    params.append('accountId', accountId);

    return this.httpClient.get(`/oauth/reauthorize/${provider}?${params.toString()}`);
  }

  // OAuth Token Management
  async getOAuthTokenInfo(accountId: string): Promise<OAuthTokenInfoResponse> {
    return this.httpClient.get(`/${accountId}/oauth/token`);
  }

  async getOAuthRefreshTokenInfo(accountId: string): Promise<OAuthRefreshTokenInfoResponse> {
    return this.httpClient.get(`/${accountId}/oauth/refresh/token`);
  }

  async revokeOAuthTokens(accountId: string): Promise<TokenRevocationResponse> {
    return this.httpClient.post(`/${accountId}/oauth/revoke`);
  }

  // Redirect Methods (for browser navigation)
  redirectToOAuthSignup(provider: OAuthProviders): void {
    this.generateOAuthSignupUrl(provider)
      .then((response) => {
        window.location.href = response.authorizationUrl;
      })
      .catch((error) => {
        console.error('Failed to generate OAuth signup URL:', error);
      });
  }

  redirectToOAuthSignin(provider: OAuthProviders): void {
    this.generateOAuthSigninUrl(provider)
      .then((response) => {
        window.location.href = response.authorizationUrl;
      })
      .catch((error) => {
        console.error('Failed to generate OAuth signin URL:', error);
      });
  }

  requestGooglePermission(accountId: string, scopeNames: string[]): void {
    this.generatePermissionUrl(OAuthProviders.Google, accountId, scopeNames)
      .then((response) => {
        window.location.href = response.authorizationUrl;
      })
      .catch((error) => {
        console.error('Failed to generate permission URL:', error);
      });
  }

  reauthorizePermissions(accountId: string): void {
    this.generateReauthorizeUrl(OAuthProviders.Google, accountId)
      .then((response) => {
        if (response.authorizationUrl) {
          window.location.href = response.authorizationUrl;
        } else {
          console.log('No reauthorization needed:', response.message);
        }
      })
      .catch((error) => {
        console.error('Failed to generate reauthorization URL:', error);
      });
  }

  // Logout Methods
  async logout(accountId: string, clearClientAccountState: boolean = true): Promise<LogoutResponse> {
    const params = new URLSearchParams();
    params.append('accountId', accountId);
    params.append('clearClientAccountState', clearClientAccountState.toString());

    return this.httpClient.get(`/account/logout?${params.toString()}`);
  }

  async logoutAll(accountIds: string[]): Promise<LogoutAllResponse> {
    const params = new URLSearchParams();
    accountIds.forEach((id) => params.append('accountIds', id));

    return this.httpClient.get(`/account/logout/all?${params.toString()}`);
  }
}
