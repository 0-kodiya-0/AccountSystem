import { ApiErrorCode, BadRequestError, ValidationError } from '../../types/response.types';
import { toSafeAccount } from './Account.utils';
import { AccountDocument } from './Account.model';
import { Account, AllowedAccountUpdates } from './Account.types';
import { getModels } from '../../config/db.config';
import { ValidationUtils } from '../../utils/validation';

/**
 * Search for an account by email
 */
export async function searchAccountByEmail(email: string) {
  ValidationUtils.validateEmail(email);

  const models = await getModels();
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
 * Convert account document to safe account object
 */
export function convertToSafeAccount(account: AccountDocument) {
  return toSafeAccount(account);
}

/**
 * Update account with only allowed fields (no nesting)
 */
export async function updateAccount(account: AccountDocument, updates: any): Promise<Account> {
  const allowedUpdates: AllowedAccountUpdates = {};

  // Validate and extract only allowed fields
  if (updates.firstName !== undefined) {
    ValidationUtils.validateStringLength(updates.firstName, 'First name', 1, 50);
    allowedUpdates.firstName = updates.firstName;
  }

  if (updates.lastName !== undefined) {
    ValidationUtils.validateStringLength(updates.lastName, 'Last name', 1, 50);
    allowedUpdates.lastName = updates.lastName;
  }

  if (updates.name !== undefined) {
    ValidationUtils.validateStringLength(updates.name, 'Name', 1, 100);
    allowedUpdates.name = updates.name;
  }

  if (updates.imageUrl !== undefined) {
    if (updates.imageUrl !== '' && updates.imageUrl !== null) {
      ValidationUtils.validateUrl(updates.imageUrl, 'Image URL');
    }
    allowedUpdates.imageUrl = updates.imageUrl;
  }

  if (updates.birthdate !== undefined) {
    // Basic date validation - should be in YYYY-MM-DD format
    if (updates.birthdate !== '' && updates.birthdate !== null) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(updates.birthdate)) {
        throw new ValidationError('Invalid birthdate format. Use YYYY-MM-DD', 400, ApiErrorCode.VALIDATION_ERROR);
      }
    }
    allowedUpdates.birthdate = updates.birthdate;
  }

  if (updates.username !== undefined) {
    if (updates.username !== '' && updates.username !== null) {
      ValidationUtils.validateStringLength(updates.username, 'Username', 3, 30);

      // Check if username is already taken by another account
      const models = await getModels();
      const existingAccount = await models.accounts.Account.findOne({
        'userDetails.username': updates.username,
        _id: { $ne: account._id },
      });

      if (existingAccount) {
        throw new ValidationError('Username is already taken', 400, ApiErrorCode.USER_EXISTS);
      }
    }
    allowedUpdates.username = updates.username;
  }

  // Check if there are any valid updates
  if (Object.keys(allowedUpdates).length === 0) {
    throw new BadRequestError('No valid fields provided for update', 400, ApiErrorCode.INVALID_REQUEST);
  }

  // Apply the allowed updates to userDetails
  account.userDetails = {
    ...account.userDetails,
    ...allowedUpdates,
  };

  account.updated = new Date().toISOString();
  await account.save();

  const result = toSafeAccount(account);
  if (!result) {
    throw new BadRequestError('Failed to update account', 500, ApiErrorCode.SERVER_ERROR);
  }

  return result;
}

/**
 * Get account email
 */
export function getAccountEmail(account: AccountDocument): string {
  return account.userDetails.email || '';
}

/**
 * Find user by email (unified search)
 */
export const findUserByEmail = async (email: string): Promise<Account | null> => {
  const models = await getModels();

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
  const models = await getModels();

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
