import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as TwoFAMockService from '../__mock__/TwoFA.service.mock';
import { authenticator } from 'otplib';
import { BadRequestError, NotFoundError, ValidationError } from '../../../types/response.types';
import { getModels } from '../../../config/db.config';
import * as TwoFACache from '../TwoFA.cache';

// Mock dependencies
vi.mock('../../../config/db.config', () => ({
  getModels: vi.fn(),
}));

vi.mock('../TwoFA.cache', () => ({
  getAllTempTokens: vi.fn(),
  getAllSetupTokens: vi.fn(),
  getTwoFactorTempToken: vi.fn(),
  getTwoFactorSetupToken: vi.fn(),
  getTwoFactorCacheStats: vi.fn(),
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('TwoFA Mock Service', () => {
  const testSecret = 'JBSWY3DPEHPK3PXP';
  const mockAccountId = '507f1f77bcf86cd799439011';
  const invalidAccountId = 'invalid-id';

  let mockModels: any;
  let mockAccount: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock account
    mockAccount = {
      _id: mockAccountId,
      security: {
        twoFactorSecret: testSecret,
        twoFactorEnabled: true,
      },
    };

    // Setup mock models
    mockModels = {
      accounts: {
        Account: {
          findById: vi.fn().mockResolvedValue(mockAccount),
        },
      },
    };

    vi.mocked(getModels).mockResolvedValue(mockModels);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('generateTotpCode', () => {
    it('should generate valid TOTP code for valid secret', async () => {
      const result = await TwoFAMockService.generateTotpCode(testSecret);

      expect(result).toEqual({
        token: expect.stringMatching(/^\d{6}$/), // 6-digit code
        secret: 'JBSWY3DP...', // Partial secret
        timeRemaining: expect.any(Number),
        timeUsed: expect.any(Number),
      });

      // Verify the generated code is actually valid
      const isValid = authenticator.verify({
        token: result.token,
        secret: testSecret,
      });
      expect(isValid).toBe(true);
    });

    it('should throw BadRequestError for empty secret', async () => {
      await expect(TwoFAMockService.generateTotpCode('')).rejects.toThrow(BadRequestError);
      await expect(TwoFAMockService.generateTotpCode('')).rejects.toThrow('Secret is required');
    });

    it('should handle invalid secret format gracefully', async () => {
      // otplib is lenient and will generate codes even for "invalid" secrets
      const result = await TwoFAMockService.generateTotpCode('invalid-secret');

      expect(result.token).toMatch(/^\d{6}$/);
      expect(result.secret).toBe('invalid-...');
    });

    it('should generate different codes for different secrets', async () => {
      const secret1 = 'JBSWY3DPEHPK3PXP';
      const secret2 = 'NBSWY3DPEHPK3PXP';

      const result1 = await TwoFAMockService.generateTotpCode(secret1);
      const result2 = await TwoFAMockService.generateTotpCode(secret2);

      // Different secrets should produce different codes (most of the time)
      // Note: There's a tiny chance they could be the same, but very unlikely
      expect(result1.token).not.toBe(result2.token);
      expect(result1.secret).not.toBe(result2.secret);
    });

    it('should generate same code for same secret within time window', async () => {
      const result1 = await TwoFAMockService.generateTotpCode(testSecret);
      const result2 = await TwoFAMockService.generateTotpCode(testSecret);

      // Same secret within same time window should produce same code
      expect(result1.token).toBe(result2.token);
      expect(result1.secret).toBe(result2.secret);
    });
  });

  describe('getAccountSecret', () => {
    it('should return account secret for valid account', async () => {
      const result = await TwoFAMockService.getAccountSecret(mockAccountId);

      expect(result).toEqual({
        accountId: mockAccountId,
        secret: testSecret,
        twoFactorEnabled: true,
      });

      expect(mockModels.accounts.Account.findById).toHaveBeenCalledWith(mockAccountId);
    });

    it('should throw BadRequestError for invalid account ID format', async () => {
      await expect(TwoFAMockService.getAccountSecret(invalidAccountId)).rejects.toThrow(BadRequestError);
      await expect(TwoFAMockService.getAccountSecret(invalidAccountId)).rejects.toThrow('Invalid Account ID format');
    });

    it('should throw NotFoundError for non-existent account', async () => {
      mockModels.accounts.Account.findById.mockResolvedValue(null);

      await expect(TwoFAMockService.getAccountSecret(mockAccountId)).rejects.toThrow(NotFoundError);
      await expect(TwoFAMockService.getAccountSecret(mockAccountId)).rejects.toThrow('Account not found');
    });

    it('should throw NotFoundError for account without 2FA secret', async () => {
      mockAccount.security.twoFactorSecret = null;
      mockModels.accounts.Account.findById.mockResolvedValue(mockAccount);

      await expect(TwoFAMockService.getAccountSecret(mockAccountId)).rejects.toThrow(NotFoundError);
      await expect(TwoFAMockService.getAccountSecret(mockAccountId)).rejects.toThrow(
        'Account does not have 2FA secret',
      );
    });

    it('should throw NotFoundError for account with undefined 2FA secret', async () => {
      mockAccount.security.twoFactorSecret = undefined;
      mockModels.accounts.Account.findById.mockResolvedValue(mockAccount);

      await expect(TwoFAMockService.getAccountSecret(mockAccountId)).rejects.toThrow(NotFoundError);
      await expect(TwoFAMockService.getAccountSecret(mockAccountId)).rejects.toThrow(
        'Account does not have 2FA secret',
      );
    });
  });

  describe('generateAccountTotpCode', () => {
    it('should generate TOTP code for account with valid secret', async () => {
      const result = await TwoFAMockService.generateAccountTotpCode(mockAccountId);

      expect(result).toEqual({
        accountId: mockAccountId,
        token: expect.stringMatching(/^\d{6}$/),
        twoFactorEnabled: true,
        timeRemaining: expect.any(Number),
        timeUsed: expect.any(Number),
      });

      // Verify the generated code is valid for the account's secret
      const isValid = authenticator.verify({
        token: result.token,
        secret: testSecret,
      });
      expect(isValid).toBe(true);
    });

    it('should throw BadRequestError for invalid account ID', async () => {
      await expect(TwoFAMockService.generateAccountTotpCode(invalidAccountId)).rejects.toThrow(BadRequestError);
    });

    it('should throw NotFoundError for account without secret', async () => {
      mockAccount.security.twoFactorSecret = null;
      mockModels.accounts.Account.findById.mockResolvedValue(mockAccount);

      await expect(TwoFAMockService.generateAccountTotpCode(mockAccountId)).rejects.toThrow(NotFoundError);
      await expect(TwoFAMockService.generateAccountTotpCode(mockAccountId)).rejects.toThrow(
        'Account does not have 2FA secret',
      );
    });

    it('should handle account with 2FA disabled but secret present', async () => {
      mockAccount.security.twoFactorEnabled = false;
      mockModels.accounts.Account.findById.mockResolvedValue(mockAccount);

      const result = await TwoFAMockService.generateAccountTotpCode(mockAccountId);

      expect(result.twoFactorEnabled).toBe(false);
      expect(result.token).toMatch(/^\d{6}$/);
    });

    it('should handle TOTP generation errors', async () => {
      // Mock the authenticator module directly
      const originalGenerate = authenticator.generate;

      // Replace the generate function to throw an error
      authenticator.generate = vi.fn().mockImplementation(() => {
        throw new Error('TOTP generation failed');
      });

      await expect(TwoFAMockService.generateAccountTotpCode(mockAccountId)).rejects.toThrow(BadRequestError);
      await expect(TwoFAMockService.generateAccountTotpCode(mockAccountId)).rejects.toThrow(
        'Failed to generate TOTP code',
      );

      // Restore original implementation
      authenticator.generate = originalGenerate;
    });
  });

  describe('validateTotpToken', () => {
    it('should validate correct TOTP token', async () => {
      const validToken = authenticator.generate(testSecret);

      const result = await TwoFAMockService.validateTotpToken(testSecret, validToken);

      expect(result).toEqual({
        valid: true,
        token: validToken,
        secret: 'JBSWY3DP...',
        timeRemaining: expect.any(Number),
        timeUsed: expect.any(Number),
      });
    });

    it('should reject incorrect TOTP token', async () => {
      const invalidToken = '000000';

      const result = await TwoFAMockService.validateTotpToken(testSecret, invalidToken);

      expect(result).toEqual({
        valid: false,
        token: invalidToken,
        secret: 'JBSWY3DP...',
        timeRemaining: expect.any(Number),
        timeUsed: expect.any(Number),
      });
    });

    it('should throw BadRequestError for missing secret', async () => {
      await expect(TwoFAMockService.validateTotpToken('', '123456')).rejects.toThrow(BadRequestError);
      await expect(TwoFAMockService.validateTotpToken('', '123456')).rejects.toThrow('Secret and token are required');
    });

    it('should throw BadRequestError for missing token', async () => {
      await expect(TwoFAMockService.validateTotpToken(testSecret, '')).rejects.toThrow(BadRequestError);
      await expect(TwoFAMockService.validateTotpToken(testSecret, '')).rejects.toThrow('Secret and token are required');
    });

    it('should throw ValidationError for invalid token length', async () => {
      await expect(TwoFAMockService.validateTotpToken(testSecret, '123')).rejects.toThrow(ValidationError);
      await expect(TwoFAMockService.validateTotpToken(testSecret, '123')).rejects.toThrow(
        'Token must be at least 6 characters',
      );
    });

    it('should throw ValidationError for token too long', async () => {
      await expect(TwoFAMockService.validateTotpToken(testSecret, '1234567')).rejects.toThrow(ValidationError);
      await expect(TwoFAMockService.validateTotpToken(testSecret, '1234567')).rejects.toThrow(
        'Token cannot exceed 6 characters',
      );
    });

    it('should handle invalid secret format during validation', async () => {
      const invalidSecret = 'invalid-secret';
      const token = '123456';

      // otplib will still attempt validation and return false for invalid combinations
      const result = await TwoFAMockService.validateTotpToken(invalidSecret, token);
      expect(result.valid).toBe(false);
      expect(result.token).toBe(token);
    });
  });

  describe('getCacheStatistics', () => {
    it('should return cache statistics', async () => {
      const mockStats = {
        temp: { size: 5, max: 1000 },
        setup: { size: 3, max: 500 },
      };

      vi.mocked(TwoFACache.getTwoFactorCacheStats).mockReturnValue(mockStats);

      const result = await TwoFAMockService.getCacheStatistics();

      expect(result).toEqual(mockStats);
      expect(TwoFACache.getTwoFactorCacheStats).toHaveBeenCalled();
    });
  });

  describe('getAllTemporaryTokens', () => {
    it('should return all temporary tokens', async () => {
      const mockTempTokens = [
        {
          token: 'temp_token_1',
          accountId: 'account1',
          email: 'test1@example.com',
          accountType: 'local',
          expiresAt: '2023-01-01T00:00:00.000Z',
          oauthTokens: null,
        },
        {
          token: 'temp_token_2',
          accountId: 'account2',
          email: 'test2@example.com',
          accountType: 'oauth',
          expiresAt: '2023-01-01T01:00:00.000Z',
          oauthTokens: { accessToken: 'token', refreshToken: 'refresh' },
        },
      ];

      vi.mocked(TwoFACache.getAllTempTokens).mockReturnValue(mockTempTokens);

      const result = await TwoFAMockService.getAllTemporaryTokens();

      expect(result).toEqual({
        count: 2,
        tokens: [
          {
            token: 'temp_token_1',
            accountId: 'account1',
            email: 'test1@example.com',
            accountType: 'local',
            expiresAt: '2023-01-01T00:00:00.000Z',
            hasOAuthTokens: false,
          },
          {
            token: 'temp_token_2',
            accountId: 'account2',
            email: 'test2@example.com',
            accountType: 'oauth',
            expiresAt: '2023-01-01T01:00:00.000Z',
            hasOAuthTokens: true,
          },
        ],
      });
    });

    it('should return empty array when no tokens exist', async () => {
      vi.mocked(TwoFACache.getAllTempTokens).mockReturnValue([]);

      const result = await TwoFAMockService.getAllTemporaryTokens();

      expect(result).toEqual({
        count: 0,
        tokens: [],
      });
    });
  });

  describe('getTemporaryTokenData', () => {
    it('should return specific temporary token data', async () => {
      const mockTokenData = {
        token: 'temp_token_123',
        accountId: mockAccountId,
        email: 'test@example.com',
        accountType: 'local',
        expiresAt: '2023-01-01T00:00:00.000Z',
      };

      vi.mocked(TwoFACache.getTwoFactorTempToken).mockReturnValue(mockTokenData);

      const result = await TwoFAMockService.getTemporaryTokenData('temp_token_123');

      expect(result).toEqual(mockTokenData);
      expect(TwoFACache.getTwoFactorTempToken).toHaveBeenCalledWith('temp_token_123');
    });

    it('should throw BadRequestError for empty token', async () => {
      await expect(TwoFAMockService.getTemporaryTokenData('')).rejects.toThrow(BadRequestError);
      await expect(TwoFAMockService.getTemporaryTokenData('')).rejects.toThrow('Token is required');
    });

    it('should throw NotFoundError for non-existent token', async () => {
      vi.mocked(TwoFACache.getTwoFactorTempToken).mockReturnValue(null);

      await expect(TwoFAMockService.getTemporaryTokenData('non_existent')).rejects.toThrow(NotFoundError);
      await expect(TwoFAMockService.getTemporaryTokenData('non_existent')).rejects.toThrow(
        'Temporary token not found or expired',
      );
    });
  });

  describe('generateMockBackupCodes', () => {
    it('should generate default number of backup codes', async () => {
      const result = await TwoFAMockService.generateMockBackupCodes();

      expect(result).toEqual({
        count: 10,
        backupCodes: expect.arrayContaining([
          expect.stringMatching(/^[0-9a-f]{8}$/), // 8-char hex
        ]),
      });

      expect(result.backupCodes).toHaveLength(10);
      expect(result.backupCodes.every((code) => code.length === 8)).toBe(true);
    });

    it('should generate custom number of backup codes', async () => {
      const result = await TwoFAMockService.generateMockBackupCodes(5);

      expect(result).toEqual({
        count: 5,
        backupCodes: expect.arrayContaining([expect.stringMatching(/^[0-9a-f]{8}$/)]),
      });

      expect(result.backupCodes).toHaveLength(5);
    });

    it('should generate unique backup codes', async () => {
      const result = await TwoFAMockService.generateMockBackupCodes(10);

      // All codes should be unique
      const uniqueCodes = new Set(result.backupCodes);
      expect(uniqueCodes.size).toBe(10);
    });

    it('should throw BadRequestError for count less than 1', async () => {
      await expect(TwoFAMockService.generateMockBackupCodes(0)).rejects.toThrow(BadRequestError);
      await expect(TwoFAMockService.generateMockBackupCodes(0)).rejects.toThrow('Count must be between 1 and 20');
    });

    it('should throw BadRequestError for count greater than 20', async () => {
      await expect(TwoFAMockService.generateMockBackupCodes(21)).rejects.toThrow(BadRequestError);
      await expect(TwoFAMockService.generateMockBackupCodes(21)).rejects.toThrow('Count must be between 1 and 20');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      vi.mocked(getModels).mockRejectedValue(new Error('Database connection failed'));

      await expect(TwoFAMockService.getAccountSecret(mockAccountId)).rejects.toThrow('Database connection failed');
    });

    it('should handle malformed account data', async () => {
      const malformedAccount = {
        _id: mockAccountId,
        security: null, // Missing security object
      };

      mockModels.accounts.Account.findById.mockResolvedValue(malformedAccount);

      await expect(TwoFAMockService.getAccountSecret(mockAccountId)).rejects.toThrow();
    });

    it('should handle very long secrets', async () => {
      const longSecret = 'A'.repeat(100);

      // otplib will handle long secrets and generate a code
      const result = await TwoFAMockService.generateTotpCode(longSecret);
      expect(result.token).toMatch(/^\d{6}$/);
      expect(result.secret).toBe('AAAAAAAA...');
    });

    it('should handle special characters in tokens', async () => {
      const tokenWithSpecialChars = '123@#$';

      // The service will validate token length but not reject special characters
      // It will return invalid when verified
      const result = await TwoFAMockService.validateTotpToken(testSecret, tokenWithSpecialChars);

      expect(result.valid).toBe(false);
      expect(result.token).toBe(tokenWithSpecialChars);
      expect(result.secret).toBe('JBSWY3DP...');
      expect(result.timeRemaining).toBeDefined();
      expect(result.timeUsed).toBeDefined();
    });
  });
});
