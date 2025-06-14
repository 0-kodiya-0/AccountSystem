import { Response } from 'express';
import { ApiErrorCode, BadRequestError } from '../../types/response.types';
import { toSafeAccount } from './Account.utils';
import { clearAllSessions, clearSession } from '../session/session.utils';
import { AccountDocument } from './Account.model';
import { Account } from './Account.types';
import db from '../../config/db';
import { ValidationUtils } from '../../utils/validation';

/**
 * Search for an account by email
 */
export async function searchAccountByEmail(email: string) {
  ValidationUtils.validateEmail(email);

  const models = await db.getModels();
  const account = await models.accounts.Account.findOne({
    'userDetails.email': email,
  });

  if (!account) {
    throw new BadRequestError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  return toSafeAccount(account);
}

/**
 * Validate account IDs array
 */
export function validateAccountIds(accountIds: string[] | undefined | null): string[] {
  if (!Array.isArray(accountIds)) {
    throw new BadRequestError('Invalid format or undefined account ids');
  }
  return accountIds as string[];
}

/**
 * Validate single account ID
 */
export function validateSingleAccountId(accountId: string | undefined | null): string {
  if (!accountId) {
    throw new BadRequestError('Missing accountId');
  }
  return accountId as string;
}

/**
 * Clear all account sessions (delegates to session manager)
 */
export function clearAllAccountSessions(res: Response, accountIds: string[]): void {
  clearAllSessions(res, accountIds);
}

/**
 * Clear single account session (delegates to session manager)
 */
export function clearSingleAccountSession(res: Response, accountId: string): void {
  clearSession(res, accountId);
}

/**
 * Convert account document to safe account object
 */
export function convertToSafeAccount(account: AccountDocument) {
  return toSafeAccount(account);
}

/**
 * Update account
 */
export async function updateAccount(account: AccountDocument, updates: any) {
  // Apply updates to the account
  Object.assign(account, {
    ...updates,
    updated: new Date().toISOString(),
  });

  await account.save();

  return toSafeAccount(account);
}

/**
 * Get account email
 */
export function getAccountEmail(account: AccountDocument): string {
  return account.userDetails.email || '';
}

/**
 * Update account security settings
 */
export async function updateAccountSecurity(account: AccountDocument, securityUpdates: any) {
  // Update security settings (excluding sensitive fields)
  const allowedUpdates = {
    twoFactorEnabled: securityUpdates.twoFactorEnabled,
    sessionTimeout: securityUpdates.sessionTimeout,
    autoLock: securityUpdates.autoLock,
  };

  account.security = {
    ...account.security,
    ...allowedUpdates,
  };
  account.updated = new Date().toISOString();

  await account.save();

  return toSafeAccount(account);
}

/**
 * Find user by email (unified search)
 */
export const findUserByEmail = async (email: string): Promise<Account | null> => {
  const models = await db.getModels();

  const accountDoc = await models.accounts.Account.findOne({
    'userDetails.email': email,
  });

  if (accountDoc) {
    return { id: accountDoc._id.toHexString(), ...accountDoc.toObject() };
  }

  return null;
};

/**
 * Find user by ID (unified search)
 */
export const findUserById = async (id: string): Promise<Account | null> => {
  const models = await db.getModels();

  try {
    const accountDoc = await models.accounts.Account.findById(id);

    if (accountDoc) {
      return { id: accountDoc._id.toHexString(), ...accountDoc.toObject() };
    }
  } catch {
    // Invalid ID format
  }

  return null;
};
