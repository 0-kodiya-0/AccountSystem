import { describe, it, expect, beforeEach } from 'vitest';
import {
  savePasswordResetToken,
  getPasswordResetToken,
  removePasswordResetToken,
  getCacheStats,
  saveEmailForVerification,
  getEmailVerificationData,
  getEmailVerificationDataByToken,
  markEmailVerifiedAndCreateProfileStep,
  getProfileCompletionData,
  getAllEmailVerificationTokens,
  getAllProfileCompletionTokens,
  getAllPasswordResetTokens,
  removeEmailVerificationData,
  removeProfileCompletionData,
  cleanupSignupData,
} from '../LocalAuth.cache';

describe('Local Auth Cache', () => {
  const mockAccountId = '507f1f77bcf86cd799439011';
  const mockEmail = 'test@example.com';

  beforeEach(() => {
    // Clear all caches before each test by getting all tokens and removing them
    const emailTokens = getAllEmailVerificationTokens();
    emailTokens.forEach((token) => removeEmailVerificationData(token.email));

    const profileTokens = getAllProfileCompletionTokens();
    profileTokens.forEach((token) => removeProfileCompletionData(token.verificationToken));

    const resetTokens = getAllPasswordResetTokens();
    resetTokens.forEach((token) => removePasswordResetToken(token.token));
  });

  describe('Password Reset Token Management', () => {
    it('should save and retrieve password reset token', () => {
      const token = savePasswordResetToken(mockAccountId, mockEmail);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes hex = 64 characters

      const tokenData = getPasswordResetToken(token);
      expect(tokenData).toEqual({
        token,
        accountId: mockAccountId,
        email: mockEmail,
        expiresAt: expect.any(String),
      });
    });

    it('should return null for non-existent password reset token', () => {
      const tokenData = getPasswordResetToken('non_existent_token');
      expect(tokenData).toBeNull();
    });

    it('should remove password reset token', () => {
      const token = savePasswordResetToken(mockAccountId, mockEmail);

      let tokenData = getPasswordResetToken(token);
      expect(tokenData).not.toBeNull();

      removePasswordResetToken(token);

      tokenData = getPasswordResetToken(token);
      expect(tokenData).toBeNull();
    });

    it('should handle password reset token expiration', () => {
      const token = savePasswordResetToken(mockAccountId, mockEmail);
      const tokenData = getPasswordResetToken(token);

      const expirationTime = new Date(tokenData!.expiresAt).getTime();
      const currentTime = Date.now();

      expect(expirationTime).toBeGreaterThan(currentTime);
      expect(expirationTime - currentTime).toBeLessThanOrEqual(10 * 60 * 1000); // 10 minutes
    });

    it('should generate unique password reset tokens', () => {
      const token1 = savePasswordResetToken(mockAccountId, mockEmail);
      const token2 = savePasswordResetToken(mockAccountId, mockEmail);

      expect(token1).not.toBe(token2);
    });

    it('should get all password reset tokens', () => {
      const token1 = savePasswordResetToken(mockAccountId, mockEmail);
      const token2 = savePasswordResetToken('another_account', 'another@example.com');

      const allTokens = getAllPasswordResetTokens();

      expect(allTokens).toHaveLength(2);
      expect(allTokens.some((t) => t.token === token1)).toBe(true);
      expect(allTokens.some((t) => t.token === token2)).toBe(true);
      expect(allTokens.some((t) => t.accountId === mockAccountId)).toBe(true);
      expect(allTokens.some((t) => t.email === mockEmail)).toBe(true);
    });
  });

  describe('Email Verification Management', () => {
    it('should save and retrieve email verification data', () => {
      const verificationToken = saveEmailForVerification(mockEmail);

      expect(verificationToken).toBeDefined();
      expect(typeof verificationToken).toBe('string');
      expect(verificationToken.length).toBe(64);

      const emailData = getEmailVerificationData(mockEmail);
      expect(emailData).toEqual({
        email: mockEmail,
        verificationToken,
        step: 'email_verification',
        expiresAt: expect.any(String),
        createdAt: expect.any(String),
      });
    });

    it('should retrieve email verification data by token', () => {
      const verificationToken = saveEmailForVerification(mockEmail);

      const emailData = getEmailVerificationDataByToken(verificationToken);
      expect(emailData).toEqual({
        email: mockEmail,
        verificationToken,
        step: 'email_verification',
        expiresAt: expect.any(String),
        createdAt: expect.any(String),
      });
    });

    it('should return null for non-existent email verification', () => {
      const emailData = getEmailVerificationData('nonexistent@example.com');
      expect(emailData).toBeNull();

      const tokenData = getEmailVerificationDataByToken('non_existent_token');
      expect(tokenData).toBeNull();
    });

    it('should remove email verification data', () => {
      saveEmailForVerification(mockEmail);

      let emailData = getEmailVerificationData(mockEmail);
      expect(emailData).not.toBeNull();

      removeEmailVerificationData(mockEmail);

      emailData = getEmailVerificationData(mockEmail);
      expect(emailData).toBeNull();
    });

    it('should handle email verification expiration', () => {
      const verificationToken = saveEmailForVerification(mockEmail);
      const emailData = getEmailVerificationData(mockEmail);

      const expirationTime = new Date(emailData!.expiresAt).getTime();
      const currentTime = Date.now();

      expect(expirationTime).toBeGreaterThan(currentTime);
      expect(expirationTime - currentTime).toBeLessThanOrEqual(24 * 60 * 60 * 1000); // 24 hours
    });

    it('should get all email verification tokens', () => {
      const token1 = saveEmailForVerification(mockEmail);
      const token2 = saveEmailForVerification('another@example.com');

      const allTokens = getAllEmailVerificationTokens();

      expect(allTokens).toHaveLength(2);
      expect(allTokens.some((t) => t.verificationToken === token1)).toBe(true);
      expect(allTokens.some((t) => t.verificationToken === token2)).toBe(true);
      expect(allTokens.some((t) => t.email === mockEmail)).toBe(true);
    });

    it('should generate unique verification tokens for same email', () => {
      // Remove first verification
      const token1 = saveEmailForVerification(mockEmail);
      removeEmailVerificationData(mockEmail);

      const token2 = saveEmailForVerification(mockEmail);

      expect(token1).not.toBe(token2);
    });
  });

  describe('Profile Completion Management', () => {
    it('should mark email verified and create profile step', () => {
      // First save email verification
      saveEmailForVerification(mockEmail);

      const profileToken = markEmailVerifiedAndCreateProfileStep(mockEmail);

      expect(profileToken).toBeDefined();
      expect(typeof profileToken).toBe('string');
      expect(profileToken.length).toBe(64);

      // Should remove from email verification cache
      const emailData = getEmailVerificationData(mockEmail);
      expect(emailData).toBeNull();

      // Should create profile completion data
      const profileData = getProfileCompletionData(profileToken);
      expect(profileData).toEqual({
        email: mockEmail,
        emailVerified: true,
        verificationToken: profileToken,
        expiresAt: expect.any(String),
      });
    });

    it('should throw error when email verification data not found', () => {
      expect(() => markEmailVerifiedAndCreateProfileStep('nonexistent@example.com')).toThrow(
        'Email verification data not found',
      );
    });

    it('should return null for non-existent profile completion token', () => {
      const profileData = getProfileCompletionData('non_existent_token');
      expect(profileData).toBeNull();
    });

    it('should remove profile completion data', () => {
      saveEmailForVerification(mockEmail);
      const profileToken = markEmailVerifiedAndCreateProfileStep(mockEmail);

      let profileData = getProfileCompletionData(profileToken);
      expect(profileData).not.toBeNull();

      removeProfileCompletionData(profileToken);

      profileData = getProfileCompletionData(profileToken);
      expect(profileData).toBeNull();
    });

    it('should handle profile completion token expiration', () => {
      saveEmailForVerification(mockEmail);
      const profileToken = markEmailVerifiedAndCreateProfileStep(mockEmail);
      const profileData = getProfileCompletionData(profileToken);

      const expirationTime = new Date(profileData!.expiresAt).getTime();
      const currentTime = Date.now();

      expect(expirationTime).toBeGreaterThan(currentTime);
      expect(expirationTime - currentTime).toBeLessThanOrEqual(60 * 60 * 1000); // 1 hour
    });

    it('should get all profile completion tokens', () => {
      saveEmailForVerification(mockEmail);
      saveEmailForVerification('another@example.com');

      const token1 = markEmailVerifiedAndCreateProfileStep(mockEmail);
      const token2 = markEmailVerifiedAndCreateProfileStep('another@example.com');

      const allTokens = getAllProfileCompletionTokens();

      expect(allTokens).toHaveLength(2);
      expect(allTokens.some((t) => t.verificationToken === token1)).toBe(true);
      expect(allTokens.some((t) => t.verificationToken === token2)).toBe(true);
      expect(allTokens.some((t) => t.email === mockEmail)).toBe(true);
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup all signup data for an email', () => {
      // Create email verification
      saveEmailForVerification(mockEmail);

      // Move to profile completion
      const profileToken = markEmailVerifiedAndCreateProfileStep(mockEmail);

      // Verify both exist
      expect(getProfileCompletionData(profileToken)).not.toBeNull();

      // Cleanup all data
      cleanupSignupData(mockEmail);

      // Verify all data is removed
      expect(getEmailVerificationData(mockEmail)).toBeNull();
      expect(getProfileCompletionData(profileToken)).toBeNull();
    });

    it('should cleanup profile completion by email even with different token', () => {
      saveEmailForVerification(mockEmail);
      const profileToken = markEmailVerifiedAndCreateProfileStep(mockEmail);

      // Verify profile data exists
      expect(getProfileCompletionData(profileToken)).not.toBeNull();

      // Cleanup by email should remove profile data
      cleanupSignupData(mockEmail);

      expect(getProfileCompletionData(profileToken)).toBeNull();
    });

    it('should handle cleanup of non-existent data gracefully', () => {
      expect(() => cleanupSignupData('nonexistent@example.com')).not.toThrow();
    });
  });

  describe('Cache Statistics', () => {
    it('should return cache statistics', () => {
      const initialStats = getCacheStats();

      expect(initialStats).toEqual({
        passwordReset: {
          size: expect.any(Number),
          max: expect.any(Number),
        },
        emailVerification: {
          size: expect.any(Number),
          max: expect.any(Number),
        },
      });
    });

    it('should track cache size correctly', () => {
      const initialStats = getCacheStats();

      // Add items to caches
      savePasswordResetToken(mockAccountId, mockEmail);
      saveEmailForVerification(mockEmail);

      const newStats = getCacheStats();

      expect(newStats.passwordReset.size).toBe(initialStats.passwordReset.size + 1);
      expect(newStats.emailVerification.size).toBe(initialStats.emailVerification.size + 1);
    });

    it('should maintain maximum cache limits', () => {
      const stats = getCacheStats();

      expect(stats.passwordReset.max).toBeGreaterThan(0);
      expect(stats.emailVerification.max).toBeGreaterThan(0);
    });
  });

  describe('Token Security and Uniqueness', () => {
    it('should generate unique tokens across all types', () => {
      const passwordToken = savePasswordResetToken(mockAccountId, mockEmail);
      const emailToken = saveEmailForVerification('another@example.com');

      saveEmailForVerification('third@example.com');
      const profileToken = markEmailVerifiedAndCreateProfileStep('third@example.com');

      // All tokens should be unique
      const tokens = [passwordToken, emailToken, profileToken];
      const uniqueTokens = new Set(tokens);

      expect(uniqueTokens.size).toBe(tokens.length);
    });

    it('should generate tokens with sufficient entropy', () => {
      const tokens = new Set();

      // Generate many tokens and ensure they're all unique
      for (let i = 0; i < 100; i++) {
        const token = savePasswordResetToken(`account_${i}`, `test${i}@example.com`);
        tokens.add(token);
      }

      expect(tokens.size).toBe(100);
    });

    it('should handle token format consistently', () => {
      const passwordToken = savePasswordResetToken(mockAccountId, mockEmail);
      const emailToken = saveEmailForVerification(mockEmail);

      // All tokens should be 64-character hex strings
      expect(passwordToken).toMatch(/^[a-f0-9]{64}$/);
      expect(emailToken).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data integrity during operations', () => {
      // Create email verification
      const emailToken = saveEmailForVerification(mockEmail);

      // Verify data exists
      const emailData1 = getEmailVerificationData(mockEmail);
      const emailData2 = getEmailVerificationDataByToken(emailToken);

      expect(emailData1).toEqual(emailData2);
    });

    it('should properly transition between verification steps', () => {
      // Step 1: Email verification
      const emailToken = saveEmailForVerification(mockEmail);
      expect(getEmailVerificationData(mockEmail)).not.toBeNull();

      // Step 2: Move to profile completion
      const profileToken = markEmailVerifiedAndCreateProfileStep(mockEmail);

      // Email verification should be removed
      expect(getEmailVerificationData(mockEmail)).toBeNull();
      expect(getEmailVerificationDataByToken(emailToken)).toBeNull();

      // Profile completion should exist
      expect(getProfileCompletionData(profileToken)).not.toBeNull();
    });

    it('should handle timestamp consistency', () => {
      const beforeTime = Date.now();

      const emailToken = saveEmailForVerification(mockEmail);
      const emailData = getEmailVerificationData(mockEmail);

      const afterTime = Date.now();

      const createdTime = new Date(emailData!.createdAt).getTime();
      const expiresTime = new Date(emailData!.expiresAt).getTime();

      expect(createdTime).toBeGreaterThanOrEqual(beforeTime);
      expect(createdTime).toBeLessThanOrEqual(afterTime);
      expect(expiresTime).toBeGreaterThan(createdTime);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle multiple operations on same email', () => {
      // Create verification
      const token1 = saveEmailForVerification(mockEmail);

      // Remove and create again
      removeEmailVerificationData(mockEmail);
      const token2 = saveEmailForVerification(mockEmail);

      expect(token1).not.toBe(token2);
      expect(getEmailVerificationData(mockEmail)).not.toBeNull();
      expect(getEmailVerificationDataByToken(token1)).toBeNull();
      expect(getEmailVerificationDataByToken(token2)).not.toBeNull();
    });

    it('should handle invalid token removal gracefully', () => {
      expect(() => removePasswordResetToken('invalid_token')).not.toThrow();
      expect(() => removeEmailVerificationData('invalid@example.com')).not.toThrow();
      expect(() => removeProfileCompletionData('invalid_token')).not.toThrow();
    });

    it('should handle empty get operations', () => {
      expect(getAllEmailVerificationTokens()).toEqual([]);
      expect(getAllProfileCompletionTokens()).toEqual([]);
      expect(getAllPasswordResetTokens()).toEqual([]);
    });

    it('should handle special characters in email addresses', () => {
      const specialEmails = ['test+tag@example.com', 'user.name@example.com', 'user-name@example-domain.com'];

      specialEmails.forEach((email) => {
        const token = saveEmailForVerification(email);
        const data = getEmailVerificationData(email);

        expect(data).not.toBeNull();
        expect(data!.email).toBe(email);

        removeEmailVerificationData(email);
      });
    });

    it('should handle very long email addresses', () => {
      const longEmail = 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com';

      const token = saveEmailForVerification(longEmail);
      const data = getEmailVerificationData(longEmail);

      expect(data).not.toBeNull();
      expect(data!.email).toBe(longEmail);
    });

    it('should handle concurrent operations', () => {
      // Simulate concurrent token generation
      const tokens = [];
      for (let i = 0; i < 10; i++) {
        tokens.push(savePasswordResetToken(`account_${i}`, `test${i}@example.com`));
      }

      // All tokens should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);

      // All tokens should be retrievable
      tokens.forEach((token, index) => {
        const data = getPasswordResetToken(token);
        expect(data).not.toBeNull();
        expect(data!.accountId).toBe(`account_${index}`);
      });
    });
  });

  describe('TTL and Expiration Behavior', () => {
    it('should set appropriate TTL for different token types', () => {
      const passwordToken = savePasswordResetToken(mockAccountId, mockEmail);
      const emailToken = saveEmailForVerification(mockEmail);

      const passwordData = getPasswordResetToken(passwordToken);
      const emailData = getEmailVerificationData(mockEmail);

      const passwordExpiry = new Date(passwordData!.expiresAt).getTime() - Date.now();
      const emailExpiry = new Date(emailData!.expiresAt).getTime() - Date.now();

      // Password reset should expire in ~10 minutes
      expect(passwordExpiry).toBeLessThanOrEqual(10 * 60 * 1000);
      expect(passwordExpiry).toBeGreaterThan(9 * 60 * 1000);

      // Email verification should expire in ~24 hours
      expect(emailExpiry).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
      expect(emailExpiry).toBeGreaterThan(23 * 60 * 60 * 1000);
    });

    it('should set shorter TTL for profile completion', () => {
      saveEmailForVerification(mockEmail);
      const profileToken = markEmailVerifiedAndCreateProfileStep(mockEmail);
      const profileData = getProfileCompletionData(profileToken);

      const profileExpiry = new Date(profileData!.expiresAt).getTime() - Date.now();

      // Profile completion should expire in ~1 hour
      expect(profileExpiry).toBeLessThanOrEqual(60 * 60 * 1000);
      expect(profileExpiry).toBeGreaterThan(59 * 60 * 1000);
    });
  });
});
