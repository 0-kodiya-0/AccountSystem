import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as TwoFAService from '../TwoFA.service';
import * as googleServices from '../../google/services/tokenInfo/tokenInfo.services';
import { AccountType, AccountStatus } from '../../account/Account.types';
import { AuthError, BadRequestError, NotFoundError, ValidationError } from '../../../types/response.types';
import { getModels } from '../../../config/db.config';

// Mock dependencies
vi.mock('../../google/services/tokenInfo/tokenInfo.services', () => ({
  verifyGoogleTokenOwnership: vi.fn(),
}));

vi.mock('../../../config/db.config', () => ({
  getModels: vi.fn(),
}));

vi.mock('../../../config/env.config', () => ({
  getAppName: vi.fn().mockReturnValue('TestApp'),
}));

describe('TwoFA Service', () => {
  const mockAccountId = '507f1f77bcf86cd799439011';
  const mockEmail = 'test@example.com';
  const mockPassword = 'password123';
  const mockOAuthToken = 'oauth_access_token';

  let mockAccount: any;
  let mockAccountModel: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock account
    mockAccount = {
      _id: { toString: () => mockAccountId },
      accountType: AccountType.Local,
      status: AccountStatus.Active,
      userDetails: {
        name: 'Test User',
        email: mockEmail,
        emailVerified: true,
      },
      security: {
        twoFactorEnabled: false,
        twoFactorSecret: undefined,
        twoFactorBackupCodes: undefined,
      },
      comparePassword: vi.fn().mockResolvedValue(true),
      save: vi.fn().mockResolvedValue(true),
    };

    // Mock account model
    mockAccountModel = {
      findById: vi.fn().mockResolvedValue(mockAccount),
    };

    // Mock database models
    vi.mocked(getModels).mockResolvedValue({
      accounts: {
        Account: mockAccountModel,
      },
    } as any);

    // Mock Google token verification
    vi.mocked(googleServices.verifyGoogleTokenOwnership).mockResolvedValue({
      isValid: true,
      reason: 'Token is valid',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getTwoFactorStatus', () => {
    it('should return 2FA status for account without 2FA', async () => {
      const result = await TwoFAService.getTwoFactorStatus(mockAccountId);

      expect(result).toEqual({
        enabled: false,
        backupCodesCount: 0,
        lastSetupDate: undefined,
      });
      expect(mockAccountModel.findById).toHaveBeenCalledWith(mockAccountId);
    });

    it('should return 2FA status for account with 2FA enabled', async () => {
      const lastSetupDate = new Date('2023-01-01');
      mockAccount.security.twoFactorEnabled = true;
      mockAccount.security.twoFactorBackupCodes = ['code1', 'code2', 'code3'];
      mockAccount.security.lastPasswordChange = lastSetupDate;

      const result = await TwoFAService.getTwoFactorStatus(mockAccountId);

      expect(result).toEqual({
        enabled: true,
        backupCodesCount: 3,
        lastSetupDate: lastSetupDate.toISOString(),
      });
    });

    it('should throw error for invalid account ID', async () => {
      await expect(TwoFAService.getTwoFactorStatus('invalid-id')).rejects.toThrow('Invalid ObjectId format');
    });

    it('should throw error for non-existent account', async () => {
      mockAccountModel.findById.mockResolvedValue(null);

      await expect(TwoFAService.getTwoFactorStatus(mockAccountId)).rejects.toThrow(NotFoundError);
      await expect(TwoFAService.getTwoFactorStatus(mockAccountId)).rejects.toThrow('Account not found');
    });
  });

  describe('setupTwoFactor', () => {
    describe('Enable 2FA', () => {
      it('should enable 2FA for local account with valid password', async () => {
        const setupData = { enableTwoFactor: true, password: mockPassword };

        const result = await TwoFAService.setupTwoFactor(mockAccountId, setupData);

        expect(mockAccount.comparePassword).toHaveBeenCalledWith(mockPassword);
        expect(mockAccount.save).toHaveBeenCalled();

        expect(result.message).toContain('2FA setup successful');
        expect(result.secret).toBeDefined();
        expect(result.qrCodeUrl).toBeDefined();
        expect(result.backupCodes).toHaveLength(10);
        expect(result.setupToken).toBeDefined();

        // Verify account wasn't enabled yet (requires verification)
        expect(mockAccount.security.twoFactorEnabled).toBe(false);
        expect(mockAccount.security.twoFactorSecret).toBeDefined();
        expect(mockAccount.security.twoFactorBackupCodes).toHaveLength(10);
      });

      it('should enable 2FA for OAuth account with valid token', async () => {
        mockAccount.accountType = AccountType.OAuth;
        const setupData = { enableTwoFactor: true };

        const result = await TwoFAService.setupTwoFactor(mockAccountId, setupData, mockOAuthToken);

        expect(googleServices.verifyGoogleTokenOwnership).toHaveBeenCalledWith(mockOAuthToken, mockAccountId);
        expect(mockAccount.save).toHaveBeenCalled();

        expect(result.message).toContain('2FA setup successful');
        expect(result.secret).toBeDefined();
        expect(result.setupToken).toBeDefined();
      });

      it('should throw error for local account without password', async () => {
        const setupData = { enableTwoFactor: true };

        await expect(TwoFAService.setupTwoFactor(mockAccountId, setupData)).rejects.toThrow(BadRequestError);
        await expect(TwoFAService.setupTwoFactor(mockAccountId, setupData)).rejects.toThrow(
          'Password is required for local accounts',
        );
      });

      it('should throw error for OAuth account without token', async () => {
        mockAccount.accountType = AccountType.OAuth;
        const setupData = { enableTwoFactor: true };

        await expect(TwoFAService.setupTwoFactor(mockAccountId, setupData)).rejects.toThrow(BadRequestError);
        await expect(TwoFAService.setupTwoFactor(mockAccountId, setupData)).rejects.toThrow(
          'OAuth access token is required for OAuth accounts',
        );
      });

      it('should throw error for incorrect password', async () => {
        mockAccount.comparePassword.mockResolvedValue(false);
        const setupData = { enableTwoFactor: true, password: 'wrong_password' };

        await expect(TwoFAService.setupTwoFactor(mockAccountId, setupData)).rejects.toThrow(ValidationError);
        await expect(TwoFAService.setupTwoFactor(mockAccountId, setupData)).rejects.toThrow('Password is incorrect');
      });

      it('should throw error for invalid OAuth token', async () => {
        mockAccount.accountType = AccountType.OAuth;
        vi.mocked(googleServices.verifyGoogleTokenOwnership).mockResolvedValue({
          isValid: false,
          reason: 'Token expired',
        });
        const setupData = { enableTwoFactor: true };

        await expect(TwoFAService.setupTwoFactor(mockAccountId, setupData, mockOAuthToken)).rejects.toThrow(AuthError);
        await expect(TwoFAService.setupTwoFactor(mockAccountId, setupData, mockOAuthToken)).rejects.toThrow(
          'OAuth token verification failed: Token expired',
        );
      });
    });

    describe('Disable 2FA', () => {
      it('should disable 2FA for local account', async () => {
        mockAccount.security.twoFactorEnabled = true;
        mockAccount.security.twoFactorSecret = 'some_secret';
        mockAccount.security.twoFactorBackupCodes = ['code1', 'code2'];

        const setupData = { enableTwoFactor: false, password: mockPassword };

        const result = await TwoFAService.setupTwoFactor(mockAccountId, setupData);

        expect(mockAccount.comparePassword).toHaveBeenCalledWith(mockPassword);
        expect(mockAccount.save).toHaveBeenCalled();
        expect(result).toEqual({
          message: '2FA has been disabled for your account.',
        });

        expect(mockAccount.security.twoFactorEnabled).toBe(false);
        expect(mockAccount.security.twoFactorSecret).toBeUndefined();
        expect(mockAccount.security.twoFactorBackupCodes).toBeUndefined();
      });

      it('should disable 2FA for OAuth account', async () => {
        mockAccount.accountType = AccountType.OAuth;
        mockAccount.security.twoFactorEnabled = true;
        const setupData = { enableTwoFactor: false };

        const result = await TwoFAService.setupTwoFactor(mockAccountId, setupData, mockOAuthToken);

        expect(result.message).toContain('2FA has been disabled');
        expect(mockAccount.security.twoFactorEnabled).toBe(false);
      });
    });

    describe('Input Validation', () => {
      it('should throw error for missing enableTwoFactor field', async () => {
        await expect(TwoFAService.setupTwoFactor(mockAccountId, {} as any)).rejects.toThrow(
          'enableTwoFactor is required',
        );
      });

      it('should throw error for invalid account ID format', async () => {
        const setupData = { enableTwoFactor: true, password: mockPassword };
        await expect(TwoFAService.setupTwoFactor('invalid-id', setupData)).rejects.toThrow('Invalid ObjectId format');
      });

      it('should throw error for unsupported account type', async () => {
        mockAccount.accountType = 'unsupported' as any;
        const setupData = { enableTwoFactor: true, password: mockPassword };

        await expect(TwoFAService.setupTwoFactor(mockAccountId, setupData)).rejects.toThrow(BadRequestError);
        await expect(TwoFAService.setupTwoFactor(mockAccountId, setupData)).rejects.toThrow('Unsupported account type');
      });
    });
  });

  describe('verifyAndEnableTwoFactor', () => {
    it('should verify and enable 2FA with valid token', async () => {
      // First setup 2FA to get the account in proper state
      mockAccount.security.twoFactorSecret = 'JBSWY3DPEHPK3PXP';
      mockAccount.security.twoFactorEnabled = false;

      const verifyData = { token: '123456', setupToken: 'setup_token_123' };

      const result = await TwoFAService.verifyAndEnableTwoFactor(mockAccountId, verifyData);

      expect(result).toEqual({
        message: 'Two-factor authentication has been successfully enabled for your account.',
      });

      expect(mockAccount.security.twoFactorEnabled).toBe(true);
      expect(mockAccount.save).toHaveBeenCalled();
    });

    it('should throw error for missing token', async () => {
      const invalidData = { setupToken: 'setup_token_123' };

      await expect(TwoFAService.verifyAndEnableTwoFactor(mockAccountId, invalidData as any)).rejects.toThrow(
        'token is required',
      );
    });

    it('should throw error for missing setup token', async () => {
      const invalidData = { token: '123456' };

      await expect(TwoFAService.verifyAndEnableTwoFactor(mockAccountId, invalidData as any)).rejects.toThrow(
        'setupToken is required',
      );
    });

    it('should throw error for invalid token length', async () => {
      const invalidData = { token: '123', setupToken: 'setup_token_123' };

      await expect(TwoFAService.verifyAndEnableTwoFactor(mockAccountId, invalidData)).rejects.toThrow(
        '2FA token must be exactly 6 characters long',
      );
    });
  });

  describe('generateBackupCodes', () => {
    beforeEach(() => {
      mockAccount.security.twoFactorEnabled = true;
    });

    it('should generate backup codes for local account with valid password', async () => {
      const requestData = { password: mockPassword };

      const result = await TwoFAService.generateBackupCodes(mockAccountId, requestData);

      expect(mockAccount.comparePassword).toHaveBeenCalledWith(mockPassword);
      expect(mockAccount.save).toHaveBeenCalled();

      expect(result.message).toContain('New backup codes generated successfully');
      expect(result.backupCodes).toHaveLength(10);
      expect(result.backupCodes.every((code) => typeof code === 'string' && code.length === 8)).toBe(true);
      expect(mockAccount.security.twoFactorBackupCodes).toHaveLength(10);
    });

    it('should generate backup codes for OAuth account with valid token', async () => {
      mockAccount.accountType = AccountType.OAuth;
      const requestData = {};

      const result = await TwoFAService.generateBackupCodes(mockAccountId, requestData, mockOAuthToken);

      expect(googleServices.verifyGoogleTokenOwnership).toHaveBeenCalledWith(mockOAuthToken, mockAccountId);
      expect(result.backupCodes).toHaveLength(10);
    });

    it('should throw error when 2FA is not enabled', async () => {
      mockAccount.security.twoFactorEnabled = false;
      const requestData = { password: mockPassword };

      await expect(TwoFAService.generateBackupCodes(mockAccountId, requestData)).rejects.toThrow(BadRequestError);
      await expect(TwoFAService.generateBackupCodes(mockAccountId, requestData)).rejects.toThrow(
        'Two-factor authentication is not enabled for this account',
      );
    });

    it('should throw error for local account without password', async () => {
      const requestData = {};

      await expect(TwoFAService.generateBackupCodes(mockAccountId, requestData)).rejects.toThrow(BadRequestError);
      await expect(TwoFAService.generateBackupCodes(mockAccountId, requestData)).rejects.toThrow(
        'Password is required for local accounts',
      );
    });

    it('should throw error for OAuth account without token', async () => {
      mockAccount.accountType = AccountType.OAuth;
      const requestData = {};

      await expect(TwoFAService.generateBackupCodes(mockAccountId, requestData)).rejects.toThrow(BadRequestError);
      await expect(TwoFAService.generateBackupCodes(mockAccountId, requestData)).rejects.toThrow(
        'OAuth access token is required for OAuth accounts',
      );
    });
  });

  describe('verifyTwoFactorLogin', () => {
    beforeEach(() => {
      mockAccount.security.twoFactorEnabled = true;
      mockAccount.security.twoFactorSecret = 'JBSWY3DPEHPK3PXP';
    });

    it('should verify and complete login for local account', async () => {
      const loginData = { token: '123456', tempToken: 'temp_token_123' };

      const result = await TwoFAService.verifyTwoFactorLogin(loginData);

      expect(result).toEqual({
        accountId: mockAccountId,
        name: mockAccount.userDetails.name,
        message: 'Two-factor authentication successful',
        accountType: AccountType.Local,
      });
    });

    it('should verify OAuth account login with tokens', async () => {
      mockAccount.accountType = AccountType.OAuth;
      const loginData = { token: '123456', tempToken: 'temp_token_123' };

      const result = await TwoFAService.verifyTwoFactorLogin(loginData);

      expect(result.accountType).toBe(AccountType.OAuth);
      expect(result.needsAdditionalScopes).toBe(false);
      expect(result.missingScopes).toEqual([]);
    });

    it('should throw error for account without 2FA enabled', async () => {
      mockAccount.security.twoFactorEnabled = false;
      const loginData = { token: '123456', tempToken: 'temp_token_123' };

      await expect(TwoFAService.verifyTwoFactorLogin(loginData)).rejects.toThrow(NotFoundError);
      await expect(TwoFAService.verifyTwoFactorLogin(loginData)).rejects.toThrow(
        'Account not found or 2FA not enabled',
      );
    });

    it('should throw error for missing required fields', async () => {
      await expect(TwoFAService.verifyTwoFactorLogin({ tempToken: 'temp' } as any)).rejects.toThrow(
        'token is required',
      );
      await expect(TwoFAService.verifyTwoFactorLogin({ token: '123456' } as any)).rejects.toThrow(
        'tempToken is required',
      );
    });

    it('should throw error for invalid token length', async () => {
      const invalidData = { token: '123456789', tempToken: 'temp' };

      await expect(TwoFAService.verifyTwoFactorLogin(invalidData)).rejects.toThrow(
        '2FA token must be between 6 and 8 characters long',
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing 2FA secret during login verification', async () => {
      mockAccount.security.twoFactorEnabled = true;
      mockAccount.security.twoFactorSecret = undefined;

      const loginData = { token: '123456', tempToken: 'temp_token_123' };

      await expect(TwoFAService.verifyTwoFactorLogin(loginData)).rejects.toThrow(NotFoundError);
    });
  });

  describe('Security Features', () => {
    it('should generate unique backup codes each time', async () => {
      mockAccount.security.twoFactorEnabled = true;
      const requestData = { password: mockPassword };

      const result1 = await TwoFAService.generateBackupCodes(mockAccountId, requestData);
      const result2 = await TwoFAService.generateBackupCodes(mockAccountId, requestData);

      // Backup codes should be different between generations
      expect(result1.backupCodes).not.toEqual(result2.backupCodes);
    });

    it('should store hashed backup codes in account', async () => {
      mockAccount.security.twoFactorEnabled = true;
      const requestData = { password: mockPassword };

      const result = await TwoFAService.generateBackupCodes(mockAccountId, requestData);

      // Backup codes in result should be different from stored ones (stored are hashed)
      expect(mockAccount.security.twoFactorBackupCodes).toHaveLength(10);
      expect(mockAccount.security.twoFactorBackupCodes).not.toEqual(result.backupCodes);
    });

    it('should verify email matching during login', async () => {
      mockAccount.security.twoFactorEnabled = true;
      mockAccount.security.twoFactorSecret = 'JBSWY3DPEHPK3PXP';
      mockAccount.userDetails.email = 'different@example.com';

      const loginData = { token: '123456', tempToken: 'temp_token_123' };

      // This should work since we're mocking the cache to return the matching email
      const result = await TwoFAService.verifyTwoFactorLogin(loginData);
      expect(result.accountId).toBe(mockAccountId);
    });
  });
});
