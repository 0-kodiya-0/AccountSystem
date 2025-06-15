import db from '../../config/db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import { Account, AccountType, AccountStatus, OAuthProviders } from '../account/Account.types';
import { ApiErrorCode, AuthError, BadRequestError, NotFoundError, ValidationError } from '../../types/response.types';
import { AuthType, OAuthState, OAuthTwoFactorTokens, ProviderResponse, SignInState } from './OAuth.types';
import { generateSignInState, generateSignupState } from './OAuth.utils';
import { validateAccount } from '../account/Account.validation';
import { AccountDocument, findUserByEmail, findUserById } from '../account';
import { createOAuthJwtToken, createOAuthRefreshToken } from './OAuth.jwt';

// Import centralized Google token services instead of duplicating logic
import {
  getGoogleTokenInfo,
  updateAccountScopes,
  getGoogleAccountScopes,
  checkForAdditionalScopes,
  verifyTokenOwnership,
} from '../google/services/tokenInfo/tokenInfo.services';
import { ValidationUtils } from '../../utils/validation';
import { getAppName } from '../../config/env.config';
import { getOAuthTokensForTwoFactor, removeOAuthTokensForTwoFactor, saveOAuthTokensForTwoFactor } from './OAuth.cache';

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
  const accessToken = await createOAuthJwtToken(accountId, oauthAccessToken, expiresIn);
  const refreshToken = await createOAuthRefreshToken(accountId, oauthRefreshToken);

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
    // Store OAuth tokens and account info, get temp token back
    const tempToken = saveOAuthTokensForTwoFactor({
      accountId: user.id,
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
  const accessToken = await createOAuthJwtToken(user.id, oauthAccessToken, expiresIn);
  const refreshToken = await createOAuthRefreshToken(user.id, oauthRefreshToken);

  // Check for additional scopes from GooglePermissions
  const needsAdditionalScopes = await checkForAdditionalScopes(user.id, oauthAccessToken);

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

/**
 * Set up two-factor authentication for OAuth accounts
 * Uses OAuth provider token validation instead of password
 */
export async function setupOAuthTwoFactor(
  accountId: string,
  accessToken: string,
  data: { enableTwoFactor: boolean },
): Promise<{ secret?: string; qrCodeUrl?: string }> {
  const models = await db.getModels();

  ValidationUtils.validateObjectId(accountId, 'Account ID');
  ValidationUtils.validateAccessToken(accessToken, 'setupOAuthTwoFactor');
  ValidationUtils.validateRequiredFields(data, ['enableTwoFactor']);

  // Find account by ID
  const account = await models.accounts.Account.findById(accountId);

  if (!account || account.accountType !== AccountType.OAuth) {
    throw new NotFoundError('OAuth account not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  // Verify OAuth access token with provider (e.g., Google)
  // This replaces password verification for OAuth accounts
  const tokenVerification = await verifyTokenOwnership(accessToken, accountId);
  if (!tokenVerification.isValid) {
    throw new AuthError(`OAuth token verification failed: ${tokenVerification.reason}`, 403, ApiErrorCode.AUTH_FAILED);
  }

  // Enable or disable 2FA
  if (data.enableTwoFactor) {
    // Generate new secret if it doesn't exist
    if (!account.security.twoFactorSecret) {
      const secret = authenticator.generateSecret();
      account.security.twoFactorSecret = secret;

      // Generate backup codes (10 codes, 8 chars each)
      const backupCodes = Array(10)
        .fill(0)
        .map(() => crypto.randomBytes(4).toString('hex'));

      // Hash the backup codes before storing
      account.security.twoFactorBackupCodes = await Promise.all(
        backupCodes.map(async (code) => {
          const salt = await bcrypt.genSalt(10);
          return bcrypt.hash(code, salt);
        }),
      );

      await account.save();

      const accountName = account.userDetails.email || account.userDetails.username || accountId;
      const qrCodeUrl = authenticator.keyuri(accountName.toString(), getAppName(), secret);

      return {
        secret,
        qrCodeUrl,
      };
    } else {
      // Secret already exists
      const accountName = account.userDetails.email || account.userDetails.username || accountId;
      const qrCodeUrl = authenticator.keyuri(accountName.toString(), getAppName(), account.security.twoFactorSecret);

      return {
        secret: account.security.twoFactorSecret,
        qrCodeUrl,
      };
    }
  } else {
    // Disable 2FA
    account.security.twoFactorEnabled = false;
    account.security.twoFactorSecret = undefined;
    account.security.twoFactorBackupCodes = undefined;

    await account.save();

    return {};
  }
}

/**
 * Verify and enable 2FA for OAuth accounts
 */
export async function verifyAndEnableOAuthTwoFactor(accountId: string, token: string): Promise<boolean> {
  const models = await db.getModels();

  ValidationUtils.validateObjectId(accountId, 'Account ID');
  ValidationUtils.validateRequiredFields({ token }, ['token']);
  ValidationUtils.validateStringLength(token, '2FA token', 6, 6);

  // Find account by ID
  const account = await models.accounts.Account.findById(accountId);

  if (!account || account.accountType !== AccountType.OAuth || !account.security.twoFactorSecret) {
    throw new NotFoundError('OAuth account not found or 2FA not set up', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  // Verify token
  const isValid = authenticator.verify({
    token,
    secret: account.security.twoFactorSecret,
  });

  if (!isValid) {
    throw new ValidationError('Invalid two-factor code', 401, ApiErrorCode.AUTH_FAILED);
  }

  // Enable 2FA
  account.security.twoFactorEnabled = true;
  await account.save();

  return true;
}

/**
 * Generate new backup codes for OAuth accounts
 * Uses OAuth token validation instead of password
 */
export async function generateOAuthBackupCodes(accountId: string, accessToken: string): Promise<string[]> {
  const models = await db.getModels();

  ValidationUtils.validateObjectId(accountId, 'Account ID');
  ValidationUtils.validateAccessToken(accessToken, 'generateOAuthBackupCodes');

  // Find account by ID
  const account = await models.accounts.Account.findById(accountId);

  if (!account || account.accountType !== AccountType.OAuth) {
    throw new NotFoundError('OAuth account not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  if (!account.security.twoFactorEnabled) {
    throw new BadRequestError(
      'Two-factor authentication is not enabled for this account',
      400,
      ApiErrorCode.INVALID_REQUEST,
    );
  }

  // Verify OAuth access token with provider instead of password
  const tokenVerification = await verifyTokenOwnership(accessToken, accountId);
  if (!tokenVerification.isValid) {
    throw new AuthError(`OAuth token verification failed: ${tokenVerification.reason}`, 403, ApiErrorCode.AUTH_FAILED);
  }

  // Generate new backup codes (10 codes, 8 chars each)
  const backupCodes = Array(10)
    .fill(0)
    .map(() => crypto.randomBytes(4).toString('hex'));

  // Hash the backup codes before storing
  account.security.twoFactorBackupCodes = await Promise.all(
    backupCodes.map(async (code) => {
      const salt = await bcrypt.genSalt(10);
      return bcrypt.hash(code, salt);
    }),
  );

  await account.save();

  // Return plain text codes to show to user
  return backupCodes;
}

/**
 * Complete OAuth signin after 2FA verification
 */
export async function completeOAuthSigninAfterTwoFactor(tempToken: string, twoFactorCode: string) {
  const models = await db.getModels();

  ValidationUtils.validateRequiredFields({ tempToken, twoFactorCode }, ['tempToken', 'twoFactorCode']);
  ValidationUtils.validateStringLength(twoFactorCode, '2FA token', 6, 8);

  // Get OAuth tokens and account info from cache (single source of truth)
  const oauthTokens = getOAuthTokensForTwoFactor(tempToken);
  if (!oauthTokens) {
    throw new ValidationError('OAuth tokens not found or expired', 401, ApiErrorCode.TOKEN_INVALID);
  }

  // Extract account info from cached OAuth tokens
  const accountId = oauthTokens.accountId;
  const userEmail = oauthTokens.userInfo.email;

  // Find account by ID
  const account = await models.accounts.Account.findById(accountId);

  if (
    !account ||
    account.accountType !== AccountType.OAuth ||
    !account.security.twoFactorEnabled ||
    !account.security.twoFactorSecret
  ) {
    throw new NotFoundError('OAuth account not found or 2FA not enabled', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  // Verify email matches (additional security check)
  if (account.userDetails.email !== userEmail) {
    throw new ValidationError('Token account mismatch', 401, ApiErrorCode.AUTH_FAILED);
  }

  // Check if token is a backup code first
  if (account.security.twoFactorBackupCodes && account.security.twoFactorBackupCodes.length > 0) {
    const backupCodeIndex = await Promise.all(
      account.security.twoFactorBackupCodes.map(async (hashedCode, index) => {
        const isMatch = await bcrypt.compare(twoFactorCode, hashedCode);
        return isMatch ? index : -1;
      }),
    ).then((results) => results.find((index) => index !== -1));

    if (backupCodeIndex !== undefined && backupCodeIndex >= 0) {
      // Remove used backup code
      account.security.twoFactorBackupCodes.splice(backupCodeIndex, 1);
      await account.save();

      // Clear temp tokens and complete signin
      removeOAuthTokensForTwoFactor(tempToken);
      return await finishOAuthSignin(oauthTokens, account);
    }
  }

  // Verify regular TOTP token
  const isValid = authenticator.verify({
    token: twoFactorCode,
    secret: account.security.twoFactorSecret,
  });

  if (!isValid) {
    throw new ValidationError('Invalid two-factor code', 401, ApiErrorCode.AUTH_FAILED);
  }

  // Clear temp tokens and complete signin
  removeOAuthTokensForTwoFactor(tempToken);
  return await finishOAuthSignin(oauthTokens, account);
}

/**
 * Helper function to finish OAuth signin process
 */
async function finishOAuthSignin(oauthTokens: OAuthTwoFactorTokens, account: AccountDocument) {
  const { accessToken: oauthAccessToken, refreshToken: oauthRefreshToken } = oauthTokens;
  const accountId = account._id.toString();

  // Update Google permissions if provider is Google
  if (account.provider === OAuthProviders.Google) {
    await updateAccountScopes(accountId, oauthAccessToken);
  }

  // Get token info to determine expiration
  const accessTokenInfo = await getGoogleTokenInfo(oauthAccessToken);
  const expiresIn = accessTokenInfo.expires_in || 3600;

  // Create our JWT tokens that wrap the OAuth tokens
  const accessToken = await createOAuthJwtToken(accountId, oauthAccessToken, expiresIn);
  const refreshToken = await createOAuthRefreshToken(accountId, oauthRefreshToken);

  // Check for additional scopes
  const needsAdditionalScopes = await checkForAdditionalScopes(accountId, oauthAccessToken);

  return {
    userId: accountId,
    userName: account.userDetails.name,
    accessToken,
    refreshToken,
    accessTokenInfo,
    needsAdditionalScopes: needsAdditionalScopes.needsAdditionalScopes,
    missingScopes: needsAdditionalScopes.missingScopes,
  };
}
