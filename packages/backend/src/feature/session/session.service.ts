import { Request, Response } from 'express';
import {
  getAccountSessionFromCookies,
  addAccountToSession as addAccountToSessionManager,
  removeAccountFromSession as removeAccountFromSessionManager,
  setCurrentAccountInSession as setCurrentAccountInSessionManager,
  clearAccountSession,
  clearSession,
  setAccessTokenCookie,
} from './session.utils';
import { GetAccountSessionDataResponse, GetAccountSessionResponse } from './session.types';
import { ValidationUtils } from '../../utils/validation';
import { BadRequestError, ApiErrorCode } from '../../types/response.types';
import db from '../../config/db';
import { toSafeSessionAccount } from '../../feature/account/Account.utils';
import { logger } from '../../utils/logger';
import { AccountType } from '../account';
import { refreshGoogleToken, revokeTokens } from '../google/services/tokenInfo/tokenInfo.services';
import { createLocalJwtToken } from '../local_auth';
import { createOAuthJwtToken } from '../oauth/OAuth.jwt';

/**
 * Get account session information only
 * Returns session data and validates account IDs still exist in database
 * Automatically cleans up invalid accounts from session
 */
export async function getAccountSession(req: Request): Promise<GetAccountSessionResponse> {
  const session = getAccountSessionFromCookies(req);

  if (!session.hasSession || !session.isValid || session.accountIds.length === 0) {
    return {
      session: {
        hasSession: false,
        accountIds: [],
        currentAccountId: null,
        isValid: false,
      },
    };
  }

  try {
    // Only validate that account IDs still exist in database (no account data fetching)
    const models = await db.getModels();
    const existingAccountIds = await models.accounts.Account.find(
      { _id: { $in: session.accountIds } },
      { _id: 1 }, // Only fetch _id field for validation
    ).distinct('_id');

    const foundAccountIds: string[] = existingAccountIds.map((id) => id.toString());
    const missingAccountIds = session.accountIds.filter((id) => !foundAccountIds.includes(id));

    if (missingAccountIds.length > 0) {
      logger.warn('Some accounts in session no longer exist:', {
        missingAccountIds,
        originalAccountIds: session.accountIds,
        foundAccountIds,
      });

      // Clean up the session by removing missing accounts using existing function
      clearAccountSession(req, {} as Response, missingAccountIds);

      // Log the cleanup action
      logger.info('Session cleaned up - removed invalid accounts:', {
        removedAccountIds: missingAccountIds,
        remainingAccountIds: foundAccountIds,
      });
    }

    // Ensure current account is valid
    const validCurrentAccountId: string | null =
      session.currentAccountId && foundAccountIds.includes(session.currentAccountId)
        ? session.currentAccountId
        : foundAccountIds.length > 0
        ? foundAccountIds[0]
        : null;

    return {
      session: {
        hasSession: true,
        accountIds: foundAccountIds,
        currentAccountId: validCurrentAccountId,
        isValid: true,
      },
    };
  } catch (error) {
    logger.error('Error validating session account IDs:', error);

    return {
      session: {
        hasSession: true,
        accountIds: session.accountIds,
        currentAccountId: session.currentAccountId,
        isValid: false,
      },
    };
  }
}

/**
 * Get account details for session account IDs
 * This should be called separately when account data is needed
 */
export async function getSessionAccountsData(
  req: Request,
  accountIds?: string[],
): Promise<GetAccountSessionDataResponse> {
  const session = getAccountSessionFromCookies(req);

  if (accountIds && accountIds.length > 0) {
    accountIds = accountIds.filter((id) => session.accountIds.includes(id));
  } else {
    accountIds = session.accountIds;
  }

  try {
    const models = await db.getModels();
    const accountDocs = await models.accounts.Account.find({
      _id: { $in: accountIds },
    });

    // Convert to safe session account objects (minimal data only)
    const accounts = accountDocs.map((doc) => toSafeSessionAccount(doc)).filter((doc) => doc != null);

    return accounts;
  } catch (error) {
    logger.error('Error fetching session account data:', error);
    return [];
  }
}

/**
 * Add account to session
 */
export async function addAccountToSession(
  req: Request,
  res: Response,
  accountId: string,
  setAsCurrent: boolean = true,
): Promise<void> {
  ValidationUtils.validateObjectId(accountId, 'Account ID');

  // Verify account exists
  const models = await db.getModels();
  const account = await models.accounts.Account.findById(accountId);

  if (!account) {
    throw new BadRequestError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  addAccountToSessionManager(req, res, accountId, setAsCurrent);
}

/**
 * Remove account from session
 */
export async function removeAccountFromSession(req: Request, res: Response, accountId: string): Promise<void> {
  ValidationUtils.validateObjectId(accountId, 'Account ID');

  const session = getAccountSessionFromCookies(req);

  if (!session.accountIds.includes(accountId)) {
    throw new BadRequestError('Account not found in session', 400, ApiErrorCode.USER_NOT_FOUND);
  }

  removeAccountFromSessionManager(req, res, accountId);
}

/**
 * Set current account in session
 */
export async function setCurrentAccountInSession(req: Request, res: Response, accountId: string | null): Promise<void> {
  if (accountId) {
    ValidationUtils.validateObjectId(accountId, 'Account ID');

    const session = getAccountSessionFromCookies(req);

    if (!session.accountIds.includes(accountId)) {
      throw new BadRequestError('Account not found in session', 400, ApiErrorCode.USER_NOT_FOUND);
    }
  }

  setCurrentAccountInSessionManager(req, res, accountId);
}

/**
 * Clear entire account session
 */
export async function clearEntireAccountSession(req: Request, res: Response): Promise<void> {
  clearAccountSession(req, res);
}

/**
 * Remove specific accounts from session (for logout scenarios)
 */
export async function removeAccountsFromSession(req: Request, res: Response, accountIds: string[]): Promise<void> {
  accountIds.forEach((id) => ValidationUtils.validateObjectId(id, 'Account ID'));

  clearAccountSession(req, res, accountIds);
}

/**
 * Refresh an access token using a refresh token
 */
export const refreshOAuthAccessToken = async (
  req: Request,
  res: Response,
  accountId: string,
  oauthRefreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> => {
  try {
    const tokens = await refreshGoogleToken(oauthRefreshToken);

    if (!tokens.access_token || !tokens.expiry_date) {
      throw new Error('Failed to refresh Google access token');
    }

    const expiresIn = Math.floor(((tokens.expiry_date as number) - Date.now()) / 1000);

    const newJwtToken = await createOAuthJwtToken(accountId, tokens.access_token, expiresIn);

    setAccessTokenCookie(req, res, accountId, newJwtToken, expiresIn);

    return {
      accessToken: newJwtToken,
      expiresIn: expiresIn,
    };
  } catch {
    clearSession(res, accountId);

    // Throw clear error
    throw new BadRequestError(
      'Refresh token expired or invalid. Please sign in again.',
      401,
      ApiErrorCode.TOKEN_INVALID,
    );
  }
};

/**
 * Refresh an access token using a refresh token
 */
export const refreshLocalAccessToken = async (
  req: Request,
  res: Response,
  accountId: string,
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> => {
  try {
    const newAccessToken = await createLocalJwtToken(accountId);
    const expiresIn = 3600 * 1000; // 1 hour in milliseconds

    setAccessTokenCookie(req, res, accountId, newAccessToken, expiresIn);

    return {
      accessToken: newAccessToken,
      expiresIn,
    };
  } catch {
    clearSession(res, accountId);

    // Throw clear error
    throw new BadRequestError(
      'Refresh token expired or invalid. Please sign in again.',
      401,
      ApiErrorCode.TOKEN_INVALID,
    );
  }
};

/**
 * Revoke tokens based on account type
 */
export const revokeAuthTokens = async (
  accountId: string,
  accountType: AccountType,
  extractedAccessToken: string,
  extractedRefreshToken: string,
  res: Response,
): Promise<any> => {
  if (accountType === AccountType.OAuth) {
    const result = await revokeTokens(extractedAccessToken, extractedRefreshToken);
    clearSession(res, accountId);
    return result;
  } else {
    clearSession(res, accountId);
    return { accessTokenRevoked: true, refreshTokenRevoked: true };
  }
};
