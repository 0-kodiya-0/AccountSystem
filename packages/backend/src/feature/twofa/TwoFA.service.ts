import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import { ValidationUtils } from '../../utils/validation';
import { ApiErrorCode, AuthError, BadRequestError, NotFoundError, ValidationError } from '../../types/response.types';
import { AccountType } from '../account/Account.types';
import { getAppName } from '../../config/env.config';
import { verifyGoogleTokenOwnership } from '../google/services/tokenInfo/tokenInfo.services';
import { AccountDocument } from '../account/Account.model';
import { getModels } from '../../config/db.config';
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
import {
  getTwoFactorSetupToken,
  getTwoFactorTempToken,
  removeTwoFactorSetupToken,
  removeTwoFactorTempToken,
  saveTwoFactorSetupToken,
} from './TwoFA.cache';
import { logger } from '../../utils/logger';

/**
 * Get 2FA status for an account
 */
export async function getTwoFactorStatus(accountId: string): Promise<TwoFactorStatusResponse> {
  ValidationUtils.validateObjectId(accountId, 'Account ID');

  const models = await getModels();
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
 * Now returns a setup token for verification
 */
export async function setupTwoFactor(
  accountId: string,
  data: SetupTwoFactorRequest,
  oauthAccessToken?: string,
): Promise<TwoFactorSetupResponse> {
  ValidationUtils.validateObjectId(accountId, 'Account ID');
  ValidationUtils.validateRequiredFields(data, ['enableTwoFactor']);

  const models = await getModels();
  const account = await models.accounts.Account.findById(accountId);

  if (!account) {
    throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  // Verify authentication based on account type
  await verifyAccountAuthentication(account, data.password, oauthAccessToken);

  if (data.enableTwoFactor) {
    return await enableTwoFactorWithSetupToken(account);
  } else {
    return await disableTwoFactor(account);
  }
}

/**
 * Verify and enable 2FA setup using setup token
 */
export async function verifyAndEnableTwoFactor(
  accountId: string,
  data: VerifySetupTwoFactorRequest,
): Promise<TwoFactorSetupResponse> {
  ValidationUtils.validateObjectId(accountId, 'Account ID');
  ValidationUtils.validateRequiredFields(data, ['token', 'setupToken']);
  ValidationUtils.validateStringLength(data.token, '2FA token', 6, 6);

  // Get setup token data
  const setupTokenData = getTwoFactorSetupToken(data.setupToken);
  if (!setupTokenData) {
    throw new ValidationError('Invalid or expired setup token', 401, ApiErrorCode.TOKEN_INVALID);
  }

  // Verify the setup token belongs to the correct account
  if (setupTokenData.accountId !== accountId) {
    throw new ValidationError('Setup token does not belong to this account', 401, ApiErrorCode.TOKEN_INVALID);
  }

  const models = await getModels();
  const account = await models.accounts.Account.findById(accountId);

  if (!account) {
    throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  // Verify the 2FA token using the secret from the setup token
  const isValid = authenticator.verify({
    token: data.token,
    secret: setupTokenData.secret,
  });

  if (!isValid) {
    throw new ValidationError('Invalid two-factor code', 401, ApiErrorCode.AUTH_FAILED);
  }

  // Enable 2FA with the verified secret
  account.security.twoFactorEnabled = true;
  account.security.twoFactorSecret = setupTokenData.secret;
  await account.save();

  // Remove the setup token as it's been used
  removeTwoFactorSetupToken(data.setupToken);

  logger.info(`2FA enabled successfully for account ${accountId}`);

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

  const models = await getModels();
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

  const models = await getModels();
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
 * Helper: Enable 2FA for account with setup token
 */
async function enableTwoFactorWithSetupToken(account: AccountDocument): Promise<TwoFactorSetupResponse> {
  // Generate new secret
  const secret = authenticator.generateSecret();

  // Generate backup codes (10 codes, 8 chars each)
  const backupCodes = Array(10)
    .fill(0)
    .map(() => crypto.randomBytes(4).toString('hex'));

  // Hash the backup codes before storing
  const hashedBackupCodes = await Promise.all(
    backupCodes.map(async (code) => {
      const salt = await bcrypt.genSalt(10);
      return bcrypt.hash(code, salt);
    }),
  );

  // Store the secret and backup codes in the account, but don't enable 2FA yet
  account.security.twoFactorSecret = secret;
  account.security.twoFactorBackupCodes = hashedBackupCodes;
  account.security.twoFactorEnabled = false; // Keep disabled until verification
  await account.save();

  // Create setup token
  const setupToken = saveTwoFactorSetupToken(
    account._id.toString(),
    secret,
    account.accountType === AccountType.Local ? 'local' : 'oauth',
  );

  const accountName = account.userDetails.email || account.userDetails.username || account._id.toString();
  const qrCodeUrl = authenticator.keyuri(accountName, getAppName(), secret);

  logger.info(`2FA setup initiated for account ${account._id.toString()}`);

  return {
    message: '2FA setup successful. Please scan the QR code with your authenticator app and verify with a code.',
    secret,
    qrCodeUrl,
    backupCodes, // Return unhashed codes for user to save
    setupToken, // Return setup token for verification step
  };
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
