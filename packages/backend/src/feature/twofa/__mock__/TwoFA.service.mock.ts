import { authenticator } from 'otplib';
import crypto from 'crypto';
import { ValidationUtils } from '../../../utils/validation';
import { ApiErrorCode, BadRequestError, NotFoundError } from '../../../types/response.types';
import { getModels } from '../../../config/db.config';
import { logger } from '../../../utils/logger';
import * as TwoFaCache from '../TwoFA.cache';

/**
 * Generate TOTP code for a given secret (simulates authenticator app)
 */
export async function generateTotpCode(secret: string): Promise<{
  token: string;
  secret: string;
  timeRemaining: number;
  timeUsed: number;
}> {
  if (!secret) {
    throw new BadRequestError('Secret is required', 400, ApiErrorCode.MISSING_DATA);
  }

  try {
    // Generate TOTP code using the secret
    const token = authenticator.generate(secret);

    // Get time window info for debugging
    const timeRemaining = authenticator.timeRemaining();
    const timeUsed = authenticator.timeUsed();

    logger.info(`Mock: Generated TOTP code for secret ${secret.substring(0, 8)}...`);

    return {
      token,
      secret: secret.substring(0, 8) + '...', // Partial secret for identification
      timeRemaining,
      timeUsed,
    };
  } catch (error) {
    logger.error('Error generating TOTP code:', error);
    throw new BadRequestError('Invalid secret format', 400, ApiErrorCode.VALIDATION_ERROR);
  }
}

/**
 * Get the 2FA secret for an account (for testing purposes)
 */
export async function getAccountSecret(accountId: string): Promise<{
  accountId: string;
  secret: string;
  twoFactorEnabled: boolean;
}> {
  ValidationUtils.validateObjectId(accountId, 'Account ID');

  const models = await getModels();
  const account = await models.accounts.Account.findById(accountId);

  if (!account) {
    throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  if (!account.security.twoFactorSecret) {
    throw new NotFoundError('Account does not have 2FA secret', 404, ApiErrorCode.RESOURCE_NOT_FOUND);
  }

  logger.info(`Mock: Retrieved 2FA secret for account ${accountId}`);

  return {
    accountId,
    secret: account.security.twoFactorSecret,
    twoFactorEnabled: account.security.twoFactorEnabled,
  };
}

/**
 * Generate TOTP code for an account using its stored secret
 */
export async function generateAccountTotpCode(accountId: string): Promise<{
  accountId: string;
  token: string;
  twoFactorEnabled: boolean;
  timeRemaining: number;
  timeUsed: number;
}> {
  ValidationUtils.validateObjectId(accountId, 'Account ID');

  const models = await getModels();
  const account = await models.accounts.Account.findById(accountId);

  if (!account) {
    throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  if (!account.security.twoFactorSecret) {
    throw new NotFoundError('Account does not have 2FA secret', 404, ApiErrorCode.RESOURCE_NOT_FOUND);
  }

  try {
    // Generate TOTP code using the account's secret
    const token = authenticator.generate(account.security.twoFactorSecret);

    // Get time window info
    const timeRemaining = authenticator.timeRemaining();
    const timeUsed = authenticator.timeUsed();

    logger.info(`Mock: Generated TOTP code for account ${accountId}`);

    return {
      accountId,
      token,
      twoFactorEnabled: account.security.twoFactorEnabled,
      timeRemaining,
      timeUsed,
    };
  } catch (error) {
    logger.error('Error generating TOTP code for account:', error);
    throw new BadRequestError('Failed to generate TOTP code', 500, ApiErrorCode.SERVER_ERROR);
  }
}

/**
 * Validate a TOTP token against a secret (simulates authenticator verification)
 */
export async function validateTotpToken(
  secret: string,
  token: string,
): Promise<{
  valid: boolean;
  token: string;
  secret: string;
  timeRemaining: number;
  timeUsed: number;
}> {
  if (!secret || !token) {
    throw new BadRequestError('Secret and token are required', 400, ApiErrorCode.MISSING_DATA);
  }

  ValidationUtils.validateStringLength(token, 'Token', 6, 6);

  try {
    // Validate the token
    const isValid = authenticator.verify({ token, secret });

    // Get time window info
    const timeRemaining = authenticator.timeRemaining();
    const timeUsed = authenticator.timeUsed();

    logger.info(`Mock: Validated token ${token} against secret ${secret.substring(0, 8)}... - Result: ${isValid}`);

    return {
      valid: isValid,
      token,
      secret: secret.substring(0, 8) + '...', // Partial secret for identification
      timeRemaining,
      timeUsed,
    };
  } catch (error) {
    logger.error('Error validating TOTP token:', error);
    throw new BadRequestError('Token validation failed', 400, ApiErrorCode.VALIDATION_ERROR);
  }
}

/**
 * Get 2FA cache statistics (temp tokens, setup tokens)
 */
export async function getCacheStatistics(): Promise<{
  temp: { size: number; max: number };
  setup: { size: number; max: number };
}> {
  const stats = TwoFaCache.getTwoFactorCacheStats();

  logger.info('Mock: Retrieved 2FA cache statistics');

  return stats;
}

/**
 * Get all temporary tokens (for debugging login flows)
 */
export async function getAllTemporaryTokens(): Promise<{
  count: number;
  tokens: Array<{
    token: string;
    accountId: string;
    email: string;
    accountType: string;
    expiresAt: string;
    hasOAuthTokens: boolean;
  }>;
}> {
  const tempTokens = TwoFaCache.getAllTempTokens();

  logger.info(`Mock: Retrieved ${tempTokens.length} temporary tokens`);

  return {
    count: tempTokens.length,
    tokens: tempTokens.map((token) => ({
      token: token.token,
      accountId: token.accountId,
      email: token.email,
      accountType: token.accountType,
      expiresAt: token.expiresAt,
      hasOAuthTokens: !!token.oauthTokens,
    })),
  };
}

/**
 * Get all setup tokens (for debugging setup flows)
 */
export async function getAllSetupTokens(): Promise<{
  count: number;
  tokens: Array<{
    token: string;
    accountId: string;
    secret: string;
    accountType: string;
    expiresAt: string;
    createdAt: string;
  }>;
}> {
  const setupTokens = TwoFaCache.getAllSetupTokens();

  logger.info(`Mock: Retrieved ${setupTokens.length} setup tokens`);

  return {
    count: setupTokens.length,
    tokens: setupTokens.map((token) => ({
      token: token.token,
      accountId: token.accountId,
      secret: token.secret.substring(0, 8) + '...', // Partial secret
      accountType: token.accountType,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
    })),
  };
}

/**
 * Get specific temporary token data
 */
export async function getTemporaryTokenData(token: string): Promise<{
  token: string;
  accountId: string;
  email: string;
  accountType: string;
  expiresAt: string;
  oauthTokens?: any;
}> {
  if (!token) {
    throw new BadRequestError('Token is required', 400, ApiErrorCode.MISSING_DATA);
  }

  const tokenData = TwoFaCache.getTwoFactorTempToken(token);

  if (!tokenData) {
    throw new NotFoundError('Temporary token not found or expired', 404, ApiErrorCode.RESOURCE_NOT_FOUND);
  }

  logger.info(`Mock: Retrieved temporary token data for ${token.substring(0, 16)}...`);

  return tokenData;
}

/**
 * Get specific setup token data
 */
export async function getSetupTokenData(token: string): Promise<{
  token: string;
  accountId: string;
  secret: string;
  accountType: string;
  expiresAt: string;
  createdAt: string;
}> {
  if (!token) {
    throw new BadRequestError('Token is required', 400, ApiErrorCode.MISSING_DATA);
  }

  const tokenData = TwoFaCache.getTwoFactorSetupToken(token);

  if (!tokenData) {
    throw new NotFoundError('Setup token not found or expired', 404, ApiErrorCode.RESOURCE_NOT_FOUND);
  }

  logger.info(`Mock: Retrieved setup token data for ${token.substring(0, 16)}...`);

  return tokenData;
}

/**
 * Generate mock backup codes (for testing backup code flows)
 */
export async function generateMockBackupCodes(count: number = 10): Promise<{
  count: number;
  backupCodes: string[];
}> {
  if (count < 1 || count > 20) {
    throw new BadRequestError('Count must be between 1 and 20', 400, ApiErrorCode.VALIDATION_ERROR);
  }

  // Generate backup codes (8 chars each, hex format)
  const backupCodes = Array(count)
    .fill(0)
    .map(() => crypto.randomBytes(4).toString('hex'));

  logger.info(`Mock: Generated ${count} backup codes`);

  return {
    count,
    backupCodes,
  };
}

export async function getTwoFAStatus() {
  const tempTokens = TwoFaCache.getAllTempTokens();
  const setupTokens = TwoFaCache.getAllSetupTokens();
  const cacheStats = TwoFaCache.getTwoFactorCacheStats();

  // Calculate statistics for temp tokens
  const tempTokenStats = {
    total: tempTokens.length,
    byAccountType: {} as Record<string, number>,
    withOAuthTokens: tempTokens.filter((token) => !!token.oauthTokens).length,
    expiring: {
      in5Minutes: 0,
      in15Minutes: 0,
      in30Minutes: 0,
    },
  };

  // Calculate statistics for setup tokens
  const setupTokenStats = {
    total: setupTokens.length,
    byAccountType: {} as Record<string, number>,
    expiring: {
      in5Minutes: 0,
      in15Minutes: 0,
      in30Minutes: 0,
    },
  };

  const now = new Date();

  // Process temp tokens
  tempTokens.forEach((token) => {
    // Count by account type
    tempTokenStats.byAccountType[token.accountType] = (tempTokenStats.byAccountType[token.accountType] || 0) + 1;

    // Count expiring tokens
    const expiresAt = new Date(token.expiresAt);
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();

    if (timeUntilExpiry <= 5 * 60 * 1000) {
      // 5 minutes
      tempTokenStats.expiring.in5Minutes++;
    } else if (timeUntilExpiry <= 15 * 60 * 1000) {
      // 15 minutes
      tempTokenStats.expiring.in15Minutes++;
    } else if (timeUntilExpiry <= 30 * 60 * 1000) {
      // 30 minutes
      tempTokenStats.expiring.in30Minutes++;
    }
  });

  // Process setup tokens
  setupTokens.forEach((token) => {
    // Count by account type
    setupTokenStats.byAccountType[token.accountType] = (setupTokenStats.byAccountType[token.accountType] || 0) + 1;

    // Count expiring tokens
    const expiresAt = new Date(token.expiresAt);
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();

    if (timeUntilExpiry <= 5 * 60 * 1000) {
      // 5 minutes
      setupTokenStats.expiring.in5Minutes++;
    } else if (timeUntilExpiry <= 15 * 60 * 1000) {
      // 15 minutes
      setupTokenStats.expiring.in15Minutes++;
    } else if (timeUntilExpiry <= 30 * 60 * 1000) {
      // 30 minutes
      setupTokenStats.expiring.in30Minutes++;
    }
  });

  return {
    cache: {
      temp: {
        size: cacheStats.temp.size,
        max: cacheStats.temp.max,
        utilization: Math.round((cacheStats.temp.size / cacheStats.temp.max) * 100),
      },
      setup: {
        size: cacheStats.setup.size,
        max: cacheStats.setup.max,
        utilization: Math.round((cacheStats.setup.size / cacheStats.setup.max) * 100),
      },
    },
    tempTokens: tempTokenStats,
    setupTokens: setupTokenStats,
    summary: {
      totalActiveTokens: tempTokens.length + setupTokens.length,
      totalCacheUsage: cacheStats.temp.size + cacheStats.setup.size,
      totalCacheCapacity: cacheStats.temp.max + cacheStats.setup.max,
      overallUtilization: Math.round(
        ((cacheStats.temp.size + cacheStats.setup.size) / (cacheStats.temp.max + cacheStats.setup.max)) * 100,
      ),
    },
    timestamp: new Date().toISOString(),
  };
}
