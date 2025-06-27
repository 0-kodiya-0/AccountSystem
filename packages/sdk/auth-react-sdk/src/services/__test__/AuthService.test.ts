import { describe, test, expect, vi, beforeEach, Mock } from 'vitest';
import { AuthService } from '../AuthService';
import { HttpClient } from '../../client/HttpClient';
import { OAuthProviders } from '../../types';

// Mock HttpClient
const createMockHttpClient = () => ({
  get: vi.fn() as Mock,
  post: vi.fn() as Mock,
  patch: vi.fn() as Mock,
  delete: vi.fn() as Mock,
  put: vi.fn() as Mock,
});

describe('AuthService', () => {
  let authService: AuthService;
  let mockHttpClient: ReturnType<typeof createMockHttpClient>;

  beforeEach(() => {
    mockHttpClient = createMockHttpClient();
    vi.clearAllMocks();
  });

  describe('Service Initialization', () => {
    test('should initialize with HttpClient', () => {
      expect(() => {
        authService = new AuthService(mockHttpClient as unknown as HttpClient);
      }).not.toThrow();

      expect(authService).toBeInstanceOf(AuthService);
    });

    test('should throw error without HttpClient', () => {
      expect(() => {
        // @ts-expect-error - Testing invalid input
        new AuthService(null);
      }).toThrow();

      expect(() => {
        // @ts-expect-error - Testing invalid input
        new AuthService(undefined);
      }).toThrow();
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      authService = new AuthService(mockHttpClient as unknown as HttpClient);
    });

    describe('Account ID Validation', () => {
      test('should validate account IDs - valid ObjectId', async () => {
        const validAccountId = '507f1f77bcf86cd799439011';

        // Mock successful response
        mockHttpClient.get.mockResolvedValue({ enabled: false });

        // Should not throw for valid ObjectId
        await expect(authService.getTwoFactorStatus(validAccountId)).resolves.toBeDefined();
      });

      test('should validate account IDs - invalid format', async () => {
        const invalidAccountIds = [
          '', // empty
          '   ', // whitespace
          'invalid-id', // not ObjectId format
          '123', // too short
          '507f1f77bcf86cd799439011x', // too long
          '507f1f77bcf86cd79943901G', // invalid hex character
        ];

        for (const invalidId of invalidAccountIds) {
          await expect(async () => {
            await authService.getTwoFactorStatus(invalidId);
          }).rejects.toThrow('Invalid accountId format for 2FA status check. Must be a valid ObjectId.');
        }
      });

      test('should validate account IDs - null or undefined', async () => {
        await expect(async () => {
          await authService.getTwoFactorStatus(null as any);
        }).rejects.toThrow('Valid accountId is required for 2FA status check');

        await expect(async () => {
          await authService.getTwoFactorStatus(undefined as any);
        }).rejects.toThrow('Valid accountId is required for 2FA status check');
      });
    });

    describe('Email Validation', () => {
      test('should validate email formats - valid emails', async () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.uk',
          'user+tag@example.org',
          'user123@test-domain.com',
        ];

        // Mock successful response
        mockHttpClient.post.mockResolvedValue({ message: 'Reset email sent' });

        for (const email of validEmails) {
          await expect(
            authService.requestPasswordReset({
              email,
              callbackUrl: 'https://example.com',
            }),
          ).resolves.toBeDefined();
        }
      });

      test('should validate email formats - invalid emails', async () => {
        const invalidEmails = [
          '', // empty
          '   ', // whitespace
          'invalid-email', // no @ symbol
          '@domain.com', // no local part
          'user@', // no domain
          'user@.com', // invalid domain
          'user name@domain.com', // space in local part
          'user@domain', // no TLD
          'a'.repeat(300) + '@domain.com', // too long
          'ab', // too short
        ];

        for (const email of invalidEmails) {
          await expect(async () => {
            await authService.requestPasswordReset({
              email,
              callbackUrl: 'https://example.com',
            });
          }).rejects.toThrow();
        }
      });
    });

    describe('URL Validation', () => {
      test('should validate URLs - valid URLs', async () => {
        const validUrls = [
          'https://example.com',
          'http://localhost:3000',
          'https://app.example.com/callback',
          'https://example.com/path?param=value',
        ];

        // Mock successful response
        mockHttpClient.post.mockResolvedValue({ message: 'Reset email sent' });

        for (const url of validUrls) {
          await expect(
            authService.requestPasswordReset({
              email: 'test@example.com',
              callbackUrl: url,
            }),
          ).resolves.toBeDefined();
        }
      });

      test('should validate URLs - invalid URLs', async () => {
        const invalidUrls = [
          '', // empty
          '   ', // whitespace
          'not-a-url', // invalid format
          'ftp://example.com', // valid URL but might want to restrict protocols
          'javascript:alert(1)', // potentially dangerous
        ];

        for (const url of invalidUrls) {
          await expect(async () => {
            await authService.requestPasswordReset({
              email: 'test@example.com',
              callbackUrl: url,
            });
          }).rejects.toThrow();
        }
      });
    });

    describe('Password Validation', () => {
      test('should validate passwords - valid passwords', async () => {
        const validPasswords = [
          'password123', // 8+ characters
          'verylongpasswordwithmanychars', // long password
          'P@ssw0rd!', // special characters
        ];

        // Mock successful response
        mockHttpClient.post.mockResolvedValue({ message: 'Password changed' });

        for (const password of validPasswords) {
          await expect(
            authService.changePassword('507f1f77bcf86cd799439011', {
              oldPassword: password,
              newPassword: 'newpassword123',
              confirmPassword: 'newpassword123',
            }),
          ).resolves.toBeDefined();
        }
      });

      test('should validate passwords - invalid passwords', async () => {
        const invalidPasswords = [
          '', // empty
          '   ', // whitespace
          '1234567', // too short (< 8 chars)
          'a'.repeat(129), // too long (> 128 chars)
        ];

        for (const password of invalidPasswords) {
          await expect(async () => {
            await authService.changePassword('507f1f77bcf86cd799439011', {
              oldPassword: password,
              newPassword: 'newpassword123',
              confirmPassword: 'newpassword123',
            });
          }).rejects.toThrow();
        }
      });
    });

    describe('Token Validation', () => {
      test('should validate tokens - valid tokens', async () => {
        const validTokens = [
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // JWT-like token
          'abcdef1234567890', // alphanumeric token
          'token-with-dashes_and_underscores.dots', // with allowed symbols
        ];

        // Mock successful response
        mockHttpClient.post.mockResolvedValue({ message: 'Email verified' });

        for (const token of validTokens) {
          await expect(authService.verifyEmailForSignup(token)).resolves.toBeDefined();
        }
      });

      test('should validate tokens - invalid tokens', async () => {
        const invalidTokens = [
          '', // empty
          '   ', // whitespace
          'short', // too short (< 10 chars)
          'token with spaces', // spaces not allowed
          'token@with#special!chars', // invalid characters
        ];

        for (const token of invalidTokens) {
          await expect(async () => {
            await authService.verifyEmailForSignup(token);
          }).rejects.toThrow();
        }
      });
    });

    describe('OAuth Provider Validation', () => {
      test('should validate OAuth providers - valid providers', async () => {
        const validProviders = [OAuthProviders.Google, OAuthProviders.Microsoft, OAuthProviders.Facebook];

        // Mock successful response
        mockHttpClient.post.mockResolvedValue({ authorizationUrl: 'https://oauth.example.com' });

        for (const provider of validProviders) {
          await expect(
            authService.generateOAuthSignupUrl(provider, {
              callbackUrl: 'https://example.com',
            }),
          ).resolves.toBeDefined();
        }
      });

      test('should validate OAuth providers - invalid providers', async () => {
        const invalidProviders = [
          '', // empty
          'invalid-provider', // not in enum
          'twitter', // not supported
          'github', // not supported
        ];

        for (const provider of invalidProviders) {
          await expect(async () => {
            // @ts-expect-error - Testing invalid input
            await authService.generateOAuthSignupUrl(provider, { callbackUrl: 'https://example.com' });
          }).rejects.toThrow();
        }
      });

      test('should validate OAuth providers - null or undefined', async () => {
        await expect(async () => {
          // @ts-expect-error - Testing invalid input
          await authService.generateOAuthSignupUrl(null, { callbackUrl: 'https://example.com' });
        }).rejects.toThrow('Valid OAuth provider is required');

        await expect(async () => {
          // @ts-expect-error - Testing invalid input
          await authService.generateOAuthSignupUrl(undefined, { callbackUrl: 'https://example.com' });
        }).rejects.toThrow('Valid OAuth provider is required');
      });
    });

    describe('Array Validation', () => {
      test('should validate arrays - valid arrays', async () => {
        const validArrays = [
          ['scope1'], // single item
          ['scope1', 'scope2', 'scope3'], // multiple items
          ['read', 'write', 'admin'], // typical scopes
        ];

        // Mock successful response
        mockHttpClient.post.mockResolvedValue({ authorizationUrl: 'https://oauth.example.com' });

        for (const scopes of validArrays) {
          await expect(
            authService.generatePermissionUrl(OAuthProviders.Google, {
              accountId: '507f1f77bcf86cd799439011',
              scopeNames: scopes,
              callbackUrl: 'https://example.com',
            }),
          ).resolves.toBeDefined();
        }
      });

      test('should validate arrays - invalid arrays', async () => {
        const invalidArrays = [
          [], // empty array
          ['scope1', null, 'scope3'], // contains null
          ['scope1', undefined, 'scope3'], // contains undefined
          ['scope1', '', 'scope3'], // contains empty string
          ['scope1', '   ', 'scope3'], // contains whitespace
        ];

        for (const scopes of invalidArrays) {
          await expect(async () => {
            await authService.generatePermissionUrl(OAuthProviders.Google, {
              accountId: '507f1f77bcf86cd799439011',
              scopeNames: scopes,
              callbackUrl: 'https://example.com',
            } as any);
          }).rejects.toThrow();
        }
      });

      test('should validate arrays - not an array', async () => {
        await expect(async () => {
          await authService.generatePermissionUrl(OAuthProviders.Google, {
            accountId: '507f1f77bcf86cd799439011',
            // @ts-expect-error - Testing invalid input
            scopeNames: 'not-an-array',
            callbackUrl: 'https://example.com',
          });
        }).rejects.toThrow('scope names must be an array');
      });
    });

    describe('Required Field Validation', () => {
      test('should validate required fields - missing data', async () => {
        await expect(async () => {
          // @ts-expect-error - Testing invalid input
          await authService.localLogin(null);
        }).rejects.toThrow('login data is required for local login');

        await expect(async () => {
          // @ts-expect-error - Testing invalid input
          await authService.localLogin(undefined);
        }).rejects.toThrow('login data is required for local login');
      });

      test('should validate required fields - empty objects', async () => {
        await expect(async () => {
          await authService.localLogin({} as any);
        }).rejects.toThrow('Either email or username is required for local login');
      });

      test('should validate required fields - missing password', async () => {
        await expect(async () => {
          await authService.localLogin({
            email: 'test@example.com',
            // password missing
          } as any);
        }).rejects.toThrow('password is required for local login');
      });
    });

    describe('Conditional Validation', () => {
      test('should validate either email or username for login', async () => {
        // Mock successful response
        mockHttpClient.post.mockResolvedValue({ accountId: '123', name: 'John' });

        // Valid with email
        await expect(
          authService.localLogin({
            email: 'test@example.com',
            password: 'password123',
          }),
        ).resolves.toBeDefined();

        // Valid with username
        await expect(
          authService.localLogin({
            username: 'testuser',
            password: 'password123',
          }),
        ).resolves.toBeDefined();

        // Valid with both
        await expect(
          authService.localLogin({
            email: 'test@example.com',
            username: 'testuser',
            password: 'password123',
          }),
        ).resolves.toBeDefined();

        // Invalid with neither
        await expect(async () => {
          await authService.localLogin({
            password: 'password123',
          });
        }).rejects.toThrow('Either email or username is required for local login');
      });
    });
  });
});
