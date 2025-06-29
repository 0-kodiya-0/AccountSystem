import { Request, Response, NextFunction } from 'express';
import { JsonSuccess, BadRequestError, ApiErrorCode } from '../../../types/response.types';
import { asyncHandler } from '../../../utils/response';
import { oauthMockService, MockAuthorizationRequest } from '../../../mocks/oauth/OAuthMockService';
import { GoogleMockProvider } from '../../../mocks/google/GoogleMockProvider';
import { OAuthProviders } from '../../account/Account.types';
import { logger } from '../../../utils/logger';

// ============================================================================
// Provider-Specific Handler Classes
// ============================================================================

abstract class BaseProviderHandler {
  abstract handleAuthorize(req: Request, res: Response, next: NextFunction, stateData: any): Promise<any>;
  abstract handleToken(req: Request, res: Response, next: NextFunction, provider: OAuthProviders): Promise<any>;
}

class GoogleProviderHandler extends BaseProviderHandler {
  private googleProvider: GoogleMockProvider;

  constructor() {
    super();
    this.googleProvider = new GoogleMockProvider(oauthMockService.getConfig());
  }

  async handleAuthorize(req: Request, res: Response, next: NextFunction, stateData: any): Promise<any> {
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
      const errorUrl = `${redirect_uri}?error=invalid_request&error_description=${encodeURIComponent(
        validation.error!,
      )}&state=${state}`;
      res.redirect(errorUrl);
      return;
    }

    // Google-specific account selection
    const allAccounts = oauthMockService.getAllMockAccounts(OAuthProviders.Google);
    const account = this.googleProvider.selectGoogleAccount(allAccounts, login_hint, stateData.mockAccountEmail);

    if (!account) {
      const errorUrl = `${redirect_uri}?error=server_error&error_description=No%20Google%20accounts%20available&state=${state}`;
      res.redirect(errorUrl);
      return;
    }

    // Google-specific status validation
    const statusCheck = this.googleProvider.validateGoogleAccountStatus(account);
    if (!statusCheck.valid) {
      const errorUrl = `${redirect_uri}?error=access_denied&error_description=${encodeURIComponent(
        statusCheck.error!,
      )}&state=${state}`;
      res.redirect(errorUrl);
      return;
    }

    // Check if account is blocked
    if (oauthMockService.isEmailBlocked(account.email)) {
      const errorUrl = `${redirect_uri}?error=access_denied&error_description=Account%20is%20blocked&state=${state}`;
      res.redirect(errorUrl);
      return;
    }

    // Simulate Google-specific behavior
    try {
      await this.googleProvider.simulateGoogleBehavior(account.email);
    } catch (error) {
      const errorUrl = `${redirect_uri}?error=server_error&error_description=${encodeURIComponent(
        error instanceof Error ? error.message : 'Unknown error',
      )}&state=${state}`;
      res.redirect(errorUrl);
      return;
    }

    // Generate authorization code
    const authCode = oauthMockService.generateAuthorizationCode(state as string, account, OAuthProviders.Google);

    // Redirect with authorization code
    const successUrl = `${redirect_uri}?code=${authCode}&state=${state}`;
    res.redirect(successUrl);
    return;
  }

  async handleToken(req: Request, res: Response, next: NextFunction, provider: OAuthProviders): Promise<any> {
    const { grant_type, code, client_id, client_secret, redirect_uri, refresh_token } = req.body;

    if (grant_type === 'authorization_code') {
      // Exchange authorization code for tokens
      if (!code) {
        res
          .status(400)
          .json(this.googleProvider.generateGoogleErrorResponse('invalid_request', 'Missing authorization code'));
        return;
      }

      const result = oauthMockService.exchangeAuthorizationCode(code, provider);
      if (!result) {
        res
          .status(400)
          .json(
            this.googleProvider.generateGoogleErrorResponse('invalid_grant', 'Invalid or expired authorization code'),
          );
        return;
      }

      res.json(result.tokens);
      return;
    } else if (grant_type === 'refresh_token') {
      // Refresh access token
      if (!refresh_token) {
        res
          .status(400)
          .json(this.googleProvider.generateGoogleErrorResponse('invalid_request', 'Missing refresh token'));
        return;
      }

      const tokens = oauthMockService.refreshAccessToken(refresh_token, provider);
      if (!tokens) {
        res.status(400).json(this.googleProvider.generateGoogleErrorResponse('invalid_grant', 'Invalid refresh token'));
        return;
      }

      res.json(tokens);
      return;
    } else {
      res
        .status(400)
        .json(
          this.googleProvider.generateGoogleErrorResponse(
            'unsupported_grant_type',
            'Only authorization_code and refresh_token grant types are supported',
          ),
        );
      return;
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
      // TODO: Implement MicrosoftProviderHandler
      return null;
    case OAuthProviders.Facebook:
      // TODO: Implement FacebookProviderHandler
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
 * GET /oauth-mock/:provider/authorize
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

  const {
    client_id,
    response_type,
    scope,
    state,
    redirect_uri,
    access_type,
    prompt,
    login_hint,
    include_granted_scopes,
  } = req.query as Partial<MockAuthorizationRequest>;

  // Validate required parameters
  if (!client_id || !response_type || !scope || !state || !redirect_uri) {
    throw new BadRequestError('Missing required OAuth parameters', 400, ApiErrorCode.MISSING_DATA);
  }

  // Validate response_type
  if (response_type !== 'code') {
    throw new BadRequestError('Unsupported response_type', 400, ApiErrorCode.INVALID_REQUEST);
  }

  // Get state data
  const stateData = oauthMockService.getOAuthState(state as string);
  if (!stateData) {
    throw new BadRequestError('Invalid or expired state parameter', 400, ApiErrorCode.INVALID_STATE);
  }

  // Validate provider matches state
  if (stateData.provider !== provider) {
    throw new BadRequestError('Provider mismatch in state', 400, ApiErrorCode.INVALID_STATE);
  }

  const config = oauthMockService.getConfig();

  // Check if we should simulate an error
  if (oauthMockService.shouldSimulateError(stateData.mockAccountEmail)) {
    const errorUrl = `${redirect_uri}?error=access_denied&error_description=User%20denied%20access&state=${state}`;
    return res.redirect(errorUrl);
  }

  if (config.logRequests) {
    logger.info('Mock OAuth authorization request received', {
      provider,
      state,
      authType: stateData.authType,
      mockAccountEmail: stateData.mockAccountEmail,
      scope,
      login_hint,
    });
  }

  // Get provider-specific handler
  const providerHandler = getProviderHandler(provider);
  if (!providerHandler) {
    const errorUrl = `${redirect_uri}?error=server_error&error_description=Provider%20handler%20not%20available&state=${state}`;
    return res.redirect(errorUrl);
  }

  // Delegate to provider-specific logic
  return providerHandler.handleAuthorize(req, res, next, stateData);
});

/**
 * Generic OAuth Token Endpoint
 * POST /oauth-mock/:provider/token
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

  const { grant_type, code, client_id, client_secret, redirect_uri, refresh_token } = req.body;

  // Validate client credentials
  if (!oauthMockService.validateClientCredentials(client_id, client_secret, provider)) {
    res.status(401).json({
      error: 'invalid_client',
      error_description: 'Invalid client credentials',
    });
    return;
  }

  // Get provider-specific handler
  const providerHandler = getProviderHandler(provider);
  if (!providerHandler) {
    res.status(500).json({
      error: 'server_error',
      error_description: 'Provider handler not available',
    });
    return;
  }

  // Delegate to provider-specific logic
  providerHandler.handleToken(req, res, next, provider);
  return;
});

/**
 * Generic OAuth UserInfo Endpoint
 * GET /oauth-mock/:provider/userinfo
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
    res.status(401).json({
      error: 'invalid_token',
      error_description: 'Missing or invalid authorization header',
    });
    return;
  }

  const accessToken = authHeader.substring(7);
  const userInfo = oauthMockService.getUserInfo(accessToken, provider);

  if (!userInfo) {
    res.status(401).json({
      error: 'invalid_token',
      error_description: 'Invalid access token',
    });
    return;
  }

  res.json(userInfo);
});

/**
 * Generic OAuth TokenInfo Endpoint
 * GET /oauth-mock/:provider/tokeninfo
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
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing access_token parameter',
    });
    return;
  }

  const tokenInfo = oauthMockService.getTokenInfo(access_token as string, provider);

  if (!tokenInfo) {
    res.status(400).json({
      error: 'invalid_token',
      error_description: 'Invalid access token',
    });
    return;
  }

  res.json(tokenInfo);
});

/**
 * Generic OAuth Revoke Endpoint
 * POST /oauth-mock/:provider/revoke
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
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing token parameter',
    });
    return;
  }

  const success = oauthMockService.revokeToken(token, provider);

  if (!success) {
    res.status(400).json({
      error: 'invalid_token',
      error_description: 'Invalid token',
    });
    return;
  }

  res.status(200).send('');
});

/**
 * Get provider-specific information
 * GET /oauth-mock/:provider/info
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
 * GET /oauth-mock/status
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
 * DELETE /oauth-mock/clear
 */
export const clearOAuthMockCache = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  oauthMockService.clearCache();

  next(
    new JsonSuccess({
      message: 'OAuth mock cache cleared successfully',
    }),
  );
});

/**
 * Update OAuth mock configuration
 * POST /oauth-mock/config
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

/**
 * Health check for email mock service
 * GET /oauth-mock/healthy
 */
export const healthCheck = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  next(
    new JsonSuccess({
      status: 'healthy',
      service: 'oauth-mock',
      enabled: oauthMockService.isEnabled(),
      configValid: true,
      timestamp: new Date().toISOString(),
    }),
  );
});
