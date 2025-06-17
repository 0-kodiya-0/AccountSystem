import { NextFunction, Request, Response } from 'express';
import { JsonSuccess, BadRequestError, ApiErrorCode } from '../../types/response.types';
import { AccountDocument } from './Account.model';
import { asyncHandler } from '../../utils/response';
import * as AccountService from './Account.service';
import { clearAllAccountsWithSession, clearAccountWithSession } from '../session/session.utils';

/**
 * Search for an account by email
 */
export const searchAccount = asyncHandler(async (req, res, next) => {
  const email = req.query.email as string;

  const result = await AccountService.searchAccountByEmail(email);

  next(new JsonSuccess({ accountId: result?.id }, 200));
});

/**
 * Logout all accounts (clear entire session) - UPDATED with session integration
 */
export const logoutAll = (req: Request, res: Response, next: NextFunction) => {
  const { accountIds } = req.query;

  const accountIdArray = AccountService.validateAccountIds(accountIds as string[]);

  // Clear both auth tokens and account session
  clearAllAccountsWithSession(req, res, accountIdArray);

  // Redirect to auth callback with logout success code
  next(new JsonSuccess(null));
};

/**
 * Logout single account - UPDATED with session integration
 */
export const logout = (req: Request, res: Response, next: NextFunction) => {
  const { accountId, clearClientAccountState } = req.query;

  const validatedAccountId = AccountService.validateSingleAccountId(accountId as string);

  // Always clear from session and auth tokens
  clearAccountWithSession(req, res, validatedAccountId);

  const shouldClearClient = clearClientAccountState !== 'false';

  // Redirect to auth callback with appropriate logout code
  next(
    new JsonSuccess({
      message: shouldClearClient
        ? 'Account logged out successfully'
        : 'Account logged out and disabled for reactivation',
      accountId: validatedAccountId,
      clearClientAccountState: shouldClearClient,
    }),
  );
};

/**
 * Get account details
 */
export const getAccount = asyncHandler(async (req, res, next) => {
  const account = req.account as AccountDocument;
  const safeAccount = AccountService.convertToSafeAccount(account);

  next(new JsonSuccess(safeAccount, 200));
});

/**
 * Update account (only specific fields allowed)
 */
export const updateAccount = asyncHandler(async (req, res, next) => {
  const account = req.account as AccountDocument;
  const updates = req.body;

  // Validate that request body exists and is an object
  if (!updates || typeof updates !== 'object') {
    throw new BadRequestError('Request body must be a valid JSON object', 400, ApiErrorCode.INVALID_REQUEST);
  }

  // Define allowed fields
  const allowedFields = ['firstName', 'lastName', 'name', 'imageUrl', 'birthdate', 'username'];
  const providedFields = Object.keys(updates);

  // Check for invalid fields
  const invalidFields = providedFields.filter((field) => !allowedFields.includes(field));

  if (invalidFields.length > 0) {
    throw new BadRequestError(
      `Invalid fields provided: ${invalidFields.join(', ')}. Allowed fields: ${allowedFields.join(', ')}`,
      400,
      ApiErrorCode.INVALID_REQUEST,
    );
  }

  // Ensure at least one field is being updated
  if (providedFields.length === 0) {
    throw new BadRequestError('At least one field must be provided for update', 400, ApiErrorCode.INVALID_REQUEST);
  }

  const updatedAccount = await AccountService.updateAccount(account, updates);

  next(new JsonSuccess(updatedAccount, 200));
});

/**
 * Get email address for a specific account
 */
export const getAccountEmail = (req: Request, res: Response, next: NextFunction) => {
  const account = req.account as AccountDocument;
  const email = AccountService.getAccountEmail(account);

  next(new JsonSuccess({ email }, 200));
};
