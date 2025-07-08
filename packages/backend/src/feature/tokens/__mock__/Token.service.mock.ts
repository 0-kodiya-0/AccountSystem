// packages/backend/src/feature/tokens/__mock__/Token.service.mock.ts
import { Request, Response } from 'express';
import { BadRequestError, ApiErrorCode } from '../../../types/response.types';
import { ValidationUtils } from '../../../utils/validation';
import { AccountType } from '../../account/Account.types';
import {
  createLocalAccessToken,
  createLocalRefreshToken,
  createOAuthAccessToken,
  createOAuthRefreshToken,
  verifyToken,
  isTokenExpired,
} from '../Token.jwt';
import { setAccessTokenCookie, setRefreshTokenCookie } from '../../session/session.utils';
import { logger } from '../../../utils/logger';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../../config/env.config';
import {
  TokenMockStatusData,
  TokenCookieInfo,
  CreateTokenRequest,
  CreateTokenResponse,
  CreateTokenPairRequest,
  CreateTokenPairResponse,
  ValidateTokenResponse,
  CreateExpiredTokenRequest,
  CreateExpiredTokenResponse,
  CreateMalformedTokenRequest,
  CreateMalformedTokenResponse,
  ClearTokensResponse,
  GetTokenInfoResponse,
  BatchCreateTokensRequest,
  BatchCreateTokensResponse,
  BatchTokenResult,
} from './Token.types.mock';

export function getTokenMockStatusData(req: Request): TokenMockStatusData {
  const cookies = req.cookies;

  // Extract all token-related cookies
  const tokenCookies = Object.keys(cookies)
    .filter((key) => key.startsWith('access_token_') || key.startsWith('refresh_token_'))
    .reduce((acc, key) => {
      const token = cookies[key];
      let tokenInfo: TokenCookieInfo;

      try {
        const decoded = jwt.decode(token) as Record<string, unknown>;
        tokenInfo = {
          type: (decoded?.type as string) || 'unknown',
          accountId: (decoded?.sub as string) || 'unknown',
          isRefreshToken: Boolean(decoded?.isRefreshToken) || false,
          iat: decoded?.iat as number,
          exp: decoded?.exp as number,
          isExpired: decoded?.exp ? Date.now() >= (decoded.exp as number) * 1000 : false,
        };
      } catch {
        tokenInfo = {
          type: 'unknown',
          accountId: 'unknown',
          isRefreshToken: false,
          isExpired: true,
          error: 'Invalid token format',
        };
      }

      acc[key] = tokenInfo;
      return acc;
    }, {} as Record<string, TokenCookieInfo>);

  return {
    enabled: true,
    tokenCookies,
    tokenCount: Object.keys(tokenCookies).length,
  };
}

export function createMockAccessToken(req: Request, res: Response, data: CreateTokenRequest): CreateTokenResponse {
  const { accountId, accountType, expiresIn, oauthAccessToken, setCookie = false } = data;

  if (!accountId) {
    throw new BadRequestError('accountId is required', 400, ApiErrorCode.MISSING_DATA);
  }

  ValidationUtils.validateObjectId(accountId, 'Account ID');
  ValidationUtils.validateEnum(accountType, AccountType, 'Account Type');

  let token: string;

  if (accountType === AccountType.Local) {
    token = createLocalAccessToken(accountId, expiresIn);
  } else if (accountType === AccountType.OAuth) {
    if (!oauthAccessToken) {
      throw new BadRequestError('oauthAccessToken is required for OAuth accounts', 400, ApiErrorCode.MISSING_DATA);
    }
    token = createOAuthAccessToken(accountId, oauthAccessToken, expiresIn);
  } else {
    throw new BadRequestError('Invalid account type', 400, ApiErrorCode.INVALID_PARAMETERS);
  }

  // Optionally set as cookie
  if (setCookie) {
    const tokenExpiresIn = expiresIn ? expiresIn * 1000 : 3600 * 1000; // Default 1 hour
    setAccessTokenCookie(req, res, accountId, token, tokenExpiresIn);
  }

  logger.info('Mock access token created', { accountId, accountType, setCookie });

  return {
    message: 'Access token created successfully',
    token,
    accountId,
    accountType,
    setCookie,
    expiresIn,
  };
}

export function createMockRefreshToken(req: Request, res: Response, data: CreateTokenRequest): CreateTokenResponse {
  const { accountId, accountType, oauthRefreshToken, setCookie = false } = data;

  if (!accountId) {
    throw new BadRequestError('accountId is required', 400, ApiErrorCode.MISSING_DATA);
  }

  ValidationUtils.validateObjectId(accountId, 'Account ID');
  ValidationUtils.validateEnum(accountType, AccountType, 'Account Type');

  let token: string;

  if (accountType === AccountType.Local) {
    token = createLocalRefreshToken(accountId);
  } else if (accountType === AccountType.OAuth) {
    if (!oauthRefreshToken) {
      throw new BadRequestError('oauthRefreshToken is required for OAuth accounts', 400, ApiErrorCode.MISSING_DATA);
    }
    token = createOAuthRefreshToken(accountId, oauthRefreshToken);
  } else {
    throw new BadRequestError('Invalid account type', 400, ApiErrorCode.INVALID_PARAMETERS);
  }

  // Optionally set as cookie
  if (setCookie) {
    setRefreshTokenCookie(req, res, accountId, token);
  }

  logger.info('Mock refresh token created', { accountId, accountType, setCookie });

  return {
    message: 'Refresh token created successfully',
    token,
    accountId,
    accountType,
    setCookie,
  };
}

export function validateMockTokenData(token: string): ValidateTokenResponse {
  if (!token) {
    throw new BadRequestError('Token is required', 400, ApiErrorCode.MISSING_DATA);
  }

  try {
    const tokenInfo = verifyToken(token);
    const expired = isTokenExpired(token);

    return {
      valid: !expired,
      expired,
      tokenInfo,
      message: expired ? 'Token is expired' : 'Token is valid',
    };
  } catch (error) {
    return {
      valid: false,
      expired: true,
      error: error instanceof Error ? error.message : 'Invalid token',
      message: 'Token is invalid',
    };
  }
}

export function createMockTokenPair(
  req: Request,
  res: Response,
  data: CreateTokenPairRequest,
): CreateTokenPairResponse {
  const {
    accountId,
    accountType,
    accessTokenExpiresIn,
    oauthAccessToken,
    oauthRefreshToken,
    setCookies = false,
  } = data;

  if (!accountId) {
    throw new BadRequestError('accountId is required', 400, ApiErrorCode.MISSING_DATA);
  }

  ValidationUtils.validateObjectId(accountId, 'Account ID');
  ValidationUtils.validateEnum(accountType, AccountType, 'Account Type');

  let accessToken: string;
  let refreshToken: string;

  if (accountType === AccountType.Local) {
    accessToken = createLocalAccessToken(accountId, accessTokenExpiresIn);
    refreshToken = createLocalRefreshToken(accountId);
  } else if (accountType === AccountType.OAuth) {
    if (!oauthAccessToken || !oauthRefreshToken) {
      throw new BadRequestError(
        'oauthAccessToken and oauthRefreshToken are required for OAuth accounts',
        400,
        ApiErrorCode.MISSING_DATA,
      );
    }
    accessToken = createOAuthAccessToken(accountId, oauthAccessToken, accessTokenExpiresIn);
    refreshToken = createOAuthRefreshToken(accountId, oauthRefreshToken);
  } else {
    throw new BadRequestError('Invalid account type', 400, ApiErrorCode.INVALID_PARAMETERS);
  }

  // Optionally set as cookies
  if (setCookies) {
    const tokenExpiresIn = accessTokenExpiresIn ? accessTokenExpiresIn * 1000 : 3600 * 1000;
    setAccessTokenCookie(req, res, accountId, accessToken, tokenExpiresIn);
    setRefreshTokenCookie(req, res, accountId, refreshToken);
  }

  logger.info('Mock token pair created', { accountId, accountType, setCookies });

  return {
    message: 'Token pair created successfully',
    accessToken,
    refreshToken,
    accountId,
    accountType,
    setCookies,
  };
}

export function createExpiredMockToken(data: CreateExpiredTokenRequest): CreateExpiredTokenResponse {
  const { accountId, accountType, tokenType = 'access', pastSeconds = 3600 } = data;

  if (!accountId) {
    throw new BadRequestError('accountId is required', 400, ApiErrorCode.MISSING_DATA);
  }

  ValidationUtils.validateObjectId(accountId, 'Account ID');
  ValidationUtils.validateEnum(accountType, AccountType, 'Account Type');

  // Calculate past expiration time
  const pastExp = Math.floor(Date.now() / 1000) - pastSeconds;

  // Create token with custom expiration
  const payload = {
    sub: accountId,
    type: accountType,
    iat: Math.floor(Date.now() / 1000) - pastSeconds - 60, // Issued even earlier
    exp: pastExp,
    isRefreshToken: tokenType === 'refresh',
  };

  const token = jwt.sign(payload, getJwtSecret());

  logger.info('Mock expired token created', { accountId, accountType, tokenType, pastSeconds });

  return {
    message: 'Expired token created successfully',
    token,
    accountId,
    accountType,
    tokenType,
    expiredSeconds: pastSeconds,
  };
}

export function createMalformedMockToken(data: CreateMalformedTokenRequest): CreateMalformedTokenResponse {
  const { type = 'invalid_signature' } = data;

  let malformedToken: string;

  switch (type) {
    case 'invalid_signature': {
      const validToken = createLocalAccessToken('507f1f77bcf86cd799439011');
      malformedToken = validToken.slice(0, -10) + 'invalidSig';
      break;
    }
    case 'malformed_structure':
      malformedToken = 'not.a.valid.jwt.structure.at.all';
      break;
    case 'missing_parts':
      malformedToken = 'only-one-part';
      break;
    case 'empty_parts':
      malformedToken = '..';
      break;
    case 'invalid_json': {
      const header = btoa('{"typ":"JWT","alg":"HS256"}');
      const payload = btoa('invalid json here');
      const signature = 'signature';
      malformedToken = `${header}.${payload}.${signature}`;
      break;
    }
    default:
      throw new BadRequestError('Invalid malformation type', 400, ApiErrorCode.INVALID_PARAMETERS);
  }

  logger.info('Mock malformed token created', { type });

  return {
    message: 'Malformed token created successfully',
    token: malformedToken,
    type,
  };
}

export function clearMockTokensForAccount(req: Request, res: Response, accountId: string): ClearTokensResponse {
  if (!accountId) {
    throw new BadRequestError('accountId is required', 400, ApiErrorCode.MISSING_DATA);
  }

  ValidationUtils.validateObjectId(accountId, 'Account ID');

  // Clear access and refresh token cookies
  res.clearCookie(`access_token_${accountId}`);
  res.clearCookie(`refresh_token_${accountId}`);

  logger.info('Mock tokens cleared', { accountId });

  return {
    message: 'Tokens cleared successfully',
    accountId,
    cleared: ['access_token', 'refresh_token'],
  };
}

export function getMockTokenInfoForAccount(req: Request, accountId: string): GetTokenInfoResponse {
  if (!accountId) {
    throw new BadRequestError('accountId is required', 400, ApiErrorCode.MISSING_DATA);
  }

  ValidationUtils.validateObjectId(accountId, 'Account ID');

  const accessTokenCookie = req.cookies[`access_token_${accountId}`];
  const refreshTokenCookie = req.cookies[`refresh_token_${accountId}`];

  const tokenInfo: GetTokenInfoResponse = {
    accountId,
    accessToken: { present: false },
    refreshToken: { present: false },
  };

  if (accessTokenCookie) {
    try {
      const accessTokenInfo = verifyToken(accessTokenCookie);
      tokenInfo.accessToken = {
        present: true,
        valid: true,
        expired: isTokenExpired(accessTokenCookie),
        info: accessTokenInfo,
      };
    } catch (error) {
      tokenInfo.accessToken = {
        present: true,
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid token',
      };
    }
  } else {
    tokenInfo.accessToken = { present: false };
  }

  if (refreshTokenCookie) {
    try {
      const refreshTokenInfo = verifyToken(refreshTokenCookie);
      tokenInfo.refreshToken = {
        present: true,
        valid: true,
        expired: isTokenExpired(refreshTokenCookie),
        info: refreshTokenInfo,
      };
    } catch (error) {
      tokenInfo.refreshToken = {
        present: true,
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid token',
      };
    }
  } else {
    tokenInfo.refreshToken = { present: false };
  }

  return tokenInfo;
}

export function createBatchMockTokens(
  req: Request,
  res: Response,
  data: BatchCreateTokensRequest,
): BatchCreateTokensResponse {
  const { accounts, setCookies = false } = data;

  if (!accounts || !Array.isArray(accounts)) {
    throw new BadRequestError('accounts array is required', 400, ApiErrorCode.MISSING_DATA);
  }

  if (accounts.length > 10) {
    throw new BadRequestError('Cannot create tokens for more than 10 accounts', 400, ApiErrorCode.INVALID_PARAMETERS);
  }

  const results: BatchTokenResult[] = [];

  for (const account of accounts) {
    const { accountId, accountType, oauthAccessToken, oauthRefreshToken } = account;

    ValidationUtils.validateObjectId(accountId, 'Account ID');
    ValidationUtils.validateEnum(accountType, AccountType, 'Account Type');

    let accessToken: string;
    let refreshToken: string;

    if (accountType === AccountType.Local) {
      accessToken = createLocalAccessToken(accountId);
      refreshToken = createLocalRefreshToken(accountId);
    } else {
      if (!oauthAccessToken || !oauthRefreshToken) {
        results.push({
          accountId,
          success: false,
          error: 'OAuth tokens required for OAuth accounts',
        });
        continue;
      }
      accessToken = createOAuthAccessToken(accountId, oauthAccessToken);
      refreshToken = createOAuthRefreshToken(accountId, oauthRefreshToken);
    }

    if (setCookies) {
      setAccessTokenCookie(req, res, accountId, accessToken, 3600 * 1000);
      setRefreshTokenCookie(req, res, accountId, refreshToken);
    }

    results.push({
      accountId,
      accountType,
      success: true,
      accessToken,
      refreshToken,
    });
  }

  logger.info('Batch mock tokens created', { accountCount: accounts.length, setCookies });

  return {
    message: `Batch token creation completed`,
    results,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };
}
