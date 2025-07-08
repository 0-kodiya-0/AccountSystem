import { Request, Response } from 'express';
import { BadRequestError, ApiErrorCode } from '../../../types/response.types';
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
import {
  SessionMockStatusData,
  CreateSessionRequest,
  CreateSessionResponse,
  UpdateSessionRequest,
  UpdateSessionResponse,
  ValidateSessionResponse,
  ClearSessionResponse,
  GenerateSessionsRequest,
  GenerateSessionsResponse,
  CorruptSessionRequest,
  CorruptSessionResponse,
  SessionMockInfoResponse,
} from './Session.types.mock';

export function getSessionMockStatusData(req: Request): SessionMockStatusData {
  const currentSession = getAccountSessionFromCookies(req);

  return {
    enabled: true,
    currentSession,
    cookies: {
      hasAccountSession: !!req.cookies.account_session,
      sessionToken: req.cookies.account_session ? 'present' : 'missing',
    },
  };
}

export function createMockSession(req: Request, res: Response, data: CreateSessionRequest): CreateSessionResponse {
  const { accountIds, currentAccountId } = data;

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

  return {
    message: 'Session token created successfully',
    token,
    sessionData,
  };
}

export function updateMockSession(req: Request, res: Response, data: UpdateSessionRequest): UpdateSessionResponse {
  const { action, accountId, currentAccountId } = data;

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

  return {
    message: `Session ${action} successful`,
    token,
    sessionData: newSessionData,
    action,
  };
}

export function validateMockSessionToken(token: string): ValidateSessionResponse {
  if (!token) {
    throw new BadRequestError('Token is required', 400, ApiErrorCode.MISSING_DATA);
  }

  const sessionData = verifyAccountSessionToken(token);

  return {
    valid: !!sessionData,
    sessionData,
    message: sessionData ? 'Token is valid' : 'Token is invalid or expired',
  };
}

export function clearMockSessionData(req: Request, res: Response): ClearSessionResponse {
  clearAccountSession(req, res);

  logger.info('Mock session cleared');

  return {
    message: 'Session cleared successfully',
    cleared: true,
  };
}

export function generateMockSessions(data: GenerateSessionsRequest): GenerateSessionsResponse {
  const { count = 5, accountsPerSession = 3 } = data;

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

  return {
    message: `Generated ${count} mock sessions`,
    sessions,
    count: sessions.length,
  };
}

export function corruptMockSessionData(
  req: Request,
  res: Response,
  data: CorruptSessionRequest,
): CorruptSessionResponse {
  const { type = 'malformed' } = data;

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

  return {
    message: `Session corrupted with type: ${type}`,
    type,
    corruptedToken: corruptToken.substring(0, 20) + '...',
  };
}

export function getSessionMockInfo(req: Request): SessionMockInfoResponse {
  const currentSession = getAccountSessionFromCookies(req);
  const cookies = req.cookies;

  // Extract all auth-related cookies
  const authCookies = Object.keys(cookies)
    .filter((key) => key.startsWith('access_token_') || key.startsWith('refresh_token_') || key === 'account_session')
    .reduce((acc, key) => {
      acc[key] = cookies[key] ? 'present' : 'missing';
      return acc;
    }, {} as Record<string, string>);

  return {
    session: currentSession,
    authCookies,
    cookieCount: Object.keys(authCookies).length,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString(),
  };
}
