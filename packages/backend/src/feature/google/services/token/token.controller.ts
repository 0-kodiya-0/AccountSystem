import { ApiErrorCode, AuthError, JsonSuccess } from '../../../../types/response.types';
import { asyncHandler } from '../../../../utils/response';
import { getTokenInfo } from './token.services';
/**
 * Get token information for the current user
 * This endpoint retrieves detailed information about the token including granted scopes
 */
export const getTokenInfoController = asyncHandler(async (req, res, next) => {
  const accessToken = req.oauthAccessToken;

  if (!accessToken) {
    throw new AuthError('Access token not available', 401, ApiErrorCode.TOKEN_INVALID);
  }

  // Get token info and scopes using the service functions
  const tokenInfo = await getTokenInfo(accessToken);

  next(new JsonSuccess(tokenInfo));
});
