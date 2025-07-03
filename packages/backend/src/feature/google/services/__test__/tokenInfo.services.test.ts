import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as GoogleTokenService from '../tokenInfo/tokenInfo.services';
import { OAuthProviders } from '../../../account/Account.types';
import { ProviderValidationError } from '../../../../types/response.types';

// Mock external dependencies
vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn(),
    },
    oauth2: vi.fn(() => ({
      tokeninfo: vi.fn(),
      userinfo: vi.fn(),
    })),
  },
}));

vi.mock('../../../../config/db.config', () => ({
  getModels: vi.fn(),
}));

vi.mock('../../../../config/env.config', () => ({
  getGoogleClientId: vi.fn(() => 'mock-client-id'),
  getGoogleClientSecret: vi.fn(() => 'mock-client-secret'),
  getNodeEnv: vi.fn(() => 'test'),
}));

vi.mock('../../../../config/mock.config', () => ({
  getOAuthMockConfig: vi.fn(() => ({
    enabled: false,
  })),
}));

vi.mock('../../../../utils/validation', () => ({
  ValidationUtils: {
    validateAccessToken: vi.fn(),
    validateRefreshToken: vi.fn(),
    validateObjectIdWithContext: vi.fn(),
  },
}));

vi.mock('../../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../../mocks/oauth/OAuthMockService', () => ({
  oauthMockService: {
    getTokenInfo: vi.fn(),
    getUserInfo: vi.fn(),
    refreshAccessToken: vi.fn(),
    revokeToken: vi.fn(),
    exchangeAuthorizationCode: vi.fn(),
  },
}));

// Import mocked modules
import { google } from 'googleapis';
import { getModels } from '../../../../config/db.config';
import { getNodeEnv } from '../../../../config/env.config';
import { getOAuthMockConfig } from '../../../../config/mock.config';
import { ValidationUtils } from '../../../../utils/validation';
import { logger } from '../../../../utils/logger';
import { oauthMockService } from '../../../../mocks/oauth/OAuthMockService';

describe('Google Token Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getGoogleTokenInfo', () => {
    it('should return token info from Google API when not using mock', async () => {
      const mockTokenInfo = {
        expires_in: 3600,
        scope: 'email profile',
        user_id: 'user123',
      };

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.oauth2).mockReturnValue({
        tokeninfo: vi.fn().mockResolvedValue({ data: mockTokenInfo }),
      } as any);

      const result = await GoogleTokenService.getGoogleTokenInfo('valid-access-token');

      expect(result).toEqual(mockTokenInfo);
      expect(ValidationUtils.validateAccessToken).toHaveBeenCalledWith('valid-access-token', 'getTokenInfo');
    });

    it('should return mock token info when mock is enabled', async () => {
      const mockTokenInfo = {
        expires_in: 3600,
        scope: 'email profile',
        user_id: 'mock-user',
      };

      vi.mocked(getNodeEnv).mockReturnValue('development');
      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: true } as any);
      vi.mocked(oauthMockService.getTokenInfo).mockReturnValue(mockTokenInfo);

      const result = await GoogleTokenService.getGoogleTokenInfo('mock-access-token');

      expect(result).toEqual(mockTokenInfo);
      expect(oauthMockService.getTokenInfo).toHaveBeenCalledWith('mock-access-token', OAuthProviders.Google);
    });

    it('should throw ProviderValidationError when token info fails', async () => {
      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.oauth2).mockReturnValue({
        tokeninfo: vi.fn().mockRejectedValue(new Error('Invalid token')),
      } as any);

      await expect(GoogleTokenService.getGoogleTokenInfo('invalid-token')).rejects.toThrow(ProviderValidationError);

      expect(logger.error).toHaveBeenCalledWith('Error getting token info:', expect.any(Error));
    });

    it('should throw error when mock service returns null', async () => {
      vi.mocked(getNodeEnv).mockReturnValue('development');
      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: true } as any);
      vi.mocked(oauthMockService.getTokenInfo).mockReturnValue(null);

      await expect(GoogleTokenService.getGoogleTokenInfo('invalid-mock-token')).rejects.toThrow(
        ProviderValidationError,
      );
    });
  });

  describe('getGoogleTokenScopes', () => {
    it('should return scopes from token info', async () => {
      const mockTokenInfo = {
        scope: 'email profile https://www.googleapis.com/auth/drive',
      };

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.oauth2).mockReturnValue({
        tokeninfo: vi.fn().mockResolvedValue({ data: mockTokenInfo }),
      } as any);

      const result = await GoogleTokenService.getGoogleTokenScopes('valid-token');

      expect(result).toEqual(['email', 'profile', 'https://www.googleapis.com/auth/drive']);
    });

    it('should return empty array when scope is not present', async () => {
      const mockTokenInfo = {};

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.oauth2).mockReturnValue({
        tokeninfo: vi.fn().mockResolvedValue({ data: mockTokenInfo }),
      } as any);

      const result = await GoogleTokenService.getGoogleTokenScopes('valid-token');

      expect(result).toEqual([]);
    });

    it('should return mock scopes when mock is enabled', async () => {
      const mockTokenInfo = {
        scope: 'email profile',
      };

      vi.mocked(getNodeEnv).mockReturnValue('development');
      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: true } as any);
      vi.mocked(oauthMockService.getTokenInfo).mockReturnValue(mockTokenInfo);

      const result = await GoogleTokenService.getGoogleTokenScopes('mock-token');

      expect(result).toEqual(['email', 'profile']);
    });
  });

  describe('updateAccountScopes', () => {
    it('should create new permissions record when none exists', async () => {
      const mockTokenInfo = {
        scope: 'email profile drive',
      };

      const mockModels = {
        google: {
          GooglePermissions: {
            findOne: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({}),
          },
        },
      };

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.oauth2).mockReturnValue({
        tokeninfo: vi.fn().mockResolvedValue({ data: mockTokenInfo }),
      } as any);
      vi.mocked(getModels).mockResolvedValue(mockModels as any);

      const result = await GoogleTokenService.updateAccountScopes('account123', 'access-token');

      expect(result).toEqual(['email', 'profile', 'drive']);
      expect(mockModels.google.GooglePermissions.create).toHaveBeenCalledWith({
        accountId: 'account123',
        scopes: ['email', 'profile', 'drive'],
        lastUpdated: expect.any(String),
      });
    });

    it('should update existing permissions with new scopes', async () => {
      const mockTokenInfo = {
        scope: 'email profile drive calendar',
      };

      const mockExistingPermissions = {
        scopes: ['email', 'profile'],
        addScopes: vi.fn(),
        save: vi.fn(),
      };

      const mockModels = {
        google: {
          GooglePermissions: {
            findOne: vi.fn().mockResolvedValue(mockExistingPermissions),
          },
        },
      };

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.oauth2).mockReturnValue({
        tokeninfo: vi.fn().mockResolvedValue({ data: mockTokenInfo }),
      } as any);
      vi.mocked(getModels).mockResolvedValue(mockModels as any);

      const result = await GoogleTokenService.updateAccountScopes('account123', 'access-token');

      expect(result).toEqual(['email', 'profile', 'drive', 'calendar']);
      expect(mockExistingPermissions.addScopes).toHaveBeenCalledWith(['drive', 'calendar']);
      expect(mockExistingPermissions.save).toHaveBeenCalled();
    });

    it('should return empty array when no scopes granted', async () => {
      const mockTokenInfo = {};

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.oauth2).mockReturnValue({
        tokeninfo: vi.fn().mockResolvedValue({ data: mockTokenInfo }),
      } as any);

      const result = await GoogleTokenService.updateAccountScopes('account123', 'access-token');

      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.oauth2).mockReturnValue({
        tokeninfo: vi.fn().mockRejectedValue(new Error('DB error')),
      } as any);

      await expect(GoogleTokenService.updateAccountScopes('account123', 'access-token')).rejects.toThrow(
        ProviderValidationError,
      );

      expect(logger.error).toHaveBeenCalledWith('Error updating account scopes:', expect.any(Error));
    });
  });

  describe('getGoogleAccountScopes', () => {
    it('should return scopes from database', async () => {
      const mockPermissions = {
        scopes: ['email', 'profile', 'drive'],
      };

      const mockModels = {
        google: {
          GooglePermissions: {
            findOne: vi.fn().mockResolvedValue(mockPermissions),
          },
        },
      };

      vi.mocked(getModels).mockResolvedValue(mockModels as any);

      const result = await GoogleTokenService.getGoogleAccountScopes('account123');

      expect(result).toEqual(['email', 'profile', 'drive']);
      expect(mockModels.google.GooglePermissions.findOne).toHaveBeenCalledWith({
        accountId: 'account123',
      });
    });

    it('should return empty array when no permissions found', async () => {
      const mockModels = {
        google: {
          GooglePermissions: {
            findOne: vi.fn().mockResolvedValue(null),
          },
        },
      };

      vi.mocked(getModels).mockResolvedValue(mockModels as any);

      const result = await GoogleTokenService.getGoogleAccountScopes('account123');

      expect(result).toEqual([]);
    });

    it('should return empty array on database error', async () => {
      vi.mocked(getModels).mockRejectedValue(new Error('DB error'));

      const result = await GoogleTokenService.getGoogleAccountScopes('account123');

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith('Error getting account scopes:', expect.any(Error));
    });
  });

  describe('refreshGoogleToken', () => {
    it('should refresh token using Google API when not using mock', async () => {
      const mockCredentials = {
        access_token: 'new-access-token',
        refresh_token: 'refresh-token',
        expiry_date: Date.now() + 3600000,
      };

      const mockOAuth2Client = {
        setCredentials: vi.fn(),
        refreshAccessToken: vi.fn().mockResolvedValue({ credentials: mockCredentials }),
      };

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.auth.OAuth2).mockReturnValue(mockOAuth2Client as any);

      const result = await GoogleTokenService.refreshGoogleToken('refresh-token');

      expect(result).toEqual(mockCredentials);
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({ refresh_token: 'refresh-token' });
    });

    it('should refresh token using mock service when mock is enabled', async () => {
      const mockTokens = {
        access_token: 'new-mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
      };

      vi.mocked(getNodeEnv).mockReturnValue('development');
      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: true } as any);
      vi.mocked(oauthMockService.refreshAccessToken).mockReturnValue(mockTokens);

      const result = await GoogleTokenService.refreshGoogleToken('mock-refresh-token');

      expect(result.access_token).toBe('new-mock-access-token');
      expect(result.refresh_token).toBe('mock-refresh-token');
      expect(result.expiry_date).toBeGreaterThan(Date.now());
    });

    it('should throw error when refresh fails', async () => {
      const mockOAuth2Client = {
        setCredentials: vi.fn(),
        refreshAccessToken: vi.fn().mockRejectedValue(new Error('Refresh failed')),
      };

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.auth.OAuth2).mockReturnValue(mockOAuth2Client as any);

      await expect(GoogleTokenService.refreshGoogleToken('invalid-refresh-token')).rejects.toThrow(
        ProviderValidationError,
      );
    });

    it('should throw error when credentials are missing required fields', async () => {
      const mockCredentials = {
        access_token: 'new-access-token',
        // Missing expiry_date
      };

      const mockOAuth2Client = {
        setCredentials: vi.fn(),
        refreshAccessToken: vi.fn().mockResolvedValue({ credentials: mockCredentials }),
      };

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.auth.OAuth2).mockReturnValue(mockOAuth2Client as any);

      await expect(GoogleTokenService.refreshGoogleToken('refresh-token')).rejects.toThrow(ProviderValidationError);
    });
  });

  describe('checkForAdditionalGoogleScopes', () => {
    it('should return missing scopes correctly', async () => {
      const mockTokenInfo = {
        scope: 'email profile',
      };

      const mockStoredScopes = ['email', 'profile', 'https://www.googleapis.com/auth/drive'];

      const mockModels = {
        google: {
          GooglePermissions: {
            findOne: vi.fn().mockResolvedValue({ scopes: mockStoredScopes }),
          },
        },
      };

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.oauth2).mockReturnValue({
        tokeninfo: vi.fn().mockResolvedValue({ data: mockTokenInfo }),
      } as any);
      vi.mocked(getModels).mockResolvedValue(mockModels as any);

      const result = await GoogleTokenService.checkForAdditionalGoogleScopes('account123', 'access-token');

      expect(result.needsAdditionalScopes).toBe(true);
      expect(result.missingScopes).toEqual(['https://www.googleapis.com/auth/drive']);
    });

    it('should return no missing scopes when all are present', async () => {
      const mockTokenInfo = {
        scope: 'email profile https://www.googleapis.com/auth/drive',
      };

      const mockStoredScopes = ['email', 'profile', 'https://www.googleapis.com/auth/drive'];

      const mockModels = {
        google: {
          GooglePermissions: {
            findOne: vi.fn().mockResolvedValue({ scopes: mockStoredScopes }),
          },
        },
      };

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.oauth2).mockReturnValue({
        tokeninfo: vi.fn().mockResolvedValue({ data: mockTokenInfo }),
      } as any);
      vi.mocked(getModels).mockResolvedValue(mockModels as any);

      const result = await GoogleTokenService.checkForAdditionalGoogleScopes('account123', 'access-token');

      expect(result.needsAdditionalScopes).toBe(false);
      expect(result.missingScopes).toEqual([]);
    });

    it('should filter out basic profile and email scopes from missing scopes', async () => {
      const mockTokenInfo = {
        scope: 'openid',
      };

      const mockStoredScopes = [
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ];

      const mockModels = {
        google: {
          GooglePermissions: {
            findOne: vi.fn().mockResolvedValue({ scopes: mockStoredScopes }),
          },
        },
      };

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.oauth2).mockReturnValue({
        tokeninfo: vi.fn().mockResolvedValue({ data: mockTokenInfo }),
      } as any);
      vi.mocked(getModels).mockResolvedValue(mockModels as any);

      const result = await GoogleTokenService.checkForAdditionalGoogleScopes('account123', 'access-token');

      expect(result.needsAdditionalScopes).toBe(false);
      expect(result.missingScopes).toEqual([]);
    });
  });

  describe('verifyGoogleTokenOwnership', () => {
    it('should verify token ownership successfully', async () => {
      const mockAccount = {
        userDetails: { email: 'test@example.com' },
      };

      const mockUserInfo = {
        data: { email: 'test@example.com' },
      };

      const mockOAuth2Client = {
        setCredentials: vi.fn(),
      };

      const mockOauth2 = {
        userinfo: {
          get: vi.fn().mockResolvedValue(mockUserInfo),
        },
      };

      const mockModels = {
        accounts: {
          Account: {
            findOne: vi.fn().mockResolvedValue(mockAccount),
          },
        },
      };

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.auth.OAuth2).mockReturnValue(mockOAuth2Client as any);
      vi.mocked(google.oauth2).mockReturnValue(mockOauth2 as any);
      vi.mocked(getModels).mockResolvedValue(mockModels as any);

      const result = await GoogleTokenService.verifyGoogleTokenOwnership('access-token', 'account123');

      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should fail verification when emails do not match', async () => {
      const mockAccount = {
        userDetails: { email: 'test@example.com' },
      };

      const mockUserInfo = {
        data: { email: 'different@example.com' },
      };

      const mockOAuth2Client = {
        setCredentials: vi.fn(),
      };

      const mockOauth2 = {
        userinfo: {
          get: vi.fn().mockResolvedValue(mockUserInfo),
        },
      };

      const mockModels = {
        accounts: {
          Account: {
            findOne: vi.fn().mockResolvedValue(mockAccount),
          },
        },
      };

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.auth.OAuth2).mockReturnValue(mockOAuth2Client as any);
      vi.mocked(google.oauth2).mockReturnValue(mockOauth2 as any);
      vi.mocked(getModels).mockResolvedValue(mockModels as any);

      const result = await GoogleTokenService.verifyGoogleTokenOwnership('access-token', 'account123');

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('does not match account email');
    });

    it('should fail verification when account not found', async () => {
      const mockModels = {
        accounts: {
          Account: {
            findOne: vi.fn().mockResolvedValue(null),
          },
        },
      };

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(getModels).mockResolvedValue(mockModels as any);

      const result = await GoogleTokenService.verifyGoogleTokenOwnership('access-token', 'account123');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Account not found');
    });

    it('should handle verification errors gracefully', async () => {
      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(getModels).mockRejectedValue(new Error('Database error'));

      const result = await GoogleTokenService.verifyGoogleTokenOwnership('access-token', 'account123');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Error verifying token ownership');
      expect(logger.error).toHaveBeenCalledWith('Error verifying token ownership:', expect.any(Error));
    });

    it('should verify using mock service when mock is enabled', async () => {
      const mockUserInfo = {
        id: 'account123',
        email: 'test@example.com',
      };

      vi.mocked(getNodeEnv).mockReturnValue('development');
      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: true } as any);
      vi.mocked(oauthMockService.getUserInfo).mockReturnValue(mockUserInfo);

      const result = await GoogleTokenService.verifyGoogleTokenOwnership('mock-token', 'account123');

      expect(result.isValid).toBe(true);
      expect(oauthMockService.getUserInfo).toHaveBeenCalledWith('mock-token', OAuthProviders.Google);
    });
  });

  describe('exchangeGoogleCode', () => {
    it('should exchange code for tokens using Google API', async () => {
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expiry_date: Date.now() + 3600000,
      };

      const mockUserInfo = {
        data: {
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://avatar.url',
        },
      };

      const mockOAuth2Client = {
        getToken: vi.fn().mockResolvedValue({ tokens: mockTokens }),
        setCredentials: vi.fn(),
      };

      const mockOauth2 = {
        userinfo: {
          get: vi.fn().mockResolvedValue(mockUserInfo),
        },
      };

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.auth.OAuth2).mockReturnValue(mockOAuth2Client as any);
      vi.mocked(google.oauth2).mockReturnValue(mockOauth2 as any);

      const result = await GoogleTokenService.exchangeGoogleCode('auth-code', 'http://redirect.uri');

      expect(result.tokens.accessToken).toBe('access-token');
      expect(result.tokens.refreshToken).toBe('refresh-token');
      expect(result.userInfo.email).toBe('test@example.com');
      expect(result.userInfo.provider).toBe(OAuthProviders.Google);
    });

    it('should exchange code using mock service when mock is enabled', async () => {
      const mockResult = {
        tokens: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
        },
        userInfo: {
          email: 'mock@example.com',
          name: 'Mock User',
          picture: 'https://mock.avatar',
        },
      };

      vi.mocked(getNodeEnv).mockReturnValue('development');
      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: true } as any);
      vi.mocked(oauthMockService.exchangeAuthorizationCode).mockReturnValue(mockResult);

      const result = await GoogleTokenService.exchangeGoogleCode('mock-code', 'http://redirect.uri');

      expect(result.tokens.accessToken).toBe('mock-access-token');
      expect(result.userInfo.email).toBe('mock@example.com');
      expect(oauthMockService.exchangeAuthorizationCode).toHaveBeenCalledWith('mock-code', OAuthProviders.Google);
    });

    it('should throw error when access token is missing', async () => {
      const mockTokens = {
        // Missing access_token
        refresh_token: 'refresh-token',
      };

      const mockOAuth2Client = {
        getToken: vi.fn().mockResolvedValue({ tokens: mockTokens }),
      };

      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: false } as any);
      vi.mocked(google.auth.OAuth2).mockReturnValue(mockOAuth2Client as any);

      await expect(GoogleTokenService.exchangeGoogleCode('auth-code', 'http://redirect.uri')).rejects.toThrow(
        'Missing access token in Google OAuth response',
      );
    });

    it('should throw error when mock service returns null', async () => {
      vi.mocked(getNodeEnv).mockReturnValue('development');
      vi.mocked(getOAuthMockConfig).mockReturnValue({ enabled: true } as any);
      vi.mocked(oauthMockService.exchangeAuthorizationCode).mockReturnValue(null);

      await expect(GoogleTokenService.exchangeGoogleCode('invalid-code', 'http://redirect.uri')).rejects.toThrow(
        'Invalid or expired authorization code (mock)',
      );
    });
  });
});
