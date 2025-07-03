import {
  buildGoogleSignupUrl,
  buildGoogleSigninUrl,
  buildGooglePermissionUrl,
  buildGoogleReauthorizeUrl,
  buildGoogleScopeUrls,
  validateScopeNames,
} from '../../google/config';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as OAuthService from '../OAuth.service';
import { OAuthProviders, AccountType } from '../../account/Account.types';
import { AuthType } from '../OAuth.types';
import { BadRequestError, NotFoundError } from '../../../types/response.types';

// Mock all external dependencies
vi.mock('../OAuth.cache', () => ({
  saveOAuthState: vi.fn(),
  savePermissionState: vi.fn(),
}));

vi.mock('../OAuth.validation', () => ({
  validateOAuthState: vi.fn(),
  validatePermissionState: vi.fn(),
  validateUserForAuthType: vi.fn(),
}));

vi.mock('../../account', () => ({
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
}));

vi.mock('../../account/Account.validation', () => ({
  validateAccount: vi.fn(),
}));

vi.mock('../../tokens', () => ({
  createOAuthAccessToken: vi.fn(),
  createOAuthRefreshToken: vi.fn(),
}));

vi.mock('../../google/services/tokenInfo/tokenInfo.services', () => ({
  exchangeGoogleCode: vi.fn(),
  getGoogleTokenInfo: vi.fn(),
  updateAccountScopes: vi.fn(),
  getGoogleAccountScopes: vi.fn(),
  checkForAdditionalGoogleScopes: vi.fn(),
  verifyGoogleTokenOwnership: vi.fn(),
}));

vi.mock('../../twofa/TwoFA.cache', () => ({
  saveTwoFactorTempToken: vi.fn(),
}));

vi.mock('../../session/session.utils', () => ({
  setupCompleteAccountSession: vi.fn(),
}));

vi.mock('../../google/config', () => ({
  buildGoogleSignupUrl: vi.fn(),
  buildGoogleSigninUrl: vi.fn(),
  buildGooglePermissionUrl: vi.fn(),
  buildGoogleReauthorizeUrl: vi.fn(),
  buildGoogleScopeUrls: vi.fn(),
  validateScopeNames: vi.fn(),
}));

vi.mock('../../../config/env.config', () => ({
  getBaseUrl: vi.fn(() => '/api'),
  getProxyUrl: vi.fn(() => 'http://localhost:3000'),
}));

vi.mock('../../../config/db.config', () => ({
  getModels: vi.fn(),
}));

// Import mocked modules
import { saveOAuthState, savePermissionState } from '../OAuth.cache';
import { findUserByEmail, findUserById } from '../../account';
import { validateAccount } from '../../account/Account.validation';
import { createOAuthAccessToken, createOAuthRefreshToken } from '../../tokens';
import {
  getGoogleTokenInfo,
  updateAccountScopes,
  getGoogleAccountScopes,
  checkForAdditionalGoogleScopes,
} from '../../google/services/tokenInfo/tokenInfo.services';
import { saveTwoFactorTempToken } from '../../twofa/TwoFA.cache';
import { getModels } from '../../../config/db.config';

describe('OAuth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('generateSignupUrl', () => {
    it('should generate signup URL with correct parameters', async () => {
      const mockState = 'mock-state-123';
      const mockUrl = 'https://accounts.google.com/oauth/authorize?...';

      vi.mocked(saveOAuthState).mockReturnValue(mockState);
      vi.mocked(buildGoogleSignupUrl).mockReturnValue(mockUrl);

      const result = await OAuthService.generateSignupUrl(OAuthProviders.Google, 'http://callback.com');

      expect(saveOAuthState).toHaveBeenCalledWith(OAuthProviders.Google, AuthType.SIGN_UP, 'http://callback.com');
      expect(buildGoogleSignupUrl).toHaveBeenCalledWith(mockState);
      expect(result).toEqual({
        authorizationUrl: mockUrl,
        state: mockState,
        provider: OAuthProviders.Google,
        authType: 'signup',
        callbackUrl: 'http://callback.com',
      });
    });
  });

  describe('generateSigninUrl', () => {
    it('should generate signin URL with correct parameters', async () => {
      const mockState = 'mock-state-456';
      const mockUrl = 'https://accounts.google.com/oauth/authorize?...';

      vi.mocked(saveOAuthState).mockReturnValue(mockState);
      vi.mocked(buildGoogleSigninUrl).mockReturnValue(mockUrl);

      const result = await OAuthService.generateSigninUrl(OAuthProviders.Google, 'http://callback.com');

      expect(saveOAuthState).toHaveBeenCalledWith(OAuthProviders.Google, AuthType.SIGN_IN, 'http://callback.com');
      expect(buildGoogleSigninUrl).toHaveBeenCalledWith(mockState);
      expect(result).toEqual({
        authorizationUrl: mockUrl,
        state: mockState,
        provider: OAuthProviders.Google,
        authType: 'signin',
        callbackUrl: 'http://callback.com',
      });
    });
  });

  describe('generatePermissionUrl', () => {
    it('should generate permission URL for valid account with array scope names', async () => {
      const mockAccount = {
        userDetails: { email: 'test@example.com' },
      };
      const mockState = 'permission-state';
      const mockUrl = 'https://accounts.google.com/oauth/authorize?...';
      const scopeNamesJson = '["scope1", "scope2"]';

      vi.mocked(findUserById).mockResolvedValue(mockAccount as any);
      vi.mocked(validateScopeNames).mockReturnValue({ valid: true, errors: [] });
      vi.mocked(buildGoogleScopeUrls).mockReturnValue(['https://scope1', 'https://scope2']);
      vi.mocked(savePermissionState).mockReturnValue(mockState);
      vi.mocked(buildGooglePermissionUrl).mockReturnValue(mockUrl);

      const result = await OAuthService.generatePermissionUrl(
        OAuthProviders.Google,
        'account123',
        'http://callback.com',
        scopeNamesJson,
      );

      expect(validateScopeNames).toHaveBeenCalledWith(['scope1', 'scope2']);
      expect(buildGoogleScopeUrls).toHaveBeenCalledWith(['scope1', 'scope2']);
      expect(savePermissionState).toHaveBeenCalledWith(
        OAuthProviders.Google,
        'account123',
        'custom',
        scopeNamesJson,
        'http://callback.com',
      );
      expect(result.scopes).toEqual(['scope1', 'scope2']);
    });

    it('should parse comma-separated scope names when JSON parsing fails', async () => {
      const mockAccount = {
        userDetails: { email: 'test@example.com' },
      };
      const scopeNamesString = 'scope1, scope2, scope3';

      vi.mocked(findUserById).mockResolvedValue(mockAccount as any);
      vi.mocked(validateScopeNames).mockReturnValue({ valid: true, errors: [] });
      vi.mocked(buildGoogleScopeUrls).mockReturnValue(['https://scope1', 'https://scope2', 'https://scope3']);
      vi.mocked(savePermissionState).mockReturnValue('state');
      vi.mocked(buildGooglePermissionUrl).mockReturnValue('url');

      await OAuthService.generatePermissionUrl(
        OAuthProviders.Google,
        'account123',
        'http://callback.com',
        scopeNamesString,
      );

      expect(validateScopeNames).toHaveBeenCalledWith(['scope1', 'scope2', 'scope3']);
    });

    it('should throw error for account without email', async () => {
      const mockAccount = {
        userDetails: { email: null },
      };

      vi.mocked(findUserById).mockResolvedValue(mockAccount as any);

      await expect(
        OAuthService.generatePermissionUrl(OAuthProviders.Google, 'account123', 'http://callback.com', '["scope1"]'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw error for invalid scope names', async () => {
      const mockAccount = {
        userDetails: { email: 'test@example.com' },
      };

      vi.mocked(findUserById).mockResolvedValue(mockAccount as any);
      vi.mocked(validateScopeNames).mockReturnValue({
        valid: false,
        errors: ['Invalid scope format'],
      });

      await expect(
        OAuthService.generatePermissionUrl(
          OAuthProviders.Google,
          'account123',
          'http://callback.com',
          '["invalid-scope"]',
        ),
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw error for empty scope names', async () => {
      const mockAccount = {
        userDetails: { email: 'test@example.com' },
      };

      vi.mocked(findUserById).mockResolvedValue(mockAccount as any);
      vi.mocked(validateScopeNames).mockReturnValue({ valid: true, errors: [] });

      await expect(
        OAuthService.generatePermissionUrl(OAuthProviders.Google, 'account123', 'http://callback.com', '[]'),
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('generateReauthorizeUrl', () => {
    it('should return null authorization URL when no stored scopes', async () => {
      const mockAccount = {
        userDetails: { email: 'test@example.com' },
      };

      vi.mocked(findUserById).mockResolvedValue(mockAccount as any);
      vi.mocked(getGoogleAccountScopes).mockResolvedValue([]);

      const result = await OAuthService.generateReauthorizeUrl(
        OAuthProviders.Google,
        'account123',
        'http://callback.com',
      );

      expect(result).toEqual({
        authorizationUrl: null,
        accountId: 'account123',
        callbackUrl: 'http://callback.com',
      });
    });

    it('should generate reauthorization URL when stored scopes exist', async () => {
      const mockAccount = {
        userDetails: { email: 'test@example.com' },
      };
      const mockScopes = ['scope1', 'scope2'];
      const mockState = 'reauth-state';
      const mockUrl = 'https://reauth.url';

      vi.mocked(findUserById).mockResolvedValue(mockAccount as any);
      vi.mocked(getGoogleAccountScopes).mockResolvedValue(mockScopes);
      vi.mocked(savePermissionState).mockReturnValue(mockState);
      vi.mocked(buildGoogleReauthorizeUrl).mockReturnValue(mockUrl);

      const result = await OAuthService.generateReauthorizeUrl(
        OAuthProviders.Google,
        'account123',
        'http://callback.com',
      );

      expect(savePermissionState).toHaveBeenCalledWith(
        OAuthProviders.Google,
        'account123',
        'reauthorize',
        'all',
        'http://callback.com',
      );
      expect(result.authorizationUrl).toBe(mockUrl);
      expect(result.scopes).toEqual(mockScopes);
    });
  });

  describe('processSignup', () => {
    it('should create new OAuth account successfully', async () => {
      const mockProviderResponse = {
        name: 'Test User',
        email: 'test@example.com',
        imageUrl: 'https://avatar.url',
        tokenDetails: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      };

      const mockAccount = { id: 'account123', _id: { toHexString: () => 'account123' } };
      const mockTokenInfo = { expires_in: 3600 };

      vi.mocked(validateAccount).mockReturnValue(true);
      vi.mocked(getModels).mockResolvedValue({
        accounts: {
          Account: {
            create: vi.fn().mockResolvedValue(mockAccount),
          },
        },
      } as any);
      vi.mocked(updateAccountScopes).mockResolvedValue(undefined);
      vi.mocked(getGoogleTokenInfo).mockResolvedValue(mockTokenInfo as any);
      vi.mocked(createOAuthAccessToken).mockReturnValue('jwt-access-token');
      vi.mocked(createOAuthRefreshToken).mockReturnValue('jwt-refresh-token');

      const result = await OAuthService.processSignup(mockProviderResponse, OAuthProviders.Google);

      expect(result).toEqual({
        accountId: 'account123',
        name: 'Test User',
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        accessTokenInfo: mockTokenInfo,
      });

      expect(updateAccountScopes).toHaveBeenCalledWith('account123', 'access-token');
      expect(createOAuthAccessToken).toHaveBeenCalledWith('account123', 'access-token', 3600);
      expect(createOAuthRefreshToken).toHaveBeenCalledWith('account123', 'refresh-token');
    });

    it('should throw error when account validation fails', async () => {
      const mockProviderResponse = {
        name: 'Test User',
        email: 'test@example.com',
        imageUrl: 'https://avatar.url',
        tokenDetails: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      };

      vi.mocked(validateAccount).mockReturnValue(false);

      await expect(OAuthService.processSignup(mockProviderResponse, OAuthProviders.Google)).rejects.toThrow(
        'Missing required account data',
      );

      expect(validateAccount).toHaveBeenCalled();
    });
  });

  describe('processSignIn', () => {
    it('should handle signin with 2FA enabled', async () => {
      const mockProviderResponse = {
        email: 'test@example.com',
        tokenDetails: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      };

      const mockUser = {
        id: 'user123',
        accountType: AccountType.OAuth,
        userDetails: { email: 'test@example.com' },
      };

      const mockAccount = {
        security: { twoFactorEnabled: true },
      };

      vi.mocked(findUserByEmail).mockResolvedValue(mockUser as any);
      vi.mocked(getModels).mockResolvedValue({
        accounts: {
          Account: {
            findById: vi.fn().mockResolvedValue(mockAccount),
          },
        },
      } as any);
      vi.mocked(saveTwoFactorTempToken).mockReturnValue('temp-token-123');

      const result = await OAuthService.processSignIn(mockProviderResponse);

      expect(result).toEqual({
        requiresTwoFactor: true,
        tempToken: 'temp-token-123',
        accountId: 'user123',
      });

      expect(saveTwoFactorTempToken).toHaveBeenCalledWith('user123', 'test@example.com', AccountType.OAuth, {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        userInfo: mockProviderResponse,
      });
    });

    it('should handle normal signin without 2FA', async () => {
      const mockProviderResponse = {
        email: 'test@example.com',
        tokenDetails: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      };

      const mockUser = {
        id: 'user123',
        accountType: AccountType.OAuth,
        userDetails: { name: 'Test User', email: 'test@example.com' },
      };

      const mockAccount = {
        security: { twoFactorEnabled: false },
      };

      const mockTokenInfo = { expires_in: 3600 };
      const mockScopeCheck = {
        needsAdditionalScopes: false,
        missingScopes: [],
      };

      vi.mocked(findUserByEmail).mockResolvedValue(mockUser as any);
      vi.mocked(getModels).mockResolvedValue({
        accounts: {
          Account: {
            findById: vi.fn().mockResolvedValue(mockAccount),
          },
        },
      } as any);
      vi.mocked(updateAccountScopes).mockResolvedValue(undefined);
      vi.mocked(getGoogleTokenInfo).mockResolvedValue(mockTokenInfo as any);
      vi.mocked(createOAuthAccessToken).mockReturnValue('jwt-access-token');
      vi.mocked(createOAuthRefreshToken).mockReturnValue('jwt-refresh-token');
      vi.mocked(checkForAdditionalGoogleScopes).mockResolvedValue(mockScopeCheck as any);

      const result = await OAuthService.processSignIn(mockProviderResponse);

      expect(result).toEqual({
        accountId: 'user123',
        userName: 'Test User',
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        accessTokenInfo: mockTokenInfo,
        needsAdditionalScopes: false,
        missingScopes: [],
      });
    });

    it('should throw error for non-OAuth account', async () => {
      const mockProviderResponse = {
        email: 'test@example.com',
        tokenDetails: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      };

      const mockUser = {
        id: 'user123',
        accountType: AccountType.Local, // Wrong type
        userDetails: { email: 'test@example.com' },
      };

      vi.mocked(findUserByEmail).mockResolvedValue(mockUser as any);

      await expect(OAuthService.processSignIn(mockProviderResponse)).rejects.toThrow(BadRequestError);
    });
  });

  describe('checkUserExists', () => {
    it('should return true when user exists', async () => {
      vi.mocked(findUserById).mockResolvedValue({ id: 'user123' } as any);

      const result = await OAuthService.checkUserExists('user123');

      expect(result).toBe(true);
      expect(findUserById).toHaveBeenCalledWith('user123');
    });

    it('should return false when user does not exist', async () => {
      vi.mocked(findUserById).mockResolvedValue(null);

      const result = await OAuthService.checkUserExists('user123');

      expect(result).toBe(false);
    });
  });

  describe('getUserAccount', () => {
    it('should return user account', async () => {
      const mockUser = { id: 'user123', name: 'Test User' };
      vi.mocked(findUserById).mockResolvedValue(mockUser as any);

      const result = await OAuthService.getUserAccount('user123');

      expect(result).toBe(mockUser);
      expect(findUserById).toHaveBeenCalledWith('user123');
    });
  });

  describe('getAccountScopes', () => {
    it('should return account scopes', async () => {
      const mockScopes = ['scope1', 'scope2'];
      vi.mocked(getGoogleAccountScopes).mockResolvedValue(mockScopes);

      const result = await OAuthService.getAccountScopes('account123');

      expect(result).toEqual(mockScopes);
      expect(getGoogleAccountScopes).toHaveBeenCalledWith('account123');
    });
  });
});
