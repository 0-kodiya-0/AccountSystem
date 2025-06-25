import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { getTokenInfo } from '../Token.service';
import { AccountType } from '../../account/Account.types';

// SOLUTION 1: Proper module mocking with type assertion
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../../../config/env.config', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    // Mock only the specific functions you need for testing
    getAppName: () => 'TestApp',
    getSenderEmail: () => 'noreply@testapp.com',
    getSenderName: () => 'TestApp Team',
    getNodeEnv: () => 'test',
    getJwtSecret: () => 'test-jwt-secret',
    getAccessTokenExpiry: () => '1h',
    getRefreshTokenExpiry: () => '7d',
  };
});

// Type the mocked JWT with proper casting
const mockJwt = jwt as any;

describe('Token Service', () => {
  const mockAccountId = '507f1f77bcf86cd799439011';
  const mockOAuthAccessToken = 'ya29.a0AVvZVsoKj1234567890';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset JWT mocks to default behavior
    mockJwt.verify.mockReturnValue({
      sub: mockAccountId,
      type: AccountType.Local,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      isRefreshToken: false,
    });
  });

  describe('getTokenInfo', () => {
    describe('Valid Tokens', () => {
      it('should return valid token info for local access token', () => {
        const mockPayload = {
          sub: mockAccountId,
          type: AccountType.Local,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          isRefreshToken: false,
        };

        mockJwt.verify.mockReturnValue(mockPayload);

        const info = getTokenInfo('valid.access.token', false);

        expect(info.isValid).toBe(true);
        expect(info.isExpired).toBe(false);
        expect(info.type).toBe('local_jwt');
        expect(info.accountId).toBe(mockAccountId);
        expect(info.expiresAt).toBeDefined();
        expect(info.timeRemaining).toBeGreaterThan(0);
        expect(info.error).toBeUndefined();
      });

      it('should return valid token info for local refresh token', () => {
        const mockPayload = {
          sub: mockAccountId,
          type: AccountType.Local,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
          isRefreshToken: true,
        };

        mockJwt.verify.mockReturnValue(mockPayload);

        const info = getTokenInfo('valid.refresh.token', true);

        expect(info.isValid).toBe(true);
        expect(info.isExpired).toBe(false);
        expect(info.type).toBe('local_refresh_jwt');
        expect(info.accountId).toBe(mockAccountId);
        expect(info.timeRemaining).toBeGreaterThan(3600000); // More than 1 hour
      });

      it('should return valid token info for OAuth access token', () => {
        const mockPayload = {
          sub: mockAccountId,
          type: AccountType.OAuth,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          isRefreshToken: false,
          oauthAccessToken: mockOAuthAccessToken,
        };

        mockJwt.verify.mockReturnValue(mockPayload);

        const info = getTokenInfo('valid.oauth.token', false);

        expect(info.isValid).toBe(true);
        expect(info.type).toBe('oauth_jwt');
        expect(info.accountId).toBe(mockAccountId);
      });

      it('should return valid token info for OAuth refresh token', () => {
        const mockPayload = {
          sub: mockAccountId,
          type: AccountType.OAuth,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
          isRefreshToken: true,
          oauthRefreshToken: 'refresh-token-123',
        };

        mockJwt.verify.mockReturnValue(mockPayload);

        const info = getTokenInfo('valid.oauth.refresh', true);

        expect(info.isValid).toBe(true);
        expect(info.type).toBe('oauth_refresh_jwt');
        expect(info.isExpired).toBe(false);
      });

      it('should handle tokens without expiration', () => {
        const mockPayload = {
          sub: mockAccountId,
          type: AccountType.Local,
          iat: Math.floor(Date.now() / 1000),
          // No exp field
          isRefreshToken: false,
        };

        mockJwt.verify.mockReturnValue(mockPayload);

        const info = getTokenInfo('token.without.exp', false);

        expect(info.isValid).toBe(true);
        expect(info.isExpired).toBe(false);
        expect(info.expiresAt).toBeUndefined();
        expect(info.timeRemaining).toBeUndefined();
      });
    });

    describe('Expired Tokens', () => {
      it('should detect expired tokens', () => {
        const mockPayload = {
          sub: mockAccountId,
          type: AccountType.Local,
          iat: Math.floor(Date.now() / 1000) - 7200,
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
          isRefreshToken: false,
        };

        mockJwt.verify.mockReturnValue(mockPayload);

        const info = getTokenInfo('expired.token', false);

        expect(info.isValid).toBe(false);
        expect(info.isExpired).toBe(true);
        expect(info.type).toBe('local_jwt');
        expect(info.timeRemaining).toBe(0);
      });

      it('should handle tokens expiring exactly now', () => {
        const now = Math.floor(Date.now() / 1000);
        const mockPayload = {
          sub: mockAccountId,
          type: AccountType.Local,
          iat: now - 3600,
          exp: now, // Expires right now
          isRefreshToken: false,
        };

        mockJwt.verify.mockReturnValue(mockPayload);

        const info = getTokenInfo('expiring.now.token', false);

        expect(info.isExpired).toBe(true);
        expect(info.timeRemaining).toBe(0);
      });
    });

    describe('Token Type Mismatch', () => {
      it('should detect when refresh token is checked as access token', () => {
        const mockPayload = {
          sub: mockAccountId,
          type: AccountType.Local,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          isRefreshToken: true, // This is a refresh token
        };

        mockJwt.verify.mockReturnValue(mockPayload);

        const info = getTokenInfo('refresh.token', false); // But checking as access token

        expect(info.isValid).toBe(false);
        expect(info.error).toBe('Expected access token');
        expect(info.type).toBe('local_refresh_jwt');
      });

      it('should detect when access token is checked as refresh token', () => {
        const mockPayload = {
          sub: mockAccountId,
          type: AccountType.Local,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          isRefreshToken: false, // This is an access token
        };

        mockJwt.verify.mockReturnValue(mockPayload);

        const info = getTokenInfo('access.token', true); // But checking as refresh token

        expect(info.isValid).toBe(false);
        expect(info.error).toBe('Expected refresh token');
        expect(info.type).toBe('local_jwt');
      });
    });

    describe('Invalid Tokens', () => {
      it('should handle malformed tokens', () => {
        mockJwt.verify.mockImplementation(() => {
          throw new Error('invalid signature');
        });

        const info = getTokenInfo('malformed.token', false);

        expect(info.isValid).toBe(false);
        expect(info.isExpired).toBe(true);
        expect(info.type).toBe('local_jwt'); // Default fallback
        expect(info.error).toBe('invalid signature');
        expect(info.accountId).toBeUndefined();
      });

      it('should handle tokens with invalid signature', () => {
        mockJwt.verify.mockImplementation(() => {
          throw new Error('jwt signature required');
        });

        const info = getTokenInfo('invalid.signature.token', false);

        expect(info.isValid).toBe(false);
        expect(info.error).toBe('jwt signature required');
      });

      it('should handle completely invalid token format', () => {
        mockJwt.verify.mockImplementation(() => {
          throw new Error('jwt malformed');
        });

        const info = getTokenInfo('not-a-token', false);

        expect(info.isValid).toBe(false);
        expect(info.error).toBe('jwt malformed');
      });

      it('should handle empty token', () => {
        mockJwt.verify.mockImplementation(() => {
          throw new Error('jwt must be provided');
        });

        const info = getTokenInfo('', false);

        expect(info.isValid).toBe(false);
        expect(info.error).toBe('jwt must be provided');
      });

      it('should handle null token', () => {
        mockJwt.verify.mockImplementation(() => {
          throw new Error('jwt must be provided');
        });

        const info = getTokenInfo(null as any, false);

        expect(info.isValid).toBe(false);
        expect(info.error).toBe('jwt must be provided');
      });
    });

    describe('Token Type String Generation', () => {
      it('should generate correct type strings for all combinations', () => {
        const testCases = [
          { accountType: AccountType.Local, isRefresh: false, expected: 'local_jwt' },
          { accountType: AccountType.Local, isRefresh: true, expected: 'local_refresh_jwt' },
          { accountType: AccountType.OAuth, isRefresh: false, expected: 'oauth_jwt' },
          { accountType: AccountType.OAuth, isRefresh: true, expected: 'oauth_refresh_jwt' },
        ];

        testCases.forEach(({ accountType, isRefresh, expected }) => {
          const mockPayload = {
            sub: mockAccountId,
            type: accountType,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600,
            isRefreshToken: isRefresh,
          };

          mockJwt.verify.mockReturnValue(mockPayload);

          const info = getTokenInfo('test.token', isRefresh);
          expect(info.type).toBe(expected);
        });
      });
    });

    describe('Time Calculations', () => {
      it('should correctly calculate remaining time', () => {
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = 1800; // 30 minutes
        const mockPayload = {
          sub: mockAccountId,
          type: AccountType.Local,
          iat: now,
          exp: now + expiresIn,
          isRefreshToken: false,
        };

        mockJwt.verify.mockReturnValue(mockPayload);

        const info = getTokenInfo('time.test.token', false);

        expect(info.timeRemaining).toBeGreaterThan(1790000); // ~30 minutes in ms, with some tolerance
        expect(info.timeRemaining).toBeLessThan(1800000);
      });

      it('should handle very short remaining time', () => {
        const now = Math.floor(Date.now() / 1000);
        const mockPayload = {
          sub: mockAccountId,
          type: AccountType.Local,
          iat: now,
          exp: now + 5, // 5 seconds remaining
          isRefreshToken: false,
        };

        mockJwt.verify.mockReturnValue(mockPayload);

        const info = getTokenInfo('short.time.token', false);

        expect(info.timeRemaining).toBeGreaterThan(0);
        expect(info.timeRemaining).toBeLessThan(5000);
        expect(info.isExpired).toBe(false);
      });

      it('should convert expiration timestamp to milliseconds correctly', () => {
        const now = Math.floor(Date.now() / 1000);
        const exp = now + 3600;
        const mockPayload = {
          sub: mockAccountId,
          type: AccountType.Local,
          iat: now,
          exp: exp,
          isRefreshToken: false,
        };

        mockJwt.verify.mockReturnValue(mockPayload);

        const info = getTokenInfo('timestamp.test', false);

        expect(info.expiresAt).toBe(exp * 1000); // Should be in milliseconds
      });
    });

    describe('Error Handling Edge Cases', () => {
      it('should handle non-Error exceptions', () => {
        mockJwt.verify.mockImplementation(() => {
          throw 'string error';
        });

        const info = getTokenInfo('string.error.token', false);

        expect(info.isValid).toBe(false);
        expect(info.error).toBe('Invalid token');
      });

      it('should handle undefined exceptions', () => {
        mockJwt.verify.mockImplementation(() => {
          throw undefined;
        });

        const info = getTokenInfo('undefined.error.token', false);

        expect(info.isValid).toBe(false);
        expect(info.error).toBe('Invalid token');
      });

      it('should handle tokens with missing sub field', () => {
        const mockPayload = {
          // Missing sub field
          type: AccountType.Local,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          isRefreshToken: false,
        };

        mockJwt.verify.mockReturnValue(mockPayload);

        const info = getTokenInfo('missing.sub.token', false);

        expect(info.isValid).toBe(true); // JWT verification passes
        expect(info.accountId).toBeUndefined();
      });

      it('should handle tokens with missing type field', () => {
        const mockPayload = {
          sub: mockAccountId,
          // Missing type field
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          isRefreshToken: false,
        };

        mockJwt.verify.mockReturnValue(mockPayload);

        const info = getTokenInfo('missing.type.token', false);

        expect(info.isValid).toBe(false);
        expect(info.type).toBe(undefined); // Default fallback
      });
    });

    describe('Performance and Edge Cases', () => {
      it('should handle very long tokens', () => {
        const longTokenPart = 'a'.repeat(10000);
        const longToken = `${longTokenPart}.${longTokenPart}.${longTokenPart}`;

        mockJwt.verify.mockReturnValue({
          sub: mockAccountId,
          type: AccountType.Local,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          isRefreshToken: false,
        });

        const info = getTokenInfo(longToken, false);

        expect(info.isValid).toBe(true);
        expect(info.accountId).toBe(mockAccountId);
      });

      it('should handle tokens with special characters', () => {
        const specialToken = 'token.with-special_chars+symbols=.signature';

        mockJwt.verify.mockReturnValue({
          sub: mockAccountId,
          type: AccountType.Local,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          isRefreshToken: false,
        });

        const info = getTokenInfo(specialToken, false);

        expect(info.isValid).toBe(true);
      });

      it('should be deterministic for same input', () => {
        const token = 'consistent.test.token';
        const mockPayload = {
          sub: mockAccountId,
          type: AccountType.Local,
          iat: 1640995200, // Fixed timestamp
          exp: 1640998800, // Fixed expiration
          isRefreshToken: false,
        };

        mockJwt.verify.mockReturnValue(mockPayload);

        const info1 = getTokenInfo(token, false);
        const info2 = getTokenInfo(token, false);

        expect(info1).toEqual(info2);
      });
    });
  });
});
