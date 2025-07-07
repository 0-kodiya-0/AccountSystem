import { asyncHandler } from '../../utils/response';
import { JsonSuccess } from '../../types/response.types';
import * as SessionService from './session.service';
import { clearAllAccountsWithSession, getAccountSessionFromCookies } from './session.utils';

/**
 * Get current account session information (session data only)
 * This API will be called by frontend on mount to get session state
 */
export const getAccountSession = asyncHandler(async (req, res, next) => {
  const session = getAccountSessionFromCookies(req);
  const sessionInfo = await SessionService.getAccountSession(session);

  if (sessionInfo.missingAccountIds.length > 0) {
    clearAllAccountsWithSession(req, res, sessionInfo.missingAccountIds);
  }

  next(new JsonSuccess(sessionInfo, 200));
});

/**
 * Get account data for session account IDs
 * This should be called separately when account details are needed
 */
export const getSessionAccountsData = asyncHandler(async (req, res, next) => {
  const { accountIds } = req.query;
  const session = getAccountSessionFromCookies(req);
  const accountsData = await SessionService.getSessionAccountsData(session, accountIds as string[] | string);

  next(new JsonSuccess(accountsData, 200));
});

/**
 * Set current account in session
 */
export const setCurrentAccount = asyncHandler(async (req, res, next) => {
  const { accountId } = req.body;

  await SessionService.setCurrentAccountInSession(req, res, accountId);

  next(
    new JsonSuccess(
      {
        message: 'Current account updated successfully',
        currentAccountId: accountId,
      },
      200,
    ),
  );
});

/**
 * Add account to session (used after successful login/signup)
 */
export const addAccountToSession = asyncHandler(async (req, res, next) => {
  const { accountId, setAsCurrent = true } = req.body;

  await SessionService.addAccountToSession(req, res, accountId, setAsCurrent);

  next(
    new JsonSuccess(
      {
        message: 'Account added to session successfully',
        accountId,
      },
      200,
    ),
  );
});

/**
 * Remove account from session
 */
export const removeAccountFromSession = asyncHandler(async (req, res, next) => {
  const { accountId } = req.body;

  await SessionService.removeAccountFromSession(req, res, accountId);

  next(
    new JsonSuccess(
      {
        message: 'Account removed from session successfully',
        accountId,
      },
      200,
    ),
  );
});
