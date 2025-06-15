import { Account, SecuritySettings } from '../types';
import { HttpClient } from '../client/HttpClient';

// Validation utility functions
const validateAccountId = (accountId: string | null | undefined, context: string): void => {
  if (!accountId || typeof accountId !== 'string' || accountId.trim() === '') {
    throw new Error(`Valid accountId is required for ${context}`);
  }
};

const validateEmail = (email: string | null | undefined, context: string): void => {
  if (!email || typeof email !== 'string' || email.trim() === '') {
    throw new Error(`Valid email is required for ${context}`);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(`Invalid email format for ${context}`);
  }
};

const validateRequired = (value: any, fieldName: string, context: string): void => {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`${fieldName} is required for ${context}`);
  }
};

export class AccountService {
  constructor(private httpClient: HttpClient) {
    if (!httpClient) {
      throw new Error('HttpClient is required for AccountService');
    }
  }

  async getAccount(accountId: string): Promise<Account> {
    validateAccountId(accountId, 'get account');

    return this.httpClient.get(`/${accountId}/account`);
  }

  async updateAccount(accountId: string, updates: Partial<Account>): Promise<Account> {
    validateAccountId(accountId, 'account update');
    validateRequired(updates, 'account updates', 'account update');

    // Validate specific fields if they exist in updates
    if (updates.userDetails?.email) {
      validateEmail(updates.userDetails.email, 'account update');
    }

    if (updates.userDetails?.firstName) {
      validateRequired(updates.userDetails.firstName, 'firstName', 'account update');
    }

    if (updates.userDetails?.lastName) {
      validateRequired(updates.userDetails.lastName, 'lastName', 'account update');
    }

    return this.httpClient.patch(`/${accountId}/account`, updates);
  }

  async getAccountEmail(accountId: string): Promise<{ email: string }> {
    validateAccountId(accountId, 'get account email');

    return this.httpClient.get(`/${accountId}/account/email`);
  }

  async updateAccountSecurity(accountId: string, security: Partial<SecuritySettings>): Promise<Account> {
    validateAccountId(accountId, 'security settings update');
    validateRequired(security, 'security settings', 'security settings update');

    // Validate security settings if they exist
    if (security.sessionTimeout !== undefined) {
      if (typeof security.sessionTimeout !== 'number' || security.sessionTimeout < 300) {
        throw new Error('Session timeout must be a number greater than 300 seconds for security settings update');
      }
    }

    if (security.twoFactorEnabled !== undefined) {
      if (typeof security.twoFactorEnabled !== 'boolean') {
        throw new Error('twoFactorEnabled must be a boolean for security settings update');
      }
    }

    if (security.autoLock !== undefined) {
      if (typeof security.autoLock !== 'boolean') {
        throw new Error('autoLock must be a boolean for security settings update');
      }
    }

    return this.httpClient.patch(`/${accountId}/account/security`, security);
  }

  async searchAccount(email: string): Promise<{ accountId?: string }> {
    validateEmail(email, 'account search');

    return this.httpClient.get(`/account/search?email=${encodeURIComponent(email)}`);
  }
}
