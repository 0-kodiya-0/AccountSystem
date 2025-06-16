import db from '../../config/db';
import { Account, AccountType, AccountStatus, OAuthProviders } from '../account/Account.types';
import { ApiErrorCode, BadRequestError } from '../../types/response.types';
import { AuthType, OAuthState, ProviderResponse, SignInState } from './OAuth.types';
import { generateSignInState, generateSignupState } from './OAuth.utils';
import { validateAccount } from '../account/Account.validation';
import { findUserByEmail, findUserById } from '../account';
import { createOAuthAccessToken, createOAuthRefreshToken } from '../tokens';

// Import centralized Google token services instead of duplicating logic
import {
  getGoogleTokenInfo,
  updateAccountScopes,
  getGoogleAccountScopes,
  checkForAdditionalGoogleScopes,
} from '../google/services/tokenInfo/tokenInfo.services';
import { saveTwoFactorLoginToken } from '../twofa/TwoFA.service';

/**
 * Process sign up with OAuth provider
 */
export async function processSignup(stateDetails: SignInState, provider: OAuthProviders) {
  if (!stateDetails || !stateDetails.oAuthResponse.email) {
    throw new BadRequestError('Invalid or missing state details', 400, ApiErrorCode.INVALID_STATE);
  }

  const oauthAccessToken = stateDetails.oAuthResponse.tokenDetails.accessToken;
  const oauthRefreshToken = stateDetails.oAuthResponse.tokenDetails.refreshToken;

  // Validate refresh token exists
  if (!oauthRefreshToken) {
    throw new BadRequestError('Missing refresh token from OAuth provider', 400, ApiErrorCode.TOKEN_INVALID);
  }

  const models = await db.getModels();

  const newAccount: Omit<Account, 'id'> = {
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    accountType: AccountType.OAuth,
    status: AccountStatus.Active,
    provider,
    userDetails: {
      name: stateDetails.oAuthResponse.name,
      email: stateDetails.oAuthResponse.email,
      imageUrl: stateDetails.oAuthResponse.imageUrl || '',
      emailVerified: true, // OAuth emails are pre-verified
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

  // Update Google permissions if provider is Google - use centralized service
  if (provider === OAuthProviders.Google) {
    const accessToken = stateDetails.oAuthResponse.tokenDetails.accessToken;
    await updateAccountScopes(accountId, accessToken);
  }

  // Get token info to determine expiration - use centralized service
  const accessTokenInfo = await getGoogleTokenInfo(oauthAccessToken);
  const expiresIn = accessTokenInfo.expires_in || 3600; // Default to 1 hour

  // Create our JWT tokens that wrap the OAuth tokens
  const accessToken = createOAuthAccessToken(accountId, oauthAccessToken, expiresIn);
  const refreshToken = createOAuthRefreshToken(accountId, oauthRefreshToken);

  return {
    accountId,
    name: newAccount.userDetails.name,
    accessToken,
    refreshToken,
    accessTokenInfo,
  };
}

/**
 * Process sign in with OAuth provider
 */
export async function processSignIn(stateDetails: SignInState) {
  if (!stateDetails || !stateDetails.oAuthResponse.email) {
    throw new BadRequestError('Invalid or missing state details', 400, ApiErrorCode.INVALID_STATE);
  }

  const user = await findUserByEmail(stateDetails.oAuthResponse.email);

  if (!user) {
    throw new BadRequestError('User not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  // Ensure this is an OAuth account
  if (user.accountType !== AccountType.OAuth) {
    throw new BadRequestError('Account exists but is not an OAuth account', 400, ApiErrorCode.AUTH_FAILED);
  }

  const oauthAccessToken = stateDetails.oAuthResponse.tokenDetails.accessToken;
  const oauthRefreshToken = stateDetails.oAuthResponse.tokenDetails.refreshToken;

  // Validate refresh token exists
  if (!oauthRefreshToken) {
    throw new BadRequestError('Missing refresh token from OAuth provider', 400, ApiErrorCode.TOKEN_INVALID);
  }

  // Check if 2FA is enabled for this OAuth account
  const models = await db.getModels();
  const account = await models.accounts.Account.findById(user.id);

  if (account?.security.twoFactorEnabled) {
    // Use unified 2FA service to store OAuth tokens and generate temp token
    const tempToken = saveTwoFactorLoginToken(user.id, user.userDetails.email as string, AccountType.OAuth, {
      accessToken: oauthAccessToken,
      refreshToken: oauthRefreshToken,
      userInfo: stateDetails.oAuthResponse,
    });

    return {
      requiresTwoFactor: true,
      tempToken,
      accountId: user.id,
    };
  }

  // Continue with normal OAuth signin process if no 2FA...
  // Update Google permissions if provider is Google
  if (user.provider === OAuthProviders.Google) {
    await updateAccountScopes(user.id, oauthAccessToken);
  }

  // Get token info to determine expiration
  const accessTokenInfo = await getGoogleTokenInfo(oauthAccessToken);
  const expiresIn = accessTokenInfo.expires_in || 3600;

  // Create our JWT tokens that wrap the OAuth tokens
  const accessToken = createOAuthAccessToken(user.id, oauthAccessToken, expiresIn);
  const refreshToken = createOAuthRefreshToken(user.id, oauthRefreshToken);

  // Check for additional scopes from GooglePermissions
  const needsAdditionalScopes = await checkForAdditionalGoogleScopes(user.id, oauthAccessToken);

  return {
    userId: user.id,
    userName: user.userDetails.name,
    accessToken,
    refreshToken,
    accessTokenInfo,
    needsAdditionalScopes: needsAdditionalScopes.needsAdditionalScopes,
    missingScopes: needsAdditionalScopes.missingScopes,
  };
}

/**
 * Process callback from OAuth provider
 */
export async function processSignInSignupCallback(userData: ProviderResponse, stateDetails: OAuthState) {
  const userEmail = userData.email;
  if (!userEmail) {
    throw new BadRequestError('Missing email parameter', 400, ApiErrorCode.MISSING_EMAIL);
  }

  const user = await findUserByEmail(userEmail);
  let state: string;

  if (stateDetails.authType === AuthType.SIGN_UP) {
    if (user) {
      throw new BadRequestError('User already exists', 409, ApiErrorCode.USER_EXISTS);
    }
    state = await generateSignupState(userData);
  } else {
    if (!user) {
      throw new BadRequestError('User not found', 404, ApiErrorCode.USER_NOT_FOUND);
    }
    state = await generateSignInState(userData);
  }

  return {
    state,
    authType: stateDetails.authType,
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
 * Get all scopes for an account from GooglePermissions - use centralized service
 */
export async function getAccountScopes(accountId: string): Promise<string[]> {
  // Delegate to centralized Google token service
  return getGoogleAccountScopes(accountId);
}

/**
 * Update tokens and scopes for a user - use centralized service
 */
export async function updateTokensAndScopes(accountId: string, accessToken: string) {
  // Delegate to centralized Google token service
  await updateAccountScopes(accountId, accessToken);
}
