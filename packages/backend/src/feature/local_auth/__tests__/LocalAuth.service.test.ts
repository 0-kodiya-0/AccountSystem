import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcrypt';
import * as LocalAuthService from '../LocalAuth.service';
import * as LocalAuthCache from '../LocalAuth.cache';
import * as TwoFACache from '../../twofa/TwoFA.cache';
import * as EmailService from '../../email/Email.service';
import * as EmailUtils from '../../email/Email.utils';
import { AccountType, AccountStatus } from '../../account/Account.types';
import { BadRequestError, NotFoundError, ValidationError, ServerError } from '../../../types/response.types';
import { getModels } from '../../../config/db.config';

// Mock dependencies
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock('../../../config/db.config', () => ({
  getModels: vi.fn(),
}));

vi.mock('../LocalAuth.cache', () => ({
  saveEmailForVerification: vi.fn(),
  getEmailVerificationData: vi.fn(),
  getEmailVerificationDataByToken: vi.fn(),
  markEmailVerifiedAndCreateProfileStep: vi.fn(),
  removeEmailVerificationData: vi.fn(),
  cleanupSignupData: vi.fn(),
  getProfileCompletionData: vi.fn(),
  removeProfileCompletionData: vi.fn(),
  savePasswordResetToken: vi.fn(),
  getPasswordResetToken: vi.fn(),
  removePasswordResetToken: vi.fn(),
}));

vi.mock('../../twofa/TwoFA.cache', () => ({
  saveTwoFactorTempToken: vi.fn(),
}));

vi.mock('../../email/Email.service', () => ({
  sendSignupEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendPasswordChangedNotification: vi.fn(),
}));

vi.mock('../../email/Email.utils', () => ({
  sendCriticalEmail: vi.fn(),
  sendNonCriticalEmail: vi.fn(),
}));

vi.mock('../../account/Account.utils', () => ({
  toSafeAccount: vi.fn((account) => account),
}));

describe('Local Auth Service', () => {
  const mockAccountId = '507f1f77bcf86cd799439011';
  const mockEmail = 'test@example.com';
  const mockPassword = 'password123';
  const mockCallbackUrl = 'https://app.example.com/auth/callback';
  const mockToken = 'mock_token_123';

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
        firstName: 'Test',
        lastName: 'User',
        email: mockEmail,
        username: 'testuser',
        emailVerified: true,
      },
      security: {
        password: 'hashed_password',
        twoFactorEnabled: false,
        sessionTimeout: 3600,
        autoLock: false,
        failedLoginAttempts: 0,
        previousPasswords: [],
      },
      comparePassword: vi.fn().mockResolvedValue(true),
      save: vi.fn().mockResolvedValue(true),
    };

    // Mock account model
    mockAccountModel = {
      findOne: vi.fn(),
      findById: vi.fn().mockResolvedValue(mockAccount),
      create: vi.fn().mockResolvedValue(mockAccount),
    };

    // Mock database models
    vi.mocked(getModels).mockResolvedValue({
      accounts: {
        Account: mockAccountModel,
      },
    } as any);

    // Mock email services
    vi.mocked(EmailUtils.sendCriticalEmail).mockResolvedValue(undefined);
    vi.mocked(EmailUtils.sendNonCriticalEmail).mockResolvedValue(undefined);

    // Mock cache functions
    vi.mocked(LocalAuthCache.saveEmailForVerification).mockReturnValue(mockToken);
    vi.mocked(TwoFACache.saveTwoFactorTempToken).mockReturnValue('temp_token_123');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('requestEmailVerification', () => {
    it('should send verification email for new email', async () => {
      mockAccountModel.findOne.mockResolvedValue(null); // Email doesn't exist

      const result = await LocalAuthService.requestEmailVerification(mockEmail, mockCallbackUrl);

      expect(LocalAuthCache.saveEmailForVerification).toHaveBeenCalledWith(mockEmail);
      expect(EmailUtils.sendCriticalEmail).toHaveBeenCalledWith(
        EmailService.sendSignupEmailVerification,
        [mockEmail, mockToken, mockCallbackUrl],
        { maxAttempts: 3, delayMs: 2000 },
      );
      expect(result).toEqual({ token: mockToken });
    });

    it('should resend verification email for existing verification', async () => {
      mockAccountModel.findOne.mockResolvedValue(null);
      vi.mocked(LocalAuthCache.getEmailVerificationData).mockReturnValue({
        email: mockEmail,
        verificationToken: 'existing_token',
        step: 'email_verification',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString(),
      });

      const result = await LocalAuthService.requestEmailVerification(mockEmail, mockCallbackUrl);

      expect(EmailUtils.sendCriticalEmail).toHaveBeenCalledWith(
        EmailService.sendSignupEmailVerification,
        [mockEmail, 'existing_token', mockCallbackUrl],
        { maxAttempts: 3, delayMs: 2000 },
      );
      expect(result).toEqual({ token: 'existing_token' });
    });

    it('should throw error if email already exists', async () => {
      mockAccountModel.findOne.mockResolvedValue(mockAccount);

      await expect(LocalAuthService.requestEmailVerification(mockEmail, mockCallbackUrl)).rejects.toThrow(
        BadRequestError,
      );
      await expect(LocalAuthService.requestEmailVerification(mockEmail, mockCallbackUrl)).rejects.toThrow(
        'Email already registered',
      );
    });

    it('should validate email format', async () => {
      await expect(LocalAuthService.requestEmailVerification('invalid-email', mockCallbackUrl)).rejects.toThrow(
        'Invalid email format',
      );
    });

    it('should validate callback URL', async () => {
      await expect(LocalAuthService.requestEmailVerification(mockEmail, 'invalid-url')).rejects.toThrow(
        'Invalid URL format',
      );
    });

    it('should handle email sending failure', async () => {
      mockAccountModel.findOne.mockResolvedValue(null);
      vi.mocked(EmailUtils.sendCriticalEmail).mockRejectedValue(new Error('Email service down'));

      await expect(LocalAuthService.requestEmailVerification(mockEmail, mockCallbackUrl)).rejects.toThrow(ServerError);
      await expect(LocalAuthService.requestEmailVerification(mockEmail, mockCallbackUrl)).rejects.toThrow(
        'Failed to send verification email',
      );

      expect(LocalAuthCache.removeEmailVerificationData).toHaveBeenCalledWith(mockEmail);
    });
  });

  describe('verifyEmailAndProceedToProfile', () => {
    it('should verify email and create profile step', async () => {
      vi.mocked(LocalAuthCache.getEmailVerificationDataByToken).mockReturnValue({
        email: mockEmail,
        verificationToken: mockToken,
        step: 'email_verification',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString(),
      });
      vi.mocked(LocalAuthCache.markEmailVerifiedAndCreateProfileStep).mockReturnValue('profile_token_123');

      const result = await LocalAuthService.verifyEmailAndProceedToProfile(mockToken);

      expect(LocalAuthCache.getEmailVerificationDataByToken).toHaveBeenCalledWith(mockToken);
      expect(LocalAuthCache.markEmailVerifiedAndCreateProfileStep).toHaveBeenCalledWith(mockEmail);
      expect(result).toEqual({
        profileToken: 'profile_token_123',
        email: mockEmail,
      });
    });

    it('should throw error for invalid token', async () => {
      vi.mocked(LocalAuthCache.getEmailVerificationDataByToken).mockReturnValue(null);

      await expect(LocalAuthService.verifyEmailAndProceedToProfile('invalid_token')).rejects.toThrow(ValidationError);
      await expect(LocalAuthService.verifyEmailAndProceedToProfile('invalid_token')).rejects.toThrow(
        'Invalid or expired verification token',
      );
    });

    it('should validate token format', async () => {
      await expect(LocalAuthService.verifyEmailAndProceedToProfile('')).rejects.toThrow('token is required');
    });
  });

  describe('completeProfileAndCreateAccount', () => {
    const profileData = {
      firstName: 'John',
      lastName: 'Doe',
      username: 'johndoe',
      password: 'StrongPass123!',
      confirmPassword: 'StrongPass123!',
      birthdate: '1990-01-01',
      agreeToTerms: true,
    };

    beforeEach(() => {
      vi.mocked(LocalAuthCache.getProfileCompletionData).mockReturnValue({
        email: mockEmail,
        emailVerified: true,
        verificationToken: 'profile_token_123',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });
      mockAccountModel.findOne.mockResolvedValue(null); // No existing account
    });

    it('should create account with valid profile data', async () => {
      const result = await LocalAuthService.completeProfileAndCreateAccount('profile_token_123', profileData);

      expect(mockAccountModel.create).toHaveBeenCalledWith({
        created: expect.any(String),
        updated: expect.any(String),
        accountType: AccountType.Local,
        status: AccountStatus.Active,
        userDetails: {
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          name: 'John Doe',
          email: mockEmail,
          username: profileData.username,
          birthdate: profileData.birthdate,
          emailVerified: true,
        },
        security: {
          password: profileData.password,
          twoFactorEnabled: false,
          sessionTimeout: 3600,
          autoLock: false,
          failedLoginAttempts: 0,
        },
      });
      expect(LocalAuthCache.removeProfileCompletionData).toHaveBeenCalledWith('profile_token_123');
      expect(result).toBeDefined();
    });

    it('should throw error for invalid profile token', async () => {
      vi.mocked(LocalAuthCache.getProfileCompletionData).mockReturnValue(null);

      await expect(LocalAuthService.completeProfileAndCreateAccount('invalid_token', profileData)).rejects.toThrow(
        ValidationError,
      );
      await expect(LocalAuthService.completeProfileAndCreateAccount('invalid_token', profileData)).rejects.toThrow(
        'Invalid or expired profile token',
      );
    });

    it('should throw error if email not verified', async () => {
      vi.mocked(LocalAuthCache.getProfileCompletionData).mockReturnValue({
        email: mockEmail,
        emailVerified: false,
        verificationToken: 'profile_token_123',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      await expect(LocalAuthService.completeProfileAndCreateAccount('profile_token_123', profileData)).rejects.toThrow(
        ValidationError,
      );
      await expect(LocalAuthService.completeProfileAndCreateAccount('profile_token_123', profileData)).rejects.toThrow(
        'Email must be verified before completing profile',
      );
    });

    it('should validate password confirmation', async () => {
      const invalidData = {
        ...profileData,
        confirmPassword: 'DifferentPassword123!',
      };

      await expect(LocalAuthService.completeProfileAndCreateAccount('profile_token_123', invalidData)).rejects.toThrow(
        ValidationError,
      );
      await expect(LocalAuthService.completeProfileAndCreateAccount('profile_token_123', invalidData)).rejects.toThrow(
        'Passwords do not match',
      );
    });

    it('should validate terms agreement', async () => {
      const invalidData = {
        ...profileData,
        agreeToTerms: false,
      };

      await expect(LocalAuthService.completeProfileAndCreateAccount('profile_token_123', invalidData)).rejects.toThrow(
        ValidationError,
      );
      await expect(LocalAuthService.completeProfileAndCreateAccount('profile_token_123', invalidData)).rejects.toThrow(
        'You must agree to the terms and conditions',
      );
    });

    it('should check for existing username', async () => {
      mockAccountModel.findOne
        .mockResolvedValueOnce(null) // Email check
        .mockResolvedValueOnce(mockAccount); // Username check

      await expect(LocalAuthService.completeProfileAndCreateAccount('profile_token_123', profileData)).rejects.toThrow(
        BadRequestError,
      );
      await expect(LocalAuthService.completeProfileAndCreateAccount('profile_token_123', profileData)).rejects.toThrow(
        'Username already in use',
      );
    });

    it('should handle account creation without username', async () => {
      const dataWithoutUsername = {
        ...profileData,
        username: undefined,
      };

      await LocalAuthService.completeProfileAndCreateAccount('profile_token_123', dataWithoutUsername);

      expect(mockAccountModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userDetails: expect.objectContaining({
            username: undefined,
          }),
        }),
      );
    });

    it("should double-check email doesn't exist during creation", async () => {
      mockAccountModel.findOne
        .mockResolvedValueOnce(null) // Initial email check
        .mockResolvedValueOnce(null) // Username check
        .mockResolvedValueOnce(mockAccount); // Final email check

      await expect(LocalAuthService.completeProfileAndCreateAccount('profile_token_123', profileData)).rejects.toThrow(
        BadRequestError,
      );
      await expect(LocalAuthService.completeProfileAndCreateAccount('profile_token_123', profileData)).rejects.toThrow(
        'Email already registered',
      );
    });
  });

  describe('cancelEmailVerification', () => {
    it('should cancel email verification', async () => {
      const result = await LocalAuthService.cancelEmailVerification(mockEmail);

      expect(LocalAuthCache.cleanupSignupData).toHaveBeenCalledWith(mockEmail);
      expect(result).toBe(true);
    });

    it('should validate email format', async () => {
      await expect(LocalAuthService.cancelEmailVerification('invalid-email')).rejects.toThrow('Invalid email format');
    });
  });

  describe('authenticateLocalUser', () => {
    const loginData = {
      email: mockEmail,
      password: mockPassword,
      rememberMe: false,
    };

    beforeEach(() => {
      mockAccountModel.findOne.mockResolvedValue(mockAccount);
    });

    it('should authenticate user with valid credentials', async () => {
      const result = await LocalAuthService.authenticateLocalUser(loginData);

      expect(mockAccountModel.findOne).toHaveBeenCalledWith({
        'userDetails.email': mockEmail,
        accountType: AccountType.Local,
      });
      expect(mockAccount.comparePassword).toHaveBeenCalledWith(mockPassword);
      expect(result).toEqual(mockAccount);
    });

    it('should authenticate with username instead of email', async () => {
      const usernameLogin = {
        username: 'testuser',
        password: mockPassword,
      };

      await LocalAuthService.authenticateLocalUser(usernameLogin);

      expect(mockAccountModel.findOne).toHaveBeenCalledWith({
        'userDetails.username': 'testuser',
        accountType: AccountType.Local,
      });
    });

    it('should return 2FA requirement when enabled', async () => {
      mockAccount.security.twoFactorEnabled = true;

      const result = await LocalAuthService.authenticateLocalUser(loginData);

      expect(TwoFACache.saveTwoFactorTempToken).toHaveBeenCalledWith(mockAccountId, mockEmail, AccountType.Local);
      expect(result).toEqual({
        requiresTwoFactor: true,
        tempToken: 'temp_token_123',
        accountId: mockAccountId,
      });
    });

    it('should throw error for non-existent account', async () => {
      mockAccountModel.findOne.mockResolvedValue(null);

      await expect(LocalAuthService.authenticateLocalUser(loginData)).rejects.toThrow(NotFoundError);
      await expect(LocalAuthService.authenticateLocalUser(loginData)).rejects.toThrow(
        'Invalid email/username or password',
      );
    });

    it('should throw error for incorrect password', async () => {
      mockAccount.comparePassword.mockResolvedValue(false);

      await expect(LocalAuthService.authenticateLocalUser(loginData)).rejects.toThrow(NotFoundError);
      await expect(LocalAuthService.authenticateLocalUser(loginData)).rejects.toThrow(
        'Invalid email/username or password',
      );

      expect(mockAccount.security.failedLoginAttempts).toBe(1);
      expect(mockAccount.save).toHaveBeenCalled();
    });

    it('should lock account after failed attempts', async () => {
      mockAccount.security.failedLoginAttempts = 4;
      mockAccount.comparePassword.mockResolvedValue(false);

      await expect(LocalAuthService.authenticateLocalUser(loginData)).rejects.toThrow(ValidationError);
      await expect(LocalAuthService.authenticateLocalUser(loginData)).rejects.toThrow('Too many failed login attempts');

      expect(mockAccount.security.lockoutUntil).toBeDefined();
    });

    it('should reject locked account', async () => {
      mockAccount.security.lockoutUntil = new Date(Date.now() + 900000); // 15 minutes

      await expect(LocalAuthService.authenticateLocalUser(loginData)).rejects.toThrow(ValidationError);
      await expect(LocalAuthService.authenticateLocalUser(loginData)).rejects.toThrow('Account is temporarily locked');
    });

    it('should reject suspended account', async () => {
      mockAccount.status = AccountStatus.Suspended;

      await expect(LocalAuthService.authenticateLocalUser(loginData)).rejects.toThrow(ValidationError);
      await expect(LocalAuthService.authenticateLocalUser(loginData)).rejects.toThrow(
        'This account has been suspended',
      );
    });

    it('should reject unverified account', async () => {
      mockAccount.status = AccountStatus.Unverified;

      await expect(LocalAuthService.authenticateLocalUser(loginData)).rejects.toThrow(ValidationError);
      await expect(LocalAuthService.authenticateLocalUser(loginData)).rejects.toThrow(
        'Please verify your email address',
      );
    });

    it('should reset failed attempts on successful login', async () => {
      mockAccount.security.failedLoginAttempts = 3;

      await LocalAuthService.authenticateLocalUser(loginData);

      expect(mockAccount.security.failedLoginAttempts).toBe(0);
      expect(mockAccount.security.lockoutUntil).toBeUndefined();
      expect(mockAccount.save).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      await expect(LocalAuthService.authenticateLocalUser({ password: mockPassword } as any)).rejects.toThrow(
        'Email or username is required',
      );

      await expect(LocalAuthService.authenticateLocalUser({ email: mockEmail } as any)).rejects.toThrow(
        'password is required',
      );
    });
  });

  describe('requestPasswordReset', () => {
    beforeEach(() => {
      mockAccountModel.findOne.mockResolvedValue(mockAccount);
      vi.mocked(LocalAuthCache.savePasswordResetToken).mockReturnValue('reset_token_123');
    });

    it('should send password reset email', async () => {
      const result = await LocalAuthService.requestPasswordReset({
        email: mockEmail,
        callbackUrl: mockCallbackUrl,
      });

      expect(mockAccountModel.findOne).toHaveBeenCalledWith({
        'userDetails.email': mockEmail,
        accountType: AccountType.Local,
      });
      expect(LocalAuthCache.savePasswordResetToken).toHaveBeenCalledWith(mockAccountId, mockEmail);
      expect(EmailUtils.sendCriticalEmail).toHaveBeenCalledWith(
        EmailService.sendPasswordResetEmail,
        [mockEmail, 'Test', 'reset_token_123', mockCallbackUrl],
        { maxAttempts: 3, delayMs: 2000 },
      );
      expect(result).toEqual({ resetToken: 'reset_token_123' });
    });

    it('should throw error for non-existent email', async () => {
      mockAccountModel.findOne.mockResolvedValue(null);

      await expect(
        LocalAuthService.requestPasswordReset({
          email: mockEmail,
          callbackUrl: mockCallbackUrl,
        }),
      ).rejects.toThrow(BadRequestError);
      await expect(
        LocalAuthService.requestPasswordReset({
          email: mockEmail,
          callbackUrl: mockCallbackUrl,
        }),
      ).rejects.toThrow('Password reset requested for non-existent email');
    });

    it('should handle email sending failure', async () => {
      vi.mocked(EmailUtils.sendCriticalEmail).mockRejectedValue(new Error('Email service down'));

      await expect(
        LocalAuthService.requestPasswordReset({
          email: mockEmail,
          callbackUrl: mockCallbackUrl,
        }),
      ).rejects.toThrow(ServerError);

      expect(LocalAuthCache.removePasswordResetToken).toHaveBeenCalledWith('reset_token_123');
    });

    it('should validate email and callback URL', async () => {
      await expect(
        LocalAuthService.requestPasswordReset({
          email: 'invalid-email',
          callbackUrl: mockCallbackUrl,
        }),
      ).rejects.toThrow('Invalid email format');

      await expect(
        LocalAuthService.requestPasswordReset({
          email: mockEmail,
          callbackUrl: 'invalid-url',
        }),
      ).rejects.toThrow('Invalid URL format');
    });
  });

  describe('verifyPasswordResetRequest', () => {
    beforeEach(() => {
      vi.mocked(LocalAuthCache.getPasswordResetToken).mockReturnValue({
        token: 'verify_token_123',
        accountId: mockAccountId,
        email: mockEmail,
        expiresAt: new Date(Date.now() + 600000).toISOString(), // 10 minutes
      });
      vi.mocked(LocalAuthCache.savePasswordResetToken).mockReturnValue('new_reset_token_123');
    });

    it('should verify and create new reset token', async () => {
      const result = await LocalAuthService.verifyPasswordResetRequest({
        token: 'verify_token_123',
      });

      expect(LocalAuthCache.getPasswordResetToken).toHaveBeenCalledWith('verify_token_123');
      expect(LocalAuthCache.savePasswordResetToken).toHaveBeenCalledWith(mockAccountId, mockEmail);
      expect(LocalAuthCache.removePasswordResetToken).toHaveBeenCalledWith('verify_token_123');
      expect(result).toEqual({
        success: true,
        message: 'Token verified successfully. You can now reset your password.',
        resetToken: 'new_reset_token_123',
        expiresAt: expect.any(String),
      });
    });

    it('should throw error for invalid token', async () => {
      vi.mocked(LocalAuthCache.getPasswordResetToken).mockReturnValue(null);

      await expect(
        LocalAuthService.verifyPasswordResetRequest({
          token: 'invalid_token',
        }),
      ).rejects.toThrow(ValidationError);
      await expect(
        LocalAuthService.verifyPasswordResetRequest({
          token: 'invalid_token',
        }),
      ).rejects.toThrow('Password reset token is invalid or has expired');
    });

    it('should throw error for expired token', async () => {
      vi.mocked(LocalAuthCache.getPasswordResetToken).mockReturnValue({
        token: 'expired_token',
        accountId: mockAccountId,
        email: mockEmail,
        expiresAt: new Date(Date.now() - 600000).toISOString(), // Expired
      });

      await expect(
        LocalAuthService.verifyPasswordResetRequest({
          token: 'expired_token',
        }),
      ).rejects.toThrow(ValidationError);
      await expect(
        LocalAuthService.verifyPasswordResetRequest({
          token: 'expired_token',
        }),
      ).rejects.toThrow('Password reset token has expired');

      expect(LocalAuthCache.removePasswordResetToken).toHaveBeenCalledWith('expired_token');
    });
  });

  describe('resetPassword', () => {
    const newPassword = 'NewStrongPass123!';

    beforeEach(() => {
      vi.mocked(LocalAuthCache.getPasswordResetToken).mockReturnValue({
        token: 'reset_token_123',
        accountId: mockAccountId,
        email: mockEmail,
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      });
    });

    it('should reset password with valid token', async () => {
      const result = await LocalAuthService.resetPassword('reset_token_123', newPassword);

      expect(mockAccountModel.findById).toHaveBeenCalledWith(mockAccountId);
      expect(mockAccount.security.password).toBe(newPassword);
      expect(mockAccount.security.lastPasswordChange).toBeDefined();
      expect(mockAccount.security.failedLoginAttempts).toBe(0);
      expect(mockAccount.save).toHaveBeenCalled();
      expect(LocalAuthCache.removePasswordResetToken).toHaveBeenCalledWith('reset_token_123');
      expect(EmailUtils.sendNonCriticalEmail).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should store previous password in history', async () => {
      mockAccount.security.password = 'old_hashed_password';

      await LocalAuthService.resetPassword('reset_token_123', newPassword);

      expect(mockAccount.security.previousPasswords).toContain('old_hashed_password');
    });

    it('should prevent password reuse', async () => {
      mockAccount.security.previousPasswords = ['hashed_password_1', 'hashed_password_2'];

      // Mock bcrypt to return true for one of the previous passwords
      vi.mocked(bcrypt.compare).mockImplementation(async (password, hash) => {
        return hash === 'hashed_password_1' && password === newPassword;
      });

      await expect(LocalAuthService.resetPassword('reset_token_123', newPassword)).rejects.toThrow(ValidationError);
      await expect(LocalAuthService.resetPassword('reset_token_123', newPassword)).rejects.toThrow(
        'New password cannot be the same as any of your previous passwords',
      );
    });

    it('should throw error for invalid token', async () => {
      vi.mocked(LocalAuthCache.getPasswordResetToken).mockReturnValue(null);

      await expect(LocalAuthService.resetPassword('invalid_token', newPassword)).rejects.toThrow(ValidationError);
      await expect(LocalAuthService.resetPassword('invalid_token', newPassword)).rejects.toThrow(
        'Password reset token is invalid or has expired',
      );
    });

    it('should throw error for non-existent account', async () => {
      mockAccountModel.findById.mockResolvedValue(null);

      await expect(LocalAuthService.resetPassword('reset_token_123', newPassword)).rejects.toThrow(ValidationError);
      await expect(LocalAuthService.resetPassword('reset_token_123', newPassword)).rejects.toThrow('Account not found');
    });

    it('should throw error for email mismatch', async () => {
      mockAccount.userDetails.email = 'different@example.com';

      await expect(LocalAuthService.resetPassword('reset_token_123', newPassword)).rejects.toThrow(ValidationError);
      await expect(LocalAuthService.resetPassword('reset_token_123', newPassword)).rejects.toThrow(
        'Token email mismatch',
      );
    });

    it('should validate password strength', async () => {
      await expect(LocalAuthService.resetPassword('reset_token_123', 'weak')).rejects.toThrow(
        'Password must be at least 8 characters long',
      );
    });

    it('should limit password history to 5', async () => {
      mockAccount.security.previousPasswords = ['p1', 'p2', 'p3', 'p4', 'p5'];
      mockAccount.security.password = 'current_password';

      await LocalAuthService.resetPassword('reset_token_123', newPassword);

      expect(mockAccount.security.previousPasswords).toEqual(['p2', 'p3', 'p4', 'p5', 'current_password']);
      expect(mockAccount.security.previousPasswords).toHaveLength(5);
    });
  });

  describe('changePassword', () => {
    const changeData = {
      oldPassword: 'currentPassword',
      newPassword: 'NewStrongPass123!',
      confirmPassword: 'NewStrongPass123!',
    };

    it('should change password with valid data', async () => {
      const result = await LocalAuthService.changePassword(mockAccountId, changeData);

      expect(mockAccountModel.findById).toHaveBeenCalledWith(mockAccountId);
      expect(mockAccount.comparePassword).toHaveBeenCalledWith(changeData.oldPassword);
      expect(mockAccount.security.password).toBe(changeData.newPassword);
      expect(mockAccount.security.lastPasswordChange).toBeDefined();
      expect(mockAccount.save).toHaveBeenCalled();
      expect(EmailUtils.sendNonCriticalEmail).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should throw error for incorrect old password', async () => {
      mockAccount.comparePassword.mockResolvedValue(false);

      await expect(LocalAuthService.changePassword(mockAccountId, changeData)).rejects.toThrow(ValidationError);
      await expect(LocalAuthService.changePassword(mockAccountId, changeData)).rejects.toThrow(
        'Current password is incorrect',
      );
    });

    it('should throw error for non-existent account', async () => {
      mockAccountModel.findById.mockResolvedValue(null);

      await expect(LocalAuthService.changePassword(mockAccountId, changeData)).rejects.toThrow(NotFoundError);
      await expect(LocalAuthService.changePassword(mockAccountId, changeData)).rejects.toThrow('Account not found');
    });

    it('should prevent password reuse in change password', async () => {
      mockAccount.security.previousPasswords = ['hashed_password_1', 'hashed_password_2'];

      vi.mocked(bcrypt.compare).mockImplementation(async (password, hash) => {
        return hash === 'hashed_password_1' && password === changeData.newPassword;
      });

      await expect(LocalAuthService.changePassword(mockAccountId, changeData)).rejects.toThrow(ValidationError);
      await expect(LocalAuthService.changePassword(mockAccountId, changeData)).rejects.toThrow(
        'New password cannot be the same as any of your previous 5 passwords',
      );
    });

    it('should store previous password in history during change', async () => {
      mockAccount.security.password = 'old_hashed_password';

      await LocalAuthService.changePassword(mockAccountId, changeData);

      expect(mockAccount.security.previousPasswords).toContain('old_hashed_password');
    });

    it('should validate account ID format', async () => {
      await expect(LocalAuthService.changePassword('invalid-id', changeData)).rejects.toThrow(
        'Invalid ObjectId format',
      );
    });

    it('should validate password strength for new password', async () => {
      const weakPasswordData = {
        ...changeData,
        newPassword: 'weak',
        confirmPassword: 'weak',
      };

      await expect(LocalAuthService.changePassword(mockAccountId, weakPasswordData)).rejects.toThrow(
        'Password must be at least 8 characters long',
      );
    });

    it('should handle non-local account types', async () => {
      mockAccount.accountType = AccountType.OAuth;

      await expect(LocalAuthService.changePassword(mockAccountId, changeData)).rejects.toThrow(NotFoundError);
      await expect(LocalAuthService.changePassword(mockAccountId, changeData)).rejects.toThrow('Account not found');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors', async () => {
      vi.mocked(getModels).mockRejectedValue(new Error('Database connection failed'));

      await expect(LocalAuthService.requestEmailVerification(mockEmail, mockCallbackUrl)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle account save failures', async () => {
      mockAccount.save.mockRejectedValue(new Error('Database save failed'));

      await expect(
        LocalAuthService.authenticateLocalUser({
          email: mockEmail,
          password: 'wrong_password',
        }),
      ).rejects.toThrow('Database save failed');
    });

    it('should handle cache failures gracefully', async () => {
      vi.mocked(LocalAuthCache.saveEmailForVerification).mockImplementation(() => {
        throw new Error('Cache error');
      });

      await expect(LocalAuthService.requestEmailVerification(mockEmail, mockCallbackUrl)).rejects.toThrow(
        'Cache error',
      );
    });

    it('should handle missing account fields', async () => {
      const incompleteAccount = {
        ...mockAccount,
        userDetails: {
          email: mockEmail,
          // Missing name field
        },
      };
      mockAccountModel.findOne.mockResolvedValue(incompleteAccount);

      // Should still work with incomplete data
      await LocalAuthService.authenticateLocalUser({
        email: mockEmail,
        password: mockPassword,
      });

      expect(incompleteAccount.comparePassword).toHaveBeenCalled();
    });

    it('should handle null security object', async () => {
      const accountWithNullSecurity = {
        ...mockAccount,
        security: null,
      };
      mockAccountModel.findOne.mockResolvedValue(accountWithNullSecurity);

      await expect(
        LocalAuthService.authenticateLocalUser({
          email: mockEmail,
          password: mockPassword,
        }),
      ).rejects.toThrow();
    });

    it('should handle long email addresses', async () => {
      const longEmail = 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com';

      await expect(LocalAuthService.requestEmailVerification(longEmail, mockCallbackUrl)).resolves.toBeDefined();
    });

    it('should handle special characters in passwords', async () => {
      const specialCharPassword = 'Pass@#$%^&*()123!';

      await expect(LocalAuthService.resetPassword('reset_token_123', specialCharPassword)).resolves.toBe(true);
    });

    it('should handle empty previous passwords array', async () => {
      mockAccount.security.previousPasswords = [];

      await LocalAuthService.changePassword(mockAccountId, {
        oldPassword: 'currentPassword',
        newPassword: 'NewStrongPass123!',
        confirmPassword: 'NewStrongPass123!',
      });

      expect(mockAccount.save).toHaveBeenCalled();
    });

    it('should handle undefined previous passwords', async () => {
      mockAccount.security.previousPasswords = undefined;

      await LocalAuthService.changePassword(mockAccountId, {
        oldPassword: 'currentPassword',
        newPassword: 'NewStrongPass123!',
        confirmPassword: 'NewStrongPass123!',
      });

      expect(mockAccount.security.previousPasswords).toBeDefined();
    });
  });

  describe('Security Features', () => {
    it('should generate unique verification tokens', async () => {
      mockAccountModel.findOne.mockResolvedValue(null);
      vi.mocked(LocalAuthCache.saveEmailForVerification).mockReturnValueOnce('token_1').mockReturnValueOnce('token_2');

      const result1 = await LocalAuthService.requestEmailVerification('email1@example.com', mockCallbackUrl);
      const result2 = await LocalAuthService.requestEmailVerification('email2@example.com', mockCallbackUrl);

      expect(result1.token).not.toBe(result2.token);
    });

    it('should generate unique reset tokens', async () => {
      mockAccountModel.findOne.mockResolvedValue(mockAccount);
      vi.mocked(LocalAuthCache.savePasswordResetToken).mockReturnValueOnce('reset_1').mockReturnValueOnce('reset_2');

      const result1 = await LocalAuthService.requestPasswordReset({
        email: 'email1@example.com',
        callbackUrl: mockCallbackUrl,
      });

      const result2 = await LocalAuthService.requestPasswordReset({
        email: 'email2@example.com',
        callbackUrl: mockCallbackUrl,
      });

      expect(result1.resetToken).not.toBe(result2.resetToken);
    });

    it('should clean up data after successful operations', async () => {
      // Test profile completion cleanup
      vi.mocked(LocalAuthCache.getProfileCompletionData).mockReturnValue({
        email: mockEmail,
        emailVerified: true,
        verificationToken: 'profile_token_123',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      await LocalAuthService.completeProfileAndCreateAccount('profile_token_123', {
        firstName: 'John',
        lastName: 'Doe',
        password: 'StrongPass123!',
        confirmPassword: 'StrongPass123!',
        agreeToTerms: true,
      });

      expect(LocalAuthCache.removeProfileCompletionData).toHaveBeenCalledWith('profile_token_123');
    });

    it('should handle concurrent login attempts', async () => {
      mockAccount.security.failedLoginAttempts = 3;
      mockAccount.comparePassword.mockResolvedValue(false);

      // Simulate concurrent failed logins
      const login1 = LocalAuthService.authenticateLocalUser({
        email: mockEmail,
        password: 'wrong1',
      });

      const login2 = LocalAuthService.authenticateLocalUser({
        email: mockEmail,
        password: 'wrong2',
      });

      await expect(Promise.all([login1, login2])).rejects.toThrow();
    });

    it('should validate token format and length', async () => {
      // Test short tokens
      await expect(LocalAuthService.verifyEmailAndProceedToProfile('short')).rejects.toThrow(
        'Verification token must be between 10 and 200 characters long',
      );

      // Test very long tokens
      const longToken = 'a'.repeat(201);
      await expect(LocalAuthService.verifyEmailAndProceedToProfile(longToken)).rejects.toThrow(
        'Verification token must be between 10 and 200 characters long',
      );
    });
  });
});
