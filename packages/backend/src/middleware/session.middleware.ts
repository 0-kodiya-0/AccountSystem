import { Request, Response, NextFunction } from 'express';
import { ApiErrorCode, BadRequestError, NotFoundError, Redirect, ServerError } from '../types/response.types';
import db from '../config/db';
import { asyncHandler } from '../utils/response';
import { validateAccount } from '../feature/account/Account.validation';
import { extractAccessToken, extractRefreshToken } from '../feature/session/session.utils';
import { AccountType } from '../feature/account/Account.types';
import { AccountDocument } from '../feature/account/Account.model';
import { ValidationUtils } from '../utils/validation';
import { verifyAccessToken, verifyRefreshToken } from '../feature/tokens';

/**
 * Middleware to verify token from cookies and add accountId to request
 * Step 1: Basic session authentication - validates accountId parameter
 */
export const authenticateSession = (req: Request, res: Response, next: NextFunction) => {
  const accountId = req.params.accountId;

  // Use centralized validation instead of duplicate logic
  ValidationUtils.validateObjectId(accountId, 'Account ID');

  next();
};

/**
 * Middleware to validate access to a specific account
 * Step 2: Account access validation - loads and validates account
 * Now works with unified Account model
 */
export const validateAccountAccess = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;

  const models = await db.getModels();
  const account = await models.accounts.Account.findOne({ _id: accountId });

  if (!account) {
    throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  try {
    validateAccount(account);
  } catch {
    throw new ServerError('Invalid account object. Please contact system admins.');
  }

  // Attach the account to the request for downstream middleware/handlers
  req.account = account as AccountDocument;

  // Keep legacy properties for backward compatibility during transition
  if (account.accountType === AccountType.OAuth) {
    req.oauthAccount = account as AccountDocument;
  } else {
    req.localAccount = account as AccountDocument;
  }

  next();
});

/**
 * Middleware to validate token access
 * Step 3: Token validation - handles both access and refresh tokens with proper redirects
 * Now uses centralized auth token service
 */
export const validateTokenAccess = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const account = req.account as AccountDocument;

  if (!account) {
    throw new ServerError('Account not loaded in middleware chain');
  }

  const accessToken = extractAccessToken(req, accountId);
  const refreshToken = extractRefreshToken(req, accountId);
  const isRefreshTokenPath = req.path.endsWith('/refresh');

  const token: string | null = isRefreshTokenPath ? refreshToken : accessToken;

  try {
    if (!token) {
      if (isRefreshTokenPath) {
        throw new BadRequestError('Missing refresh token');
      } else {
        throw new Error('Token not found');
      }
    }

    // Use centralized token verification
    if (isRefreshTokenPath) {
      const refreshResult = verifyRefreshToken(token);

      // Check if token belongs to the right account
      if (refreshResult.accountId !== accountId) {
        throw new Error('Invalid refresh token for this account');
      }

      // Check account type matches
      if (refreshResult.accountType !== account.accountType) {
        throw new Error('Token account type mismatch');
      }

      req.refreshToken = token;

      // For OAuth refresh tokens, extract the OAuth refresh token
      if (refreshResult.accountType === AccountType.OAuth && refreshResult.oauthRefreshToken) {
        req.oauthRefreshToken = refreshResult.oauthRefreshToken;
      }
    } else {
      const accessResult = verifyAccessToken(token);

      // Check if token belongs to the right account
      if (accessResult.accountId !== accountId) {
        throw new Error('Invalid access token for this account');
      }

      // Check account type matches
      if (accessResult.accountType !== account.accountType) {
        throw new Error('Token account type mismatch');
      }

      req.accessToken = token;

      // For OAuth access tokens, extract the OAuth access token
      if (accessResult.accountType === AccountType.OAuth && accessResult.oauthAccessToken) {
        req.oauthAccessToken = accessResult.oauthAccessToken;
      }
    }

    next();
  } catch {
    const accountPath = account.id || account._id?.toHexString?.() || accountId;

    if (isRefreshTokenPath) {
      throw new Redirect(
        {
          code: ApiErrorCode.TOKEN_INVALID,
          message: 'Refresh token expired',
        },
        `./${accountPath}/account/logout?accountId=${accountPath}&clearClientAccountState=false`,
      );
    } else {
      // Determine correct refresh path - now unified
      const refreshPath = `./${accountPath}/tokens/refresh`;

      throw new Redirect(
        {
          code: ApiErrorCode.TOKEN_INVALID,
          message: 'Access token expired',
        },
        refreshPath,
        302,
        req.originalUrl, // Pass original URL for redirect after refresh
      );
    }
  }
});
