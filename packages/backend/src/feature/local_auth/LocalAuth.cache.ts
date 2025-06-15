import { LRUCache } from 'lru-cache';
import crypto from 'crypto';
import {
  TwoFactorTempToken,
  PasswordResetToken,
  EmailVerificationToken,
  EmailVerificationData,
  ProfileCompletionData,
} from './LocalAuth.types';

// Cache options with TTL (time to live)
const options = {
  max: 1000, // Maximum number of items in cache
  ttl: 1000 * 60 * 10, // 10 minutes in milliseconds for password reset
  updateAgeOnGet: false, // Don't reset TTL when reading an item
  allowStale: false, // Don't allow expired items to be returned
};

const verificationOptions = {
  max: 1000, // Maximum number of items in cache
  ttl: 1000 * 60 * 60 * 24, // 24 hours in milliseconds for email verification
  updateAgeOnGet: false,
  allowStale: false,
};

// Cache for temporary 2FA tokens (5 minutes)
const twoFactorTempOptions = {
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
  updateAgeOnGet: false,
  allowStale: false,
};

// Create separate caches for each token type
const twoFactorTempCache = new LRUCache<string, TwoFactorTempToken>(twoFactorTempOptions);
const passwordResetCache = new LRUCache<string, PasswordResetToken>(options);
const emailVerificationCache = new LRUCache<string, EmailVerificationToken>(verificationOptions);

const emailVerificationStepOptions = {
  max: 1000,
  ttl: 1000 * 60 * 60 * 24, // 24 hours
  updateAgeOnGet: false,
  allowStale: false,
};

const emailVerificationStepCache = new LRUCache<string, EmailVerificationData>(emailVerificationStepOptions);

// Cache for profile completion step (1 hour after email verification)
const profileCompletionOptions = {
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour
  updateAgeOnGet: false,
  allowStale: false,
};

const profileCompletionCache = new LRUCache<string, ProfileCompletionData>(profileCompletionOptions);

// Password Reset Token methods
export const savePasswordResetToken = (accountId: string, email: string): string => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + options.ttl);

  const tokenData: PasswordResetToken = {
    token,
    accountId,
    email,
    expiresAt: expiresAt.toISOString(),
  };

  passwordResetCache.set(token, tokenData);
  return token;
};

export const getPasswordResetToken = (token: string): PasswordResetToken | null => {
  const tokenData = passwordResetCache.get(token);

  if (!tokenData) {
    return null;
  }

  // Check if token has expired
  if (new Date(tokenData.expiresAt) < new Date()) {
    passwordResetCache.delete(token);
    return null;
  }

  return tokenData;
};

export const removePasswordResetToken = (token: string): void => {
  passwordResetCache.delete(token);
};

// Helper method to clean up all tokens for a specific account
export const removeAllTokensForAccount = (accountId: string): void => {
  // Clean password reset tokens
  for (const [token, data] of passwordResetCache.entries()) {
    if (data.accountId === accountId) {
      passwordResetCache.delete(token);
    }
  }

  // Clean verification tokens
  for (const [token, data] of emailVerificationCache.entries()) {
    if (data.accountId === accountId) {
      emailVerificationCache.delete(token);
    }
  }
};

// Temporary 2FA Token methods
export const saveTwoFactorTempToken = (accountId: string, email: string): string => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + twoFactorTempOptions.ttl);

  const tokenData: TwoFactorTempToken = {
    token,
    accountId,
    email,
    expiresAt: expiresAt.toISOString(),
  };

  twoFactorTempCache.set(token, tokenData);
  return token;
};

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

export const removeTwoFactorTempToken = (token: string): void => {
  twoFactorTempCache.delete(token);
};

// Clear all tokens (useful for testing)
export const clearAllTokens = (): void => {
  passwordResetCache.clear();
  emailVerificationCache.clear();
};

// Get cache stats (useful for monitoring)
export const getCacheStats = () => {
  return {
    passwordReset: {
      size: passwordResetCache.size,
      max: passwordResetCache.max,
    },
    emailVerification: {
      size: emailVerificationCache.size,
      max: emailVerificationCache.max,
    },
  };
};

/**
 * Step 1: Save email for verification
 */
export const saveEmailForVerification = (email: string): string => {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + emailVerificationStepOptions.ttl);

  const emailData: EmailVerificationData = {
    email,
    verificationToken,
    step: 'email_verification',
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
  };

  emailVerificationStepCache.set(email, emailData);
  return verificationToken;
};

/**
 * Get email verification data
 */
export const getEmailVerificationData = (email: string): EmailVerificationData | null => {
  const data = emailVerificationStepCache.get(email);

  if (!data) {
    return null;
  }

  // Check if expired
  if (new Date(data.expiresAt) < new Date()) {
    emailVerificationStepCache.delete(email);
    return null;
  }

  return data;
};

/**
 * Get email verification data by token
 */
export const getEmailVerificationDataByToken = (token: string): EmailVerificationData | null => {
  for (const [email, data] of emailVerificationStepCache.entries()) {
    if (data.verificationToken === token) {
      // Check if expired
      if (new Date(data.expiresAt) < new Date()) {
        emailVerificationStepCache.delete(email);
        return null;
      }
      return data;
    }
  }
  return null;
};

/**
 * Mark email as verified and move to profile completion step
 */
export const markEmailVerifiedAndCreateProfileStep = (email: string): string => {
  const emailData = emailVerificationStepCache.get(email);
  if (!emailData) {
    throw new Error('Email verification data not found');
  }

  // Create profile completion token
  const profileToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + profileCompletionOptions.ttl);

  const profileData: ProfileCompletionData = {
    email,
    emailVerified: true,
    verificationToken: profileToken,
    expiresAt: expiresAt.toISOString(),
  };

  // Remove from email verification cache
  emailVerificationStepCache.delete(email);

  // Add to profile completion cache
  profileCompletionCache.set(profileToken, profileData);

  return profileToken;
};

/**
 * Get profile completion data by token
 */
export const getProfileCompletionData = (token: string): ProfileCompletionData | null => {
  const data = profileCompletionCache.get(token);

  if (!data) {
    return null;
  }

  // Check if expired
  if (new Date(data.expiresAt) < new Date()) {
    profileCompletionCache.delete(token);
    return null;
  }

  return data;
};

/**
 * Remove email from verification cache
 */
export const removeEmailVerificationData = (email: string): void => {
  emailVerificationStepCache.delete(email);
};

/**
 * Remove profile completion data
 */
export const removeProfileCompletionData = (token: string): void => {
  profileCompletionCache.delete(token);
};

/**
 * Clean up all signup data for an email
 */
export const cleanupSignupData = (email: string): void => {
  // Remove from email verification cache
  emailVerificationStepCache.delete(email);

  // Remove from profile completion cache (find by email)
  for (const [token, data] of profileCompletionCache.entries()) {
    if (data.email === email) {
      profileCompletionCache.delete(token);
    }
  }
};
