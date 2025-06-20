import crypto from 'crypto';
import { LRUCache } from 'lru-cache';
import { TwoFactorTempToken, TwoFactorSetupToken } from './TwoFA.types';

// Cache for temporary 2FA tokens during login (5 minutes)
const twoFactorTempOptions = {
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
  updateAgeOnGet: false,
  allowStale: false,
};

// Cache for 2FA setup tokens (15 minutes)
const twoFactorSetupOptions = {
  max: 500,
  ttl: 1000 * 60 * 15, // 15 minutes
  updateAgeOnGet: false,
  allowStale: false,
};

const twoFactorTempCache = new LRUCache<string, TwoFactorTempToken>(twoFactorTempOptions);
const twoFactorSetupCache = new LRUCache<string, TwoFactorSetupToken>(twoFactorSetupOptions);

/**
 * Save temporary token for 2FA verification during login
 * Unified for both local and OAuth accounts
 */
export const saveTwoFactorTempToken = (
  accountId: string,
  email: string,
  accountType: 'local' | 'oauth',
  oauthTokens?: {
    accessToken: string;
    refreshToken: string;
    userInfo?: any;
  },
): string => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + twoFactorTempOptions.ttl);

  const tokenData: TwoFactorTempToken = {
    token,
    accountId,
    email,
    accountType,
    expiresAt: expiresAt.toISOString(),
    ...(oauthTokens && { oauthTokens }),
  };

  twoFactorTempCache.set(token, tokenData);
  return token;
};

/**
 * Get temporary token data for 2FA verification
 */
export const getTwoFactorTempToken = (token: string): TwoFactorTempToken | null => {
  const tokenData = twoFactorTempCache.get(token);

  if (!tokenData) {
    return null;
  }

  // Check if token has expired
  if (new Date(tokenData.expiresAt) < new Date()) {
    twoFactorTempCache.delete(token);
    return null;
  }

  return tokenData;
};

/**
 * Remove temporary token after successful verification
 */
export const removeTwoFactorTempToken = (token: string): void => {
  twoFactorTempCache.delete(token);
};

/**
 * Save setup token for 2FA setup verification
 * This token ensures the verify-setup request comes after a valid setup request
 */
export const saveTwoFactorSetupToken = (accountId: string, secret: string, accountType: 'local' | 'oauth'): string => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + twoFactorSetupOptions.ttl);

  const tokenData: TwoFactorSetupToken = {
    token,
    accountId,
    secret,
    accountType,
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
  };

  twoFactorSetupCache.set(token, tokenData);
  return token;
};

/**
 * Get setup token data for verification
 */
export const getTwoFactorSetupToken = (token: string): TwoFactorSetupToken | null => {
  const tokenData = twoFactorSetupCache.get(token);

  if (!tokenData) {
    return null;
  }

  // Check if token has expired
  if (new Date(tokenData.expiresAt) < new Date()) {
    twoFactorSetupCache.delete(token);
    return null;
  }

  return tokenData;
};

/**
 * Remove setup token after successful verification
 */
export const removeTwoFactorSetupToken = (token: string): void => {
  twoFactorSetupCache.delete(token);
};

/**
 * Clean up expired tokens (for maintenance)
 */
export const cleanupExpiredTwoFactorTokens = (): void => {
  for (const [token, tokenData] of twoFactorTempCache.entries()) {
    if (new Date(tokenData.expiresAt) < new Date()) {
      twoFactorTempCache.delete(token);
    }
  }

  for (const [token, tokenData] of twoFactorSetupCache.entries()) {
    if (new Date(tokenData.expiresAt) < new Date()) {
      twoFactorSetupCache.delete(token);
    }
  }
};

/**
 * Get cache statistics
 */
export const getTwoFactorCacheStats = () => {
  return {
    temp: {
      size: twoFactorTempCache.size,
      max: twoFactorTempCache.max,
    },
    setup: {
      size: twoFactorSetupCache.size,
      max: twoFactorSetupCache.max,
    },
  };
};
