import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import * as TokenMockController from '../__mock__/Token.controller.mock';
import { AccountType } from '../../account/Account.types';
import * as tokenJwt from '../Token.jwt';
import * as sessionUtils from '../../session/session.utils';
import jwt from 'jsonwebtoken';

// Mock dependencies
vi.mock('../Token.jwt', () => ({
  createLocalAccessToken: vi.fn(),
  createLocalRefreshToken: vi.fn(),
  createOAuthAccessToken: vi.fn(),
  createOAuthRefreshToken: vi.fn(),
  verifyToken: vi.fn(),
  isTokenExpired: vi.fn(),
  extractAccountId: vi.fn(),
}));

vi.mock('../../session/session.utils', () => ({
  setAccessTokenCookie: vi.fn(),
  setRefreshTokenCookie: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    decode: vi.fn(),
    sign: vi.fn(),
  },
}));

vi.mock('../../../config/env.config', () => ({
  getJwtSecret: vi.fn().mockReturnValue('test-secret'),
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Token Mock Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      cookies: {},
    };
    mockResponse = {
      clearCookie: vi.fn(),
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getMockTokenInfo', () => {
    it('should return status with token cookies information', async () => {
      const mockDecodedToken = {
        type: AccountType.Local,
        sub: '507f1f77bcf86cd799439011',
        isRefreshToken: false,
        iat: 1642248600,
        exp: 1642252200,
      };

      mockRequest.cookies = {
        access_token_507f1f77bcf86cd799439011: 'mock_access_token',
        refresh_token_507f1f77bcf86cd799439011: 'mock_refresh_token',
        unrelated_cookie: 'value',
      };

      vi.mocked(jwt.decode).mockReturnValue(mockDecodedToken);

      await TokenMockController.getMockTokenInfo(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            enabled: true,
            tokenCookies: expect.objectContaining({
              access_token_507f1f77bcf86cd799439011: expect.objectContaining({
                type: AccountType.Local,
                accountId: '507f1f77bcf86cd799439011',
                isRefreshToken: false,
              }),
              refresh_token_507f1f77bcf86cd799439011: expect.objectContaining({
                type: AccountType.Local,
                accountId: '507f1f77bcf86cd799439011',
              }),
            }),
            tokenCount: 2,
          }),
        }),
      );
    });

    it('should handle invalid token format', async () => {
      mockRequest.cookies = {
        access_token_507f1f77bcf86cd799439011: 'invalid_token',
      };

      vi.mocked(jwt.decode).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await TokenMockController.getMockTokenInfo(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokenCookies: expect.objectContaining({
              access_token_507f1f77bcf86cd799439011: {
                error: 'Invalid token format',
              },
            }),
          }),
        }),
      );
    });
  });

  describe('createMockAccessToken', () => {
    it('should create local access token', async () => {
      const mockToken = 'mock_local_access_token';
      mockRequest.body = {
        accountId: '507f1f77bcf86cd799439011',
        accountType: AccountType.Local,
        expiresIn: 3600,
        setCookie: false,
      };

      vi.mocked(tokenJwt.createLocalAccessToken).mockReturnValue(mockToken);

      await TokenMockController.createMockAccessToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(tokenJwt.createLocalAccessToken).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 3600);
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: 'Access token created successfully',
            token: mockToken,
            accountId: '507f1f77bcf86cd799439011',
            accountType: AccountType.Local,
            setCookie: false,
            expiresIn: 3600,
          }),
        }),
      );
    });

    it('should create OAuth access token', async () => {
      const mockToken = 'mock_oauth_access_token';
      mockRequest.body = {
        accountId: '507f1f77bcf86cd799439011',
        accountType: AccountType.OAuth,
        oauthAccessToken: 'google_access_token',
        expiresIn: 3600,
        setCookie: true,
      };

      vi.mocked(tokenJwt.createOAuthAccessToken).mockReturnValue(mockToken);

      await TokenMockController.createMockAccessToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(tokenJwt.createOAuthAccessToken).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        'google_access_token',
        3600,
      );
      expect(sessionUtils.setAccessTokenCookie).toHaveBeenCalledWith(
        mockRequest,
        mockResponse,
        '507f1f77bcf86cd799439011',
        mockToken,
        3600000,
      );
    });

    it('should throw error when accountId is missing', async () => {
      mockRequest.body = { accountType: AccountType.Local };

      await expect(
        TokenMockController.createMockRefreshToken(mockRequest as Request, mockResponse as Response, mockNext),
      ).rejects.toThrow('oauthRefreshToken is required for OAuth accounts');
    });
  });

  describe('validateMockToken', () => {
    it('should validate valid token', async () => {
      const mockTokenInfo = {
        accountId: '507f1f77bcf86cd799439011',
        accountType: AccountType.Local,
        isRefreshToken: false,
      };

      mockRequest.body = { token: 'valid_token' };
      vi.mocked(tokenJwt.verifyToken).mockReturnValue(mockTokenInfo);
      vi.mocked(tokenJwt.isTokenExpired).mockReturnValue(false);

      await TokenMockController.validateMockToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            valid: true,
            expired: false,
            tokenInfo: mockTokenInfo,
            message: 'Token is valid',
          }),
        }),
      );
    });

    it('should handle expired token', async () => {
      const mockTokenInfo = {
        accountId: '507f1f77bcf86cd799439011',
        accountType: AccountType.Local,
        isRefreshToken: false,
      };

      mockRequest.body = { token: 'expired_token' };
      vi.mocked(tokenJwt.verifyToken).mockReturnValue(mockTokenInfo);
      vi.mocked(tokenJwt.isTokenExpired).mockReturnValue(true);

      await TokenMockController.validateMockToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            valid: false,
            expired: true,
            message: 'Token is expired',
          }),
        }),
      );
    });

    it('should handle invalid token', async () => {
      mockRequest.body = { token: 'invalid_token' };
      vi.mocked(tokenJwt.verifyToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await TokenMockController.validateMockToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            valid: false,
            expired: true,
            error: 'Invalid token',
            message: 'Token is invalid',
          }),
        }),
      );
    });

    it('should throw error when token is missing', async () => {
      mockRequest.body = {};

      await expect(
        TokenMockController.validateMockToken(mockRequest as Request, mockResponse as Response, mockNext),
      ).rejects.toThrow('Token is required');
    });
  });

  describe('createMockTokenPair', () => {
    it('should create local token pair', async () => {
      const mockAccessToken = 'mock_access_token';
      const mockRefreshToken = 'mock_refresh_token';

      mockRequest.body = {
        accountId: '507f1f77bcf86cd799439011',
        accountType: AccountType.Local,
        accessTokenExpiresIn: 3600,
        setCookies: true,
      };

      vi.mocked(tokenJwt.createLocalAccessToken).mockReturnValue(mockAccessToken);
      vi.mocked(tokenJwt.createLocalRefreshToken).mockReturnValue(mockRefreshToken);

      await TokenMockController.createMockTokenPair(mockRequest as Request, mockResponse as Response, mockNext);

      expect(tokenJwt.createLocalAccessToken).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 3600);
      expect(tokenJwt.createLocalRefreshToken).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(sessionUtils.setAccessTokenCookie).toHaveBeenCalledWith(
        mockRequest,
        mockResponse,
        '507f1f77bcf86cd799439011',
        mockAccessToken,
        3600000,
      );
      expect(sessionUtils.setRefreshTokenCookie).toHaveBeenCalledWith(
        mockRequest,
        mockResponse,
        '507f1f77bcf86cd799439011',
        mockRefreshToken,
      );
    });

    it('should create OAuth token pair', async () => {
      const mockAccessToken = 'mock_oauth_access_token';
      const mockRefreshToken = 'mock_oauth_refresh_token';

      mockRequest.body = {
        accountId: '507f1f77bcf86cd799439011',
        accountType: AccountType.OAuth,
        oauthAccessToken: 'google_access_token',
        oauthRefreshToken: 'google_refresh_token',
        setCookies: false,
      };

      vi.mocked(tokenJwt.createOAuthAccessToken).mockReturnValue(mockAccessToken);
      vi.mocked(tokenJwt.createOAuthRefreshToken).mockReturnValue(mockRefreshToken);

      await TokenMockController.createMockTokenPair(mockRequest as Request, mockResponse as Response, mockNext);

      expect(tokenJwt.createOAuthAccessToken).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        'google_access_token',
        undefined,
      );
      expect(tokenJwt.createOAuthRefreshToken).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'google_refresh_token');
      expect(sessionUtils.setAccessTokenCookie).not.toHaveBeenCalled();
      expect(sessionUtils.setRefreshTokenCookie).not.toHaveBeenCalled();
    });

    it('should throw error when OAuth tokens are missing', async () => {
      mockRequest.body = {
        accountId: '507f1f77bcf86cd799439011',
        accountType: AccountType.OAuth,
      };

      await expect(
        TokenMockController.createMockTokenPair(mockRequest as Request, mockResponse as Response, mockNext),
      ).rejects.toThrow('oauthAccessToken and oauthRefreshToken are required for OAuth accounts');
    });
  });

  describe('createExpiredMockToken', () => {
    it('should create expired access token', async () => {
      const mockToken = 'expired_access_token';
      mockRequest.body = {
        accountId: '507f1f77bcf86cd799439011',
        accountType: AccountType.Local,
        tokenType: 'access',
        pastSeconds: 3600,
      };

      vi.mocked(jwt.sign).mockReturnValue(mockToken);

      await TokenMockController.createExpiredMockToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: '507f1f77bcf86cd799439011',
          type: AccountType.Local,
          isRefreshToken: false,
          exp: expect.any(Number),
        }),
        'test-secret',
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: 'Expired token created successfully',
            token: mockToken,
            accountType: AccountType.Local,
            tokenType: 'access',
            expiredSeconds: 3600,
          }),
        }),
      );
    });

    it('should create expired refresh token', async () => {
      mockRequest.body = {
        accountId: '507f1f77bcf86cd799439011',
        accountType: AccountType.Local,
        tokenType: 'refresh',
        pastSeconds: 7200,
      };

      await TokenMockController.createExpiredMockToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          isRefreshToken: true,
        }),
        'test-secret',
      );
    });
  });

  describe('createMalformedMockToken', () => {
    it('should create token with invalid signature', async () => {
      const validToken = 'valid.jwt.token';
      mockRequest.body = { type: 'invalid_signature' };

      vi.mocked(tokenJwt.createLocalAccessToken).mockReturnValue(validToken);

      await TokenMockController.createMalformedMockToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: 'Malformed token created successfully',
            token: expect.stringMatching(/invalidSig$/),
            type: 'invalid_signature',
          }),
        }),
      );
    });

    it('should create malformed structure token', async () => {
      mockRequest.body = { type: 'malformed_structure' };

      await TokenMockController.createMalformedMockToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            token: 'not.a.valid.jwt.structure.at.all',
            type: 'malformed_structure',
          }),
        }),
      );
    });

    it('should create token with missing parts', async () => {
      mockRequest.body = { type: 'missing_parts' };

      await TokenMockController.createMalformedMockToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            token: 'onlyonepart',
            type: 'missing_parts',
          }),
        }),
      );
    });

    it('should throw error for invalid malformation type', async () => {
      mockRequest.body = { type: 'invalid_type' };

      await expect(
        TokenMockController.createMalformedMockToken(mockRequest as Request, mockResponse as Response, mockNext),
      ).rejects.toThrow('Invalid malformation type');
    });
  });

  describe('clearMockTokens', () => {
    it('should clear tokens for account', async () => {
      mockRequest.params = { accountId: '507f1f77bcf86cd799439011' };

      await TokenMockController.clearMockTokens(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token_507f1f77bcf86cd799439011');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token_507f1f77bcf86cd799439011');

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: 'Tokens cleared successfully',
            accountId: '507f1f77bcf86cd799439011',
            cleared: ['access_token', 'refresh_token'],
          }),
        }),
      );
    });

    it('should throw error when accountId is missing', async () => {
      mockRequest.params = {};

      await expect(
        TokenMockController.clearMockTokens(mockRequest as Request, mockResponse as Response, mockNext),
      ).rejects.toThrow('accountId is required');
    });
  });

  describe('getMockTokenInfo', () => {
    it('should return token information for account', async () => {
      const mockAccessTokenInfo = {
        accountId: '507f1f77bcf86cd799439011',
        accountType: AccountType.Local,
        isRefreshToken: false,
      };

      const mockRefreshTokenInfo = {
        accountId: '507f1f77bcf86cd799439011',
        accountType: AccountType.Local,
        isRefreshToken: true,
      };

      mockRequest.params = { accountId: '507f1f77bcf86cd799439011' };
      mockRequest.cookies = {
        access_token_507f1f77bcf86cd799439011: 'access_token',
        refresh_token_507f1f77bcf86cd799439011: 'refresh_token',
      };

      vi.mocked(tokenJwt.verifyToken)
        .mockReturnValueOnce(mockAccessTokenInfo)
        .mockReturnValueOnce(mockRefreshTokenInfo);

      vi.mocked(tokenJwt.isTokenExpired).mockReturnValue(false);

      await TokenMockController.getMockTokenInfo(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountId: '507f1f77bcf86cd799439011',
            accessToken: expect.objectContaining({
              present: true,
              valid: true,
              expired: false,
              info: mockAccessTokenInfo,
            }),
            refreshToken: expect.objectContaining({
              present: true,
              valid: true,
              expired: false,
              info: mockRefreshTokenInfo,
            }),
          }),
        }),
      );
    });

    it('should handle missing tokens', async () => {
      mockRequest.params = { accountId: '507f1f77bcf86cd799439011' };
      mockRequest.cookies = {};

      await TokenMockController.getMockTokenInfo(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accessToken: { present: false },
            refreshToken: { present: false },
          }),
        }),
      );
    });

    it('should handle invalid tokens', async () => {
      mockRequest.params = { accountId: '507f1f77bcf86cd799439011' };
      mockRequest.cookies = {
        access_token_507f1f77bcf86cd799439011: 'invalid_token',
      };

      vi.mocked(tokenJwt.verifyToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await TokenMockController.getMockTokenInfo(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accessToken: expect.objectContaining({
              present: true,
              valid: false,
              error: 'Invalid token',
            }),
          }),
        }),
      );
    });
  });
});
