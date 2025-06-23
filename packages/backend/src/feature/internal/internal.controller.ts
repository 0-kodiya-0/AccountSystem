import { NextFunction, Request, Response } from 'express';
import { JsonSuccess, NotFoundError, BadRequestError, ApiErrorCode } from '../../types/response.types';
import { ValidationUtils } from '../../utils/validation';
import { asyncHandler } from '../../utils/response';
import * as AccountService from '../account/Account.service';
import * as SessionService from '../session/session.service';
import * as TokenService from '../tokens/Token.service';
import { verifyAccessToken, verifyRefreshToken } from '../tokens/Token.jwt';
import { TokenVerificationResponse } from './internal.types';

/**
 * Verify and extract token information (unified for local and OAuth)
 * POST /internal/auth/verify-token
 * Body: { token: string, tokenType?: 'access' | 'refresh' }
 */
export const verifyAndExtractToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { token, tokenType = 'access' } = req.body;

  if (!token) {
    throw new BadRequestError('Token is required', 400, ApiErrorCode.TOKEN_INVALID);
  }

  let tokenData;

  if (tokenType === 'refresh') {
    tokenData = verifyRefreshToken(token);
  } else {
    tokenData = verifyAccessToken(token);
  }

  const response: TokenVerificationResponse = {
    valid: true,
    accountId: tokenData.accountId,
    accountType: tokenData.accountType,
    isRefreshToken: tokenData.isRefreshToken,
    expiresAt: tokenData.exp ? tokenData.exp * 1000 : undefined,
    // OAuth specific fields
    ...(tokenData.oauthAccessToken && { oauthAccessToken: tokenData.oauthAccessToken }),
    ...(tokenData.oauthRefreshToken && { oauthRefreshToken: tokenData.oauthRefreshToken }),
  };

  next(new JsonSuccess(response));
});

/**
 * Get token information without verification (safe info extraction)
 * POST /internal/auth/token-info
 * Body: { token: string, tokenType?: 'access' | 'refresh' }
 */
export const getTokenInfo = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { token, tokenType = 'access' } = req.body;

  if (!token) {
    throw new BadRequestError('Token is required', 400, ApiErrorCode.TOKEN_INVALID);
  }

  const tokenInfo = TokenService.getTokenInfo(token, tokenType === 'refresh');

  next(
    new JsonSuccess({
      tokenInfo,
      tokenType,
    }),
  );
});

/**
 * Find user by ID
 * GET /internal/users/:accountId
 */
export const getUserById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { accountId } = req.params;

  ValidationUtils.validateObjectId(accountId, 'Account ID');

  const user = await AccountService.findUserById(accountId);

  if (!user) {
    throw new NotFoundError('User not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  next(
    new JsonSuccess({
      user,
      accountId,
    }),
  );
});

/**
 * Find user by email
 * GET /internal/users/search/email/:email
 */
export const getUserByEmail = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.params;

  ValidationUtils.validateEmail(email);

  const user = await AccountService.findUserByEmail(email);

  if (!user) {
    throw new NotFoundError('User not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  next(
    new JsonSuccess({
      user,
      email,
    }),
  );
});

/**
 * Search user by email (query parameter version)
 * GET /internal/users/search?email=...
 */
export const searchUserByEmail = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.query;

  if (!email || typeof email !== 'string') {
    throw new BadRequestError('Email query parameter is required', 400, ApiErrorCode.MISSING_DATA);
  }

  ValidationUtils.validateEmail(email);

  const user = await AccountService.findUserByEmail(email);

  if (!user) {
    throw new NotFoundError('User not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  next(
    new JsonSuccess({
      user,
      email,
    }),
  );
});

/**
 * Validate user exists (lightweight check)
 * GET /internal/users/:accountId/exists
 */
export const checkUserExists = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { accountId } = req.params;

  ValidationUtils.validateObjectId(accountId, 'Account ID');

  const user = await AccountService.findUserById(accountId);

  next(
    new JsonSuccess({
      exists: !!user,
      accountId,
    }),
  );
});

/**
 * Get session information from request
 * POST /internal/session/info
 * Body: { sessionCookie?: string } or reads from cookies
 */
export const getSessionInfo = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // This will read from cookies automatically
  const sessionInfo = await SessionService.getAccountSession(req);

  next(
    new JsonSuccess({
      session: sessionInfo.session,
    }),
  );
});

/**
 * Get session accounts data
 * POST /internal/session/accounts
 * Body: { accountIds?: string[] } or reads from session
 */
export const getSessionAccountsData = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { accountIds } = req.body;

  const accountsData = await SessionService.getSessionAccountsData(req, accountIds);

  next(
    new JsonSuccess({
      accounts: accountsData,
      count: accountsData.length,
    }),
  );
});

/**
 * Validate session and extract information
 * POST /internal/session/validate
 * Body: { accountId?: string } - optional account ID to check if it's in session
 */
export const validateSession = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { accountId } = req.body;

  const sessionInfo = await SessionService.getAccountSession(req);

  let isAccountInSession = false;
  let isCurrentAccount = false;

  if (accountId) {
    ValidationUtils.validateObjectId(accountId, 'Account ID');
    isAccountInSession = sessionInfo.session.accountIds.includes(accountId);
    isCurrentAccount = sessionInfo.session.currentAccountId === accountId;
  }

  next(
    new JsonSuccess({
      session: sessionInfo.session,
      ...(accountId && {
        accountId,
        isAccountInSession,
        isCurrentAccount,
      }),
    }),
  );
});

/**
 * Health check endpoint
 * GET /internal/health
 */
export const healthCheck = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  next(
    new JsonSuccess({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: 'internal-api',
      services: {
        accounts: 'available',
        sessions: 'available',
        tokens: 'available',
      },
    }),
  );
});
