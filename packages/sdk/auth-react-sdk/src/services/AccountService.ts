import { Account, AccountUpdateRequest, SearchAccountResponse, GetAccountEmailResponse } from '../types';
import { HttpClient } from '../client/HttpClient';

// Validation utility functions
const validateAccountId = (accountId: string | null | undefined, context: string): void => {
  if (typeof accountId !== 'string') {
    throw new Error(`Valid accountId is required for ${context}`);
  }

  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  if (!objectIdRegex.test(accountId.trim())) {
    throw new Error(`Valid accountId is required for ${context}`);
  }
};

const validateEmail = (email: string | null | undefined, context: string): void => {
  if (typeof email !== 'string') {
    throw new Error(`Valid email is required for ${context}`);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(`Invalid email format for ${context}`);
  }
};

const validateRequired = (value: any, fieldName: string, context: string): void => {
  if (value === null || value === undefined) {
    throw new Error(`${fieldName} is required for ${context}`);
  }
};

const validateUrl = (url: string | null | undefined, context: string): void => {
  if (typeof url !== 'string') {
    throw new Error(`Valid URL is required for ${context}`);
  }

  try {
    const urlObj = new URL(url.trim());
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error(`Invalid URL format for ${context}`);
    }
  } catch {
    throw new Error(`Invalid URL format for ${context}`);
  }
};

const validateStringLength = (
  value: string | null | undefined,
  fieldName: string,
  context: string,
  minLength: number = 1,
  maxLength: number = 255,
): void => {
  if (value === '' || value === null || value === undefined) {
    return;
  }

  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string for ${context}`);
  }

  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    throw new Error(`${fieldName} must be at least ${minLength} characters for ${context}`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} cannot exceed ${maxLength} characters for ${context}`);
  }
};

const validateBirthdate = (birthdate: string | null | undefined, context: string): void => {
  if (birthdate === '' || birthdate === null || birthdate === undefined) {
    return;
  }

  if (typeof birthdate !== 'string') {
    throw new Error(`Birthdate must be a string for ${context}`);
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(birthdate)) {
    throw new Error(`Invalid birthdate format for ${context}. Use YYYY-MM-DD format`);
  }

  const date = new Date(birthdate);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid birthdate for ${context}`);
  }

  const [year, month, day] = birthdate.split('-').map(Number);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error(`Invalid birthdate for ${context}`);
  }

  if (date > new Date()) {
    throw new Error(`Birthdate cannot be in the future for ${context}`);
  }
};

export class AccountService {
  constructor(private httpClient: HttpClient) {
    if (!httpClient) {
      throw new Error('HttpClient is required for AccountService');
    }
  }

  /**
   * Get account details
   * Returns the account data directly
   */
  async getAccount(accountId: string): Promise<Account> {
    validateAccountId(accountId, 'get account');

    return this.httpClient.get(`/${accountId}/account`);
  }

  /**
   * Update account with direct field access
   * Returns the updated account data directly
   */
  async updateAccount(accountId: string, updates: AccountUpdateRequest): Promise<Account> {
    validateAccountId(accountId, 'account update');
    validateRequired(updates, 'account updates', 'account update');

    // Validate that at least one allowed field is present
    const allowedFields = ['firstName', 'lastName', 'name', 'imageUrl', 'birthdate', 'username'];
    const providedFields = Object.keys(updates);
    const validFields = providedFields.filter((field) => allowedFields.includes(field));

    if (validFields.length === 0) {
      throw new Error(`At least one valid field must be provided for account update`);
    }

    // Check for invalid fields first
    const invalidFields = providedFields.filter((field) => !allowedFields.includes(field));
    if (invalidFields.length > 0) {
      throw new Error(`Invalid fields provided: ${invalidFields.join(', ')}`);
    }

    // Validate each field if provided
    if (updates.firstName !== undefined) {
      validateStringLength(updates.firstName, 'firstName', 'account update', 1, 50);
    }

    if (updates.lastName !== undefined) {
      validateStringLength(updates.lastName, 'lastName', 'account update', 1, 50);
    }

    if (updates.name !== undefined) {
      validateStringLength(updates.name, 'name', 'account update', 1, 100);
    }

    if (updates.imageUrl !== undefined) {
      validateUrl(updates.imageUrl, 'account update');
    }

    if (updates.birthdate !== undefined) {
      validateBirthdate(updates.birthdate, 'account update');
    }

    if (updates.username !== undefined) {
      validateStringLength(updates.username, 'username', 'account update', 3, 30);
    }

    return this.httpClient.patch(`/${accountId}/account`, updates);
  }

  /**
   * Get account email
   * Returns the email data directly
   */
  async getAccountEmail(accountId: string): Promise<GetAccountEmailResponse> {
    validateAccountId(accountId, 'get account email');

    return this.httpClient.get(`/${accountId}/account/email`);
  }

  /**
   * Search for account by email
   * Returns the search result data directly
   */
  async searchAccount(email: string): Promise<SearchAccountResponse> {
    validateEmail(email, 'account search');

    return this.httpClient.get(`/account/search?email=${encodeURIComponent(email)}`);
  }
}
