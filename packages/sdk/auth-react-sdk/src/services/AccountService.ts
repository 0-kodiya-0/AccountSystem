import { Account, SecuritySettings } from '../types';
import { HttpClient } from '../client/HttpClient';

export class AccountService {
  constructor(private httpClient: HttpClient) {}

  async getAccount(accountId: string): Promise<Account> {
    return this.httpClient.get(`/${accountId}/account`);
  }

  async updateAccount(
    accountId: string,
    updates: Partial<Account>,
  ): Promise<Account> {
    return this.httpClient.patch(`/${accountId}/account`, updates);
  }

  async getAccountEmail(accountId: string): Promise<{ email: string }> {
    return this.httpClient.get(`/${accountId}/account/email`);
  }

  async updateAccountSecurity(
    accountId: string,
    security: Partial<SecuritySettings>,
  ): Promise<Account> {
    return this.httpClient.patch(`/${accountId}/account/security`, security);
  }

  async searchAccount(email: string): Promise<{ accountId?: string }> {
    return this.httpClient.get(
      `/account/search?email=${encodeURIComponent(email)}`,
    );
  }
}
