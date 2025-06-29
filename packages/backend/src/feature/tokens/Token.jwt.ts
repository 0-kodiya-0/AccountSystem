import jwt from 'jsonwebtoken';
import { getJwtSecret, getAccessTokenExpiry, getRefreshTokenExpiry } from '../../config/env.config';
import { AccountType } from '../account/Account.types';
import { ValidationUtils } from '../../utils/validation';
import { BadRequestError, AuthError, ApiErrorCode } from '../../types/response.types';
import {
  TokenPayload,
  LocalTokenPayload,
  OAuthTokenPayload,
  TokenVerificationResult,
  TokenCreationOptions,
} from './Token.types';

const JWT_SECRET = getJwtSecret();

// ============================================================================
// TOKEN CREATION
// ============================================================================

/**
 * Create access token for any account type
 */
export async function createAccessToken(options: TokenCreationOptions): Promise<string> {
  const { accountId, accountType, expiresIn, oauthAccessToken } = options;

  ValidationUtils.validateObjectId(accountId, 'Account ID');

  if (accountType === AccountType.Local) {
    return createLocalAccessToken(accountId, expiresIn);
  } else if (accountType === AccountType.OAuth) {
    if (!oauthAccessToken) {
      throw new BadRequestError('OAuth access token required for OAuth accounts', 400, ApiErrorCode.TOKEN_INVALID);
    }
    return createOAuthAccessToken(accountId, oauthAccessToken, expiresIn);
  } else {
    throw new BadRequestError('Unsupported account type', 400, ApiErrorCode.INVALID_REQUEST);
  }
}

/**
 * Create refresh token for any account type
 */
export async function createRefreshToken(options: TokenCreationOptions): Promise<string> {
  const { accountId, accountType, oauthRefreshToken } = options;

  ValidationUtils.validateObjectId(accountId, 'Account ID');

  if (accountType === AccountType.Local) {
    return createLocalRefreshToken(accountId);
  } else if (accountType === AccountType.OAuth) {
    if (!oauthRefreshToken) {
      throw new BadRequestError('OAuth refresh token required for OAuth accounts', 400, ApiErrorCode.TOKEN_INVALID);
    }
    return createOAuthRefreshToken(accountId, oauthRefreshToken);
  } else {
    throw new BadRequestError('Unsupported account type', 400, ApiErrorCode.INVALID_REQUEST);
  }
}

/**
 * Create local access token
 */
export function createLocalAccessToken(accountId: string, expiresIn?: number): string {
  ValidationUtils.validateObjectId(accountId, 'Account ID');

  const payload: LocalTokenPayload = {
    sub: accountId,
    type: AccountType.Local,
    iat: Math.floor(Date.now() / 1000),
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: expiresIn ? `${expiresIn}s` : getAccessTokenExpiry(),
  });
}

/**
 * Create local refresh token
 */
export function createLocalRefreshToken(accountId: string): string {
  ValidationUtils.validateObjectId(accountId, 'Account ID');

  const payload: LocalTokenPayload = {
    sub: accountId,
    type: AccountType.Local,
    isRefreshToken: true,
    iat: Math.floor(Date.now() / 1000),
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: getRefreshTokenExpiry(),
  });
}

/**
 * Create OAuth access token (wraps OAuth provider token)
 */
export function createOAuthAccessToken(accountId: string, oauthAccessToken: string, expiresIn?: number): string {
  ValidationUtils.validateObjectId(accountId, 'Account ID');

  if (!oauthAccessToken || !oauthAccessToken.trim()) {
    throw new BadRequestError('OAuth access token is required', 400, ApiErrorCode.TOKEN_INVALID);
  }

  const payload: OAuthTokenPayload = {
    sub: accountId,
    type: AccountType.OAuth,
    oauthAccessToken,
    iat: Math.floor(Date.now() / 1000),
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: expiresIn ? `${expiresIn}s` : getAccessTokenExpiry(),
  });
}

/**
 * Create OAuth refresh token (wraps OAuth provider refresh token)
 */
export function createOAuthRefreshToken(accountId: string, oauthRefreshToken: string): string {
  ValidationUtils.validateObjectId(accountId, 'Account ID');

  if (!oauthRefreshToken || !oauthRefreshToken.trim()) {
    throw new BadRequestError('OAuth refresh token is required', 400, ApiErrorCode.TOKEN_INVALID);
  }

  const payload: OAuthTokenPayload = {
    sub: accountId,
    type: AccountType.OAuth,
    oauthRefreshToken,
    isRefreshToken: true,
    iat: Math.floor(Date.now() / 1000),
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: getRefreshTokenExpiry(),
  });
}

// ============================================================================
// TOKEN VERIFICATION
// ============================================================================

/**
 * Verify any token type and return structured result
 */
export function verifyToken(token: string): TokenVerificationResult {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

    // Validate required fields are present
    if (!decoded.sub) {
      throw new AuthError('Token missing required field: sub', 401, ApiErrorCode.TOKEN_INVALID);
    }

    if (!decoded.type) {
      throw new AuthError('Token missing required field: type', 401, ApiErrorCode.TOKEN_INVALID);
    }

    // Validate account type is valid
    if (!Object.values(AccountType).includes(decoded.type)) {
      throw new AuthError('Invalid account type in token', 401, ApiErrorCode.TOKEN_INVALID);
    }

    const result: TokenVerificationResult = {
      accountId: decoded.sub,
      accountType: decoded.type,
      isRefreshToken: decoded.isRefreshToken || false,
      exp: decoded.exp,
    };

    // Add OAuth-specific fields if applicable
    if (decoded.type === AccountType.OAuth) {
      const oauthPayload = decoded as OAuthTokenPayload;
      if (oauthPayload.oauthAccessToken) {
        result.oauthAccessToken = oauthPayload.oauthAccessToken;
      }
      if (oauthPayload.oauthRefreshToken) {
        result.oauthRefreshToken = oauthPayload.oauthRefreshToken;
      }
    }

    return result;
  } catch (error) {
    // If it's already an AuthError, re-throw it
    if (error instanceof AuthError) {
      throw error;
    }

    // Preserve the original error message for JWT-specific errors
    const errorMessage =
      error instanceof Error
        ? error.message.charAt(0).toUpperCase() + error.message.slice(1)
        : 'Invalid or expired token';
    throw new AuthError(errorMessage, 401, ApiErrorCode.TOKEN_INVALID);
  }
}

/**
 * Verify access token specifically
 */
export function verifyAccessToken(token: string): TokenVerificationResult {
  const result = verifyToken(token);

  if (result.isRefreshToken) {
    throw new AuthError('Expected access token, got refresh token', 401, ApiErrorCode.TOKEN_INVALID);
  }

  return result;
}

/**
 * Verify refresh token specifically
 */
export function verifyRefreshToken(token: string): TokenVerificationResult {
  const result = verifyToken(token);

  if (!result.isRefreshToken) {
    throw new AuthError('Expected refresh token, got access token', 401, ApiErrorCode.TOKEN_INVALID);
  }

  return result;
}

// ============================================================================
// TOKEN VALIDATION HELPERS
// ============================================================================

/**
 * Validate token belongs to specific account
 */
export function validateTokenOwnership(token: string, expectedAccountId: string): boolean {
  try {
    const result = verifyToken(token);
    return result.accountId === expectedAccountId;
  } catch {
    return false;
  }
}

/**
 * Extract account ID from token without throwing
 */
export function extractAccountId(token: string): string | null {
  try {
    const result = verifyToken(token);
    return result.accountId;
  } catch {
    return null;
  }
}

/**
 * Check if token is expired without throwing
 */
export function isTokenExpired(token: string): boolean {
  try {
    const result = verifyToken(token);
    return result.exp ? Date.now() >= result.exp * 1000 : false;
  } catch {
    return true;
  }
}
