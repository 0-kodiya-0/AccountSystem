import {
  GetAccountSessionResponse,
  LocalSignupRequest,
  LocalLoginRequest,
  LocalLoginResponse,
  TwoFactorVerifyRequest,
  PasswordResetRequest,
  ResetPasswordRequest,
  PasswordChangeRequest,
  TwoFactorSetupRequest,
  TwoFactorSetupResponse,
} from '../types';
import { HttpClient } from '../client/HttpClient';

export class AuthService {
  constructor(private httpClient: HttpClient) {}

  async getAccountSession(): Promise<GetAccountSessionResponse> {
    return this.httpClient.get('/account/session');
  }

  async setCurrentAccountInSession(
    accountId: string | null,
  ): Promise<{ message: string; currentAccountId: string | null }> {
    return this.httpClient.post('/account/session/current', { accountId });
  }

  async localSignup(data: LocalSignupRequest): Promise<{ accountId: string }> {
    return this.httpClient.post('/auth/signup', data);
  }

  async localLogin(data: LocalLoginRequest): Promise<LocalLoginResponse> {
    return this.httpClient.post('/auth/login', data);
  }

  async verifyTwoFactor(data: TwoFactorVerifyRequest): Promise<LocalLoginResponse> {
    return this.httpClient.post('/auth/verify-two-factor', data);
  }

  async verifyEmail(token: string): Promise<void> {
    return this.httpClient.get(`/auth/verify-email?token=${token}`);
  }

  async requestPasswordReset(data: PasswordResetRequest): Promise<{ message: string }> {
    return this.httpClient.post('/auth/reset-password-request', data);
  }

  async resetPassword(token: string, data: ResetPasswordRequest): Promise<{ message: string }> {
    return this.httpClient.post(`/auth/reset-password?token=${token}`, data);
  }

  async changePassword(accountId: string, data: PasswordChangeRequest): Promise<{ message: string }> {
    return this.httpClient.post(`/${accountId}/auth/change-password`, data);
  }

  async setupTwoFactor(accountId: string, data: TwoFactorSetupRequest): Promise<TwoFactorSetupResponse> {
    return this.httpClient.post(`/${accountId}/auth/setup-two-factor`, data);
  }

  async verifyTwoFactorSetup(accountId: string, token: string): Promise<{ message: string }> {
    return this.httpClient.post(`/${accountId}/auth/verify-two-factor-setup`, {
      token,
    });
  }

  async generateBackupCodes(accountId: string, password: string): Promise<{ backupCodes: string[] }> {
    return this.httpClient.post(`/${accountId}/auth/generate-backup-codes`, {
      password,
    });
  }

  redirectToOAuthSignup(provider: string): void {
    const baseUrl = this.httpClient.getRedirectBaseUrl();
    window.location.href = `${baseUrl}/oauth/signup/${provider}`;
  }

  redirectToOAuthSignin(provider: string): void {
    const baseUrl = this.httpClient.getRedirectBaseUrl();
    window.location.href = `${baseUrl}/oauth/signin/${provider}`;
  }

  requestGooglePermission(accountId: string, scopeNames: string[]): void {
    const params = new URLSearchParams();
    params.append('accountId', accountId);

    const scopes = Array.isArray(scopeNames) ? scopeNames.join(',') : scopeNames;
    window.location.href = `${this.httpClient.getRedirectBaseUrl()}/oauth/permission/${scopes}?${params.toString()}`;
  }

  reauthorizePermissions(accountId: string): void {
    const params = new URLSearchParams();
    params.append('accountId', accountId);

    window.location.href = `${this.httpClient.getRedirectBaseUrl()}/oauth/permission/reauthorize?${params.toString()}`;
  }

  logout(accountId: string, clearClientAccountState: boolean = true): void {
    const baseUrl = this.httpClient.getRedirectBaseUrl();
    const params = new URLSearchParams();
    params.append('accountId', accountId);
    params.append('clearClientAccountState', clearClientAccountState.toString());
    window.location.href = `${baseUrl}/account/logout?${params.toString()}`;
  }

  logoutAll(accountIds: string[]): void {
    const baseUrl = this.httpClient.getRedirectBaseUrl();
    const params = new URLSearchParams();
    accountIds.forEach((id) => params.append('accountIds', id));
    window.location.href = `${baseUrl}/account/logout/all?${params.toString()}`;
  }
}
