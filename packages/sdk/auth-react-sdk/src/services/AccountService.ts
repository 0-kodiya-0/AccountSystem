import { Account, AccountUpdateRequest } from '../types';
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

const validateUrl = (url: string | null | undefined, context: string): void => {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    throw new Error(`Valid URL is required for ${context}`);
  }

  try {
    new URL(url);
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
  if (!value || typeof value !== 'string') {
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
  if (!birthdate || typeof birthdate !== 'string') {
    throw new Error(`Birthdate must be a string for ${context}`);
  }

  // Validate YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(birthdate)) {
    throw new Error(`Invalid birthdate format for ${context}. Use YYYY-MM-DD format`);
  }

  // Additional date validation
  const date = new Date(birthdate);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid birthdate for ${context}`);
  }

  // Check if date is not in the future
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

  async getAccount(accountId: string): Promise<Account> {
    validateAccountId(accountId, 'get account');

    return this.httpClient.get(`/${accountId}/account`);
  }

  /**
   * Update account with direct field access (no nested userDetails)
   * Only allows specific fields: firstName, lastName, name, imageUrl, birthdate, username
   */
  async updateAccount(accountId: string, updates: AccountUpdateRequest): Promise<Account> {
    validateAccountId(accountId, 'account update');
    validateRequired(updates, 'account updates', 'account update');

    // Validate that at least one allowed field is present
    const allowedFields = ['firstName', 'lastName', 'name', 'imageUrl', 'birthdate', 'username'];
    const providedFields = Object.keys(updates);
    const validFields = providedFields.filter((field) => allowedFields.includes(field));

    if (validFields.length === 0) {
      throw new Error(
        `At least one valid field must be provided for account update. Allowed fields: ${allowedFields.join(', ')}`,
      );
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
      if (updates.imageUrl !== '' && updates.imageUrl !== null) {
        validateUrl(updates.imageUrl, 'account update');
      }
    }

    if (updates.birthdate !== undefined) {
      if (updates.birthdate !== '' && updates.birthdate !== null) {
        validateBirthdate(updates.birthdate, 'account update');
      }
    }

    if (updates.username !== undefined) {
      if (updates.username !== '' && updates.username !== null) {
        validateStringLength(updates.username, 'username', 'account update', 3, 30);
      }
    }

    // Check for invalid fields
    const invalidFields = providedFields.filter((field) => !allowedFields.includes(field));
    if (invalidFields.length > 0) {
      throw new Error(
        `Invalid fields provided: ${invalidFields.join(', ')}. Only these fields can be updated: ${allowedFields.join(', ')}`,
      );
    }

    return this.httpClient.patch(`/${accountId}/account`, updates);
  }

  async getAccountEmail(accountId: string): Promise<{ email: string }> {
    validateAccountId(accountId, 'get account email');

    return this.httpClient.get(`/${accountId}/account/email`);
  }

  async searchAccount(email: string): Promise<{ accountId?: string }> {
    validateEmail(email, 'account search');

    return this.httpClient.get(`/account/search?email=${encodeURIComponent(email)}`);
  }
}
