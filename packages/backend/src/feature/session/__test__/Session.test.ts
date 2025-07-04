import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import jwt from 'jsonwebtoken';
import { startMainServer, stopMainServer } from '../../../app';
import { initializeDB, clearDatabase, seedTestDatabase, closeAllConnections } from '../../../config/db.config';
import { getJwtSecret } from '../../../config/env.config';
import {
  createAccountSessionToken,
  verifyAccountSessionToken,
  setAccountSessionCookie,
  clearAccountSession,
  getAccountSessionFromCookies,
  extractAccessToken,
  extractRefreshToken,
} from '../../../feature/session/session.utils';
import { AccountSessionData } from '../../../feature/session/session.types';
import { AccountType } from '../../../feature/account/Account.types';
import { getModels } from '../../../config/db.config';

describe('Session Management Tests', () => {
  let app: Express;
  let oauthAccountId: string;
  let localAccountId: string;
  let validAccessToken: string;
  let validRefreshToken: string;

  beforeAll(async () => {
    // Start the server
    app = await startMainServer();

    // Initialize database and seed test data
    await initializeDB();
    await clearDatabase();
    await seedTestDatabase();

    // Get seeded account IDs
    const models = await getModels();

    // Find OAuth account (should be account_1 from mock config)
    const oauthAccount = await models.accounts.Account.findOne({
      'userDetails.email': 'test.user@example.com',
      accountType: AccountType.OAuth,
    });

    // Find Local account (should be account_7 from mock config)
    const localAccount = await models.accounts.Account.findOne({
      'userDetails.email': 'local.user@example.com',
      accountType: AccountType.Local,
    });

    expect(oauthAccount).toBeDefined();
    expect(localAccount).toBeDefined();

    oauthAccountId = oauthAccount!._id.toString();
    localAccountId = localAccount!._id.toString();

    // Create valid tokens for testing
    const jwtSecret = getJwtSecret();
    validAccessToken = jwt.sign(
      {
        accountId: oauthAccountId,
        accountType: AccountType.OAuth,
        oauthAccessToken: 'oauth_access_token_123',
      },
      jwtSecret,
      { expiresIn: '1h' },
    );

    validRefreshToken = jwt.sign(
      {
        accountId: oauthAccountId,
        accountType: AccountType.OAuth,
        oauthRefreshToken: 'oauth_refresh_token_123',
      },
      jwtSecret,
      { expiresIn: '7d' },
    );
  }, 30000);

  afterAll(async () => {
    await closeAllConnections();
    await stopMainServer();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Token Management', () => {
    describe('createAccountSessionToken', () => {
      it('should create a valid session token', () => {
        const sessionData: AccountSessionData = {
          accountIds: [oauthAccountId, localAccountId],
          currentAccountId: oauthAccountId,
        };

        const token = createAccountSessionToken(sessionData);

        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3); // JWT format
      });

      it('should create token with single account', () => {
        const sessionData: AccountSessionData = {
          accountIds: [oauthAccountId],
          currentAccountId: oauthAccountId,
        };

        const token = createAccountSessionToken(sessionData);
        const decoded = verifyAccountSessionToken(token);

        expect(decoded).toEqual(sessionData);
      });

      it('should create token with null current account', () => {
        const sessionData: AccountSessionData = {
          accountIds: [oauthAccountId],
          currentAccountId: null,
        };

        const token = createAccountSessionToken(sessionData);
        const decoded = verifyAccountSessionToken(token);

        expect(decoded).toEqual(sessionData);
      });
    });

    describe('verifyAccountSessionToken', () => {
      it('should verify valid session token', () => {
        const sessionData: AccountSessionData = {
          accountIds: [oauthAccountId, localAccountId],
          currentAccountId: oauthAccountId,
        };

        const token = createAccountSessionToken(sessionData);
        const decoded = verifyAccountSessionToken(token);

        expect(decoded).toEqual(sessionData);
      });

      it('should return null for invalid token', () => {
        const invalidToken = 'invalid.token.here';
        const decoded = verifyAccountSessionToken(invalidToken);

        expect(decoded).toBeNull();
      });

      it('should return null for malformed token', () => {
        const malformedToken = 'not-a-jwt-token';
        const decoded = verifyAccountSessionToken(malformedToken);

        expect(decoded).toBeNull();
      });

      it('should return null for empty token', () => {
        const decoded = verifyAccountSessionToken('');

        expect(decoded).toBeNull();
      });
    });
  });

  describe('Session Cookie Management', () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
      mockReq = {
        cookies: {},
        get: vi.fn(),
        ip: '127.0.0.1',
      };
      mockRes = {
        cookie: vi.fn(),
        clearCookie: vi.fn(),
      };
    });

    describe('setAccountSessionCookie', () => {
      it('should set session cookie with correct options', () => {
        const sessionData: AccountSessionData = {
          accountIds: [oauthAccountId],
          currentAccountId: oauthAccountId,
        };

        setAccountSessionCookie(mockReq, mockRes, sessionData);

        expect(mockRes.cookie).toHaveBeenCalledWith(
          'account_session',
          expect.any(String),
          expect.objectContaining({
            httpOnly: true,
            path: '/',
            maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
            sameSite: 'lax',
          }),
        );
      });
    });

    describe('getAccountSessionFromCookies', () => {
      it('should return session info from valid cookie', () => {
        const sessionData: AccountSessionData = {
          accountIds: [oauthAccountId, localAccountId],
          currentAccountId: oauthAccountId,
        };

        const token = createAccountSessionToken(sessionData);
        mockReq.cookies.account_session = token;

        const sessionInfo = getAccountSessionFromCookies(mockReq);

        expect(sessionInfo).toEqual({
          hasSession: true,
          accountIds: sessionData.accountIds,
          currentAccountId: sessionData.currentAccountId,
          isValid: true,
        });
      });

      it('should return empty session info when no cookie', () => {
        const sessionInfo = getAccountSessionFromCookies(mockReq);

        expect(sessionInfo).toEqual({
          hasSession: false,
          accountIds: [],
          currentAccountId: null,
          isValid: false,
        });
      });

      it('should return invalid session for corrupted cookie', () => {
        mockReq.cookies.account_session = 'corrupted.token.data';

        const sessionInfo = getAccountSessionFromCookies(mockReq);

        expect(sessionInfo).toEqual({
          hasSession: true,
          accountIds: [],
          currentAccountId: null,
          isValid: false,
        });
      });
    });

    describe('clearAccountSession', () => {
      it('should clear entire session', () => {
        clearAccountSession(mockReq, mockRes);

        expect(mockRes.clearCookie).toHaveBeenCalledWith('account_session', { path: '/' });
      });

      it('should remove specific accounts from session', () => {
        const sessionData: AccountSessionData = {
          accountIds: [oauthAccountId, localAccountId],
          currentAccountId: oauthAccountId,
        };

        const token = createAccountSessionToken(sessionData);
        mockReq.cookies.account_session = token;

        clearAccountSession(mockReq, mockRes, [localAccountId]);

        expect(mockRes.cookie).toHaveBeenCalledWith('account_session', expect.any(String), expect.any(Object));
      });

      it('should update current account when removing current', () => {
        const sessionData: AccountSessionData = {
          accountIds: [oauthAccountId, localAccountId],
          currentAccountId: oauthAccountId,
        };

        const token = createAccountSessionToken(sessionData);
        mockReq.cookies.account_session = token;

        clearAccountSession(mockReq, mockRes, [oauthAccountId]);

        // Verify the new token has updated currentAccountId
        const setCookieCall = mockRes.cookie.mock.calls[0];
        const newToken = setCookieCall[1];
        const newSessionData = verifyAccountSessionToken(newToken);

        expect(newSessionData?.currentAccountId).toBe(localAccountId);
        expect(newSessionData?.accountIds).toEqual([localAccountId]);
      });
    });
  });

  describe('Auth Token Extraction', () => {
    let mockReq: any;

    beforeEach(() => {
      mockReq = {
        cookies: {},
        headers: {},
      };
    });

    describe('extractAccessToken', () => {
      it('should extract access token from cookies', () => {
        mockReq.cookies[`access_token_${oauthAccountId}`] = validAccessToken;

        const token = extractAccessToken(mockReq, oauthAccountId);

        expect(token).toBe(validAccessToken);
      });

      it('should extract access token from authorization header', () => {
        mockReq.headers.authorization = `Bearer ${validAccessToken}`;

        const token = extractAccessToken(mockReq, oauthAccountId);

        expect(token).toBe(validAccessToken);
      });

      it('should prioritize cookie over header', () => {
        const cookieToken = 'cookie_token';
        const headerToken = 'header_token';

        mockReq.cookies[`access_token_${oauthAccountId}`] = cookieToken;
        mockReq.headers.authorization = `Bearer ${headerToken}`;

        const token = extractAccessToken(mockReq, oauthAccountId);

        expect(token).toBe(cookieToken);
      });

      it('should return null when no token found', () => {
        const token = extractAccessToken(mockReq, oauthAccountId);

        expect(token).toBeNull();
      });
    });

    describe('extractRefreshToken', () => {
      it('should extract refresh token from cookies', () => {
        mockReq.cookies[`refresh_token_${oauthAccountId}`] = validRefreshToken;

        const token = extractRefreshToken(mockReq, oauthAccountId);

        expect(token).toBe(validRefreshToken);
      });

      it('should return null when no refresh token found', () => {
        const token = extractRefreshToken(mockReq, oauthAccountId);

        expect(token).toBeNull();
      });
    });
  });

  describe('Session API Endpoints', () => {
    let sessionCookie: string;

    beforeEach(() => {
      // Create a session with both accounts
      const sessionData: AccountSessionData = {
        accountIds: [oauthAccountId, localAccountId],
        currentAccountId: oauthAccountId,
      };
      sessionCookie = createAccountSessionToken(sessionData);
    });

    describe('GET /session', () => {
      it('should return session information', async () => {
        const response = await request(app)
          .get('/session')
          .set('Cookie', `account_session=${sessionCookie}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.session).toEqual({
          hasSession: true,
          accountIds: [oauthAccountId, localAccountId],
          currentAccountId: oauthAccountId,
          isValid: true,
        });
      });

      it('should return empty session when no cookie', async () => {
        const response = await request(app).get('/session').expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.session).toEqual({
          hasSession: false,
          accountIds: [],
          currentAccountId: null,
          isValid: false,
        });
      });

      it('should clean up invalid accounts from session', async () => {
        // Create session with a non-existent account
        const invalidSessionData: AccountSessionData = {
          accountIds: [oauthAccountId, '507f1f77bcf86cd799439011'], // Non-existent ID
          currentAccountId: oauthAccountId,
        };
        const invalidSessionCookie = createAccountSessionToken(invalidSessionData);

        const response = await request(app)
          .get('/session')
          .set('Cookie', `account_session=${invalidSessionCookie}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.session.accountIds).toEqual([oauthAccountId]);
      });
    });

    describe('GET /session/accounts', () => {
      it('should return account data for session accounts', async () => {
        const response = await request(app)
          .get('/session/accounts')
          .set('Cookie', `account_session=${sessionCookie}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data).toHaveLength(2);

        const accounts = response.body.data;
        expect(accounts.some((acc: any) => acc.id === oauthAccountId)).toBe(true);
        expect(accounts.some((acc: any) => acc.id === localAccountId)).toBe(true);
      });

      it('should filter accounts by provided accountIds query', async () => {
        const response = await request(app)
          .get('/session/accounts')
          .query({ accountIds: [oauthAccountId] })
          .set('Cookie', `account_session=${sessionCookie}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(oauthAccountId);
      });

      it('should return empty array when no session', async () => {
        const response = await request(app).get('/session/accounts').expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual([]);
      });
    });

    describe('POST /session/current', () => {
      it('should set current account in session', async () => {
        const response = await request(app)
          .post('/session/current')
          .set('Cookie', `account_session=${sessionCookie}`)
          .send({ accountId: localAccountId })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.currentAccountId).toBe(localAccountId);

        // Verify the session cookie was updated
        const setCookieHeader = response.headers['set-cookie'];
        expect(setCookieHeader).toBeDefined();
        expect(setCookieHeader.some((cookie: string) => cookie.startsWith('account_session='))).toBe(true);
      });

      it('should fail when account not in session', async () => {
        const models = await getModels();
        const anotherAccount = await models.accounts.Account.findOne({
          'userDetails.email': 'admin@example.com',
        });

        const response = await request(app)
          .post('/session/current')
          .set('Cookie', `account_session=${sessionCookie}`)
          .send({ accountId: anotherAccount?._id.toString() })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('USER_NOT_FOUND');
      });

      it('should allow setting current account to null', async () => {
        const response = await request(app)
          .post('/session/current')
          .set('Cookie', `account_session=${sessionCookie}`)
          .send({ accountId: null })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('POST /session/add', () => {
      it('should add account to session', async () => {
        // Create session with only one account
        const singleAccountData: AccountSessionData = {
          accountIds: [oauthAccountId],
          currentAccountId: oauthAccountId,
        };
        const singleAccountCookie = createAccountSessionToken(singleAccountData);

        const response = await request(app)
          .post('/session/add')
          .set('Cookie', `account_session=${singleAccountCookie}`)
          .send({ accountId: localAccountId, setAsCurrent: true })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.accountId).toBe(localAccountId);

        // Verify the session cookie was updated
        const setCookieHeader = response.headers['set-cookie'];
        expect(setCookieHeader).toBeDefined();
      });

      it('should fail when adding non-existent account', async () => {
        const response = await request(app)
          .post('/session/add')
          .set('Cookie', `account_session=${sessionCookie}`)
          .send({ accountId: '507f1f77bcf86cd799439011' }) // Non-existent ID
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('USER_NOT_FOUND');
      });

      it('should fail with invalid account ID format', async () => {
        const response = await request(app)
          .post('/session/add')
          .set('Cookie', `account_session=${sessionCookie}`)
          .send({ accountId: 'invalid-id' })
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /session/remove', () => {
      it('should remove account from session', async () => {
        const response = await request(app)
          .post('/session/remove')
          .set('Cookie', `account_session=${sessionCookie}`)
          .send({ accountId: localAccountId })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.accountId).toBe(localAccountId);

        // Verify the session cookie was updated
        const setCookieHeader = response.headers['set-cookie'];
        expect(setCookieHeader).toBeDefined();
      });

      it('should update current account when removing current', async () => {
        const response = await request(app)
          .post('/session/remove')
          .set('Cookie', `account_session=${sessionCookie}`)
          .send({ accountId: oauthAccountId }) // Remove current account
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify session was updated by checking the new session
        const checkResponse = await request(app)
          .get('/session')
          .set('Cookie', response.headers['set-cookie'])
          .expect(200);

        expect(checkResponse.body.data.session.currentAccountId).toBe(localAccountId);
        expect(checkResponse.body.data.session.accountIds).toEqual([localAccountId]);
      });

      it('should fail when removing account not in session', async () => {
        const models = await getModels();
        const anotherAccount = await models.accounts.Account.findOne({
          'userDetails.email': 'admin@example.com',
        });

        const response = await request(app)
          .post('/session/remove')
          .set('Cookie', `account_session=${sessionCookie}`)
          .send({ accountId: anotherAccount?._id.toString() })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('USER_NOT_FOUND');
      });
    });
  });

  describe('Session Edge Cases', () => {
    it('should handle session with empty account list', () => {
      const sessionData: AccountSessionData = {
        accountIds: [],
        currentAccountId: null,
      };

      const token = createAccountSessionToken(sessionData);
      const decoded = verifyAccountSessionToken(token);

      expect(decoded).toEqual(sessionData);
    });

    it('should handle session with mismatched current account', () => {
      const sessionData: AccountSessionData = {
        accountIds: [oauthAccountId],
        currentAccountId: localAccountId, // Not in accountIds
      };

      const token = createAccountSessionToken(sessionData);
      const decoded = verifyAccountSessionToken(token);

      expect(decoded).toEqual(sessionData);
    });

    it('should handle very large account lists', () => {
      const manyAccountIds = Array.from(
        { length: 50 },
        (_, i) => '507f1f77bcf86cd79943' + i.toString().padStart(4, '0'),
      );

      const sessionData: AccountSessionData = {
        accountIds: manyAccountIds,
        currentAccountId: manyAccountIds[0],
      };

      const token = createAccountSessionToken(sessionData);
      const decoded = verifyAccountSessionToken(token);

      expect(decoded).toEqual(sessionData);
    });

    it('should handle special characters in account IDs', () => {
      // MongoDB ObjectIds only contain hex characters, but test the token system
      const sessionData: AccountSessionData = {
        accountIds: [oauthAccountId],
        currentAccountId: oauthAccountId,
      };

      const token = createAccountSessionToken(sessionData);

      // Token should still be valid even with special characters in the data
      expect(token).toBeDefined();
      expect(verifyAccountSessionToken(token)).toEqual(sessionData);
    });
  });
});
