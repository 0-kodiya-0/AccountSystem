import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  createLocalAccessToken,
  createLocalRefreshToken,
  createOAuthAccessToken,
  createOAuthRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyToken,
  validateTokenOwnership,
  extractAccountId,
  isTokenExpired,
} from '../Token.jwt';
import { AccountType } from '../../account/Account.types';
import { AuthError, ApiErrorCode } from '../../../types/response.types';

// Mock the config
vi.mock('../../../config/env.config', () => ({
  getJwtSecret: () => 'test-secret-key',
  getAccessTokenExpiry: () => '1h',
  getRefreshTokenExpiry: () => '7d',
}));

describe('Token JWT Functions', () => {
  const mockAccountId = '507f1f77bcf86cd799439011';
  const mockOAuthAccessToken = 'ya29.a0AVvZVsoKj1234567890';
  const mockOAuthRefreshToken = '1//04567890abcdef';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createLocalAccessToken', () => {
    it('should create valid JWT token', () => {
      const token = createLocalAccessToken(mockAccountId);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include correct payload for local account', () => {
      const token = createLocalAccessToken(mockAccountId);
      const decoded = jwt.decode(token) as any;

      expect(decoded.sub).toBe(mockAccountId);
      expect(decoded.type).toBe(AccountType.Local);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.isRefreshToken).toBeUndefined();
    });

    it('should accept custom expiration time', () => {
      const customExpiry = 7200; // 2 hours
      const token = createLocalAccessToken(mockAccountId, customExpiry);
      const decoded = jwt.decode(token) as any;

      // Should expire approximately 2 hours from now
      const expectedExp = Math.floor(Date.now() / 1000) + customExpiry;
      expect(decoded.exp).toBeCloseTo(expectedExp, -1); // Within 10 seconds
    });

    it('should throw for invalid account ID', () => {
      expect(() => createLocalAccessToken('')).toThrow();
      expect(() => createLocalAccessToken('invalid-id')).toThrow();
    });
  });

  describe('createLocalRefreshToken', () => {
    it('should create valid refresh token', () => {
      const token = createLocalRefreshToken(mockAccountId);
      const decoded = jwt.decode(token) as any;

      expect(decoded.sub).toBe(mockAccountId);
      expect(decoded.type).toBe(AccountType.Local);
      expect(decoded.isRefreshToken).toBe(true);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should have longer expiration than access token', () => {
      const accessToken = createLocalAccessToken(mockAccountId);
      const refreshToken = createLocalRefreshToken(mockAccountId);

      const accessDecoded = jwt.decode(accessToken) as any;
      const refreshDecoded = jwt.decode(refreshToken) as any;

      expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp);
    });
  });

  describe('createOAuthAccessToken', () => {
    it('should create valid OAuth access token', () => {
      const token = createOAuthAccessToken(mockAccountId, mockOAuthAccessToken);
      const decoded = jwt.decode(token) as any;

      expect(decoded.sub).toBe(mockAccountId);
      expect(decoded.type).toBe(AccountType.OAuth);
      expect(decoded.oauthAccessToken).toBe(mockOAuthAccessToken);
      expect(decoded.isRefreshToken).toBeUndefined();
    });

    it('should accept custom expiration', () => {
      const customExpiry = 3600;
      const token = createOAuthAccessToken(mockAccountId, mockOAuthAccessToken, customExpiry);
      const decoded = jwt.decode(token) as any;

      const expectedExp = Math.floor(Date.now() / 1000) + customExpiry;
      expect(decoded.exp).toBeCloseTo(expectedExp, -1);
    });

    it('should throw for missing OAuth token', () => {
      expect(() => createOAuthAccessToken(mockAccountId, '')).toThrow();
    });
  });

  describe('createOAuthRefreshToken', () => {
    it('should create valid OAuth refresh token', () => {
      const token = createOAuthRefreshToken(mockAccountId, mockOAuthRefreshToken);
      const decoded = jwt.decode(token) as any;

      expect(decoded.sub).toBe(mockAccountId);
      expect(decoded.type).toBe(AccountType.OAuth);
      expect(decoded.oauthRefreshToken).toBe(mockOAuthRefreshToken);
      expect(decoded.isRefreshToken).toBe(true);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid local access token', () => {
      const token = createLocalAccessToken(mockAccountId);
      const result = verifyToken(token);

      expect(result.accountId).toBe(mockAccountId);
      expect(result.accountType).toBe(AccountType.Local);
      expect(result.isRefreshToken).toBe(false);
      expect(result.exp).toBeDefined();
    });

    it('should verify valid OAuth access token', () => {
      const token = createOAuthAccessToken(mockAccountId, mockOAuthAccessToken);
      const result = verifyToken(token);

      expect(result.accountId).toBe(mockAccountId);
      expect(result.accountType).toBe(AccountType.OAuth);
      expect(result.oauthAccessToken).toBe(mockOAuthAccessToken);
      expect(result.isRefreshToken).toBe(false);
    });

    it('should verify valid refresh token', () => {
      const token = createLocalRefreshToken(mockAccountId);
      const result = verifyToken(token);

      expect(result.accountId).toBe(mockAccountId);
      expect(result.isRefreshToken).toBe(true);
    });

    it('should throw AuthError for invalid token', () => {
      expect(() => verifyToken('invalid.token.here')).toThrow(AuthError);
      expect(() => verifyToken('invalid.token.here')).toThrow('Invalid token');
    });

    it('should throw AuthError with correct error code', () => {
      try {
        verifyToken('invalid-token');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError<any>).code).toBe(ApiErrorCode.TOKEN_INVALID);
      }
    });

    it('should handle expired tokens', () => {
      // Create token with past expiration
      const expiredToken = jwt.sign(
        { sub: mockAccountId, type: AccountType.Local, exp: Math.floor(Date.now() / 1000) - 3600 },
        'test-secret-key',
      );

      expect(() => verifyToken(expiredToken)).toThrow(AuthError);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const token = createLocalAccessToken(mockAccountId);
      const result = verifyAccessToken(token);

      expect(result.accountId).toBe(mockAccountId);
      expect(result.isRefreshToken).toBe(false);
    });

    it('should reject refresh token', () => {
      const refreshToken = createLocalRefreshToken(mockAccountId);

      expect(() => verifyAccessToken(refreshToken)).toThrow(AuthError);
      expect(() => verifyAccessToken(refreshToken)).toThrow('Expected access token, got refresh token');
    });

    it('should reject invalid token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow(AuthError);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const token = createLocalRefreshToken(mockAccountId);
      const result = verifyRefreshToken(token);

      expect(result.accountId).toBe(mockAccountId);
      expect(result.isRefreshToken).toBe(true);
    });

    it('should reject access token', () => {
      const accessToken = createLocalAccessToken(mockAccountId);

      expect(() => verifyRefreshToken(accessToken)).toThrow(AuthError);
      expect(() => verifyRefreshToken(accessToken)).toThrow('Expected refresh token, got access token');
    });
  });

  describe('validateTokenOwnership', () => {
    it('should return true for matching account', () => {
      const token = createLocalAccessToken(mockAccountId);
      expect(validateTokenOwnership(token, mockAccountId)).toBe(true);
    });

    it('should return false for non-matching account', () => {
      const token = createLocalAccessToken(mockAccountId);
      const differentAccountId = '507f1f77bcf86cd799439022';
      expect(validateTokenOwnership(token, differentAccountId)).toBe(false);
    });

    it('should return false for invalid token', () => {
      expect(validateTokenOwnership('invalid-token', mockAccountId)).toBe(false);
    });

    it('should work with OAuth tokens', () => {
      const token = createOAuthAccessToken(mockAccountId, mockOAuthAccessToken);
      expect(validateTokenOwnership(token, mockAccountId)).toBe(true);
    });
  });

  describe('extractAccountId', () => {
    it('should extract account ID from valid token', () => {
      const token = createLocalAccessToken(mockAccountId);
      expect(extractAccountId(token)).toBe(mockAccountId);
    });

    it('should return null for invalid token', () => {
      expect(extractAccountId('invalid-token')).toBe(null);
    });

    it('should work with refresh tokens', () => {
      const token = createLocalRefreshToken(mockAccountId);
      expect(extractAccountId(token)).toBe(mockAccountId);
    });

    it('should work with OAuth tokens', () => {
      const token = createOAuthAccessToken(mockAccountId, mockOAuthAccessToken);
      expect(extractAccountId(token)).toBe(mockAccountId);
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid non-expired token', () => {
      const token = createLocalAccessToken(mockAccountId);
      expect(isTokenExpired(token)).toBe(false);
    });

    it('should return true for expired token', () => {
      const expiredToken = jwt.sign(
        { sub: mockAccountId, type: AccountType.Local, exp: Math.floor(Date.now() / 1000) - 3600 },
        'test-secret-key',
      );

      expect(isTokenExpired(expiredToken)).toBe(true);
    });

    it('should return true for invalid token', () => {
      expect(isTokenExpired('invalid-token')).toBe(true);
    });

    it('should return false for token without expiration', () => {
      const tokenWithoutExp = jwt.sign({ sub: mockAccountId, type: AccountType.Local }, 'test-secret-key');

      expect(isTokenExpired(tokenWithoutExp)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed JWT tokens', () => {
      expect(() => verifyToken('not.a.jwt')).toThrow(AuthError);
      expect(() => verifyToken('header.payload')).toThrow(AuthError);
      expect(() => verifyToken('')).toThrow(AuthError);
    });

    it('should handle tokens with missing required fields', () => {
      const tokenWithoutSub = jwt.sign({ type: AccountType.Local }, 'test-secret-key');
      expect(() => verifyToken(tokenWithoutSub)).toThrow(AuthError);
    });

    it('should handle tokens with wrong secret', () => {
      const tokenWithWrongSecret = jwt.sign({ sub: mockAccountId, type: AccountType.Local }, 'wrong-secret');

      expect(() => verifyToken(tokenWithWrongSecret)).toThrow(AuthError);
    });

    it('should validate account ID format in token creation', () => {
      expect(() => createLocalAccessToken('invalid-account-id')).toThrow();
      expect(() => createOAuthAccessToken('invalid-account-id', mockOAuthAccessToken)).toThrow();
    });
  });
});
