import { describe, test, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../AuthService';
import { HttpClient } from '../../client/HttpClient';
import { OAuthProviders } from '../../types';

// Mock HttpClient
const mockHttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  put: vi.fn(),
} as unknown as HttpClient;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Service Initialization', () => {
    test('should initialize with HttpClient', () => {
      expect(() => {
        authService = new AuthService(mockHttpClient);
      }).not.toThrow();

      expect(authService).toBeInstanceOf(AuthService);
    });

    test('should throw error without HttpClient', () => {
      expect(() => {
        // @ts-expect-error - Testing invalid input
        authService = new AuthService(null);
      }).toThrow();

      expect(() => {
        // @ts-expect-error - Testing invalid input
        authService = new AuthService(undefined);
      }).toThrow();
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      authService = new AuthService(mockHttpClient);
    });

    describe('Account ID Validation', () => {
      test('should validate account IDs - valid ObjectId', () => {
        const validAccountId = '507f1f77bcf86cd799439011';

        // Should not throw for valid ObjectId
        expect(() => {
          authService.getTwoFactorStatus(validAccountId);
        }).not.toThrow();
      });

      test('should validate account IDs - invalid format', () => {
        const invalidAccountIds = [
          '', // empty
          '   ', // whitespace
          'invalid-id', // not ObjectId format
          '123', // too short
          '507f1f77bcf86cd799439011x', // too long
          '507f1f77bcf86cd79943901G', // invalid hex character
        ];

        invalidAccountIds.forEach((invalidId) => {
          expect(() => {
            authService.getTwoFactorStatus(invalidId);
          }).toThrow('Invalid accountId format for 2FA status check. Must be a valid ObjectId.');
        });
      });

      test('should validate account IDs - null or undefined', () => {
        expect(() => {
          // @ts-expect-error - Testing invalid input
          authService.getTwoFactorStatus(null);
        }).toThrow('Valid accountId is required for 2FA status check');

        expect(() => {
          // @ts-expect-error - Testing invalid input
          authService.getTwoFactorStatus(undefined);
        }).toThrow('Valid accountId is required for 2FA status check');
      });
    });

    describe('Email Validation', () => {
      test('should validate email formats - valid emails', () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.uk',
          'user+tag@example.org',
          'user123@test-domain.com',
        ];

        validEmails.forEach((email) => {
          expect(() => {
            authService.requestPasswordReset({ email, callbackUrl: 'https://example.com' });
          }).not.toThrow();
        });
      });

      test('should validate email formats - invalid emails', () => {
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

        invalidEmails.forEach((email) => {
          expect(() => {
            authService.requestPasswordReset({ email, callbackUrl: 'https://example.com' });
          }).toThrow();
        });
      });
    });

    describe('URL Validation', () => {
      test('should validate URLs - valid URLs', () => {
        const validUrls = [
          'https://example.com',
          'http://localhost:3000',
          'https://app.example.com/callback',
          'https://example.com/path?param=value',
        ];

        validUrls.forEach((url) => {
          expect(() => {
            authService.requestPasswordReset({ email: 'test@example.com', callbackUrl: url });
          }).not.toThrow();
        });
      });

      test('should validate URLs - invalid URLs', () => {
        const invalidUrls = [
          '', // empty
          '   ', // whitespace
          'not-a-url', // invalid format
          'ftp://example.com', // valid URL but might want to restrict protocols
          'javascript:alert(1)', // potentially dangerous
        ];

        invalidUrls.forEach((url) => {
          expect(() => {
            authService.requestPasswordReset({ email: 'test@example.com', callbackUrl: url });
          }).toThrow();
        });
      });
    });

    describe('Password Validation', () => {
      test('should validate passwords - valid passwords', () => {
        const validPasswords = [
          'password123', // 8+ characters
          'verylongpasswordwithmanychars', // long password
          'P@ssw0rd!', // special characters
        ];

        validPasswords.forEach((password) => {
          expect(() => {
            authService.changePassword('507f1f77bcf86cd799439011', {
              oldPassword: password,
              newPassword: 'newpassword123',
              confirmPassword: 'newpassword123',
            });
          }).not.toThrow();
        });
      });

      test('should validate passwords - invalid passwords', () => {
        const invalidPasswords = [
          '', // empty
          '   ', // whitespace
          '1234567', // too short (< 8 chars)
          'a'.repeat(129), // too long (> 128 chars)
        ];

        invalidPasswords.forEach((password) => {
          expect(() => {
            authService.changePassword('507f1f77bcf86cd799439011', {
              oldPassword: password,
              newPassword: 'newpassword123',
              confirmPassword: 'newpassword123',
            });
          }).toThrow();
        });
      });
    });

    describe('Token Validation', () => {
      test('should validate tokens - valid tokens', () => {
        const validTokens = [
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // JWT-like token
          'abcdef1234567890', // alphanumeric token
          'token-with-dashes_and_underscores.dots', // with allowed symbols
        ];

        validTokens.forEach((token) => {
          expect(() => {
            authService.verifyEmailForSignup(token);
          }).not.toThrow();
        });
      });

      test('should validate tokens - invalid tokens', () => {
        const invalidTokens = [
          '', // empty
          '   ', // whitespace
          'short', // too short (< 10 chars)
          'token with spaces', // spaces not allowed
          'token@with#special!chars', // invalid characters
        ];

        invalidTokens.forEach((token) => {
          expect(() => {
            authService.verifyEmailForSignup(token);
          }).toThrow();
        });
      });
    });

    describe('OAuth Provider Validation', () => {
      test('should validate OAuth providers - valid providers', () => {
        const validProviders = [OAuthProviders.Google, OAuthProviders.Microsoft, OAuthProviders.Facebook];

        validProviders.forEach((provider) => {
          expect(() => {
            authService.generateOAuthSignupUrl(provider, { callbackUrl: 'https://example.com' });
          }).not.toThrow();
        });
      });

      test('should validate OAuth providers - invalid providers', () => {
        const invalidProviders = [
          '', // empty
          'invalid-provider', // not in enum
          'twitter', // not supported
          'github', // not supported
        ];

        invalidProviders.forEach((provider) => {
          expect(() => {
            // @ts-expect-error - Testing invalid input
            authService.generateOAuthSignupUrl(provider, { callbackUrl: 'https://example.com' });
          }).toThrow();
        });
      });

      test('should validate OAuth providers - null or undefined', () => {
        expect(() => {
          // @ts-expect-error - Testing invalid input
          authService.generateOAuthSignupUrl(null, { callbackUrl: 'https://example.com' });
        }).toThrow('Valid OAuth provider is required');

        expect(() => {
          // @ts-expect-error - Testing invalid input
          authService.generateOAuthSignupUrl(undefined, { callbackUrl: 'https://example.com' });
        }).toThrow('Valid OAuth provider is required');
      });
    });

    describe('Array Validation', () => {
      test('should validate arrays - valid arrays', () => {
        const validArrays = [
          ['scope1'], // single item
          ['scope1', 'scope2', 'scope3'], // multiple items
          ['read', 'write', 'admin'], // typical scopes
        ];

        validArrays.forEach((scopes) => {
          expect(() => {
            authService.generatePermissionUrl(OAuthProviders.Google, {
              accountId: '507f1f77bcf86cd799439011',
              scopeNames: scopes,
              callbackUrl: 'https://example.com',
            });
          }).not.toThrow();
        });
      });

      test('should validate arrays - invalid arrays', () => {
        const invalidArrays = [
          [], // empty array
          ['scope1', null, 'scope3'], // contains null
          ['scope1', undefined, 'scope3'], // contains undefined
          ['scope1', '', 'scope3'], // contains empty string
          ['scope1', '   ', 'scope3'], // contains whitespace
        ];

        invalidArrays.forEach((scopes) => {
          expect(() => {
            authService.generatePermissionUrl(OAuthProviders.Google, {
              accountId: '507f1f77bcf86cd799439011',
              scopeNames: scopes,
              callbackUrl: 'https://example.com',
            });
          }).toThrow();
        });
      });

      test('should validate arrays - not an array', () => {
        expect(() => {
          authService.generatePermissionUrl(OAuthProviders.Google, {
            accountId: '507f1f77bcf86cd799439011',
            // @ts-expect-error - Testing invalid input
            scopeNames: 'not-an-array',
            callbackUrl: 'https://example.com',
          });
        }).toThrow('scope names must be an array');
      });
    });

    describe('Required Field Validation', () => {
      test('should validate required fields - missing data', () => {
        expect(() => {
          // @ts-expect-error - Testing invalid input
          authService.localLogin(null);
        }).toThrow('login data is required for local login');

        expect(() => {
          // @ts-expect-error - Testing invalid input
          authService.localLogin(undefined);
        }).toThrow('login data is required for local login');
      });

      test('should validate required fields - empty objects', () => {
        expect(() => {
          authService.localLogin({} as any);
        }).toThrow('Either email or username is required for local login');
      });

      test('should validate required fields - missing password', () => {
        expect(() => {
          authService.localLogin({
            email: 'test@example.com',
            // password missing
          } as any);
        }).toThrow('password is required for local login');
      });
    });

    describe('Conditional Validation', () => {
      test('should validate either email or username for login', () => {
        // Valid with email
        expect(() => {
          authService.localLogin({
            email: 'test@example.com',
            password: 'password123',
          });
        }).not.toThrow();

        // Valid with username
        expect(() => {
          authService.localLogin({
            username: 'testuser',
            password: 'password123',
          });
        }).not.toThrow();

        // Valid with both
        expect(() => {
          authService.localLogin({
            email: 'test@example.com',
            username: 'testuser',
            password: 'password123',
          });
        }).not.toThrow();

        // Invalid with neither
        expect(() => {
          authService.localLogin({
            password: 'password123',
          });
        }).toThrow('Either email or username is required for local login');
      });
    });
  });
});
