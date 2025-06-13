import {
  ApiErrorCode,
  BadRequestError,
  CallbackCode,
  CallbackData,
  JsonSuccess,
  NotFoundError,
  Redirect,
} from '../../types/response.types';
import * as AuthService from './OAuth.service';
import { AuthType, OAuthState, PermissionState } from './OAuth.types';
import { AccountType, OAuthProviders } from '../account/Account.types';
import { validateOAuthState, validatePermissionState, validateState } from './OAuth.validation';
import { generateOAuthState, generatePermissionState } from './OAuth.utils';
import {
  exchangeGoogleCode,
  getGoogleTokenInfo,
  verifyTokenOwnership,
} from '../google/services/tokenInfo/tokenInfo.services';
import { extractAccessToken, extractRefreshToken, setupCompleteAccountSession } from '../session/session.utils';
import { getCallbackUrl } from '../../utils/redirect';
import { ValidationUtils } from '../../utils/validation';
import { buildGoogleScopeUrls, validateScopeNames } from '../google/config';
import { asyncHandler, oauthCallbackHandler } from '../../utils/response';
import { logger } from '../../utils/logger';
import {
  createOAuthJwtToken,
  createOAuthRefreshToken,
  verifyOAuthJwtToken,
  verifyOAuthRefreshToken,
} from './OAuth.jwt';
import { getBaseUrl } from '../../config/env.config';
import {
  buildGoogleSignupUrl,
  buildGoogleSigninUrl,
  buildGooglePermissionUrl,
  buildGoogleReauthorizeUrl,
} from '../google/config';
import { AccountDocument } from '../account';
import { refreshOAuthAccessToken, revokeAuthTokens } from '../session/session.service';

/**
 * Generate OAuth signup URL
 */
export const generateSignupUrl = asyncHandler(async (req, res, next) => {
  const provider = ValidationUtils.validateEnum(req.params.provider, OAuthProviders, 'OAuth provider');

  // Check if provider is implemented (only Google currently)
  if (provider !== OAuthProviders.Google) {
    throw new BadRequestError(`Provider ${provider} is not implemented yet`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  // Generate state for signup
  const state = await generateOAuthState(provider, AuthType.SIGN_UP);

  let authorizationUrl: string;

  // Build authorization URL based on provider
  switch (provider) {
    case OAuthProviders.Google:
      authorizationUrl = buildGoogleSignupUrl(state);
      break;

    default:
      throw new BadRequestError(`Provider ${provider} not implemented`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  logger.info(`Generated signup URL for provider: ${provider}`);

  next(
    new JsonSuccess({
      authorizationUrl,
      state,
      provider,
      authType: 'signup',
    }),
  );
});

/**
 * Generate OAuth signin URL
 */
export const generateSigninUrl = asyncHandler(async (req, res, next) => {
  const provider = ValidationUtils.validateEnum(req.params.provider, OAuthProviders, 'OAuth provider');

  // Check if provider is implemented (only Google currently)
  if (provider !== OAuthProviders.Google) {
    throw new BadRequestError(`Provider ${provider} is not implemented yet`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  // Generate state for signin
  const state = await generateOAuthState(provider, AuthType.SIGN_IN);

  let authorizationUrl: string;

  // Build authorization URL based on provider
  switch (provider) {
    case OAuthProviders.Google:
      authorizationUrl = buildGoogleSigninUrl(state);
      break;

    default:
      throw new BadRequestError(`Provider ${provider} not implemented`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  logger.info(`Generated signin URL for provider: ${provider}`);

  next(
    new JsonSuccess({
      authorizationUrl,
      state,
      provider,
      authType: 'signin',
    }),
  );
});

/**
 * Handle OAuth callback from provider
 */
export const handleOAuthCallback = oauthCallbackHandler(
  getCallbackUrl(),
  CallbackCode.OAUTH_ERROR,
  async (req, res, next) => {
    const provider = ValidationUtils.validateEnum(req.params.provider, OAuthProviders, 'OAuth provider');

    // Check if provider is implemented (only Google currently)
    if (provider !== OAuthProviders.Google) {
      throw new BadRequestError(`Provider ${provider} is not implemented yet`, 400, ApiErrorCode.INVALID_PROVIDER);
    }

    const { code, state } = req.body;

    ValidationUtils.validateRequiredFields(req.body, ['code', 'state']);

    // Validate the state parameter and get OAuth state details
    const stateDetails = (await validateState(
      state,
      (state) => validateOAuthState(state, provider), // Fix: Don't use stateDetails.provider before it's defined
      res,
    )) as OAuthState;

    // Exchange authorization code for tokens based on provider
    let tokens;
    let userInfo;

    switch (stateDetails.provider) {
      case OAuthProviders.Google: {
        // Fix: Pass the correct redirect URI based on auth type
        const redirectUri =
          stateDetails.authType === AuthType.SIGN_UP
            ? `${getBaseUrl()}/oauth/callback/signup`
            : `${getBaseUrl()}/oauth/callback/signin`;
        ({ tokens, userInfo } = await exchangeGoogleCode(code, redirectUri));
        break;
      }

      default:
        throw new BadRequestError(
          `Provider ${stateDetails.provider} exchange not implemented`,
          400,
          ApiErrorCode.INVALID_PROVIDER,
        );
    }

    // Fix: Ensure userInfo has required fields for ProviderResponse
    const providerResponse = {
      email: userInfo.email || '',
      name: userInfo.name || '',
      imageUrl: userInfo.imageUrl || '',
      tokenDetails: tokens,
      provider: stateDetails.provider,
    };

    // Process the OAuth response based on auth type (signup vs signin)
    await AuthService.processSignInSignupCallback(providerResponse, stateDetails);

    if (stateDetails.authType === AuthType.SIGN_UP) {
      // Process signup
      const signupResult = await AuthService.processSignup(
        {
          ...stateDetails,
          oAuthResponse: providerResponse,
        },
        stateDetails.provider,
      );

      // Set up account session
      if (signupResult.accessTokenInfo && signupResult.accessTokenInfo.expires_in) {
        setupCompleteAccountSession(
          req,
          res,
          signupResult.accountId,
          AccountType.OAuth,
          signupResult.accessToken,
          signupResult.accessTokenInfo.expires_in * 1000,
          signupResult.refreshToken,
          true, // set as current account
        );
      }

      logger.info(`OAuth signup successful for provider: ${stateDetails.provider}`);

      const callbackData: CallbackData = {
        code: CallbackCode.OAUTH_SIGNUP_SUCCESS,
        accountId: signupResult.accountId,
        name: signupResult.name,
        provider: stateDetails.provider,
      };

      next(new Redirect(callbackData, getCallbackUrl()));
    } else {
      // Process signin
      const signinResult = await AuthService.processSignIn({
        ...stateDetails,
        oAuthResponse: providerResponse,
      });

      // Set up account session
      if (signinResult.accessTokenInfo && signinResult.accessTokenInfo.expires_in) {
        setupCompleteAccountSession(
          req,
          res,
          signinResult.userId,
          AccountType.OAuth,
          signinResult.accessToken,
          signinResult.accessTokenInfo.expires_in * 1000,
          signinResult.refreshToken,
          true, // set as current account
        );
      }

      logger.info(`OAuth signin successful for provider: ${stateDetails.provider}`);

      const callbackData: CallbackData = {
        code: CallbackCode.OAUTH_SIGNIN_SUCCESS,
        accountId: signinResult.userId,
        name: signinResult.userName,
        provider: stateDetails.provider,
        needsAdditionalScopes: signinResult.needsAdditionalScopes,
        missingScopes: signinResult.missingScopes,
      };

      next(new Redirect(callbackData, getCallbackUrl()));
    }
  },
);

/**
 * Handle permission code exchange
 */
export const handlePermissionCallback = oauthCallbackHandler(
  getCallbackUrl(),
  CallbackCode.PERMISSION_ERROR,
  async (req, res, next) => {
    const { code, state } = req.body;

    ValidationUtils.validateRequiredFields(req.body, ['code', 'state']);

    // Validate the state parameter
    const permissionDetails = (await validateState(
      state,
      (state) => validatePermissionState(state, OAuthProviders.Google),
      res,
    )) as PermissionState;

    const { accountId, service, scopeLevel } = permissionDetails;

    // Use existing Google code exchange function
    const redirectUri = `${getBaseUrl()}/oauth/callback/permission`;
    const { tokens } = await exchangeGoogleCode(code, redirectUri); // Fix: Remove unused userInfo

    // Verify user account exists
    const exists = await AuthService.checkUserExists(accountId);
    if (!exists) {
      throw new NotFoundError('User record not found in database', 404, ApiErrorCode.USER_NOT_FOUND);
    }

    // Fix: Ensure accessToken is not null/undefined
    if (!tokens.accessToken) {
      throw new BadRequestError('Missing access token from OAuth response', 400, ApiErrorCode.TOKEN_INVALID);
    }

    // Verify that the token belongs to the correct user account
    const tokenVerification = await verifyTokenOwnership(tokens.accessToken, accountId);
    if (!tokenVerification.isValid) {
      throw new BadRequestError(
        'Permission was granted with an incorrect account. Please try again and ensure you use the correct Google account.',
        400,
        ApiErrorCode.AUTH_FAILED,
      );
    }

    // Get token info for expiration details
    const accessTokenInfo = await getGoogleTokenInfo(tokens.accessToken);
    if (!accessTokenInfo.expires_in) {
      throw new BadRequestError('Failed to fetch token information', 400, ApiErrorCode.TOKEN_INVALID);
    }

    // Update tokens and scopes in database
    await AuthService.updateTokensAndScopes(accountId, tokens.accessToken);

    // Create JWT tokens for our system
    const jwtAccessToken = await createOAuthJwtToken(accountId, tokens.accessToken, accessTokenInfo.expires_in);

    // Fix: Ensure refreshToken is not null/undefined
    if (!tokens.refreshToken) {
      throw new BadRequestError('Missing refresh token from OAuth response', 400, ApiErrorCode.TOKEN_INVALID);
    }

    const jwtRefreshToken = await createOAuthRefreshToken(accountId, tokens.refreshToken);

    // Set up complete account session (auth cookies + account session)
    setupCompleteAccountSession(
      req,
      res,
      accountId,
      AccountType.OAuth,
      jwtAccessToken,
      accessTokenInfo.expires_in * 1000,
      jwtRefreshToken,
      false, // don't set as current account for permission updates
    );

    logger.info(`Permission tokens exchanged successfully for account ${accountId}`);

    const callbackData: CallbackData = {
      code: CallbackCode.OAUTH_PERMISSION_SUCCESS,
      accountId,
      service,
      scopeLevel,
      provider: OAuthProviders.Google,
      message: `Successfully granted ${service} ${scopeLevel} permissions`,
    };

    next(new Redirect(callbackData, getCallbackUrl()));
  },
);

/**
 * Generate permission request URL
 */
export const generatePermissionUrl = asyncHandler(async (req, res, next) => {
  const requestedScopeNames = req.query.scopeNames as string;
  const { accountId } = req.query;

  const provider = ValidationUtils.validateEnum(req.params.provider, OAuthProviders, 'OAuth provider');

  // Check if provider is implemented (only Google currently)
  if (provider !== OAuthProviders.Google) {
    throw new BadRequestError(`Provider ${provider} is not implemented yet`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  ValidationUtils.validateRequiredFields(req.query, ['accountId']);
  ValidationUtils.validateObjectId(accountId as string, 'Account ID');

  // Get user account information
  const account = await AuthService.getUserAccount(accountId as string);

  if (!account || !account.userDetails.email) {
    throw new NotFoundError('Account not found or missing email', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  const userEmail = account.userDetails.email;

  // Parse scope names - support both single scope and comma-separated scope names
  let scopeNames: string[];

  try {
    // Try to parse as JSON array first
    scopeNames = JSON.parse(requestedScopeNames);
    if (!Array.isArray(scopeNames)) {
      throw new Error('Not an array');
    }
  } catch {
    // Fall back to comma-separated string
    scopeNames = requestedScopeNames.split(',').map((name) => name.trim());
  }

  const validation = validateScopeNames(scopeNames);

  if (!validation.valid) {
    throw new BadRequestError(`Invalid scope name format: ${validation.errors.join(', ')}`);
  }

  if (scopeNames.length === 0) {
    throw new BadRequestError('At least one scope name is required');
  }

  const scopes = buildGoogleScopeUrls(scopeNames);

  // Generate state and save permission state
  const state = await generatePermissionState(provider, accountId as string, 'custom', requestedScopeNames);

  // Use utility to build authorization URL
  const authorizationUrl = buildGooglePermissionUrl(state, scopes, userEmail);

  logger.info(`Generated permission URL for scope names: ${scopeNames.join(', ')}`);
  logger.info(`Converted to scope URLs: ${scopes.join(', ')}`);
  logger.info(`Account: ${userEmail}`);

  next(
    new JsonSuccess({
      authorizationUrl,
      state,
      scopes: scopeNames,
      accountId,
      userEmail,
    }),
  );
});

/**
 * Generate reauthorization URL
 */
export const generateReauthorizeUrl = asyncHandler(async (req, res, next) => {
  const { accountId } = req.query;

  const provider = ValidationUtils.validateEnum(req.params.provider, OAuthProviders, 'OAuth provider');

  // Check if provider is implemented (only Google currently)
  if (provider !== OAuthProviders.Google) {
    throw new BadRequestError(`Provider ${provider} is not implemented yet`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  if (!accountId) {
    throw new BadRequestError('Missing required parameters');
  }

  ValidationUtils.validateObjectId(accountId as string, 'Account ID');

  // Get the user's account details
  const account = await AuthService.getUserAccount(accountId as string);

  if (!account || !account.userDetails.email) {
    throw new NotFoundError('Account not found or missing email', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  // Get previously granted scopes from the database
  const storedScopes = await AuthService.getAccountScopes(accountId as string);

  if (!storedScopes || storedScopes.length === 0) {
    next(
      new JsonSuccess({
        message: 'No additional scopes needed',
        authorizationUrl: null,
        accountId,
      }),
    );
    return;
  }

  // Generate a unique state for this re-authorization
  const state = await generatePermissionState(provider, accountId as string, 'reauthorize', 'all');

  // Use utility to build authorization URL
  const authorizationUrl = buildGoogleReauthorizeUrl(state, storedScopes, account.userDetails.email);

  logger.info(`Generated reauthorization URL for account ${accountId}`);
  logger.info(`Scopes: ${storedScopes.join(', ')}`);

  next(
    new JsonSuccess({
      authorizationUrl,
      state,
      scopes: storedScopes,
      accountId,
      userEmail: account.userDetails.email,
    }),
  );
});

/**
 * Get OAuth access token information
 * Route: GET /:accountId/oauth/token
 */
export const getOAuthTokenInfo = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;

  // First try to get token from body, then from cookies
  let systemToken = req.body.token;
  if (!systemToken) {
    systemToken = extractAccessToken(req, accountId);
  }

  if (!systemToken) {
    throw new BadRequestError('Access token not found in body or cookies', 400, ApiErrorCode.TOKEN_INVALID);
  }

  try {
    // Decode our JWT wrapper to get OAuth token and validate system token
    const { accountId: tokenAccountId, oauthAccessToken, exp } = verifyOAuthJwtToken(systemToken);

    // Check if our system token is expired
    const isSystemTokenExpired = exp && Date.now() >= exp * 1000;
    if (isSystemTokenExpired) {
      return next(
        new JsonSuccess({
          systemToken: {
            isExpired: true,
            type: 'oauth_jwt',
          },
        }),
      );
    }

    // Verify token belongs to correct account
    if (tokenAccountId !== accountId) {
      throw new BadRequestError('Token does not belong to this account', 400, ApiErrorCode.TOKEN_INVALID);
    }

    // Get Google provider token information
    const providerTokenInfo = await getGoogleTokenInfo(oauthAccessToken);

    const response = {
      systemToken: {
        isExpired: false,
        type: 'oauth_jwt',
        expiresAt: exp ? exp * 1000 : null,
        timeRemaining: exp ? Math.max(0, exp * 1000 - Date.now()) : null,
      },
      providerToken: {
        ...providerTokenInfo,
        provider: 'google',
      },
    };

    next(new JsonSuccess(response));
  } catch {
    // If JWT verification fails, token is invalid/expired
    next(
      new JsonSuccess({
        systemToken: {
          isExpired: true,
          type: 'oauth_jwt',
          error: 'Invalid or expired token',
        },
      }),
    );
  }
});

/**
 * Get OAuth refresh token information
 * Route: GET /:accountId/oauth/refresh/token
 */
export const getOAuthRefreshTokenInfo = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;

  // First try to get token from body, then from cookies
  let refreshToken = req.body.token;
  if (!refreshToken) {
    refreshToken = extractRefreshToken(req, accountId);
  }

  if (!refreshToken) {
    throw new BadRequestError('Refresh token not found in body or cookies', 400, ApiErrorCode.TOKEN_INVALID);
  }

  try {
    // Decode our JWT wrapper
    const { accountId: tokenAccountId, oauthRefreshToken, exp } = verifyOAuthRefreshToken(refreshToken);

    // Check if our system refresh token is expired (if it has expiration)
    const isSystemTokenExpired = exp && Date.now() >= exp * 1000;
    if (isSystemTokenExpired) {
      return next(
        new JsonSuccess({
          systemToken: {
            isExpired: true,
            type: 'oauth_refresh_jwt',
          },
        }),
      );
    }

    // Verify token belongs to correct account
    if (tokenAccountId !== accountId) {
      throw new BadRequestError('Token does not belong to this account', 400, ApiErrorCode.TOKEN_INVALID);
    }

    const response = {
      systemToken: {
        isExpired: false,
        type: 'oauth_refresh_jwt',
        expiresAt: exp ? exp * 1000 : null,
        timeRemaining: exp ? Math.max(0, exp * 1000 - Date.now()) : null,
      },
      providerToken: {
        type: 'google_refresh_token',
        provider: 'google',
        // Note: Google refresh tokens don't expire, so we can't get info about them
        hasToken: !!oauthRefreshToken,
      },
    };

    next(new JsonSuccess(response));
  } catch {
    next(
      new JsonSuccess({
        systemToken: {
          isExpired: true,
          type: 'oauth_refresh_jwt',
          error: 'Invalid or expired refresh token',
        },
      }),
    );
  }
});

/**
 * Refresh OAuth access token
 * Route: POST /:accountId/oauth/refresh
 */
export const refreshOAuthToken = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const account = req.account as AccountDocument;
  const { redirectUrl } = req.query;

  // Validate account type
  if (account.accountType !== AccountType.OAuth) {
    throw new BadRequestError('Account is not an OAuth account', 400, ApiErrorCode.AUTH_FAILED);
  }

  // Extract refresh token
  const refreshToken = req.refreshToken;
  if (!refreshToken) {
    throw new BadRequestError('Refresh token not found', 400, ApiErrorCode.TOKEN_INVALID);
  }

  // Extract OAuth refresh token from middleware (already verified)
  const oauthRefreshToken = req.oauthRefreshToken;

  if (!oauthRefreshToken) {
    throw new BadRequestError('OAuth refresh token not available', 400, ApiErrorCode.TOKEN_INVALID);
  }

  // Use the session manager to handle token refresh
  await refreshOAuthAccessToken(req, res, accountId, oauthRefreshToken);

  // Validate and determine redirect URL
  if (!redirectUrl) {
    throw new BadRequestError('Missing redirectUrl query parameter', 400, ApiErrorCode.MISSING_DATA);
  }

  ValidationUtils.validateUrl(redirectUrl as string, 'Redirect URL');

  next(new Redirect(null, redirectUrl as string));
});

/**
 * Revoke OAuth tokens
 * Route: POST /:accountId/oauth/revoke
 */
export const revokeOAuthToken = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId as string;
  const account = req.account as AccountDocument;

  // Validate account type
  if (account.accountType !== AccountType.OAuth) {
    throw new BadRequestError('Account is not an OAuth account', 400, ApiErrorCode.AUTH_FAILED);
  }

  // Tokens are already extracted by middleware
  const accessToken = req.oauthAccessToken as string;
  const refreshToken = req.oauthRefreshToken as string;

  if (!accessToken || !refreshToken) {
    throw new BadRequestError('OAuth tokens not available', 400, ApiErrorCode.TOKEN_INVALID);
  }

  // Use the existing service function to revoke tokens
  const result = await revokeAuthTokens(accountId, account.accountType, accessToken, refreshToken, res);

  next(new JsonSuccess(result, undefined, 'OAuth tokens revoked successfully'));
});
