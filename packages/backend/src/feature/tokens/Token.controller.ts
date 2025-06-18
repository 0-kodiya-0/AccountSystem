import { asyncHandler } from '../../utils/response';
import { JsonSuccess, BadRequestError, ApiErrorCode, Redirect } from '../../types/response.types';
import { extractAccessToken, extractRefreshToken } from '../session/session.utils';
import { AccountDocument } from '../account/Account.model';
import * as TokenService from './Token.service';
import { validateTokenOwnership } from './Token.jwt';

/**
 * Get access token information for any account type
 * Route: GET /:accountId/tokens/info/access
 */
export const getAccessTokenInfo = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;

  // First try to get token from body, then from cookies
  let accessToken = req.body.token;
  if (!accessToken) {
    accessToken = extractAccessToken(req, accountId);
  }

  if (!accessToken) {
    throw new BadRequestError('Access token not found in body or cookies', 400, ApiErrorCode.TOKEN_INVALID);
  }

  const tokenInfo = TokenService.getTokenInfo(accessToken, false);

  // Verify token belongs to correct account
  if (tokenInfo.isValid && tokenInfo.accountId !== accountId) {
    throw new BadRequestError('Token does not belong to this account', 400, ApiErrorCode.TOKEN_INVALID);
  }

  next(new JsonSuccess(tokenInfo));
});

/**
 * Get refresh token information for any account type
 * Route: GET /:accountId/tokens/info/refresh
 */
export const getRefreshTokenInfo = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;

  // First try to get token from body, then from cookies
  let refreshToken = req.body.token;
  if (!refreshToken) {
    refreshToken = extractRefreshToken(req, accountId);
  }

  if (!refreshToken) {
    throw new BadRequestError('Refresh token not found in body or cookies', 400, ApiErrorCode.TOKEN_INVALID);
  }

  const tokenInfo = TokenService.getTokenInfo(refreshToken, true);

  // Verify token belongs to correct account
  if (tokenInfo.isValid && tokenInfo.accountId !== accountId) {
    throw new BadRequestError('Token does not belong to this account', 400, ApiErrorCode.TOKEN_INVALID);
  }

  next(new JsonSuccess(tokenInfo));
});

/**
 * Refresh access token for any account type
 * Route: POST /:accountId/tokens/refresh
 */
export const refreshAccessToken = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const { redirectUrl } = req.query;

  // Extract refresh token
  const refreshToken = req.refreshToken;
  if (!refreshToken) {
    throw new BadRequestError('Refresh token not found', 400, ApiErrorCode.TOKEN_INVALID);
  }

  // Use centralized refresh logic
  const result = await TokenService.refreshAccessToken(req, res, accountId, refreshToken);

  // Validate and determine redirect URL
  if (!redirectUrl) {
    throw new BadRequestError('Missing redirectUrl query parameter', 400, ApiErrorCode.MISSING_DATA);
  }

  next(new Redirect(result, redirectUrl as string));
});

/**
 * Revoke tokens for any account type
 * Route: POST /:accountId/tokens/revoke
 */
export const revokeTokens = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const account = req.account as AccountDocument;

  // Tokens are already extracted by middleware
  const accessToken = req.accessToken;
  const refreshToken = req.refreshToken;

  if (!accessToken && !refreshToken) {
    throw new BadRequestError('Access and refresh tokens are required', 400, ApiErrorCode.TOKEN_INVALID);
  }

  // Use centralized revocation logic
  const result = await TokenService.revokeTokens(req, res, accountId, account.accountType, accessToken, refreshToken);

  next(new JsonSuccess(result, undefined, 'Tokens revoked successfully'));
});

/**
 * Validate token ownership
 * Route: POST /:accountId/tokens/validate
 */
export const validateToken = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const { token, tokenType = 'access' } = req.body;

  if (!token) {
    throw new BadRequestError('Token is required', 400, ApiErrorCode.TOKEN_INVALID);
  }

  const isRefreshToken = tokenType === 'refresh';
  const tokenInfo = TokenService.getTokenInfo(token, isRefreshToken);

  const isOwner = validateTokenOwnership(token, accountId);

  next(
    new JsonSuccess({
      ...tokenInfo,
      isOwner,
      belongsToAccount: isOwner,
    }),
  );
});
