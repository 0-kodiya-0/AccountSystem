import { asyncHandler } from '../../utils/response';
import { JsonSuccess, BadRequestError, ApiErrorCode } from '../../types/response.types';
import * as TokenInfoService from './tokenInfo.service';

/**
 * Get token information - validates token and returns useful details
 * Just pass the token and get back validity, expiration info, etc.
 */
export const getTokenInfo = asyncHandler(async (req, res, next) => {
  const { token } = req.body;

  if (!token) {
    throw new BadRequestError('Token is required in request body', 400, ApiErrorCode.MISSING_DATA);
  }

  const tokenInfo = await TokenInfoService.getTokenInformation(token);

  next(new JsonSuccess(tokenInfo, 200));
});

/**
 * Check if token is expired (simple endpoint)
 */
export const checkTokenExpiry = asyncHandler(async (req, res, next) => {
  const { token } = req.body;

  if (!token) {
    throw new BadRequestError('Token is required in request body', 400, ApiErrorCode.MISSING_DATA);
  }

  const isExpired = TokenInfoService.isTokenExpired(token);
  const timeRemaining = TokenInfoService.getTokenTimeRemaining(token);

  next(
    new JsonSuccess(
      {
        isExpired,
        timeRemaining,
        expiresAt: timeRemaining > 0 ? Date.now() + timeRemaining : null,
      },
      200,
    ),
  );
});
