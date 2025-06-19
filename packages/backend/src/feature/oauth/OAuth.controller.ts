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
import { OAuthProviders } from '../account/Account.types';
import { validateOAuthState, validatePermissionState, validateState } from './OAuth.validation';
import { generateOAuthState, generatePermissionState } from './OAuth.utils';
import {
  exchangeGoogleCode,
  getGoogleTokenInfo,
  verifyGoogleTokenOwnership,
} from '../google/services/tokenInfo/tokenInfo.services';
import { setupCompleteAccountSession } from '../session/session.utils';
import { ValidationUtils } from '../../utils/validation';
import { buildGoogleScopeUrls, validateScopeNames } from '../google/config';
import { asyncHandler } from '../../utils/response';
import { logger } from '../../utils/logger';
import { createOAuthAccessToken, createOAuthRefreshToken } from '../tokens';
import { getBaseUrl, getProxyUrl } from '../../config/env.config';
import {
  buildGoogleSignupUrl,
  buildGoogleSigninUrl,
  buildGooglePermissionUrl,
  buildGoogleReauthorizeUrl,
} from '../google/config';

/**
 * Generate OAuth signup URL
 */
export const generateSignupUrl = asyncHandler(async (req, res, next) => {
  const provider = ValidationUtils.validateEnum(req.params.provider, OAuthProviders, 'OAuth provider');
  const { callbackUrl } = req.query;

  // Validate callback URL is provided
  if (!callbackUrl) {
    throw new BadRequestError('callbackUrl query parameter is required', 400, ApiErrorCode.MISSING_DATA);
  }

  ValidationUtils.validateUrl(callbackUrl as string, 'Callback URL');

  // Check if provider is implemented (only Google currently)
  if (provider !== OAuthProviders.Google) {
    throw new BadRequestError(`Provider ${provider} is not implemented yet`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  // Generate state for signup with callback URL
  const state = await generateOAuthState(provider, AuthType.SIGN_UP, callbackUrl as string);

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
      callbackUrl,
    }),
  );
});

/**
 * Generate OAuth signin URL
 */
export const generateSigninUrl = asyncHandler(async (req, res, next) => {
  const provider = ValidationUtils.validateEnum(req.params.provider, OAuthProviders, 'OAuth provider');
  const { callbackUrl } = req.query;

  // Validate callback URL is provided
  if (!callbackUrl) {
    throw new BadRequestError('callbackUrl query parameter is required', 400, ApiErrorCode.MISSING_DATA);
  }

  ValidationUtils.validateUrl(callbackUrl as string, 'Callback URL');

  // Check if provider is implemented (only Google currently)
  if (provider !== OAuthProviders.Google) {
    throw new BadRequestError(`Provider ${provider} is not implemented yet`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  // Generate state for signin with callback URL
  const state = await generateOAuthState(provider, AuthType.SIGN_IN, callbackUrl as string);

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
      callbackUrl,
    }),
  );
});

/**
 * Handle OAuth callback from provider
 * Updated to use callback URL from state
 */
export const handleOAuthCallback = asyncHandler(async (req, res, next) => {
  const provider = ValidationUtils.validateEnum(req.params.provider, OAuthProviders, 'OAuth provider');

  // Check if provider is implemented (only Google currently)
  if (provider !== OAuthProviders.Google) {
    throw new BadRequestError(`Provider ${provider} is not implemented yet`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  const { code, state } = req.query;

  ValidationUtils.validateRequiredFields({ code, state }, ['code', 'state']);

  // Validate the state parameter and get OAuth state details
  const stateDetails = (await validateState(
    state as string,
    (state) => validateOAuthState(state, provider),
    res,
  )) as OAuthState;

  // Get the callback URL from the state
  const callbackUrl = stateDetails.callbackUrl;

  // Wrap the main logic with error handling that redirects to the correct callback URL
  try {
    // Exchange authorization code for tokens based on provider
    let tokens;
    let userInfo;

    switch (stateDetails.provider) {
      case OAuthProviders.Google: {
        ({ tokens, userInfo } = await exchangeGoogleCode(
          code as string,
          `${getProxyUrl()}${getBaseUrl()}/oauth/callback/google`,
        ));
        break;
      }

      default:
        throw new BadRequestError(
          `Provider ${stateDetails.provider} exchange not implemented`,
          400,
          ApiErrorCode.INVALID_PROVIDER,
        );
    }

    // Create provider response object
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
      // Process signup - no 2FA check needed for new accounts
      const signupResult = await AuthService.processSignup(
        {
          ...stateDetails,
          oAuthResponse: providerResponse,
        },
        stateDetails.provider,
      );

      // Set up account session for new user
      if (signupResult.accessTokenInfo && signupResult.accessTokenInfo.expires_in) {
        setupCompleteAccountSession(
          req,
          res,
          signupResult.accountId,
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

      next(new Redirect(callbackData, callbackUrl));
    } else {
      // Process signin
      const signinResult = await AuthService.processSignIn({
        ...stateDetails,
        oAuthResponse: providerResponse,
      });

      // Check if 2FA is required for signin
      if ('requiresTwoFactor' in signinResult && signinResult.requiresTwoFactor) {
        const callbackData: CallbackData = {
          code: CallbackCode.OAUTH_SIGNIN_REQUIRES_2FA,
          accountId: signinResult.accountId,
          tempToken: signinResult.tempToken,
          provider: stateDetails.provider,
          requiresTwoFactor: true,
          message: 'Please complete two-factor authentication to continue.',
        };

        next(new Redirect(callbackData, callbackUrl));
        return;
      }

      // Normal signin flow - set up account session
      if (signinResult.accessTokenInfo && signinResult.accessTokenInfo.expires_in) {
        setupCompleteAccountSession(
          req,
          res,
          signinResult.userId,
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

      next(new Redirect(callbackData, callbackUrl));
    }
  } catch (error) {
    logger.error('OAuth callback error:', error);

    // Create error callback data
    const callbackData: CallbackData = {
      code: CallbackCode.OAUTH_ERROR,
      error: error instanceof Error ? error.message : 'OAuth authentication failed',
      provider: stateDetails.provider,
    };

    next(new Redirect(callbackData, callbackUrl));
  }
});

/**
 * Handle permission code exchange
 */
export const handlePermissionCallback = asyncHandler(async (req, res, next) => {
  const { code, state } = req.query;

  ValidationUtils.validateRequiredFields({ code, state }, ['code', 'state']);

  // Validate the state parameter
  const permissionDetails = (await validateState(
    state as string,
    (state) => validatePermissionState(state, OAuthProviders.Google),
    res,
  )) as PermissionState;

  // Get the callback URL from the permission state
  const callbackUrl = permissionDetails.callbackUrl || `${getProxyUrl()}/auth/callback`;

  // Wrap the main logic with error handling that redirects to the correct callback URL
  try {
    const { accountId, service, scopeLevel } = permissionDetails;

    // Use existing Google code exchange function
    const redirectUri = `${getProxyUrl()}${getBaseUrl()}/oauth/permission/callback/google`;
    const { tokens } = await exchangeGoogleCode(code as string, redirectUri);

    // Verify user account exists
    const exists = await AuthService.checkUserExists(accountId);
    if (!exists) {
      throw new NotFoundError('User record not found in database', 404, ApiErrorCode.USER_NOT_FOUND);
    }

    // Ensure accessToken is not null/undefined
    if (!tokens.accessToken) {
      throw new BadRequestError('Missing access token from OAuth response', 400, ApiErrorCode.TOKEN_INVALID);
    }

    // Verify that the token belongs to the correct user account
    const tokenVerification = await verifyGoogleTokenOwnership(tokens.accessToken, accountId);
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
    const jwtAccessToken = createOAuthAccessToken(accountId, tokens.accessToken, accessTokenInfo.expires_in);

    // Ensure refreshToken is not null/undefined
    if (!tokens.refreshToken) {
      throw new BadRequestError('Missing refresh token from OAuth response', 400, ApiErrorCode.TOKEN_INVALID);
    }

    const jwtRefreshToken = createOAuthRefreshToken(accountId, tokens.refreshToken);

    // Set up complete account session (auth cookies + account session)
    setupCompleteAccountSession(
      req,
      res,
      accountId,
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

    next(new Redirect(callbackData, callbackUrl));
  } catch (error) {
    logger.error('Permission callback error:', error);

    // Create error callback data
    const callbackData: CallbackData = {
      code: CallbackCode.OAUTH_PERMISSION_ERROR,
      error: error instanceof Error ? error.message : 'Permission grant failed',
      provider: OAuthProviders.Google,
    };

    next(new Redirect(callbackData, callbackUrl));
  }
});

/**
 * Generate permission request URL
 */
export const generatePermissionUrl = asyncHandler(async (req, res, next) => {
  const requestedScopeNames = req.query.scopeNames as string;
  const { accountId, callbackUrl } = req.query;

  const provider = ValidationUtils.validateEnum(req.params.provider, OAuthProviders, 'OAuth provider');

  // Check if provider is implemented (only Google currently)
  if (provider !== OAuthProviders.Google) {
    throw new BadRequestError(`Provider ${provider} is not implemented yet`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  ValidationUtils.validateRequiredFields(req.query, ['accountId', 'callbackUrl']);
  ValidationUtils.validateObjectId(accountId as string, 'Account ID');
  ValidationUtils.validateUrl(callbackUrl as string, 'Callback URL');

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

  // Generate state and save permission state with callback URL
  const state = await generatePermissionState(
    provider,
    accountId as string,
    'custom',
    requestedScopeNames,
    callbackUrl as string,
  );

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
      callbackUrl,
    }),
  );
});

/**
 * Generate reauthorization URL
 */
export const generateReauthorizeUrl = asyncHandler(async (req, res, next) => {
  const { accountId, callbackUrl } = req.query;

  const provider = ValidationUtils.validateEnum(req.params.provider, OAuthProviders, 'OAuth provider');

  // Check if provider is implemented (only Google currently)
  if (provider !== OAuthProviders.Google) {
    throw new BadRequestError(`Provider ${provider} is not implemented yet`, 400, ApiErrorCode.INVALID_PROVIDER);
  }

  if (!accountId || !callbackUrl) {
    throw new BadRequestError('Missing required parameters: accountId and callbackUrl');
  }

  ValidationUtils.validateObjectId(accountId as string, 'Account ID');
  ValidationUtils.validateUrl(callbackUrl as string, 'Callback URL');

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
        callbackUrl,
      }),
    );
    return;
  }

  // Generate a unique state for this re-authorization with callback URL
  const state = await generatePermissionState(
    provider,
    accountId as string,
    'reauthorize',
    'all',
    callbackUrl as string,
  );

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
      callbackUrl,
    }),
  );
});
