import { Request, Response, NextFunction } from 'express';
import { JsonSuccess, BadRequestError, ApiErrorCode } from '../../../types/response.types';
import { asyncHandler } from '../../../utils/response';
import { ValidationUtils } from '../../../utils/validation';
import {
  createAccountSessionToken,
  verifyAccountSessionToken,
  setAccountSessionCookie,
  clearAccountSession,
  getAccountSessionFromCookies,
} from '../session.utils';
import { AccountSessionData } from '../session.types';
import { logger } from '../../../utils/logger';

/**
 * Get session mock status and information
 * GET /mock/session/status
 */
export const getSessionMockStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentSession = getAccountSessionFromCookies(req);

  next(
    new JsonSuccess({
      enabled: true,
      currentSession,
      cookies: {
        hasAccountSession: !!req.cookies.account_session,
        sessionToken: req.cookies.account_session ? 'present' : 'missing',
      },
    }),
  );
});

/**
 * Create a mock session token
 * POST /mock/session/create
 */
export const createMockSessionToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { accountIds, currentAccountId } = req.body;

  if (!accountIds || !Array.isArray(accountIds)) {
    throw new BadRequestError('accountIds array is required', 400, ApiErrorCode.MISSING_DATA);
  }

  // Validate account IDs
  accountIds.forEach((id: string) => ValidationUtils.validateObjectId(id, 'Account ID'));

  if (currentAccountId) {
    ValidationUtils.validateObjectId(currentAccountId, 'Current Account ID');
    if (!accountIds.includes(currentAccountId)) {
      throw new BadRequestError('currentAccountId must be in accountIds array', 400, ApiErrorCode.INVALID_PARAMETERS);
    }
  }

  const sessionData: AccountSessionData = {
    accountIds,
    currentAccountId: currentAccountId || accountIds[0] || null,
  };

  // Create session token
  const token = createAccountSessionToken(sessionData);

  // Set cookie
  setAccountSessionCookie(req, res, sessionData);

  logger.info('Mock session token created', { accountIds, currentAccountId });

  next(
    new JsonSuccess({
      message: 'Session token created successfully',
      token,
      sessionData,
    }),
  );
});

/**
 * Update session token (add/remove accounts, change current account)
 * PUT /mock/session/update
 */
export const updateMockSessionToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { action, accountId, currentAccountId } = req.body;

  if (!action) {
    throw new BadRequestError('action is required (add, remove, setCurrent)', 400, ApiErrorCode.MISSING_DATA);
  }

  const currentSession = getAccountSessionFromCookies(req);

  if (!currentSession.hasSession) {
    throw new BadRequestError('No active session found', 400, ApiErrorCode.INVALID_REQUEST);
  }

  const newSessionData: AccountSessionData = {
    accountIds: [...currentSession.accountIds],
    currentAccountId: currentSession.currentAccountId,
  };

  switch (action) {
    case 'add':
      if (!accountId) {
        throw new BadRequestError('accountId is required for add action', 400, ApiErrorCode.MISSING_DATA);
      }
      ValidationUtils.validateObjectId(accountId, 'Account ID');

      if (!newSessionData.accountIds.includes(accountId)) {
        newSessionData.accountIds.push(accountId);
      }
      break;

    case 'remove':
      if (!accountId) {
        throw new BadRequestError('accountId is required for remove action', 400, ApiErrorCode.MISSING_DATA);
      }
      ValidationUtils.validateObjectId(accountId, 'Account ID');

      newSessionData.accountIds = newSessionData.accountIds.filter((id) => id !== accountId);

      // If removing current account, set to first remaining or null
      if (newSessionData.currentAccountId === accountId) {
        newSessionData.currentAccountId = newSessionData.accountIds.length > 0 ? newSessionData.accountIds[0] : null;
      }
      break;

    case 'setCurrent':
      if (!currentAccountId) {
        throw new BadRequestError('currentAccountId is required for setCurrent action', 400, ApiErrorCode.MISSING_DATA);
      }
      ValidationUtils.validateObjectId(currentAccountId, 'Current Account ID');

      if (!newSessionData.accountIds.includes(currentAccountId)) {
        throw new BadRequestError('currentAccountId must be in session accounts', 400, ApiErrorCode.INVALID_PARAMETERS);
      }

      newSessionData.currentAccountId = currentAccountId;
      break;

    default:
      throw new BadRequestError(
        'Invalid action. Must be: add, remove, setCurrent',
        400,
        ApiErrorCode.INVALID_PARAMETERS,
      );
  }

  // Create new session token
  const token = createAccountSessionToken(newSessionData);
  setAccountSessionCookie(req, res, newSessionData);

  logger.info('Mock session token updated', { action, accountId, currentAccountId, newSessionData });

  next(
    new JsonSuccess({
      message: `Session ${action} successful`,
      token,
      sessionData: newSessionData,
      action,
    }),
  );
});

/**
 * Validate session token
 * POST /mock/session/validate
 */
export const validateMockSessionToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { token } = req.body;

  if (!token) {
    throw new BadRequestError('Token is required', 400, ApiErrorCode.MISSING_DATA);
  }

  const sessionData = verifyAccountSessionToken(token);

  next(
    new JsonSuccess({
      valid: !!sessionData,
      sessionData,
      message: sessionData ? 'Token is valid' : 'Token is invalid or expired',
    }),
  );
});

/**
 * Clear session (remove session cookie)
 * DELETE /mock/session/clear
 */
export const clearMockSession = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  clearAccountSession(req, res);

  logger.info('Mock session cleared');

  next(
    new JsonSuccess({
      message: 'Session cleared successfully',
      cleared: true,
    }),
  );
});

/**
 * Generate multiple mock sessions for testing
 * POST /mock/session/generate
 */
export const generateMockSessions = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { count = 5, accountsPerSession = 3 } = req.body;

  if (count > 10) {
    throw new BadRequestError('Cannot generate more than 10 mock sessions', 400, ApiErrorCode.INVALID_PARAMETERS);
  }

  const sessions = [];

  for (let i = 0; i < count; i++) {
    const accountIds = [];
    for (let j = 0; j < accountsPerSession; j++) {
      accountIds.push(`mock_account_${i}_${j}_${Date.now()}`);
    }

    const sessionData: AccountSessionData = {
      accountIds,
      currentAccountId: accountIds[0],
    };

    const token = createAccountSessionToken(sessionData);

    sessions.push({
      token,
      sessionData,
    });
  }

  next(
    new JsonSuccess({
      message: `Generated ${count} mock sessions`,
      sessions,
      count: sessions.length,
    }),
  );
});

/**
 * Simulate session corruption/invalid states
 * POST /mock/session/corrupt
 */
export const corruptMockSession = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { type = 'malformed' } = req.body;

  let corruptToken: string;

  switch (type) {
    case 'malformed':
      corruptToken = 'malformed.jwt.token';
      break;
    case 'expired':
      // Create a token with past expiration
      corruptToken = createAccountSessionToken({
        accountIds: ['expired_account_123'],
        currentAccountId: 'expired_account_123',
      }).replace(/}/g, `,"exp":${Math.floor(Date.now() / 1000) - 3600}}`);
      break;
    case 'invalid_signature': {
      const validToken = createAccountSessionToken({
        accountIds: ['invalid_sig_account_123'],
        currentAccountId: 'invalid_sig_account_123',
      });
      corruptToken = validToken.slice(0, -10) + 'invalid123';
      break;
    }
    case 'empty':
      corruptToken = '';
      break;
    default:
      throw new BadRequestError('Invalid corruption type', 400, ApiErrorCode.INVALID_PARAMETERS);
  }

  res.cookie('account_session', corruptToken, {
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  logger.info('Mock session corrupted', { type, corruptToken: corruptToken.substring(0, 20) + '...' });

  next(
    new JsonSuccess({
      message: `Session corrupted with type: ${type}`,
      type,
      corruptedToken: corruptToken.substring(0, 20) + '...',
    }),
  );
});

/**
 * Get session statistics and information
 * GET /mock/session/info
 */
export const getSessionMockInfo = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const currentSession = getAccountSessionFromCookies(req);
  const cookies = req.cookies;

  // Extract all auth-related cookies
  const authCookies = Object.keys(cookies)
    .filter((key) => key.startsWith('access_token_') || key.startsWith('refresh_token_') || key === 'account_session')
    .reduce((acc, key) => {
      acc[key] = cookies[key] ? 'present' : 'missing';
      return acc;
    }, {} as Record<string, string>);

  next(
    new JsonSuccess({
      session: currentSession,
      authCookies,
      cookieCount: Object.keys(authCookies).length,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString(),
    }),
  );
});
