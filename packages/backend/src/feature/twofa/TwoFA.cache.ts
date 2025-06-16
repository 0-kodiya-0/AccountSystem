import crypto from 'crypto';
import { LRUCache } from 'lru-cache';
import { TwoFactorTempToken } from './TwoFA.types';

// Cache for temporary 2FA tokens during login (5 minutes)
const twoFactorTempOptions = {
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
  updateAgeOnGet: false,
  allowStale: false,
};

const twoFactorTempCache = new LRUCache<string, TwoFactorTempToken>(twoFactorTempOptions);

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
 * Clean up expired tokens (for maintenance)
 */
export const cleanupExpiredTwoFactorTokens = (): void => {
  for (const [token, tokenData] of twoFactorTempCache.entries()) {
    if (new Date(tokenData.expiresAt) < new Date()) {
      twoFactorTempCache.delete(token);
    }
  }
};

/**
 * Get cache statistics
 */
export const getTwoFactorCacheStats = () => {
  return {
    size: twoFactorTempCache.size,
    max: twoFactorTempCache.max,
  };
};
