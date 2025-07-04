import { Request, Response } from 'express';
import { ApiErrorCode, BadRequestError, NotFoundError, CallbackCode, CallbackData } from '../../types/response.types';
import { Account, AccountType, AccountStatus, OAuthProviders } from '../account/Account.types';
import { AuthType, OAuthState, OAuthPermissionState } from './OAuth.types';
import { validateAccount } from '../account/Account.validation';
import { findUserByEmail, findUserById } from '../account';
import { createOAuthAccessToken, createOAuthRefreshToken } from '../tokens';
import {
  exchangeGoogleCode,
  getGoogleTokenInfo,
  updateAccountScopes,
  getGoogleAccountScopes,
  checkForAdditionalGoogleScopes,
  verifyGoogleTokenOwnership,
} from '../google/services/tokenInfo/tokenInfo.services';
import { saveTwoFactorTempToken } from '../twofa/TwoFA.cache';
import { setupCompleteAccountSession } from '../session/session.utils';
import {
  buildGoogleSignupUrl,
  buildGoogleSigninUrl,
  buildGooglePermissionUrl,
  buildGoogleReauthorizeUrl,
  buildGoogleScopeUrls,
  validateScopeNames,
} from '../google/config';
import { saveOAuthState, savePermissionState } from './OAuth.cache';
import { getApiBasePATH, getProxyUrl } from '../../config/env.config';
import { getModels } from '../../config/db.config';
import { validateUserForAuthType } from './OAuth.validation';

/**
 * Generate OAuth signup URL
 */
export async function generateSignupUrl(provider: OAuthProviders, callbackUrl: string) {
  const state = saveOAuthState(provider, AuthType.SIGN_UP, callbackUrl);
  const authorizationUrl = buildGoogleSignupUrl(state);

  return {
    authorizationUrl,
    state,
    provider,
    authType: 'signup',
    callbackUrl,
  };
}

/**
 * Generate OAuth signin URL
 */
export async function generateSigninUrl(provider: OAuthProviders, callbackUrl: string) {
  const state = saveOAuthState(provider, AuthType.SIGN_IN, callbackUrl);
  const authorizationUrl = buildGoogleSigninUrl(state);

  return {
    authorizationUrl,
    state,
    provider,
    authType: 'signin',
    callbackUrl,
  };
}

/**
 * Generate permission request URL
 */
export async function generatePermissionUrl(
  provider: OAuthProviders,
  accountId: string,
  callbackUrl: string,
  requestedScopeNames: string,
) {
  const account = await getUserAccount(accountId);

  if (!account || !account.userDetails.email) {
    throw new NotFoundError('Account not found or missing email', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  // Parse scope names as comma-separated string
  const scopeNames = requestedScopeNames
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0); // Remove empty strings

  if (scopeNames.length === 0) {
    throw new BadRequestError('At least one scope name is required');
  }

  const validation = validateScopeNames(scopeNames);
  if (!validation.valid) {
    throw new BadRequestError(`Invalid scope name format: ${validation.errors.join(', ')}`);
  }

  const scopes = buildGoogleScopeUrls(scopeNames);
  const state = savePermissionState(provider, accountId, 'custom', requestedScopeNames, callbackUrl);
  const authorizationUrl = buildGooglePermissionUrl(state, scopes, account.userDetails.email);

  return {
    authorizationUrl,
    state,
    scopes: scopeNames,
    accountId,
    userEmail: account.userDetails.email,
    callbackUrl,
  };
}

/**
 * Generate reauthorization URL
 */
export async function generateReauthorizeUrl(provider: OAuthProviders, accountId: string, callbackUrl: string) {
  const account = await getUserAccount(accountId);

  if (!account || !account.userDetails.email) {
    throw new NotFoundError('Account not found or missing email', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  const storedScopes = await getAccountScopes(accountId);

  if (!storedScopes || storedScopes.length === 0) {
    return {
      authorizationUrl: null,
      accountId,
      callbackUrl,
    };
  }

  const state = savePermissionState(provider, accountId, 'reauthorize', 'all', callbackUrl);
  const authorizationUrl = buildGoogleReauthorizeUrl(state, storedScopes, account.userDetails.email);

  return {
    authorizationUrl,
    state,
    scopes: storedScopes,
    accountId,
    userEmail: account.userDetails.email,
    callbackUrl,
  };
}

/**
 * Process OAuth callback
 */
export async function processOAuthCallback(
  req: Request,
  res: Response,
  provider: OAuthProviders,
  code: string,
  stateDetails: OAuthState,
) {
  // Exchange code for tokens
  const { tokens, userInfo } = await exchangeGoogleCode(
    code,
    `${getProxyUrl()}${getApiBasePATH()}/oauth/callback/google`,
  );

  const providerResponse = {
    email: userInfo.email || '',
    name: userInfo.name || '',
    imageUrl: userInfo.imageUrl || '',
    tokenDetails: tokens,
    provider,
  };

  // Validate user existence based on auth type
  await validateUserForAuthType(providerResponse.email, stateDetails.authType);

  if (stateDetails.authType === AuthType.SIGN_UP) {
    const signupResult = await processSignup(providerResponse, provider);

    if (signupResult.accessTokenInfo && signupResult.accessTokenInfo.expires_in) {
      setupCompleteAccountSession(
        req,
        res,
        signupResult.accountId,
        signupResult.accessToken,
        signupResult.accessTokenInfo.expires_in * 1000,
        signupResult.refreshToken,
        true,
      );
    }

    const callbackData: CallbackData = {
      code: CallbackCode.OAUTH_SIGNUP_SUCCESS,
      accountId: signupResult.accountId,
      name: signupResult.name,
      provider,
    };

    return {
      callbackData,
      callbackUrl: stateDetails.callbackUrl,
    };
  } else {
    const signinResult = await processSignIn(providerResponse);

    if ('requiresTwoFactor' in signinResult && signinResult.requiresTwoFactor) {
      const callbackData: CallbackData = {
        code: CallbackCode.OAUTH_SIGNIN_REQUIRES_2FA,
        accountId: signinResult.accountId,
        tempToken: signinResult.tempToken,
        provider,
        requiresTwoFactor: true,
        message: 'Please complete two-factor authentication to continue.',
      };

      return {
        callbackData,
        callbackUrl: stateDetails.callbackUrl,
      };
    }

    if (signinResult.accessTokenInfo && signinResult.accessTokenInfo.expires_in) {
      setupCompleteAccountSession(
        req,
        res,
        signinResult.accountId,
        signinResult.accessToken as string,
        signinResult.accessTokenInfo.expires_in * 1000,
        signinResult.refreshToken as string,
        true,
      );
    }

    const callbackData: CallbackData = {
      code: CallbackCode.OAUTH_SIGNIN_SUCCESS,
      accountId: signinResult.accountId,
      name: signinResult.userName,
      provider,
      needsAdditionalScopes: signinResult.needsAdditionalScopes,
      missingScopes: signinResult.missingScopes,
    };

    return {
      callbackData,
      callbackUrl: stateDetails.callbackUrl,
    };
  }
}

/**
 * Process permission callback
 */
export async function processPermissionCallback(
  req: Request,
  res: Response,
  code: string,
  permissionDetails: OAuthPermissionState,
) {
  const { accountId, service, scopeLevel } = permissionDetails;
  const callbackUrl = permissionDetails.callbackUrl || `${getProxyUrl()}/auth/callback`;

  // Exchange code for tokens
  const redirectUri = `${getProxyUrl()}${getApiBasePATH()}/oauth/permission/callback/google`;
  const { tokens } = await exchangeGoogleCode(code, redirectUri);

  // Verify user exists
  const exists = await checkUserExists(accountId);
  if (!exists) {
    throw new NotFoundError('User record not found in database', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  if (!tokens.accessToken) {
    throw new BadRequestError('Missing access token from OAuth response', 400, ApiErrorCode.TOKEN_INVALID);
  }

  // Verify token ownership
  const tokenVerification = await verifyGoogleTokenOwnership(tokens.accessToken, accountId);
  if (!tokenVerification.isValid) {
    throw new BadRequestError(
      'Permission was granted with an incorrect account. Please try again and ensure you use the correct Google account.',
      400,
      ApiErrorCode.AUTH_FAILED,
    );
  }

  // Get token info
  const accessTokenInfo = await getGoogleTokenInfo(tokens.accessToken);
  if (!accessTokenInfo.expires_in) {
    throw new BadRequestError('Failed to fetch token information', 400, ApiErrorCode.TOKEN_INVALID);
  }

  // Update tokens and scopes
  await updateAccountScopes(accountId, tokens.accessToken);

  // Create JWT tokens
  const jwtAccessToken = createOAuthAccessToken(accountId, tokens.accessToken, accessTokenInfo.expires_in);

  if (!tokens.refreshToken) {
    throw new BadRequestError('Missing refresh token from OAuth response', 400, ApiErrorCode.TOKEN_INVALID);
  }

  const jwtRefreshToken = createOAuthRefreshToken(accountId, tokens.refreshToken);

  // Set up session
  setupCompleteAccountSession(
    req,
    res,
    accountId,
    jwtAccessToken,
    accessTokenInfo.expires_in * 1000,
    jwtRefreshToken,
    false,
  );

  const callbackData: CallbackData = {
    code: CallbackCode.OAUTH_PERMISSION_SUCCESS,
    accountId,
    service,
    scopeLevel,
    provider: OAuthProviders.Google,
    message: `Successfully granted ${service} ${scopeLevel} permissions`,
  };

  return {
    callbackData,
    callbackUrl,
  };
}

/**
 * Process signup
 */
export async function processSignup(providerResponse: any, provider: OAuthProviders) {
  const models = await getModels();

  const newAccount: Omit<Account, 'id'> = {
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    accountType: AccountType.OAuth,
    status: AccountStatus.Active,
    provider,
    userDetails: {
      name: providerResponse.name,
      email: providerResponse.email,
      imageUrl: providerResponse.imageUrl || '',
      emailVerified: true,
    },
    security: {
      twoFactorEnabled: false,
      sessionTimeout: 3600,
      autoLock: false,
    },
  };

  const success = validateAccount(newAccount);
  if (!success) {
    throw new BadRequestError('Missing required account data', 400, ApiErrorCode.MISSING_DATA);
  }

  const newAccountDoc = await models.accounts.Account.create(newAccount);
  const accountId = newAccountDoc.id || newAccountDoc._id.toHexString();

  // Update Google permissions
  await updateAccountScopes(accountId, providerResponse.tokenDetails.accessToken);

  // Get token info
  const accessTokenInfo = await getGoogleTokenInfo(providerResponse.tokenDetails.accessToken);
  const expiresIn = accessTokenInfo.expires_in || 3600;

  // Create JWT tokens
  const accessToken = createOAuthAccessToken(accountId, providerResponse.tokenDetails.accessToken, expiresIn);
  const refreshToken = createOAuthRefreshToken(accountId, providerResponse.tokenDetails.refreshToken);

  return {
    accountId,
    name: newAccount.userDetails.name,
    accessToken,
    refreshToken,
    accessTokenInfo,
  };
}

/**
 * Process signin
 */
export async function processSignIn(providerResponse: any) {
  const user = await findUserByEmail(providerResponse.email);

  if (!user) {
    throw new BadRequestError('User not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  if (user.accountType !== AccountType.OAuth) {
    throw new BadRequestError('Account exists but is not an OAuth account', 400, ApiErrorCode.AUTH_FAILED);
  }

  // Check for 2FA
  const models = await getModels();
  const account = await models.accounts.Account.findById(user.id);

  if (account?.security.twoFactorEnabled) {
    const tempToken = saveTwoFactorTempToken(user.id, user.userDetails.email as string, AccountType.OAuth, {
      accessToken: providerResponse.tokenDetails.accessToken,
      refreshToken: providerResponse.tokenDetails.refreshToken,
      userInfo: providerResponse,
    });

    return {
      requiresTwoFactor: true,
      tempToken,
      accountId: user.id,
    };
  }

  // Normal signin
  await updateAccountScopes(user.id, providerResponse.tokenDetails.accessToken);

  const accessTokenInfo = await getGoogleTokenInfo(providerResponse.tokenDetails.accessToken);
  const expiresIn = accessTokenInfo.expires_in || 3600;

  const accessToken = createOAuthAccessToken(user.id, providerResponse.tokenDetails.accessToken, expiresIn);
  const refreshToken = createOAuthRefreshToken(user.id, providerResponse.tokenDetails.refreshToken);

  const needsAdditionalScopes = await checkForAdditionalGoogleScopes(
    user.id,
    providerResponse.tokenDetails.accessToken,
  );

  return {
    accountId: user.id,
    userName: user.userDetails.name,
    accessToken,
    refreshToken,
    accessTokenInfo,
    needsAdditionalScopes: needsAdditionalScopes.needsAdditionalScopes,
    missingScopes: needsAdditionalScopes.missingScopes,
  };
}

/**
 * Check if user exists
 */
export async function checkUserExists(id: string): Promise<boolean> {
  const user = await findUserById(id);
  return user !== null;
}

/**
 * Get user account by ID
 */
export async function getUserAccount(id: string) {
  return await findUserById(id);
}

/**
 * Get account scopes
 */
export async function getAccountScopes(accountId: string): Promise<string[]> {
  return getGoogleAccountScopes(accountId);
}
