import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveTwoFactorTempToken,
  getTwoFactorTempToken,
  removeTwoFactorTempToken,
  saveTwoFactorSetupToken,
  getTwoFactorSetupToken,
  removeTwoFactorSetupToken,
  cleanupExpiredTwoFactorTokens,
  getTwoFactorCacheStats,
  getAllTempTokens,
  getAllSetupTokens,
} from '../TwoFA.cache';

describe('TwoFA Cache', () => {
  const mockAccountId = '507f1f77bcf86cd799439011';
  const mockEmail = 'test@example.com';
  const mockSecret = 'JBSWY3DPEHPK3PXP';

  beforeEach(() => {
    // Clean up cache before each test
    cleanupExpiredTwoFactorTokens();
  });

  describe('Temporary Token Management', () => {
    it('should save and retrieve temp token for local account', () => {
      const token = saveTwoFactorTempToken(mockAccountId, mockEmail, 'local');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes hex = 64 characters

      const tokenData = getTwoFactorTempToken(token);
      expect(tokenData).toEqual({
        token,
        accountId: mockAccountId,
        email: mockEmail,
        accountType: 'local',
        expiresAt: expect.any(String),
      });
    });

    it('should save and retrieve temp token for OAuth account with tokens', () => {
      const oauthTokens = {
        accessToken: 'oauth_access_token',
        refreshToken: 'oauth_refresh_token',
        userInfo: { name: 'Test User', email: mockEmail },
      };

      const token = saveTwoFactorTempToken(mockAccountId, mockEmail, 'oauth', oauthTokens);

      const tokenData = getTwoFactorTempToken(token);
      expect(tokenData).toEqual({
        token,
        accountId: mockAccountId,
        email: mockEmail,
        accountType: 'oauth',
        expiresAt: expect.any(String),
        oauthTokens,
      });
    });

    it('should return null for non-existent temp token', () => {
      const tokenData = getTwoFactorTempToken('non_existent_token');
      expect(tokenData).toBeNull();
    });

    it('should remove temp token', () => {
      const token = saveTwoFactorTempToken(mockAccountId, mockEmail, 'local');

      let tokenData = getTwoFactorTempToken(token);
      expect(tokenData).not.toBeNull();

      removeTwoFactorTempToken(token);

      tokenData = getTwoFactorTempToken(token);
      expect(tokenData).toBeNull();
    });

    it('should handle temp token expiration', () => {
      // This test would require manipulating time or waiting
      // For now, just test that expiration date is set in the future
      const token = saveTwoFactorTempToken(mockAccountId, mockEmail, 'local');
      const tokenData = getTwoFactorTempToken(token);

      const expirationTime = new Date(tokenData!.expiresAt).getTime();
      const currentTime = Date.now();

      expect(expirationTime).toBeGreaterThan(currentTime);
      expect(expirationTime - currentTime).toBeLessThanOrEqual(5 * 60 * 1000); // 5 minutes
    });
  });

  describe('Setup Token Management', () => {
    it('should save and retrieve setup token for local account', () => {
      const token = saveTwoFactorSetupToken(mockAccountId, mockSecret, 'local');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64);

      const tokenData = getTwoFactorSetupToken(token);
      expect(tokenData).toEqual({
        token,
        accountId: mockAccountId,
        secret: mockSecret,
        accountType: 'local',
        expiresAt: expect.any(String),
        createdAt: expect.any(String),
      });
    });

    it('should save and retrieve setup token for OAuth account', () => {
      const token = saveTwoFactorSetupToken(mockAccountId, mockSecret, 'oauth');

      const tokenData = getTwoFactorSetupToken(token);
      expect(tokenData).toEqual({
        token,
        accountId: mockAccountId,
        secret: mockSecret,
        accountType: 'oauth',
        expiresAt: expect.any(String),
        createdAt: expect.any(String),
      });
    });

    it('should return null for non-existent setup token', () => {
      const tokenData = getTwoFactorSetupToken('non_existent_token');
      expect(tokenData).toBeNull();
    });

    it('should remove setup token', () => {
      const token = saveTwoFactorSetupToken(mockAccountId, mockSecret, 'local');

      let tokenData = getTwoFactorSetupToken(token);
      expect(tokenData).not.toBeNull();

      removeTwoFactorSetupToken(token);

      tokenData = getTwoFactorSetupToken(token);
      expect(tokenData).toBeNull();
    });

    it('should handle setup token expiration', () => {
      const token = saveTwoFactorSetupToken(mockAccountId, mockSecret, 'local');
      const tokenData = getTwoFactorSetupToken(token);

      const expirationTime = new Date(tokenData!.expiresAt).getTime();
      const currentTime = Date.now();

      expect(expirationTime).toBeGreaterThan(currentTime);
      expect(expirationTime - currentTime).toBeLessThanOrEqual(15 * 60 * 1000); // 15 minutes
    });
  });

  describe('Cache Statistics and Management', () => {
    it('should return cache statistics', () => {
      const stats = getTwoFactorCacheStats();

      expect(stats).toEqual({
        temp: {
          size: expect.any(Number),
          max: expect.any(Number),
        },
        setup: {
          size: expect.any(Number),
          max: expect.any(Number),
        },
      });
    });

    it('should track cache size correctly', () => {
      const initialStats = getTwoFactorCacheStats();

      // Add temp tokens
      saveTwoFactorTempToken(mockAccountId, mockEmail, 'local');
      saveTwoFactorTempToken('another_account', 'another@example.com', 'oauth');

      // Add setup tokens
      saveTwoFactorSetupToken(mockAccountId, mockSecret, 'local');

      const newStats = getTwoFactorCacheStats();

      expect(newStats.temp.size).toBe(initialStats.temp.size + 2);
      expect(newStats.setup.size).toBe(initialStats.setup.size + 1);
    });

    it('should get all temp tokens', () => {
      const token1 = saveTwoFactorTempToken(mockAccountId, mockEmail, 'local');
      const token2 = saveTwoFactorTempToken('account2', 'test2@example.com', 'oauth');

      const allTokens = getAllTempTokens();

      expect(allTokens).toHaveLength(2);
      expect(allTokens.some((t) => t.token === token1)).toBe(true);
      expect(allTokens.some((t) => t.token === token2)).toBe(true);
    });

    it('should get all setup tokens', () => {
      const token1 = saveTwoFactorSetupToken(mockAccountId, mockSecret, 'local');
      const token2 = saveTwoFactorSetupToken('account2', 'another_secret', 'oauth');

      const allTokens = getAllSetupTokens();

      expect(allTokens).toHaveLength(2);
      expect(allTokens.some((t) => t.token === token1)).toBe(true);
      expect(allTokens.some((t) => t.token === token2)).toBe(true);
    });

    it('should cleanup expired tokens', () => {
      // Add some tokens
      saveTwoFactorTempToken(mockAccountId, mockEmail, 'local');
      saveTwoFactorSetupToken(mockAccountId, mockSecret, 'local');

      const statsBefore = getTwoFactorCacheStats();

      // Run cleanup (won't remove non-expired tokens)
      cleanupExpiredTwoFactorTokens();

      const statsAfter = getTwoFactorCacheStats();

      // Since tokens are not expired, they should still be there
      expect(statsAfter.temp.size).toBe(statsBefore.temp.size);
      expect(statsAfter.setup.size).toBe(statsBefore.setup.size);
    });
  });

  describe('Token Uniqueness and Security', () => {
    it('should generate unique temp tokens', () => {
      const token1 = saveTwoFactorTempToken(mockAccountId, mockEmail, 'local');
      const token2 = saveTwoFactorTempToken(mockAccountId, mockEmail, 'local');

      expect(token1).not.toBe(token2);
    });

    it('should generate unique setup tokens', () => {
      const token1 = saveTwoFactorSetupToken(mockAccountId, mockSecret, 'local');
      const token2 = saveTwoFactorSetupToken(mockAccountId, mockSecret, 'local');

      expect(token1).not.toBe(token2);
    });

    it('should generate tokens with sufficient entropy', () => {
      const tokens = new Set();

      // Generate 100 tokens and ensure they're all unique
      for (let i = 0; i < 100; i++) {
        const token = saveTwoFactorTempToken(`account_${i}`, `test${i}@example.com`, 'local');
        tokens.add(token);
      }

      expect(tokens.size).toBe(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid token removal gracefully', () => {
      // Should not throw error when removing non-existent tokens
      expect(() => removeTwoFactorTempToken('non_existent')).not.toThrow();
      expect(() => removeTwoFactorSetupToken('non_existent')).not.toThrow();
    });

    it('should handle empty getAllTempTokens when cache is empty', () => {
      const tokens = getAllTempTokens();
      expect(Array.isArray(tokens)).toBe(true);
    });

    it('should handle empty getAllSetupTokens when cache is empty', () => {
      const tokens = getAllSetupTokens();
      expect(Array.isArray(tokens)).toBe(true);
    });

    it('should handle multiple cleanup calls', () => {
      saveTwoFactorTempToken(mockAccountId, mockEmail, 'local');

      expect(() => {
        cleanupExpiredTwoFactorTokens();
        cleanupExpiredTwoFactorTokens();
        cleanupExpiredTwoFactorTokens();
      }).not.toThrow();
    });
  });
});
