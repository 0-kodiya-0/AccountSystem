import { Request, Response, NextFunction } from 'express';
import { JsonSuccess, BadRequestError, ApiErrorCode, Redirect } from '../../../types/response.types';
import { asyncHandler } from '../../../utils/response';
import { oauthMockService, MockAuthorizationRequest } from '../../../mocks/oauth/OAuthMockService';
import { GoogleMockProvider } from '../../../mocks/google/GoogleMockProvider';
import { OAuthProviders } from '../../account/Account.types';
import { logger } from '../../../utils/logger';

// ============================================================================
// Provider-Specific Handler Classes
// ============================================================================

abstract class BaseProviderHandler {
  abstract handleAuthorize(req: Request, res: Response, next: NextFunction, stateData: any): Promise<void>;
  abstract handleToken(req: Request, res: Response, next: NextFunction, provider: OAuthProviders): Promise<void>;
}

class GoogleProviderHandler extends BaseProviderHandler {
  private googleProvider: GoogleMockProvider;

  constructor() {
    super();
    this.googleProvider = new GoogleMockProvider(oauthMockService.getConfig());
  }

  async handleAuthorize(req: Request, res: Response, next: NextFunction, stateData: any): Promise<void> {
    const { client_id, response_type, scope, state, redirect_uri, login_hint } =
      req.query as Partial<MockAuthorizationRequest>;

    // Google-specific validation
    const validation = this.googleProvider.validateGoogleAuthorizationRequest({
      client_id: client_id!,
      response_type: response_type!,
      scope: scope!,
      state: state!,
      redirect_uri: redirect_uri!,
      login_hint,
    });

    if (!validation.valid) {
      return next(
        new Redirect(
          {
            error: 'invalid_request',
            error_description: validation.error!,
            state,
          },
          redirect_uri as string,
        ),
      );
    }

    const allAccounts = oauthMockService.getNonDefaultAccounts(OAuthProviders.Google);
    const account = this.googleProvider.selectGoogleAccount(allAccounts, login_hint, stateData.mockAccountEmail);

    if (!account) {
      return next(
        new Redirect(
          {
            error: 'server_error',
            error_description: 'No Google accounts available',
            state,
          },
          redirect_uri as string,
        ),
      );
    }

    // Google-specific status validation
    const statusCheck = this.googleProvider.validateGoogleAccountStatus(account);
    if (!statusCheck.valid) {
      return next(
        new Redirect(
          {
            error: 'access_denied',
            error_description: statusCheck.error!,
            state,
          },
          redirect_uri as string,
        ),
      );
    }

    // Check if account is blocked
    if (oauthMockService.isEmailBlocked(account.email)) {
      return next(
        new Redirect(
          {
            error: 'access_denied',
            error_description: 'Account is blocked',
            state,
          },
          redirect_uri as string,
        ),
      );
    }

    // Simulate Google-specific behavior
    try {
      await this.googleProvider.simulateGoogleBehavior(account.email);
    } catch (error) {
      return next(
        new Redirect(
          {
            error: 'server_error',
            error_description: error instanceof Error ? error.message : 'Unknown error',
            state,
          },
          redirect_uri as string,
        ),
      );
    }

    // Generate authorization code
    const authCode = oauthMockService.generateAuthorizationCode(state as string, account, OAuthProviders.Google);

    // Redirect with authorization code
    next(
      new Redirect(
        {
          code: authCode,
          state,
        },
        redirect_uri as string,
      ),
    );
  }

  async handleToken(req: Request, res: Response, next: NextFunction, provider: OAuthProviders): Promise<void> {
    const { grant_type, code, refresh_token } = req.body;

    if (grant_type === 'authorization_code') {
      // Exchange authorization code for tokens
      if (!code) {
        throw new BadRequestError('Missing authorization code', 400, ApiErrorCode.INVALID_REQUEST);
      }

      const result = oauthMockService.exchangeAuthorizationCode(code, provider);
      if (!result) {
        throw new BadRequestError('Invalid or expired authorization code', 400, ApiErrorCode.TOKEN_INVALID);
      }

      next(new JsonSuccess(result.tokens));
      return;
    } else if (grant_type === 'refresh_token') {
      // Refresh access token
      if (!refresh_token) {
        throw new BadRequestError('Missing refresh token', 400, ApiErrorCode.TOKEN_INVALID);
      }

      const tokens = oauthMockService.refreshAccessToken(refresh_token, provider);
      if (!tokens) {
        throw new BadRequestError('Invalid refresh token', 400, ApiErrorCode.TOKEN_INVALID);
      }

      next(new JsonSuccess(tokens));
      return;
    } else {
      throw new BadRequestError(
        'Only authorization_code and refresh_token grant types are supported',
        400,
        ApiErrorCode.INVALID_REQUEST,
      );
    }
  }
}

// ============================================================================
// Provider Handler Factory
// ============================================================================

function getProviderHandler(provider: OAuthProviders): BaseProviderHandler | null {
  switch (provider) {
    case OAuthProviders.Google:
      return new GoogleProviderHandler();
    case OAuthProviders.Microsoft:
      // TODO: Implement MicrosoftProviderHandler when needed
      return null;
    case OAuthProviders.Facebook:
      // TODO: Implement FacebookProviderHandler when needed
      return null;
    default:
      return null;
  }
}

// ============================================================================
// Generic OAuth Mock Controllers
// ============================================================================

/**
 * Generic OAuth Authorization Endpoint
 * GET /mock/oauth/:provider/authorize
 */
export const mockOAuthAuthorize = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!oauthMockService.isEnabled()) {
    throw new BadRequestError('OAuth mock is not enabled', 400, ApiErrorCode.INVALID_REQUEST);
  }

  const provider = req.params.provider as OAuthProviders;

  // Validate provider
  if (!oauthMockService.getSupportedProviders().includes(provider)) {
    throw new BadRequestError(`Unsupported OAuth provider: ${provider}`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  await oauthMockService.simulateDelay();

  const { state, redirect_uri, scope, login_hint } = req.query as Partial<MockAuthorizationRequest>;

  // Basic validation
  if (!state || !redirect_uri) {
    throw new BadRequestError('Missing required OAuth parameters', 400, ApiErrorCode.MISSING_DATA);
  }

  const config = oauthMockService.getConfig();

  if (config.logRequests) {
    logger.info('Mock OAuth authorization request received', {
      provider,
      state,
      scope,
      login_hint,
    });
  }

  // Get provider-specific handler
  const providerHandler = getProviderHandler(provider);
  if (!providerHandler) {
    return next(
      new Redirect(
        {
          error: 'server_error',
          error_description: 'Provider handler not available',
          state,
        },
        redirect_uri as string,
      ),
    );
  }

  // Delegate to provider-specific authorization logic
  return providerHandler.handleAuthorize(req, res, next, {});
});

/**
 * Generic OAuth Token Endpoint
 * POST /mock/oauth/:provider/token
 */
export const mockOAuthToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!oauthMockService.isEnabled()) {
    throw new BadRequestError('OAuth mock is not enabled', 400, ApiErrorCode.INVALID_REQUEST);
  }

  const provider = req.params.provider as OAuthProviders;

  // Validate provider
  if (!oauthMockService.getSupportedProviders().includes(provider)) {
    throw new BadRequestError(`Unsupported OAuth provider: ${provider}`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  await oauthMockService.simulateDelay();

  const { client_id, client_secret } = req.body;

  // Validate client credentials
  if (!oauthMockService.validateClientCredentials(client_id, client_secret, provider)) {
    throw new BadRequestError('Invalid client credentials', 401, ApiErrorCode.AUTH_FAILED);
  }

  // Get provider-specific handler
  const providerHandler = getProviderHandler(provider);
  if (!providerHandler) {
    throw new BadRequestError('Provider handler not available', 500, ApiErrorCode.SERVER_ERROR);
  }

  // Delegate to provider-specific logic
  return providerHandler.handleToken(req, res, next, provider);
});

/**
 * Generic OAuth UserInfo Endpoint
 * GET /mock/oauth/:provider/userinfo
 */
export const mockOAuthUserInfo = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!oauthMockService.isEnabled()) {
    throw new BadRequestError('OAuth mock is not enabled', 400, ApiErrorCode.INVALID_REQUEST);
  }

  const provider = req.params.provider as OAuthProviders;

  // Validate provider
  if (!oauthMockService.getSupportedProviders().includes(provider)) {
    throw new BadRequestError(`Unsupported OAuth provider: ${provider}`, 400, ApiErrorCode.INVALID_REQUEST);
  }

  await oauthMockService.simulateDelay();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new BadRequestError('Missing or invalid authorization header', 401, ApiErrorCode.AUTH_FAILED);
  }

  const accessToken = authHeader.substring(7);
  const userInfo = oauthMockService.getUserInfo(accessToken, provider);

  if (!userInfo) {
    throw new BadRequestError('Invalid access token', 401, ApiErrorCode.TOKEN_INVALID);
  }

  next(new JsonSuccess(userInfo));
});

/**
 * Generic OAuth TokenInfo Endpoint
 * GET /mock/oauth/:provider/tokeninfo
 */
export const mockOAuthTokenInfo = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!oauthMockService.isEnabled()) {
    throw new BadRequestError('OAuth mock is not enabled', 400, ApiErrorCode.INVALID_REQUEST);
  }

  const provider = req.params.provider as OAuthProviders;

  // Validate provider
  if (!oauthMockService.getSupportedProviders().includes(provider)) {
    throw new BadRequestError(`Unsupported OAuth provider: ${provider}`, 400, ApiErrorCode.INVALID_REQUEST);
  }

  await oauthMockService.simulateDelay();

  const { access_token } = req.query;

  if (!access_token) {
    throw new BadRequestError('Missing access_token parameter', 400, ApiErrorCode.MISSING_DATA);
  }

  const tokenInfo = oauthMockService.getTokenInfo(access_token as string, provider);

  if (!tokenInfo) {
    throw new BadRequestError('Invalid access token', 400, ApiErrorCode.TOKEN_INVALID);
  }

  next(new JsonSuccess(tokenInfo));
});

/**
 * Generic OAuth Revoke Endpoint
 * POST /mock/oauth/:provider/revoke
 */
export const mockOAuthRevoke = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!oauthMockService.isEnabled()) {
    throw new BadRequestError('OAuth mock is not enabled', 400, ApiErrorCode.INVALID_REQUEST);
  }

  const provider = req.params.provider as OAuthProviders;

  // Validate provider
  if (!oauthMockService.getSupportedProviders().includes(provider)) {
    throw new BadRequestError(`Unsupported OAuth provider: ${provider}`, 400, ApiErrorCode.INVALID_REQUEST);
  }

  await oauthMockService.simulateDelay();

  const { token } = req.body;

  if (!token) {
    throw new BadRequestError('Missing token parameter', 400, ApiErrorCode.MISSING_DATA);
  }

  const success = oauthMockService.revokeToken(token, provider);

  if (!success) {
    throw new BadRequestError('Invalid token', 400, ApiErrorCode.TOKEN_INVALID);
  }

  next(new JsonSuccess({ success: true }, 200, 'Token revoked successfully'));
});

/**
 * Get provider-specific information
 * GET /mock/oauth/:provider/info
 */
export const getProviderInfo = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const provider = req.params.provider as OAuthProviders;

  if (!oauthMockService.getSupportedProviders().includes(provider)) {
    throw new BadRequestError(`Unsupported OAuth provider: ${provider}`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  const accounts = oauthMockService.getAllMockAccounts(provider);
  const providerInstance = oauthMockService.getProvider(provider);

  let endpoints = {};
  if (provider === OAuthProviders.Google) {
    const googleProvider = new GoogleMockProvider(oauthMockService.getConfig());
    endpoints = googleProvider.getGoogleEndpoints();
  }

  next(
    new JsonSuccess({
      provider,
      accountCount: accounts.length,
      accounts: accounts.map((acc) => ({
        id: acc.id,
        email: acc.email,
        name: acc.name,
        status: acc.status,
        twoFactorEnabled: acc.twoFactorEnabled,
      })),
      endpoints,
      supported: !!providerInstance,
    }),
  );
});

// ============================================================================
// Management Controllers
// ============================================================================

/**
 * Get OAuth mock status and configuration
 * GET /mock/oauth/status
 */
export const getOAuthMockStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const stats = oauthMockService.getStats();

  next(
    new JsonSuccess({
      enabled: oauthMockService.isEnabled(),
      ...stats,
    }),
  );
});

/**
 * Clear OAuth mock cache
 * DELETE /mock/oauth/clear
 */
export const clearOAuthMockCache = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  oauthMockService.clearCaches();

  next(
    new JsonSuccess({
      message: 'OAuth mock cache cleared successfully',
    }),
  );
});

/**
 * Update OAuth mock configuration
 * POST /mock/oauth/config
 */
export const updateOAuthMockConfig = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  oauthMockService.refreshConfig();

  next(
    new JsonSuccess({
      message: 'OAuth mock configuration refreshed',
      config: oauthMockService.getConfig(),
    }),
  );
});
