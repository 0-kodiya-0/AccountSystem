import { Request } from 'express';
import { OAuthProviders } from '../../account/Account.types';
import { oauthMockService, MockAuthorizationRequest } from '../../../mocks/oauth/OAuthMockService';
import { GoogleMockProvider } from '../../../mocks/google/GoogleMockProvider';
import { BadRequestError, ApiErrorCode } from '../../../types/response.types';
import { logger } from '../../../utils/logger';
import {
  OAuthAuthorizationResult,
  OAuthTokenRequest,
  OAuthUserInfoRequest,
  OAuthTokenInfoRequest,
  OAuthRevokeRequest,
  OAuthRevokeResponse,
  ProviderInfoResponse,
  OAuthMockStatusResponse,
  OAuthCacheResponse,
  OAuthConfigResponse,
} from './OAuth.types.mock';

// ============================================================================
// Provider-Specific Handler Classes
// ============================================================================

abstract class BaseProviderHandler {
  abstract handleAuthorize(stateData: Record<string, unknown>, req: Request): Promise<OAuthAuthorizationResult>;
  abstract handleToken(provider: OAuthProviders, body: OAuthTokenRequest): Promise<unknown>;
}

class GoogleProviderHandler extends BaseProviderHandler {
  private googleProvider: GoogleMockProvider;

  constructor() {
    super();
    this.googleProvider = new GoogleMockProvider(oauthMockService.getConfig());
  }

  async handleAuthorize(stateData: Record<string, unknown>, req: Request): Promise<OAuthAuthorizationResult> {
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
      return {
        success: false,
        error: {
          error: 'invalid_request',
          error_description: validation.error!,
          state,
          redirect_uri,
        },
      };
    }

    const allAccounts = oauthMockService.getNonDefaultAccounts(OAuthProviders.Google);
    const account = this.googleProvider.selectGoogleAccount(
      allAccounts,
      login_hint,
      stateData.mockAccountEmail as string,
    );

    if (!account) {
      return {
        success: false,
        error: {
          error: 'server_error',
          error_description: 'No Google accounts available',
          state,
          redirect_uri,
        },
      };
    }

    // Google-specific status validation
    const statusCheck = this.googleProvider.validateGoogleAccountStatus(account);
    if (!statusCheck.valid) {
      return {
        success: false,
        error: {
          error: 'access_denied',
          error_description: statusCheck.error!,
          state,
          redirect_uri,
        },
      };
    }

    // Check if account is blocked
    if (oauthMockService.isEmailBlocked(account.email)) {
      return {
        success: false,
        error: {
          error: 'access_denied',
          error_description: 'Account is blocked',
          state,
          redirect_uri,
        },
      };
    }

    // Simulate Google-specific behavior
    try {
      await this.googleProvider.simulateGoogleBehavior(account.email);
    } catch (error) {
      return {
        success: false,
        error: {
          error: 'server_error',
          error_description: error instanceof Error ? error.message : 'Unknown error',
          state,
          redirect_uri,
        },
      };
    }

    // Generate authorization code
    const authCode = oauthMockService.generateAuthorizationCode(state as string, account, OAuthProviders.Google);

    return {
      success: true,
      data: {
        code: authCode,
        state,
        redirect_uri,
      },
    };
  }

  async handleToken(provider: OAuthProviders, body: OAuthTokenRequest): Promise<unknown> {
    const { grant_type, code, refresh_token } = body;

    if (grant_type === 'authorization_code') {
      // Exchange authorization code for tokens
      if (!code) {
        throw new BadRequestError('Missing authorization code', 400, ApiErrorCode.INVALID_REQUEST);
      }

      const result = oauthMockService.exchangeAuthorizationCode(code, provider);
      if (!result) {
        throw new BadRequestError('Invalid or expired authorization code', 400, ApiErrorCode.TOKEN_INVALID);
      }

      return result.tokens;
    } else if (grant_type === 'refresh_token') {
      // Refresh access token
      if (!refresh_token) {
        throw new BadRequestError('Missing refresh token', 400, ApiErrorCode.TOKEN_INVALID);
      }

      const tokens = oauthMockService.refreshAccessToken(refresh_token, provider);
      if (!tokens) {
        throw new BadRequestError('Invalid refresh token', 400, ApiErrorCode.TOKEN_INVALID);
      }

      return tokens;
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
// OAuth Mock Service Functions
// ============================================================================

export async function handleOAuthAuthorization(req: Request): Promise<OAuthAuthorizationResult> {
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
    return {
      success: false,
      error: {
        error: 'server_error',
        error_description: 'Provider handler not available',
        state,
        redirect_uri,
      },
    };
  }

  // Delegate to provider-specific authorization logic
  return providerHandler.handleAuthorize({}, req);
}

export async function handleOAuthToken(req: Request): Promise<unknown> {
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
  return providerHandler.handleToken(provider, req.body as OAuthTokenRequest);
}

export async function getOAuthUserInfo(req: OAuthUserInfoRequest): Promise<unknown> {
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

  return userInfo;
}

export async function getOAuthTokenInfo(req: OAuthTokenInfoRequest): Promise<unknown> {
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

  return tokenInfo;
}

export async function revokeOAuthToken(req: Request): Promise<OAuthRevokeResponse> {
  if (!oauthMockService.isEnabled()) {
    throw new BadRequestError('OAuth mock is not enabled', 400, ApiErrorCode.INVALID_REQUEST);
  }

  const provider = req.params.provider as OAuthProviders;

  // Validate provider
  if (!oauthMockService.getSupportedProviders().includes(provider)) {
    throw new BadRequestError(`Unsupported OAuth provider: ${provider}`, 400, ApiErrorCode.INVALID_REQUEST);
  }

  await oauthMockService.simulateDelay();

  const { token } = req.body as OAuthRevokeRequest;

  if (!token) {
    throw new BadRequestError('Missing token parameter', 400, ApiErrorCode.MISSING_DATA);
  }

  const success = oauthMockService.revokeToken(token, provider);

  if (!success) {
    throw new BadRequestError('Invalid token', 400, ApiErrorCode.TOKEN_INVALID);
  }

  return { success: true };
}

export async function getProviderInformation(provider: OAuthProviders): Promise<ProviderInfoResponse> {
  if (!oauthMockService.getSupportedProviders().includes(provider)) {
    throw new BadRequestError(`Unsupported OAuth provider: ${provider}`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  const accounts = oauthMockService.getAllMockAccounts(provider);
  const providerInstance = oauthMockService.getProvider(provider);

  let endpoints: Record<string, unknown> = {};
  if (provider === OAuthProviders.Google) {
    const googleProvider = new GoogleMockProvider(oauthMockService.getConfig());
    endpoints = googleProvider.getGoogleEndpoints();
  }

  return {
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
  };
}

export function clearOAuthMockCache(): OAuthCacheResponse {
  oauthMockService.clearCaches();

  return {
    message: 'OAuth mock cache cleared successfully',
  };
}
