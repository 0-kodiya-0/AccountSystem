import { Request, Response, NextFunction } from 'express';
import { JsonSuccess, Redirect } from '../../../types/response.types';
import { asyncHandler } from '../../../utils/response';
import { OAuthProviders } from '../../account/Account.types';
import * as OAuthMockService from './OAuth.service.mock';

// ============================================================================
// Generic OAuth Mock Controllers
// ============================================================================

/**
 * Generic OAuth Authorization Endpoint
 * GET /mock/oauth/:provider/authorize
 */
export const mockOAuthAuthorize = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = await OAuthMockService.handleOAuthAuthorization(req);

  if (!result.success) {
    return next(new Redirect(result.error, result.error.redirect_uri));
  }

  // Redirect with authorization code
  next(new Redirect(result.data, result.data.redirect_uri));
});

/**
 * Generic OAuth Token Endpoint
 * POST /mock/oauth/:provider/token
 */
export const mockOAuthToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const tokens = await OAuthMockService.handleOAuthToken(req);
  next(new JsonSuccess(tokens));
});

/**
 * Generic OAuth UserInfo Endpoint
 * GET /mock/oauth/:provider/userinfo
 */
export const mockOAuthUserInfo = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userInfo = await OAuthMockService.getOAuthUserInfo(req);
  next(new JsonSuccess(userInfo));
});

/**
 * Generic OAuth TokenInfo Endpoint
 * GET /mock/oauth/:provider/tokeninfo
 */
export const mockOAuthTokenInfo = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const tokenInfo = await OAuthMockService.getOAuthTokenInfo(req);
  next(new JsonSuccess(tokenInfo));
});

/**
 * Generic OAuth Revoke Endpoint
 * POST /mock/oauth/:provider/revoke
 */
export const mockOAuthRevoke = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = await OAuthMockService.revokeOAuthToken(req);
  next(new JsonSuccess(result, 200, 'Token revoked successfully'));
});

/**
 * Get provider-specific information
 * GET /mock/oauth/:provider/info
 */
export const getProviderInfo = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const provider = req.params.provider as OAuthProviders;
  const providerInfo = await OAuthMockService.getProviderInformation(provider);
  next(new JsonSuccess(providerInfo));
});

// ============================================================================
// Management Controllers
// ============================================================================

/**
 * Clear OAuth mock cache
 * DELETE /mock/oauth/clear
 */
export const clearOAuthMockCache = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = OAuthMockService.clearOAuthMockCache();
  next(new JsonSuccess(result));
});
