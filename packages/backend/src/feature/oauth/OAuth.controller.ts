import passport from 'passport';
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
import { AuthType, AuthUrls, OAuthState, PermissionState, ProviderResponse, SignInState } from './OAuth.types';
import { OAuthProviders } from '../account/Account.types';
import {
  validateOAuthState,
  validateSignInState,
  validateSignUpState,
  validatePermissionState,
  validateProvider,
  validateState,
} from './OAuth.validation';
import {
  clearOAuthState,
  clearSignInState,
  clearSignUpState,
  generateOAuthState,
  generatePermissionState,
} from './OAuth.utils';
import { getTokenInfo, verifyTokenOwnership } from '../google/services/token/token.services';
import { setupCompleteAccountSession } from '../../services';
import { getCallbackUrl } from '../../utils/redirect';
import { SignUpRequest, SignInRequest, OAuthCallBackRequest } from './OAuth.dto';
import { ValidationUtils } from '../../utils/validation';
import { buildGoogleScopeUrls, validateScopeNames } from '../google/config';
import { asyncHandler, oauthCallbackHandler } from '../../utils/response';
import { logger } from '../../utils/logger';
import { createOAuthJwtToken, createOAuthRefreshToken } from './OAuth.jwt';

/**
 * Initiate Google authentication
 */
export const initiateGoogleAuth = asyncHandler(async (req, res, next) => {
  const { state } = req.query;

  await validateState(state as string, (state) => validateOAuthState(state, OAuthProviders.Google), res);

  // Default Google authentication options
  const authOptions = {
    scope: ['profile', 'email'],
    state: state as string,
    accessType: 'offline',
    prompt: 'consent',
  };

  // Pass control to passport middleware
  passport.authenticate('google', authOptions)(req, res, next);
});

/**
 * Handle sign up process - UPDATED with session integration
 */
export const signup = asyncHandler(async (req: SignUpRequest, res, next) => {
  const provider = req.params.provider as OAuthProviders;

  validateProvider(provider, res);

  const reqState = req.query.state;
  if (reqState && typeof reqState === 'string') {
    const stateDetails = (await validateState(reqState, validateSignUpState, res)) as SignInState;

    try {
      const result = await AuthService.processSignup(stateDetails, provider);
      await clearSignUpState(stateDetails.state);

      if (result.accessTokenInfo && result.accessTokenInfo.expires_in) {
        // Set up complete account session (auth cookies + account session)
        setupCompleteAccountSession(
          req,
          res,
          result.accountId,
          result.accessToken,
          result.accessTokenInfo.expires_in * 1000,
          result.refreshToken,
          true, // set as current account
        );
      }

      const callbackData: CallbackData = {
        code: CallbackCode.OAUTH_SIGNUP_SUCCESS,
        accountId: result.accountId,
        name: result.name,
        provider,
      };

      next(new Redirect(callbackData, getCallbackUrl()));
      return;
    } catch (error) {
      logger.error(error);
      const callbackData: CallbackData = {
        code: CallbackCode.OAUTH_ERROR,
        error: 'Signup processing failed',
        provider,
      };
      next(new Redirect(callbackData, getCallbackUrl()));
      return;
    }
  }

  // Generate state without redirectUrl
  const generatedState = await generateOAuthState(provider as OAuthProviders, AuthType.SIGN_UP);
  const authUrls: AuthUrls = {
    [OAuthProviders.Google]: '../auth/google',
    [OAuthProviders.Microsoft]: '../auth/microsoft',
    [OAuthProviders.Facebook]: '../auth/facebook',
  };

  next(new JsonSuccess({ state: generatedState, authUrl: authUrls[provider] }));
});

/**
 * Handle sign in process - UPDATED with session integration
 */
export const signin = asyncHandler(async (req: SignInRequest, res, next) => {
  const provider = req.params.provider as OAuthProviders;
  const { state } = req.query;

  validateProvider(provider, res);

  if (state && typeof state === 'string') {
    const stateDetails = (await validateState(state, validateSignInState, res)) as SignInState;

    try {
      const result = await AuthService.processSignIn(stateDetails);
      await clearSignInState(stateDetails.state);

      if (result.accessTokenInfo && result.accessTokenInfo.expires_in) {
        // Set up complete account session (auth cookies + account session)
        setupCompleteAccountSession(
          req,
          res,
          result.userId,
          result.accessToken,
          result.accessTokenInfo.expires_in * 1000,
          result.refreshToken,
          true, // set as current account
        );
      }

      // Handle additional scopes
      const callbackData: CallbackData = {
        code: CallbackCode.OAUTH_SIGNIN_SUCCESS,
        accountId: result.userId,
        name: result.userName,
        provider,
        needsAdditionalScopes: result.needsAdditionalScopes,
        missingScopes: result.missingScopes,
      };
      next(new Redirect(callbackData, getCallbackUrl()));
      return;
    } catch (error) {
      logger.error(error);
      const callbackData: CallbackData = {
        code: CallbackCode.OAUTH_ERROR,
        error: 'Signin processing failed',
        provider,
      };
      next(new Redirect(callbackData, getCallbackUrl()));
      return;
    }
  }

  const generatedState = await generateOAuthState(provider as OAuthProviders, AuthType.SIGN_IN);
  const authUrls: AuthUrls = {
    [OAuthProviders.Google]: '../auth/google',
    [OAuthProviders.Microsoft]: '../auth/microsoft',
    [OAuthProviders.Facebook]: '../auth/facebook',
  };

  next(new JsonSuccess({ state: generatedState, authUrl: authUrls[provider] }));
});

/**
 * Handle callback from OAuth provider
 */
export const handleCallback = oauthCallbackHandler(
  getCallbackUrl(),
  CallbackCode.PERMISSION_ERROR,
  async (req: OAuthCallBackRequest, res, next) => {
    const provider = req.params.provider;
    const stateFromProvider = req.query.state;

    validateProvider(provider, res);

    const stateDetails = (await validateState(
      stateFromProvider,
      (state) => validateOAuthState(state, provider as OAuthProviders),
      res,
    )) as OAuthState;

    await clearOAuthState(stateDetails.state);

    passport.authenticate(
      provider as OAuthProviders,
      { session: false },
      async (err: Error | null, userData: ProviderResponse) => {
        try {
          if (err) {
            const callbackData: CallbackData = {
              code: CallbackCode.OAUTH_ERROR,
              error: 'Authentication failed',
              provider: provider as OAuthProviders,
            };
            return next(new Redirect(callbackData, getCallbackUrl()));
          }

          if (!userData) {
            const callbackData: CallbackData = {
              code: CallbackCode.OAUTH_ERROR,
              error: 'No user data received',
              provider: provider as OAuthProviders,
            };
            return next(new Redirect(callbackData, getCallbackUrl()));
          }

          const result = await AuthService.processSignInSignupCallback(userData, stateDetails);

          if (result.authType === AuthType.SIGN_UP) {
            next(new Redirect({ state: result.state }, `../signup/${provider}`));
          } else {
            next(new Redirect({ state: result.state }, `../signin/${provider}`));
          }
        } catch (error) {
          logger.error(error);
          const callbackData: CallbackData = {
            code: CallbackCode.OAUTH_ERROR,
            error: 'Failed to process authentication',
            provider: provider as OAuthProviders,
          };
          next(new Redirect(callbackData, getCallbackUrl()));
        }
      },
    )(req, res, next);
  },
);

/**
 * Handle callback for permission request - UPDATED with session integration
 */
export const handlePermissionCallback = oauthCallbackHandler(
  getCallbackUrl(),
  CallbackCode.PERMISSION_ERROR,
  async (req, res, next) => {
    const provider = req.params.provider;
    const stateFromProvider = req.query.state as string;

    validateProvider(provider, res);

    const permissionDetails = (await validateState(
      stateFromProvider,
      (state) => validatePermissionState(state, provider as OAuthProviders),
      res,
    )) as PermissionState;

    // Get the details we need from the permission state
    const { accountId, service, scopeLevel } = permissionDetails;

    // Use the permission-specific passport strategy
    passport.authenticate(
      `${provider}-permission`,
      { session: false },
      async (err: Error | null, result: ProviderResponse) => {
        try {
          if (err) {
            logger.error('Permission token exchange error:', err);
            const callbackData: CallbackData = {
              code: CallbackCode.PERMISSION_ERROR,
              error: 'Permission token exchange failed',
              provider: provider as OAuthProviders,
              accountId,
            };
            return next(new Redirect(callbackData, getCallbackUrl()));
          }

          if (
            !result ||
            !result.tokenDetails ||
            !result.tokenDetails.accessToken ||
            !result.tokenDetails.refreshToken
          ) {
            const callbackData: CallbackData = {
              code: CallbackCode.PERMISSION_ERROR,
              error: 'Permission request failed - no tokens received',
              provider: provider as OAuthProviders,
              accountId,
            };
            return next(new Redirect(callbackData, getCallbackUrl()));
          }

          const exists = await AuthService.checkUserExists(accountId);

          if (!exists) {
            const callbackData: CallbackData = {
              code: CallbackCode.USER_NOT_FOUND,
              error: 'User record not found in database',
              accountId,
            };
            return next(new Redirect(callbackData, getCallbackUrl()));
          }

          logger.info(
            `Processing permission callback for account ${accountId}, service ${service}, scope ${scopeLevel}`,
          );

          // Verify that the token belongs to the correct user account
          const token = await verifyTokenOwnership(result.tokenDetails.accessToken, accountId);

          if (!token.isValid) {
            logger.error('Token ownership verification failed:', token.reason);
            const callbackData: CallbackData = {
              code: CallbackCode.PERMISSION_ERROR,
              error:
                'Permission was granted with an incorrect account. Please try again and ensure you use the correct Google account.',
              provider: provider as OAuthProviders,
              accountId,
            };
            return next(new Redirect(callbackData, getCallbackUrl()));
          }

          const accessTokenInfo = await getTokenInfo(result.tokenDetails.accessToken);

          if (!accessTokenInfo.expires_in) {
            const callbackData: CallbackData = {
              code: CallbackCode.PERMISSION_ERROR,
              error: 'Failed to fetch token information',
              provider: provider as OAuthProviders,
              accountId,
            };
            return next(new Redirect(callbackData, getCallbackUrl()));
          }

          // Update tokens and scopes
          await AuthService.updateTokensAndScopes(accountId, result.tokenDetails.accessToken);

          const jwtAccessToken = await createOAuthJwtToken(
            accountId,
            result.tokenDetails.accessToken,
            accessTokenInfo.expires_in,
          );

          const jwtRefreshToken = await createOAuthRefreshToken(accountId, result.tokenDetails.refreshToken);

          // Set up complete account session (auth cookies + account session)
          // Note: Don't change current account for permission updates
          setupCompleteAccountSession(
            req,
            res,
            accountId,
            jwtAccessToken,
            accessTokenInfo.expires_in * 1000,
            jwtRefreshToken,
            false, // don't set as current account
          );

          logger.info(`Token updated for ${service} ${scopeLevel}. Processing success callback.`);

          const callbackData: CallbackData = {
            code: CallbackCode.OAUTH_PERMISSION_SUCCESS,
            accountId,
            service,
            scopeLevel,
            provider: provider as OAuthProviders,
            message: `Successfully granted ${service} ${scopeLevel} permissions`,
          };

          next(new Redirect(callbackData, getCallbackUrl()));
        } catch (error) {
          logger.error('Error updating token:', error);
          const callbackData: CallbackData = {
            code: CallbackCode.PERMISSION_ERROR,
            error: 'Failed to update token',
            provider: provider as OAuthProviders,
            accountId,
          };
          next(new Redirect(callbackData, getCallbackUrl()));
        }
      },
    )(req, res, next);
  },
);

/**
 * Request permission for specific scope names
 * Accepts scope names and converts them to proper Google OAuth scope URLs
 */
export const requestPermission = asyncHandler(async (req, res, next) => {
  const requestedScopeNames = req.params.scopeNames as string;
  const { accountId } = req.query;

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
  const state = await generatePermissionState(
    OAuthProviders.Google,
    accountId as string,
    'custom', // service field - keeping for backward compatibility
    requestedScopeNames, // Store original scope names string
  );

  // CRITICAL: These options force Google to use the specified account
  const authOptions = {
    scope: scopes, // Full Google OAuth scope URLs - Google will validate these
    accessType: 'offline',
    prompt: 'consent',
    loginHint: userEmail, // Pre-select the account
    state,
    includeGrantedScopes: true,
  };

  logger.info(`Initiating permission request for scope names: ${scopeNames.join(', ')}`);
  logger.info(`Converted to scope URLs: ${scopes.join(', ')}`);
  logger.info(`Account: ${userEmail}`);

  // Redirect to Google authorization page - Google will validate the scopes
  passport.authenticate('google-permission', authOptions)(req, res, next);
});

/**
 * Reauthorize permissions
 */
export const reauthorizePermissions = asyncHandler(async (req, res, next) => {
  const { accountId } = req.query;

  if (!accountId) {
    throw new BadRequestError('Missing required parameters');
  }

  // Get the user's account details
  const account = await AuthService.getUserAccount(accountId as string);

  if (!account || !account.userDetails.email) {
    throw new NotFoundError('Account not found or missing email', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  // Get previously granted scopes from the database
  const storedScopes = await AuthService.getAccountScopes(accountId as string);

  if (!storedScopes || storedScopes.length === 0) {
    // No additional scopes to request, redirect with success
    next(new JsonSuccess({ message: 'No additional scopes needed' }));
    return;
  }

  // Generate a unique state for this re-authorization
  const state = await generatePermissionState(OAuthProviders.Google, accountId as string, 'reauthorize', 'all');

  // Build the authentication options
  const authOptions = {
    scope: storedScopes,
    accessType: 'offline',
    prompt: 'consent',
    loginHint: account.userDetails.email,
    state,
    includeGrantedScopes: true,
  };

  logger.info(`Re-requesting scopes for account ${accountId}:`, storedScopes);

  // Redirect to Google authorization page
  passport.authenticate('google-permission', authOptions)(req, res, next);
});
