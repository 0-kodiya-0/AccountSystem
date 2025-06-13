import { NextFunction, Request, Response } from 'express';
import { JsonSuccess } from '../../types/response.types';
import { AccountDocument } from './Account.model';
import { asyncHandler } from '../../utils/response';
import * as AccountService from './Account.service';
import { clearAllAccountsWithSession, clearAccountWithSession } from '../../services';

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
 * Update account
 */
export const updateAccount = asyncHandler(async (req, res, next) => {
  const account = req.account as AccountDocument;
  const updates = req.body;

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

/**
 * Update account security settings
 */
export const updateAccountSecurity = asyncHandler(async (req, res, next) => {
  const securityUpdates = req.body;
  const account = req.account as AccountDocument;

  const updatedAccount = await AccountService.updateAccountSecurity(account, securityUpdates);

  next(new JsonSuccess(updatedAccount, 200));
});
