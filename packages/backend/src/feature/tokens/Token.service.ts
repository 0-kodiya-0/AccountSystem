import { Request, Response } from 'express';
import { AccountType } from '../account/Account.types';
import { ValidationUtils } from '../../utils/validation';
import { BadRequestError, AuthError, ApiErrorCode, ServerError } from '../../types/response.types';
import { refreshGoogleToken, revokeGoogleTokens } from '../google/services/tokenInfo/tokenInfo.services';
import { setAccessTokenCookie, clearAccountWithSession } from '../session/session.utils';
import { logger } from '../../utils/logger';
import { TokenInfo, RefreshTokenResult, TokenRevocationResult } from './Token.types';
import {
  verifyToken,
  verifyRefreshToken,
  verifyAccessToken,
  createLocalAccessToken,
  createOAuthAccessToken,
} from './Token.jwt';

// ============================================================================
// TOKEN INFORMATION
// ============================================================================

/**
 * Get token information without throwing errors
 */
export function getTokenInfo(token: string, isRefreshToken: boolean = false): TokenInfo {
  try {
    const result = verifyToken(token);

    // Check if token type matches expectation
    if (result.isRefreshToken !== isRefreshToken) {
      return {
        isExpired: false,
        isValid: false,
        type: getTokenTypeString(result.accountType, isRefreshToken),
        error: `Expected ${isRefreshToken ? 'refresh' : 'access'} token`,
      };
    }

    // Check if expired
    const isExpired = result.exp && Date.now() >= result.exp * 1000;

    const tokenInfo: TokenInfo = {
      isExpired: !!isExpired,
      isValid: !isExpired,
      type: getTokenTypeString(result.accountType, isRefreshToken),
      expiresAt: result.exp ? result.exp * 1000 : undefined,
      timeRemaining: result.exp ? Math.max(0, result.exp * 1000 - Date.now()) : undefined,
      accountId: result.accountId,
    };

    return tokenInfo;
  } catch (error) {
    return {
      isExpired: true,
      isValid: false,
      error: error instanceof Error ? error.message : 'Invalid token',
    };
  }
}

/**
 * Helper to get token type string
 */
function getTokenTypeString(accountType: AccountType, isRefreshToken: boolean): TokenInfo['type'] {
  if (accountType === AccountType.Local) {
    return isRefreshToken ? 'local_refresh_jwt' : 'local_jwt';
  } else if (accountType === AccountType.OAuth) {
    return isRefreshToken ? 'oauth_refresh_jwt' : 'oauth_jwt';
  } else {
    throw new ServerError('Invalid account type');
  }
}

// ============================================================================
// TOKEN REFRESH
// ============================================================================

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  req: Request,
  res: Response,
  accountId: string,
  refreshToken: string,
): Promise<RefreshTokenResult> {
  ValidationUtils.validateObjectId(accountId, 'Account ID');

  try {
    const refreshResult = verifyRefreshToken(refreshToken);

    // Verify token belongs to correct account
    if (refreshResult.accountId !== accountId) {
      throw new AuthError('Refresh token does not belong to this account', 401, ApiErrorCode.TOKEN_INVALID);
    }

    if (refreshResult.accountType === AccountType.Local) {
      return await refreshLocalAccessToken(req, res, accountId);
    } else if (refreshResult.accountType === AccountType.OAuth) {
      if (!refreshResult.oauthRefreshToken) {
        throw new AuthError('OAuth refresh token not found', 401, ApiErrorCode.TOKEN_INVALID);
      }
      return await refreshOAuthAccessToken(req, res, accountId, refreshResult.oauthRefreshToken);
    } else {
      throw new BadRequestError('Unsupported account type', 400, ApiErrorCode.INVALID_REQUEST);
    }
  } catch {
    clearAccountWithSession(req, res, accountId);
    throw new BadRequestError(
      'Refresh token expired or invalid. Please sign in again.',
      401,
      ApiErrorCode.TOKEN_INVALID,
    );
  }
}

/**
 * Refresh local access token
 */
async function refreshLocalAccessToken(req: Request, res: Response, accountId: string): Promise<RefreshTokenResult> {
  const newAccessToken = createLocalAccessToken(accountId);
  const expiresIn = 3600 * 1000; // 1 hour in milliseconds

  setAccessTokenCookie(req, res, accountId, newAccessToken, expiresIn);

  return {
    expiresIn,
  };
}

/**
 * Refresh OAuth access token
 */
async function refreshOAuthAccessToken(
  req: Request,
  res: Response,
  accountId: string,
  oauthRefreshToken: string,
): Promise<RefreshTokenResult> {
  const tokens = await refreshGoogleToken(oauthRefreshToken);

  if (!tokens.access_token || !tokens.expiry_date) {
    throw new AuthError('Failed to refresh Google access token', 401, ApiErrorCode.TOKEN_INVALID);
  }

  const expiresIn = Math.floor(((tokens.expiry_date as number) - Date.now()) / 1000);
  const newJwtToken = createOAuthAccessToken(accountId, tokens.access_token, expiresIn);

  setAccessTokenCookie(req, res, accountId, newJwtToken, expiresIn * 1000);

  return {
    expiresIn: expiresIn * 1000,
  };
}

// ============================================================================
// TOKEN REVOCATION
// ============================================================================

/**
 * Revoke tokens based on account type
 */
export async function revokeTokens(
  req: Request,
  res: Response,
  accountId: string,
  accountType: AccountType,
  accessToken?: string,
  refreshToken?: string,
): Promise<TokenRevocationResult> {
  ValidationUtils.validateObjectId(accountId, 'Account ID');

  if (accountType === AccountType.OAuth) {
    // For OAuth, we need to extract the actual OAuth tokens and revoke them with the provider
    try {
      const token = [];
      if (accessToken) {
        token.push(verifyAccessToken(accessToken).oauthAccessToken);
      }
      if (refreshToken) {
        token.push(verifyRefreshToken(refreshToken).oauthRefreshToken);
      }

      if (token.length <= 0) {
        throw new AuthError('OAuth tokens not found in JWT payload', 400, ApiErrorCode.TOKEN_INVALID);
      }

      const result = await revokeGoogleTokens(token);
      clearAccountWithSession(req, res, accountId);

      return {
        ...result,
        message: 'OAuth tokens revoked successfully',
      };
    } catch (error) {
      logger.error('Error revoking OAuth tokens:', error);
      clearAccountWithSession(req, res, accountId);

      return {
        totalTokens: 0,
        successfulRevocations: 0,
        failedRevocations: 0,
        message: 'Failed to revoke OAuth tokens, but session cleared',
      };
    }
  } else {
    // For local accounts, just clear the session (no external revocation needed)
    clearAccountWithSession(req, res, accountId);

    return {
      totalTokens: 0,
      successfulRevocations: 0,
      failedRevocations: 0,
      message: 'Local session cleared successfully',
    };
  }
}
