import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import {
  getJwtSecret,
  getNodeEnv, // BUILD_REMOVE
} from '../../config/env.config';
import { getStrippedPathPrefix } from '../../utils/redirect';
import { AccountSessionData, AccountSessionTokenPayload, AccountSessionInfo } from './session.types';
import { logger } from '../../utils/logger';

// Environment variables
const JWT_SECRET = getJwtSecret();
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
const ACCOUNT_SESSION_COOKIE_NAME = 'account_session';

// ============================================================================
// ACCOUNT SESSION TOKEN MANAGEMENT
// ============================================================================

/**
 * Create a non-expiring account session token
 */
export function createAccountSessionToken(sessionData: AccountSessionData): string {
  const payload: AccountSessionTokenPayload = {
    ...sessionData,
    iat: Math.floor(Date.now() / 1000),
  };

  // Create token without expiration
  return jwt.sign(payload, JWT_SECRET);
}

/**
 * Verify and decode account session token
 */
export function verifyAccountSessionToken(token: string): AccountSessionData | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AccountSessionTokenPayload;

    return {
      accountIds: decoded.accountIds || [],
      currentAccountId: decoded.currentAccountId || null,
    };
  } catch (error) {
    logger.warn('Invalid account session token:', error);
    return null;
  }
}

/**
 * Set account session cookie
 */
export function setAccountSessionCookie(req: Request, res: Response, sessionData: AccountSessionData): void {
  const token = createAccountSessionToken(sessionData);

  logger.info('Setting account session cookie', {
    accountIds: sessionData.accountIds,
    currentAccountId: sessionData.currentAccountId,
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  res.cookie(ACCOUNT_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: /* BUILD_REMOVE_START */ !(getNodeEnv() === 'production') ? false : /* BUILD_REMOVE_END */ true,
    path: '/', // Set at root path as requested
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
  });

  logger.info('Account session cookie set', {
    accountIds: sessionData.accountIds,
    currentAccountId: sessionData.currentAccountId,
  });
}

/**
 * Get account session from cookies
 */
export function getAccountSessionFromCookies(req: Request): AccountSessionInfo {
  const token = req.cookies[ACCOUNT_SESSION_COOKIE_NAME];

  if (!token) {
    return {
      hasSession: false,
      accountIds: [],
      currentAccountId: null,
      isValid: false,
    };
  }

  const sessionData = verifyAccountSessionToken(token);

  if (!sessionData) {
    return {
      hasSession: true,
      accountIds: [],
      currentAccountId: null,
      isValid: false,
    };
  }

  return {
    hasSession: true,
    accountIds: sessionData.accountIds,
    currentAccountId: sessionData.currentAccountId,
    isValid: true,
  };
}

/**
 * Update account session - add account
 */
export function addAccountToSession(
  req: Request,
  res: Response,
  accountId: string,
  setAsCurrent: boolean = true,
): void {
  const currentSession = getAccountSessionFromCookies(req);

  const newAccountIds = currentSession.accountIds.includes(accountId)
    ? currentSession.accountIds
    : [...currentSession.accountIds, accountId];

  const newSessionData: AccountSessionData = {
    accountIds: newAccountIds,
    currentAccountId: setAsCurrent ? accountId : currentSession.currentAccountId,
  };

  setAccountSessionCookie(req, res, newSessionData);
}

/**
 * Update account session - remove account
 */
export function removeAccountFromSession(req: Request, res: Response, accountId: string): void {
  const currentSession = getAccountSessionFromCookies(req);

  const newAccountIds = currentSession.accountIds.filter((id) => id !== accountId);

  // If removing current account, switch to first remaining account or null
  const newCurrentAccountId =
    currentSession.currentAccountId === accountId
      ? newAccountIds.length > 0
        ? newAccountIds[0]
        : null
      : currentSession.currentAccountId;

  const newSessionData: AccountSessionData = {
    accountIds: newAccountIds,
    currentAccountId: newCurrentAccountId,
  };

  setAccountSessionCookie(req, res, newSessionData);
}

/**
 * Update account session - set current account
 */
export function setCurrentAccountInSession(req: Request, res: Response, accountId: string | null): void {
  const currentSession = getAccountSessionFromCookies(req);

  // If setting a specific account, ensure it's in the accounts list
  if (accountId && !currentSession.accountIds.includes(accountId)) {
    throw new Error(`Account ${accountId} not found in session`);
  }

  const newSessionData: AccountSessionData = {
    accountIds: currentSession.accountIds,
    currentAccountId: accountId,
  };

  setAccountSessionCookie(req, res, newSessionData);
}

/**
 * Clear account session completely
 */
export function clearAccountSession(req: Request, res: Response, accountIds?: string[]): void {
  if (accountIds && accountIds.length > 0) {
    // Remove specific accounts
    const currentSession = getAccountSessionFromCookies(req);
    const remainingAccountIds = currentSession.accountIds.filter((id) => !accountIds.includes(id));

    const newCurrentAccountId = accountIds.includes(currentSession.currentAccountId || '')
      ? remainingAccountIds.length > 0
        ? remainingAccountIds[0]
        : null
      : currentSession.currentAccountId;

    const newSessionData: AccountSessionData = {
      accountIds: remainingAccountIds,
      currentAccountId: newCurrentAccountId,
    };

    setAccountSessionCookie(req, res, newSessionData);
  } else {
    // Clear entire session
    res.clearCookie(ACCOUNT_SESSION_COOKIE_NAME, { path: '/' });
    logger.info('Account session cleared completely');
  }
}

/**
 * Extract account session token from request
 */
export function extractAccountSessionToken(req: Request): string | null {
  return req.cookies[ACCOUNT_SESSION_COOKIE_NAME] || null;
}

// ============================================================================
// AUTH TOKEN MANAGEMENT
// ============================================================================

/**
 * Sets the access token as a cookie for a specific account
 */
export const setAccessTokenCookie = (
  req: Request,
  res: Response,
  accountId: string,
  accessToken: string,
  expiresIn: number,
): void => {
  res.cookie(`access_token_${accountId}`, accessToken, {
    httpOnly: true,
    secure: /* BUILD_REMOVE_START */ !(getNodeEnv() === 'production') ? false : /* BUILD_REMOVE_END */ true,
    maxAge: expiresIn,
    path: `${getStrippedPathPrefix(req)}/${accountId}`,
    sameSite: 'lax',
  });
};

/**
 * Sets the refresh token as a cookie for a specific account
 */
export const setRefreshTokenCookie = (req: Request, res: Response, accountId: string, refreshToken: string): void => {
  res.cookie(`refresh_token_${accountId}`, refreshToken, {
    httpOnly: true,
    secure: /* BUILD_REMOVE_START */ !(getNodeEnv() === 'production') ? false : /* BUILD_REMOVE_END */ true,
    maxAge: COOKIE_MAX_AGE,
    path: `${getStrippedPathPrefix(req)}/${accountId}/tokens/refresh`,
    sameSite: 'lax',
  });
};

/**
 * Complete account session setup - sets both auth cookies and account session
 */
export const setupCompleteAccountSession = (
  req: Request,
  res: Response,
  accountId: string,
  accessToken: string,
  expiresIn: number,
  refreshToken?: string,
  setAsCurrent: boolean = true,
): void => {
  // Set authentication cookies
  setAccessTokenCookie(req, res, accountId, accessToken, expiresIn);

  if (refreshToken) {
    setRefreshTokenCookie(req, res, accountId, refreshToken);
  }

  // Add account to session
  addAccountToSession(req, res, accountId, setAsCurrent);
};

/**
 * Extract access token from cookies or authorization header
 */
export const extractAccessToken = (req: Request, accountId: string): string | null => {
  const cookieToken = req.cookies[`access_token_${accountId}`];
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
};

/**
 * Extract refresh token from cookies
 */
export const extractRefreshToken = (req: Request, accountId: string): string | null => {
  return req.cookies[`refresh_token_${accountId}`] || null;
};

/**
 * Clear all session data for multiple accounts
 */
export const clearAllSessions = (req: Request, res: Response, accountIds: string[]) => {
  // Clear auth cookies
  accountIds.forEach((accountId) => {
    res.clearCookie(`access_token_${accountId}`, { path: `${getStrippedPathPrefix(req)}/${accountId}` });
    res.clearCookie(`refresh_token_${accountId}`, {
      path: `${getStrippedPathPrefix(req)}/${accountId}/tokens/refresh`,
    });
  });
};

/**
 * Clear session data for a specific account
 */
export const clearSession = (req: Request, res: Response, accountId: string) => {
  res.clearCookie(`access_token_${accountId}`, { path: `${getStrippedPathPrefix(req)}/${accountId}` });
  res.clearCookie(`refresh_token_${accountId}`, {
    path: `${getStrippedPathPrefix(req)}/${accountId}/tokens/refresh`,
  });
};

/**
 * Clear account session and auth tokens - with account session integration
 */
export const clearAccountWithSession = (req: Request, res: Response, accountId: string): void => {
  // Clear auth cookies
  clearSession(req, res, accountId);

  // Remove from account session
  removeAccountFromSession(req, res, accountId);
};

/**
 * Clear all accounts session and auth tokens - with account session integration
 */
export const clearAllAccountsWithSession = (req: Request, res: Response, accountIds: string[]): void => {
  // Clear auth cookies
  clearAllSessions(req, res, accountIds);

  // Clear from account session
  clearAccountSession(req, res, accountIds);
};
