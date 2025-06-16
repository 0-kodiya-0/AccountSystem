import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import { ValidationUtils } from '../../utils/validation';
import { ApiErrorCode, AuthError, BadRequestError, NotFoundError, ValidationError } from '../../types/response.types';
import { AccountType } from '../account/Account.types';
import { getAppName } from '../../config/env.config';
import { verifyGoogleTokenOwnership } from '../google/services/tokenInfo/tokenInfo.services';
import { AccountDocument } from '../account/Account.model';
import db from '../../config/db';
import {
  SetupTwoFactorRequest,
  VerifySetupTwoFactorRequest,
  GenerateBackupCodesRequest,
  TwoFactorSetupResponse,
  TwoFactorStatusResponse,
  BackupCodesResponse,
  TwoFactorLoginResponse,
  VerifyTwoFactorLoginRequest,
} from './TwoFA.types';
import { saveTwoFactorTempToken, getTwoFactorTempToken, removeTwoFactorTempToken } from './TwoFA.cache';
import { logger } from '../../utils/logger';

/**
 * Get 2FA status for an account
 */
export async function getTwoFactorStatus(accountId: string): Promise<TwoFactorStatusResponse> {
  ValidationUtils.validateObjectId(accountId, 'Account ID');

  const models = await db.getModels();
  const account = await models.accounts.Account.findById(accountId);

  if (!account) {
    throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  return {
    enabled: account.security.twoFactorEnabled || false,
    backupCodesCount: account.security.twoFactorBackupCodes?.length || 0,
    lastSetupDate: account.security.lastPasswordChange?.toISOString(),
  };
}

/**
 * Set up 2FA for any account type (unified)
 */
export async function setupTwoFactor(
  accountId: string,
  data: SetupTwoFactorRequest,
  oauthAccessToken?: string,
): Promise<TwoFactorSetupResponse> {
  ValidationUtils.validateObjectId(accountId, 'Account ID');
  ValidationUtils.validateRequiredFields(data, ['enableTwoFactor']);

  const models = await db.getModels();
  const account = await models.accounts.Account.findById(accountId);

  if (!account) {
    throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  // Verify authentication based on account type
  await verifyAccountAuthentication(account, data.password, oauthAccessToken);

  if (data.enableTwoFactor) {
    return await enableTwoFactor(account);
  } else {
    return await disableTwoFactor(account);
  }
}

/**
 * Verify and enable 2FA setup
 */
export async function verifyAndEnableTwoFactor(
  accountId: string,
  data: VerifySetupTwoFactorRequest,
): Promise<TwoFactorSetupResponse> {
  ValidationUtils.validateObjectId(accountId, 'Account ID');
  ValidationUtils.validateRequiredFields(data, ['token']);
  ValidationUtils.validateStringLength(data.token, '2FA token', 6, 6);

  const models = await db.getModels();
  const account = await models.accounts.Account.findById(accountId);

  if (!account || !account.security.twoFactorSecret) {
    throw new NotFoundError('Account not found or 2FA not set up', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  // Verify token
  const isValid = authenticator.verify({
    token: data.token,
    secret: account.security.twoFactorSecret,
  });

  if (!isValid) {
    throw new ValidationError('Invalid two-factor code', 401, ApiErrorCode.AUTH_FAILED);
  }

  // Enable 2FA
  account.security.twoFactorEnabled = true;
  await account.save();

  return {
    message: 'Two-factor authentication has been successfully enabled for your account.',
  };
}

/**
 * Generate new backup codes
 */
export async function generateBackupCodes(
  accountId: string,
  data: GenerateBackupCodesRequest,
  oauthAccessToken?: string,
): Promise<BackupCodesResponse> {
  ValidationUtils.validateObjectId(accountId, 'Account ID');

  const models = await db.getModels();
  const account = await models.accounts.Account.findById(accountId);

  if (!account) {
    throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  if (!account.security.twoFactorEnabled) {
    throw new BadRequestError(
      'Two-factor authentication is not enabled for this account',
      400,
      ApiErrorCode.INVALID_REQUEST,
    );
  }

  // Verify authentication based on account type
  await verifyAccountAuthentication(account, data.password, oauthAccessToken);

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

  return {
    message: 'New backup codes generated successfully. Please save these codes in a secure location.',
    backupCodes,
  };
}

/**
 * Save temporary token for 2FA verification during login
 * Unified for both local and OAuth accounts
 */
export function saveTwoFactorLoginToken(
  accountId: string,
  email: string,
  accountType: AccountType,
  oauthTokens?: {
    accessToken: string;
    refreshToken: string;
    userInfo?: any;
  },
): string {
  const tempToken = saveTwoFactorTempToken(
    accountId,
    email,
    accountType === AccountType.Local ? 'local' : 'oauth',
    oauthTokens,
  );

  logger.info(`2FA temp token created for account ${accountId} (${accountType})`);
  return tempToken;
}

/**
 * Verify 2FA code during login and complete authentication
 * Unified for both local and OAuth accounts
 */
export async function verifyTwoFactorLogin(data: VerifyTwoFactorLoginRequest): Promise<TwoFactorLoginResponse> {
  ValidationUtils.validateRequiredFields(data, ['token', 'tempToken']);
  ValidationUtils.validateStringLength(data.token, '2FA token', 6, 8);

  // Get temporary token data
  const tempTokenData = getTwoFactorTempToken(data.tempToken);
  if (!tempTokenData) {
    throw new ValidationError('Invalid or expired temporary token', 401, ApiErrorCode.TOKEN_INVALID);
  }

  const { accountId, email, accountType } = tempTokenData;

  const models = await db.getModels();
  const account = await models.accounts.Account.findById(accountId);

  if (!account || !account.security.twoFactorEnabled || !account.security.twoFactorSecret) {
    throw new NotFoundError('Account not found or 2FA not enabled', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  // Verify email matches (additional security check)
  if (account.userDetails.email !== email) {
    throw new ValidationError('Token account mismatch', 401, ApiErrorCode.AUTH_FAILED);
  }

  // Verify 2FA code (check backup codes first, then TOTP)
  const isValidCode = await verifyTwoFactorCode(account, data.token);
  if (!isValidCode) {
    throw new ValidationError('Invalid two-factor code', 401, ApiErrorCode.AUTH_FAILED);
  }

  // Clear temp token
  removeTwoFactorTempToken(data.tempToken);

  // Prepare response with token information for session setup
  const response: TwoFactorLoginResponse = {
    accountId,
    name: account.userDetails.name,
    message: 'Two-factor authentication successful',
    accountType: accountType === 'local' ? AccountType.Local : AccountType.OAuth,
  };

  // Add OAuth-specific fields and token data if needed
  if (accountType === 'oauth' && tempTokenData.oauthTokens) {
    response.needsAdditionalScopes = false;
    response.missingScopes = [];
    response.oauthTokens = tempTokenData.oauthTokens;
  }

  return response;
}

/**
 * Helper: Verify account authentication based on type
 */
async function verifyAccountAuthentication(
  account: AccountDocument,
  password?: string,
  oauthAccessToken?: string,
): Promise<void> {
  if (account.accountType === AccountType.Local) {
    if (!password) {
      throw new BadRequestError('Password is required for local accounts', 400, ApiErrorCode.MISSING_DATA);
    }

    const isPasswordValid = await account.comparePassword!(password);
    if (!isPasswordValid) {
      throw new ValidationError('Password is incorrect', 401, ApiErrorCode.AUTH_FAILED);
    }
  } else if (account.accountType === AccountType.OAuth) {
    if (!oauthAccessToken) {
      throw new BadRequestError('OAuth access token is required for OAuth accounts', 400, ApiErrorCode.TOKEN_INVALID);
    }

    const tokenVerification = await verifyGoogleTokenOwnership(oauthAccessToken, account._id.toString());
    if (!tokenVerification.isValid) {
      throw new AuthError(
        `OAuth token verification failed: ${tokenVerification.reason}`,
        403,
        ApiErrorCode.AUTH_FAILED,
      );
    }
  } else {
    throw new BadRequestError('Unsupported account type', 400, ApiErrorCode.INVALID_REQUEST);
  }
}

/**
 * Helper: Enable 2FA for account
 */
async function enableTwoFactor(account: AccountDocument): Promise<TwoFactorSetupResponse> {
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

    const accountName = account.userDetails.email || account.userDetails.username || account._id.toString();
    const qrCodeUrl = authenticator.keyuri(accountName, getAppName(), secret);

    return {
      message: '2FA setup successful. Please scan the QR code with your authenticator app.',
      secret,
      qrCodeUrl,
      backupCodes, // Return unhashed codes for user to save
    };
  } else {
    // Secret already exists
    const accountName = account.userDetails.email || account.userDetails.username || account._id.toString();
    const qrCodeUrl = authenticator.keyuri(accountName, getAppName(), account.security.twoFactorSecret);

    return {
      message: '2FA setup successful. Please scan the QR code with your authenticator app.',
      secret: account.security.twoFactorSecret,
      qrCodeUrl,
    };
  }
}

/**
 * Helper: Disable 2FA for account
 */
async function disableTwoFactor(account: AccountDocument): Promise<TwoFactorSetupResponse> {
  account.security.twoFactorEnabled = false;
  account.security.twoFactorSecret = undefined;
  account.security.twoFactorBackupCodes = undefined;

  await account.save();

  return {
    message: '2FA has been disabled for your account.',
  };
}

/**
 * Helper: Verify 2FA code (backup codes or TOTP)
 */
async function verifyTwoFactorCode(account: AccountDocument, token: string): Promise<boolean> {
  // Check if token is a backup code first
  if (account.security.twoFactorBackupCodes && account.security.twoFactorBackupCodes.length > 0) {
    const backupCodeIndex = await Promise.all(
      account.security.twoFactorBackupCodes.map(async (hashedCode, index) => {
        const isMatch = await bcrypt.compare(token, hashedCode);
        return isMatch ? index : -1;
      }),
    ).then((results) => results.find((index) => index !== -1));

    if (backupCodeIndex !== undefined && backupCodeIndex >= 0) {
      // Remove used backup code
      account.security.twoFactorBackupCodes.splice(backupCodeIndex, 1);
      await account.save();
      return true;
    }
  }

  // Verify regular TOTP token
  if (!account.security.twoFactorSecret) {
    return false;
  }

  return authenticator.verify({
    token,
    secret: account.security.twoFactorSecret,
  });
}
