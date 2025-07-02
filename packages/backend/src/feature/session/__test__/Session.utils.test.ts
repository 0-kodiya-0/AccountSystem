import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import {
  createAccountSessionToken,
  verifyAccountSessionToken,
  setAccountSessionCookie,
  getAccountSessionFromCookies,
  addAccountToSession,
  removeAccountFromSession,
  setCurrentAccountInSession,
  clearAccountSession,
  extractAccountSessionToken,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  setupCompleteAccountSession,
  extractAccessToken,
  extractRefreshToken,
  clearAllSessions,
  clearSession,
  clearAccountWithSession,
  clearAllAccountsWithSession,
} from '../session.utils';
import { AccountSessionData } from '../session.types';

// Mock config
vi.mock('../../../config/env.config', () => ({
  getJwtSecret: () => 'test-jwt-secret',
  getNodeEnv: () => 'test',
}));

vi.mock('../../utils/redirect', () => ({
  getStrippedPathPrefix: vi.fn().mockReturnValue('/api'),
}));

describe('Session Utils', () => {
  const mockAccountId = '507f1f77bcf86cd799439011';
  const mockAccountId2 = '507f1f77bcf86cd799439012';
  const mockAccessToken = 'access_token_123';
  const mockRefreshToken = 'refresh_token_123';

  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let cookies: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    cookies = {};

    mockRequest = {
      cookies,
      headers: {},
      get: vi.fn(),
    };

    mockResponse = {
      cookie: vi.fn((name: string, value: string) => {
        cookies[name] = value;
      }),
      clearCookie: vi.fn((name: string) => {
        delete cookies[name];
      }),
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Account Session Token Management', () => {
    const sessionData: AccountSessionData = {
      accountIds: [mockAccountId, mockAccountId2],
      currentAccountId: mockAccountId,
    };

    describe('createAccountSessionToken and verifyAccountSessionToken', () => {
      it('should create and verify valid session token', () => {
        const token = createAccountSessionToken(sessionData);

        expect(token).toBeDefined();
        expect(typeof token).toBe('string');

        const decoded = verifyAccountSessionToken(token);
        expect(decoded).toEqual({
          accountIds: [mockAccountId, mockAccountId2],
          currentAccountId: mockAccountId,
        });
      });

      it('should include issued at time in token', () => {
        const beforeTime = Math.floor(Date.now() / 1000);
        const token = createAccountSessionToken(sessionData);
        const afterTime = Math.floor(Date.now() / 1000);

        // Decode manually to check iat
        const decoded = verifyAccountSessionToken(token);
        expect(decoded).toBeDefined();

        // Token should have been created between beforeTime and afterTime
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        expect(payload.iat).toBeGreaterThanOrEqual(beforeTime);
        expect(payload.iat).toBeLessThanOrEqual(afterTime);
      });

      it('should handle empty account IDs', () => {
        const emptySessionData: AccountSessionData = {
          accountIds: [],
          currentAccountId: null,
        };

        const token = createAccountSessionToken(emptySessionData);
        const decoded = verifyAccountSessionToken(token);

        expect(decoded).toEqual({
          accountIds: [],
          currentAccountId: null,
        });
      });

      it('should return null for invalid token', () => {
        const result = verifyAccountSessionToken('invalid.token.here');
        expect(result).toBeNull();
      });

      it('should return null for malformed token', () => {
        const result = verifyAccountSessionToken('not-a-jwt');
        expect(result).toBeNull();
      });

      it('should return null for empty token', () => {
        const result = verifyAccountSessionToken('');
        expect(result).toBeNull();
      });
    });

    describe('setAccountSessionCookie', () => {
      it('should set account session cookie with correct properties', () => {
        setAccountSessionCookie(mockRequest as Request, mockResponse as Response, sessionData);

        expect(mockResponse.cookie).toHaveBeenCalledWith(
          'account_session',
          expect.any(String),
          expect.objectContaining({
            httpOnly: true,
            secure: false, // test environment
            path: '/',
            maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
            sameSite: 'lax',
          }),
        );

        // Verify the token can be decoded
        const cookieCall = vi.mocked(mockResponse.cookie).mock.calls[0];
        const token = cookieCall[1] as string;
        const decoded = verifyAccountSessionToken(token);
        expect(decoded).toEqual(sessionData);
      });

      it('should set secure cookie in production', () => {
        vi.doMock('../../../config/env.config', () => ({
          getJwtSecret: () => 'test-jwt-secret',
          getNodeEnv: () => 'production',
        }));

        setAccountSessionCookie(mockRequest as Request, mockResponse as Response, sessionData);

        expect(mockResponse.cookie).toHaveBeenCalledWith(
          'account_session',
          expect.any(String),
          expect.objectContaining({
            secure: true,
          }),
        );
      });
    });

    describe('getAccountSessionFromCookies', () => {
      it('should return session info when valid cookie exists', () => {
        const token = createAccountSessionToken(sessionData);
        mockRequest.cookies = { account_session: token };

        const result = getAccountSessionFromCookies(mockRequest as Request);

        expect(result).toEqual({
          hasSession: true,
          accountIds: [mockAccountId, mockAccountId2],
          currentAccountId: mockAccountId,
          isValid: true,
        });
      });

      it('should return no session when cookie does not exist', () => {
        const result = getAccountSessionFromCookies(mockRequest as Request);

        expect(result).toEqual({
          hasSession: false,
          accountIds: [],
          currentAccountId: null,
          isValid: false,
        });
      });

      it('should return invalid session when token is malformed', () => {
        mockRequest.cookies = { account_session: 'invalid-token' };

        const result = getAccountSessionFromCookies(mockRequest as Request);

        expect(result).toEqual({
          hasSession: true,
          accountIds: [],
          currentAccountId: null,
          isValid: false,
        });
      });
    });

    describe('extractAccountSessionToken', () => {
      it('should extract token from cookies', () => {
        const token = 'test_token_123';
        mockRequest.cookies = { account_session: token };

        const result = extractAccountSessionToken(mockRequest as Request);
        expect(result).toBe(token);
      });

      it('should return null when no token exists', () => {
        const result = extractAccountSessionToken(mockRequest as Request);
        expect(result).toBeNull();
      });
    });
  });

  describe('Session Management Operations', () => {
    beforeEach(() => {
      // Setup existing session
      const existingSession: AccountSessionData = {
        accountIds: [mockAccountId],
        currentAccountId: mockAccountId,
      };
      const token = createAccountSessionToken(existingSession);
      mockRequest.cookies = { account_session: token };
    });

    describe('addAccountToSession', () => {
      it('should add new account to session and set as current', () => {
        addAccountToSession(mockRequest as Request, mockResponse as Response, mockAccountId2, true);

        expect(mockResponse.cookie).toHaveBeenCalled();

        // Verify the new session data
        const cookieCall = vi.mocked(mockResponse.cookie).mock.calls[0];
        const newToken = cookieCall[1] as string;
        const decoded = verifyAccountSessionToken(newToken);

        expect(decoded).toEqual({
          accountIds: [mockAccountId, mockAccountId2],
          currentAccountId: mockAccountId2,
        });
      });

      it('should add new account without setting as current', () => {
        addAccountToSession(mockRequest as Request, mockResponse as Response, mockAccountId2, false);

        const cookieCall = vi.mocked(mockResponse.cookie).mock.calls[0];
        const newToken = cookieCall[1] as string;
        const decoded = verifyAccountSessionToken(newToken);

        expect(decoded).toEqual({
          accountIds: [mockAccountId, mockAccountId2],
          currentAccountId: mockAccountId, // Should remain the same
        });
      });

      it('should not duplicate existing account', () => {
        addAccountToSession(
          mockRequest as Request,
          mockResponse as Response,
          mockAccountId, // Already exists
          true,
        );

        const cookieCall = vi.mocked(mockResponse.cookie).mock.calls[0];
        const newToken = cookieCall[1] as string;
        const decoded = verifyAccountSessionToken(newToken);

        expect(decoded).toEqual({
          accountIds: [mockAccountId], // Should not duplicate
          currentAccountId: mockAccountId,
        });
      });

      it('should default setAsCurrent to true', () => {
        addAccountToSession(mockRequest as Request, mockResponse as Response, mockAccountId2);

        const cookieCall = vi.mocked(mockResponse.cookie).mock.calls[0];
        const newToken = cookieCall[1] as string;
        const decoded = verifyAccountSessionToken(newToken);

        expect(decoded?.currentAccountId).toBe(mockAccountId2);
      });
    });

    describe('removeAccountFromSession', () => {
      beforeEach(() => {
        // Setup session with multiple accounts
        const multiAccountSession: AccountSessionData = {
          accountIds: [mockAccountId, mockAccountId2],
          currentAccountId: mockAccountId,
        };
        const token = createAccountSessionToken(multiAccountSession);
        mockRequest.cookies = { account_session: token };
      });

      it('should remove account from session', () => {
        removeAccountFromSession(mockRequest as Request, mockResponse as Response, mockAccountId2);

        const cookieCall = vi.mocked(mockResponse.cookie).mock.calls[0];
        const newToken = cookieCall[1] as string;
        const decoded = verifyAccountSessionToken(newToken);

        expect(decoded).toEqual({
          accountIds: [mockAccountId],
          currentAccountId: mockAccountId,
        });
      });

      it('should switch current account when removing current account', () => {
        removeAccountFromSession(
          mockRequest as Request,
          mockResponse as Response,
          mockAccountId, // Remove current account
        );

        const cookieCall = vi.mocked(mockResponse.cookie).mock.calls[0];
        const newToken = cookieCall[1] as string;
        const decoded = verifyAccountSessionToken(newToken);

        expect(decoded).toEqual({
          accountIds: [mockAccountId2],
          currentAccountId: mockAccountId2, // Should switch to remaining account
        });
      });

      it('should set current account to null when removing last account', () => {
        // Remove all but one account first
        removeAccountFromSession(mockRequest as Request, mockResponse as Response, mockAccountId2);

        // Now remove the last account
        const firstCallToken = vi.mocked(mockResponse.cookie).mock.calls[0][1] as string;
        mockRequest.cookies = { account_session: firstCallToken };

        removeAccountFromSession(mockRequest as Request, mockResponse as Response, mockAccountId);

        const lastCallToken = vi.mocked(mockResponse.cookie).mock.calls[1][1] as string;
        const decoded = verifyAccountSessionToken(lastCallToken);

        expect(decoded).toEqual({
          accountIds: [],
          currentAccountId: null,
        });
      });
    });

    describe('setCurrentAccountInSession', () => {
      beforeEach(() => {
        const multiAccountSession: AccountSessionData = {
          accountIds: [mockAccountId, mockAccountId2],
          currentAccountId: mockAccountId,
        };
        const token = createAccountSessionToken(multiAccountSession);
        mockRequest.cookies = { account_session: token };
      });

      it('should set new current account', () => {
        setCurrentAccountInSession(mockRequest as Request, mockResponse as Response, mockAccountId2);

        const cookieCall = vi.mocked(mockResponse.cookie).mock.calls[0];
        const newToken = cookieCall[1] as string;
        const decoded = verifyAccountSessionToken(newToken);

        expect(decoded).toEqual({
          accountIds: [mockAccountId, mockAccountId2],
          currentAccountId: mockAccountId2,
        });
      });

      it('should set current account to null', () => {
        setCurrentAccountInSession(mockRequest as Request, mockResponse as Response, null);

        const cookieCall = vi.mocked(mockResponse.cookie).mock.calls[0];
        const newToken = cookieCall[1] as string;
        const decoded = verifyAccountSessionToken(newToken);

        expect(decoded).toEqual({
          accountIds: [mockAccountId, mockAccountId2],
          currentAccountId: null,
        });
      });

      it('should throw error when account not in session', () => {
        const nonExistentAccountId = '507f1f77bcf86cd799439099';

        expect(() => {
          setCurrentAccountInSession(mockRequest as Request, mockResponse as Response, nonExistentAccountId);
        }).toThrow(`Account ${nonExistentAccountId} not found in session`);
      });
    });

    describe('clearAccountSession', () => {
      it('should clear entire session when no specific accounts provided', () => {
        clearAccountSession(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.clearCookie).toHaveBeenCalledWith('account_session', { path: '/' });
      });

      it('should remove specific accounts from session', () => {
        const multiAccountSession: AccountSessionData = {
          accountIds: [mockAccountId, mockAccountId2],
          currentAccountId: mockAccountId,
        };
        const token = createAccountSessionToken(multiAccountSession);
        mockRequest.cookies = { account_session: token };

        clearAccountSession(mockRequest as Request, mockResponse as Response, [mockAccountId2]);

        const cookieCall = vi.mocked(mockResponse.cookie).mock.calls[0];
        const newToken = cookieCall[1] as string;
        const decoded = verifyAccountSessionToken(newToken);

        expect(decoded).toEqual({
          accountIds: [mockAccountId],
          currentAccountId: mockAccountId,
        });
      });

      it('should update current account when removing current account', () => {
        const multiAccountSession: AccountSessionData = {
          accountIds: [mockAccountId, mockAccountId2],
          currentAccountId: mockAccountId,
        };
        const token = createAccountSessionToken(multiAccountSession);
        mockRequest.cookies = { account_session: token };

        clearAccountSession(
          mockRequest as Request,
          mockResponse as Response,
          [mockAccountId], // Remove current account
        );

        const cookieCall = vi.mocked(mockResponse.cookie).mock.calls[0];
        const newToken = cookieCall[1] as string;
        const decoded = verifyAccountSessionToken(newToken);

        expect(decoded).toEqual({
          accountIds: [mockAccountId2],
          currentAccountId: mockAccountId2, // Should switch to remaining account
        });
      });
    });
  });

  describe('Auth Token Cookie Management', () => {
    describe('setAccessTokenCookie', () => {
      it('should set access token cookie with correct properties', () => {
        const expiresIn = 3600000; // 1 hour

        setAccessTokenCookie(
          mockRequest as Request,
          mockResponse as Response,
          mockAccountId,
          mockAccessToken,
          expiresIn,
        );

        expect(mockResponse.cookie).toHaveBeenCalledWith(
          `access_token_${mockAccountId}`,
          mockAccessToken,
          expect.objectContaining({
            httpOnly: true,
            secure: false, // test environment
            maxAge: expiresIn,
            path: `/api/${mockAccountId}`,
            sameSite: 'lax',
          }),
        );
      });
    });

    describe('setRefreshTokenCookie', () => {
      it('should set refresh token cookie with correct properties', () => {
        setRefreshTokenCookie(mockRequest as Request, mockResponse as Response, mockAccountId, mockRefreshToken);

        expect(mockResponse.cookie).toHaveBeenCalledWith(
          `refresh_token_${mockAccountId}`,
          mockRefreshToken,
          expect.objectContaining({
            httpOnly: true,
            secure: false, // test environment
            maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
            path: `/api/${mockAccountId}/tokens/refresh`,
            sameSite: 'lax',
          }),
        );
      });
    });

    describe('setupCompleteAccountSession', () => {
      it('should set all cookies and add account to session', () => {
        const expiresIn = 3600000;

        setupCompleteAccountSession(
          mockRequest as Request,
          mockResponse as Response,
          mockAccountId,
          mockAccessToken,
          expiresIn,
          mockRefreshToken,
          true,
        );

        // Should set access token cookie
        expect(mockResponse.cookie).toHaveBeenCalledWith(
          `access_token_${mockAccountId}`,
          mockAccessToken,
          expect.any(Object),
        );

        // Should set refresh token cookie
        expect(mockResponse.cookie).toHaveBeenCalledWith(
          `refresh_token_${mockAccountId}`,
          mockRefreshToken,
          expect.any(Object),
        );

        // Should set account session cookie
        expect(mockResponse.cookie).toHaveBeenCalledWith('account_session', expect.any(String), expect.any(Object));
      });

      it('should work without refresh token', () => {
        const expiresIn = 3600000;

        setupCompleteAccountSession(
          mockRequest as Request,
          mockResponse as Response,
          mockAccountId,
          mockAccessToken,
          expiresIn,
          undefined, // No refresh token
          false,
        );

        // Should set access token cookie
        expect(mockResponse.cookie).toHaveBeenCalledWith(
          `access_token_${mockAccountId}`,
          mockAccessToken,
          expect.any(Object),
        );

        // Should NOT set refresh token cookie
        expect(mockResponse.cookie).not.toHaveBeenCalledWith(
          `refresh_token_${mockAccountId}`,
          expect.any(String),
          expect.any(Object),
        );
      });
    });

    describe('extractAccessToken', () => {
      it('should extract access token from cookies', () => {
        mockRequest.cookies = { [`access_token_${mockAccountId}`]: mockAccessToken };

        const result = extractAccessToken(mockRequest as Request, mockAccountId);
        expect(result).toBe(mockAccessToken);
      });

      it('should extract access token from authorization header', () => {
        mockRequest.headers = { authorization: `Bearer ${mockAccessToken}` };

        const result = extractAccessToken(mockRequest as Request, mockAccountId);
        expect(result).toBe(mockAccessToken);
      });

      it('should prioritize cookie over header', () => {
        const cookieToken = 'cookie_token';
        const headerToken = 'header_token';

        mockRequest.cookies = { [`access_token_${mockAccountId}`]: cookieToken };
        mockRequest.headers = { authorization: `Bearer ${headerToken}` };

        const result = extractAccessToken(mockRequest as Request, mockAccountId);
        expect(result).toBe(cookieToken);
      });

      it('should return null when no token found', () => {
        const result = extractAccessToken(mockRequest as Request, mockAccountId);
        expect(result).toBeNull();
      });

      it('should return null for malformed authorization header', () => {
        mockRequest.headers = { authorization: 'InvalidFormat' };

        const result = extractAccessToken(mockRequest as Request, mockAccountId);
        expect(result).toBeNull();
      });
    });

    describe('extractRefreshToken', () => {
      it('should extract refresh token from cookies', () => {
        mockRequest.cookies = { [`refresh_token_${mockAccountId}`]: mockRefreshToken };

        const result = extractRefreshToken(mockRequest as Request, mockAccountId);
        expect(result).toBe(mockRefreshToken);
      });

      it('should return null when no refresh token found', () => {
        const result = extractRefreshToken(mockRequest as Request, mockAccountId);
        expect(result).toBeNull();
      });
    });

    describe('clearSession and clearAllSessions', () => {
      it('should clear session cookies for single account', () => {
        clearSession(mockRequest as Request, mockResponse as Response, mockAccountId);

        expect(mockResponse.clearCookie).toHaveBeenCalledWith(`access_token_${mockAccountId}`, {
          path: `/api/${mockAccountId}`,
        });
        expect(mockResponse.clearCookie).toHaveBeenCalledWith(`refresh_token_${mockAccountId}`, {
          path: `/api/${mockAccountId}/tokens/refresh`,
        });
      });

      it('should clear session cookies for multiple accounts', () => {
        const accountIds = [mockAccountId, mockAccountId2];

        clearAllSessions(mockRequest as Request, mockResponse as Response, accountIds);

        accountIds.forEach((accountId) => {
          expect(mockResponse.clearCookie).toHaveBeenCalledWith(`access_token_${accountId}`, {
            path: `/api/${accountId}`,
          });
          expect(mockResponse.clearCookie).toHaveBeenCalledWith(`refresh_token_${accountId}`, {
            path: `/api/${accountId}/tokens/refresh`,
          });
        });
      });

      it('should clear account with session integration', () => {
        clearAccountWithSession(mockRequest as Request, mockResponse as Response, mockAccountId);

        // Should clear auth cookies
        expect(mockResponse.clearCookie).toHaveBeenCalledWith(`access_token_${mockAccountId}`, expect.any(Object));
        expect(mockResponse.clearCookie).toHaveBeenCalledWith(`refresh_token_${mockAccountId}`, expect.any(Object));

        // Should update account session cookie (removing the account)
        expect(mockResponse.cookie).toHaveBeenCalledWith('account_session', expect.any(String), expect.any(Object));
      });

      it('should clear all accounts with session integration', () => {
        const accountIds = [mockAccountId, mockAccountId2];

        clearAllAccountsWithSession(mockRequest as Request, mockResponse as Response, accountIds);

        // Should clear all auth cookies
        accountIds.forEach((accountId) => {
          expect(mockResponse.clearCookie).toHaveBeenCalledWith(`access_token_${accountId}`, expect.any(Object));
          expect(mockResponse.clearCookie).toHaveBeenCalledWith(`refresh_token_${accountId}`, expect.any(Object));
        });

        // Should update account session cookie
        expect(mockResponse.cookie).toHaveBeenCalledWith('account_session', expect.any(String), expect.any(Object));
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing cookies object', () => {
      mockRequest.cookies = undefined;

      const result = getAccountSessionFromCookies(mockRequest as Request);
      expect(result.hasSession).toBe(false);
    });

    it('should handle empty session data', () => {
      const emptySession: AccountSessionData = {
        accountIds: [],
        currentAccountId: null,
      };

      const token = createAccountSessionToken(emptySession);
      const decoded = verifyAccountSessionToken(token);

      expect(decoded).toEqual(emptySession);
    });

    it('should handle null currentAccountId', () => {
      const sessionWithNullCurrent: AccountSessionData = {
        accountIds: [mockAccountId],
        currentAccountId: null,
      };

      const token = createAccountSessionToken(sessionWithNullCurrent);
      const decoded = verifyAccountSessionToken(token);

      expect(decoded).toEqual(sessionWithNullCurrent);
    });

    it('should handle large number of account IDs', () => {
      const manyAccountIds = Array.from({ length: 50 }, (_, i) => `account_${i}`);
      const sessionData: AccountSessionData = {
        accountIds: manyAccountIds,
        currentAccountId: manyAccountIds[0],
      };

      const token = createAccountSessionToken(sessionData);
      const decoded = verifyAccountSessionToken(token);

      expect(decoded).toEqual(sessionData);
    });
  });
});
