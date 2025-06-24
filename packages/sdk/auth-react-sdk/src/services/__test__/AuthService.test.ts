import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../AuthService';
import { HttpClient } from '../../client/HttpClient';
import { OAuthProviders, AccountType } from '../../types';

describe('AuthService', () => {
  let authService: AuthService;
  let mockHttpClient: HttpClient;

  beforeEach(() => {
    mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
    } as any;

    authService = new AuthService(mockHttpClient);
  });

  describe('Session Management', () => {
    it('should get account session', async () => {
      const mockSessionData = {
        session: {
          hasSession: true,
          accountIds: ['507f1f77bcf86cd799439011'],
          currentAccountId: '507f1f77bcf86cd799439011',
          isValid: true,
        },
      };

      vi.mocked(mockHttpClient.get).mockResolvedValue(mockSessionData);

      const result = await authService.getAccountSession();

      expect(vi.mocked(mockHttpClient.get)).toHaveBeenCalledWith('/session');
      expect(result).toEqual(mockSessionData);
    });

    it('should get session accounts data', async () => {
      const accountIds = ['507f1f77bcf86cd799439011'];
      const mockAccountsData = [
        {
          id: '507f1f77bcf86cd799439011',
          accountType: 'local',
          status: 'active',
          userDetails: {
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      ];

      vi.mocked(mockHttpClient.get).mockResolvedValue(mockAccountsData);

      const result = await authService.getSessionAccountsData(accountIds);

      expect(vi.mocked(mockHttpClient.get)).toHaveBeenCalledWith(
        '/session/accounts?accountIds=507f1f77bcf86cd799439011',
      );
      expect(result).toEqual(mockAccountsData);
    });

    it('should set current account in session', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockResponse = { message: 'Account set as current', currentAccountId: accountId };

      vi.mocked(mockHttpClient.post).mockResolvedValue(mockResponse);

      const result = await authService.setCurrentAccountInSession(accountId);

      expect(vi.mocked(mockHttpClient.post)).toHaveBeenCalledWith('/session/current', { accountId });
      expect(result).toEqual(mockResponse);
    });

    it('should set current account to null', async () => {
      const mockResponse = { message: 'Account set as current', currentAccountId: null };

      vi.mocked(mockHttpClient.post).mockResolvedValue(mockResponse);

      const result = await authService.setCurrentAccountInSession(null);

      expect(vi.mocked(mockHttpClient.post)).toHaveBeenCalledWith('/session/current', { accountId: null });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Local Authentication', () => {
    it('should perform local login with email', async () => {
      const loginData = {
        email: 'john@example.com',
        password: 'password123',
      };
      const mockResponse = {
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: 'Login successful',
      };

      vi.mocked(mockHttpClient.post).mockResolvedValue(mockResponse);

      const result = await authService.localLogin(loginData);

      expect(vi.mocked(mockHttpClient.post)).toHaveBeenCalledWith('/auth/login', loginData);
      expect(result).toEqual(mockResponse);
    });

    it('should perform local login with username', async () => {
      const loginData = {
        username: 'johndoe',
        password: 'password123',
      };

      vi.mocked(mockHttpClient.post).mockResolvedValue({});

      await authService.localLogin(loginData);

      expect(vi.mocked(mockHttpClient.post)).toHaveBeenCalledWith('/auth/login', loginData);
    });

    it('should throw error when neither email nor username provided', async () => {
      const loginData = {
        password: 'password123',
      };

      await expect(authService.localLogin(loginData as any)).rejects.toThrow(
        'Either email or username is required for local login',
      );
    });

    it('should request password reset', async () => {
      const resetData = {
        email: 'john@example.com',
        callbackUrl: 'http://localhost:3000/reset',
      };
      const mockResponse = {
        message: 'Password reset email sent',
        callbackUrl: resetData.callbackUrl,
      };

      vi.mocked(mockHttpClient.post).mockResolvedValue(mockResponse);

      const result = await authService.requestPasswordReset(resetData);

      expect(vi.mocked(mockHttpClient.post)).toHaveBeenCalledWith('/auth/reset-password-request', resetData);
      expect(result).toEqual(mockResponse);
    });

    it('should verify password reset token', async () => {
      const verifyData = { token: 'reset-token-123' };
      const mockResponse = {
        success: true,
        message: 'Token verified',
        resetToken: 'verified-reset-token',
        expiresAt: '2024-01-01T01:00:00.000Z',
      };

      vi.mocked(mockHttpClient.post).mockResolvedValue(mockResponse);

      const result = await authService.verifyPasswordReset(verifyData);

      expect(vi.mocked(mockHttpClient.post)).toHaveBeenCalledWith('/auth/verify-password-request', verifyData);
      expect(result).toEqual(mockResponse);
    });

    it('should reset password', async () => {
      const token = 'reset-token-123';
      const resetData = {
        password: 'newPassword123',
        confirmPassword: 'newPassword123',
      };
      const mockResponse = { message: 'Password reset successful' };

      vi.mocked(mockHttpClient.post).mockResolvedValue(mockResponse);

      const result = await authService.resetPassword(token, resetData);

      expect(vi.mocked(mockHttpClient.post)).toHaveBeenCalledWith(
        `/auth/reset-password?token=${encodeURIComponent(token)}`,
        resetData,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should change password', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const changeData = {
        oldPassword: 'oldPassword123',
        newPassword: 'newPassword123',
        confirmPassword: 'newPassword123',
      };
      const mockResponse = { message: 'Password changed successfully' };

      vi.mocked(mockHttpClient.post).mockResolvedValue(mockResponse);

      const result = await authService.changePassword(accountId, changeData);

      expect(vi.mocked(mockHttpClient.post)).toHaveBeenCalledWith(`/${accountId}/auth/change-password`, changeData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Signup Flow', () => {
    it('should request email verification', async () => {
      const verificationData = {
        email: 'john@example.com',
        callbackUrl: 'http://localhost:3000/verify',
      };
      const mockResponse = {
        message: 'Verification email sent',
        email: verificationData.email,
        callbackUrl: verificationData.callbackUrl,
      };

      vi.mocked(mockHttpClient.post).mockResolvedValue(mockResponse);

      const result = await authService.requestEmailVerification(verificationData);

      expect(vi.mocked(mockHttpClient.post)).toHaveBeenCalledWith('/auth/signup/request-email', verificationData);
      expect(result).toEqual(mockResponse);
    });

    it('should verify email for signup', async () => {
      const token = 'verification-token-123';
      const mockResponse = {
        message: 'Email verified',
        profileToken: 'profile-token-456',
        email: 'john@example.com',
      };

      vi.mocked(mockHttpClient.get).mockResolvedValue(mockResponse);

      const result = await authService.verifyEmailForSignup(token);

      expect(vi.mocked(mockHttpClient.get)).toHaveBeenCalledWith(
        `/auth/signup/verify-email?token=${encodeURIComponent(token)}`,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should complete profile', async () => {
      const token = 'profile-token-456';
      const profileData = {
        firstName: 'John',
        lastName: 'Doe',
        password: 'password123',
        confirmPassword: 'password123',
        agreeToTerms: true,
      };
      const mockResponse = {
        message: 'Profile completed',
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
      };

      vi.mocked(mockHttpClient.post).mockResolvedValue(mockResponse);

      const result = await authService.completeProfile(token, profileData);

      expect(vi.mocked(mockHttpClient.post)).toHaveBeenCalledWith(
        `/auth/signup/complete-profile?token=${encodeURIComponent(token)}`,
        profileData,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should cancel signup', async () => {
      const cancelData = { email: 'john@example.com' };
      const mockResponse = { message: 'Signup canceled' };

      vi.mocked(mockHttpClient.delete).mockResolvedValue(mockResponse);

      const result = await authService.cancelSignup(cancelData);

      expect(vi.mocked(mockHttpClient.delete)).toHaveBeenCalledWith('/auth/signup/cancel', cancelData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Two-Factor Authentication', () => {
    it('should get 2FA status', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockResponse = {
        enabled: true,
        backupCodesCount: 8,
        lastSetupDate: '2024-01-01T00:00:00.000Z',
      };

      vi.mocked(mockHttpClient.get).mockResolvedValue(mockResponse);

      const result = await authService.getTwoFactorStatus(accountId);

      expect(vi.mocked(mockHttpClient.get)).toHaveBeenCalledWith(`/${accountId}/twofa/status`);
      expect(result).toEqual(mockResponse);
    });

    it('should setup 2FA for local account', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const setupData = {
        enableTwoFactor: true,
        password: 'password123',
      };
      const mockResponse = {
        message: '2FA setup initiated',
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
        setupToken: 'setup-token-123',
      };

      vi.mocked(mockHttpClient.post).mockResolvedValue(mockResponse);

      const result = await authService.setupTwoFactor(accountId, AccountType.Local, setupData);

      expect(vi.mocked(mockHttpClient.post)).toHaveBeenCalledWith(`/${accountId}/twofa/setup`, setupData);
      expect(result).toEqual(mockResponse);
    });

    it('should verify 2FA setup', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const token = '123456';
      const setupToken = 'setup-token-123';
      const mockResponse = { message: '2FA setup completed' };

      vi.mocked(mockHttpClient.post).mockResolvedValue(mockResponse);

      const result = await authService.verifyTwoFactorSetup(accountId, token, setupToken);

      expect(vi.mocked(mockHttpClient.post)).toHaveBeenCalledWith(`/${accountId}/twofa/verify-setup`, {
        token,
        setupToken,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should verify 2FA login', async () => {
      const verifyData = {
        token: '123456',
        tempToken: 'temp-token-789',
      };
      const mockResponse = {
        accountId: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        message: '2FA verification successful',
      };

      vi.mocked(mockHttpClient.post).mockResolvedValue(mockResponse);

      const result = await authService.verifyTwoFactorLogin(verifyData);

      expect(vi.mocked(mockHttpClient.post)).toHaveBeenCalledWith('/twofa/verify-login', verifyData);
      expect(result).toEqual(mockResponse);
    });

    it('should generate backup codes', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const backupData = { password: 'password123' };
      const mockResponse = {
        message: 'Backup codes generated',
        backupCodes: ['123456', '789012', '345678'],
      };

      vi.mocked(mockHttpClient.post).mockResolvedValue(mockResponse);

      const result = await authService.generateBackupCodes(accountId, backupData);

      expect(vi.mocked(mockHttpClient.post)).toHaveBeenCalledWith(`/${accountId}/twofa/backup-codes`, backupData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('OAuth Authentication', () => {
    it('should generate OAuth signup URL', async () => {
      const provider = OAuthProviders.Google;
      const requestData = { callbackUrl: 'http://localhost:3000/callback' };
      const mockResponse = {
        authorizationUrl: 'https://accounts.google.com/oauth/authorize?...',
        state: 'state-123',
        provider: 'google',
        authType: 'signup',
        callbackUrl: requestData.callbackUrl,
      };

      vi.mocked(mockHttpClient.get).mockResolvedValue(mockResponse);

      const result = await authService.generateOAuthSignupUrl(provider, requestData);

      expect(vi.mocked(mockHttpClient.get)).toHaveBeenCalledWith(
        `/oauth/signup/${provider}?callbackUrl=${encodeURIComponent(requestData.callbackUrl)}`,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should generate OAuth signin URL', async () => {
      const provider = OAuthProviders.Google;
      const requestData = { callbackUrl: 'http://localhost:3000/callback' };
      const mockResponse = {
        authorizationUrl: 'https://accounts.google.com/oauth/authorize?...',
        state: 'state-123',
        provider: 'google',
        authType: 'signin',
        callbackUrl: requestData.callbackUrl,
      };

      vi.mocked(mockHttpClient.get).mockResolvedValue(mockResponse);

      const result = await authService.generateOAuthSigninUrl(provider, requestData);

      expect(vi.mocked(mockHttpClient.get)).toHaveBeenCalledWith(
        `/oauth/signin/${provider}?callbackUrl=${encodeURIComponent(requestData.callbackUrl)}`,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should generate permission URL', async () => {
      const provider = OAuthProviders.Google;
      const requestData = {
        accountId: '507f1f77bcf86cd799439011',
        scopeNames: ['email', 'profile'],
        callbackUrl: 'http://localhost:3000/callback',
      };
      const mockResponse = {
        authorizationUrl: 'https://accounts.google.com/oauth/authorize?...',
        state: 'state-123',
        scopes: requestData.scopeNames,
        accountId: requestData.accountId,
        userEmail: 'john@example.com',
        callbackUrl: requestData.callbackUrl,
      };

      vi.mocked(mockHttpClient.get).mockResolvedValue(mockResponse);

      const result = await authService.generatePermissionUrl(provider, requestData);

      const expectedParams = new URLSearchParams();
      expectedParams.append('accountId', requestData.accountId);
      expectedParams.append('scopeNames', JSON.stringify(requestData.scopeNames));
      expectedParams.append('callbackUrl', requestData.callbackUrl);

      expect(vi.mocked(mockHttpClient.get)).toHaveBeenCalledWith(
        `/oauth/permission/${provider}?${expectedParams.toString()}`,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Token Management', () => {
    it('should get access token info', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockResponse = {
        isExpired: false,
        isValid: true,
        type: 'local_jwt',
        expiresAt: 1609459200000,
        timeRemaining: 3600,
        accountId,
      };

      vi.mocked(mockHttpClient.get).mockResolvedValue(mockResponse);

      const result = await authService.getAccessTokenInfo(accountId);

      expect(vi.mocked(mockHttpClient.get)).toHaveBeenCalledWith(`/${accountId}/tokens/access/info`);
      expect(result).toEqual(mockResponse);
    });

    it('should revoke tokens', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockResponse = {
        totalTokens: 2,
        successfulRevocations: 2,
        failedRevocations: 0,
        message: 'All tokens revoked successfully',
      };

      vi.mocked(mockHttpClient.post).mockResolvedValue(mockResponse);

      const result = await authService.revokeTokens(accountId);

      expect(vi.mocked(mockHttpClient.post)).toHaveBeenCalledWith(`/${accountId}/tokens/revoke`);
      expect(result).toEqual(mockResponse);
    });

    it('should logout account', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockResponse = {
        message: 'Logout successful',
        accountId,
        clearClientAccountState: true,
      };

      vi.mocked(mockHttpClient.get).mockResolvedValue(mockResponse);

      const result = await authService.logout(accountId);

      expect(vi.mocked(mockHttpClient.get)).toHaveBeenCalledWith(
        `/account/logout?accountId=${accountId}&clearClientAccountState=true`,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should logout all accounts', async () => {
      const accountIds = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'];
      const mockResponse = { message: 'All accounts logged out' };

      vi.mocked(mockHttpClient.get).mockResolvedValue(mockResponse);

      const result = await authService.logoutAll(accountIds);

      expect(vi.mocked(mockHttpClient.get)).toHaveBeenCalledWith(
        `/account/logout/all?accountIds=507f1f77bcf86cd799439011&accountIds=507f1f77bcf86cd799439012`,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Validation', () => {
    it('should throw error for invalid account ID format', async () => {
      const invalidAccountId = 'invalid-id';

      await expect(authService.getTwoFactorStatus(invalidAccountId)).rejects.toThrow('Invalid accountId format');
    });

    it('should throw error for invalid email format', async () => {
      const invalidData = {
        email: 'invalid-email',
        callbackUrl: 'http://localhost:3000/callback',
      };

      await expect(authService.requestEmailVerification(invalidData)).rejects.toThrow('Invalid email format');
    });

    it('should throw error for invalid URL format', async () => {
      const invalidData = {
        email: 'john@example.com',
        callbackUrl: 'invalid-url',
      };

      await expect(authService.requestEmailVerification(invalidData)).rejects.toThrow('Invalid URL format');
    });

    it('should throw error for invalid OAuth provider', async () => {
      const invalidProvider = 'invalid-provider' as any;
      const requestData = { callbackUrl: 'http://localhost:3000/callback' };

      await expect(authService.generateOAuthSignupUrl(invalidProvider, requestData)).rejects.toThrow(
        'Invalid OAuth provider',
      );
    });

    it('should throw error for weak password', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const weakPasswordData = {
        oldPassword: 'old123',
        newPassword: '123', // Too short
        confirmPassword: '123',
      };

      await expect(authService.changePassword(accountId, weakPasswordData)).rejects.toThrow('Password too short');
    });

    it('should throw error for empty required fields', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const emptyData = {
        oldPassword: '',
        newPassword: 'newPassword123',
        confirmPassword: 'newPassword123',
      };

      await expect(authService.changePassword(accountId, emptyData)).rejects.toThrow('password cannot be empty');
    });
  });
});
