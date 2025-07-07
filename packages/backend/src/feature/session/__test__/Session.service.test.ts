import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import * as SessionService from '../session.service';
import * as sessionUtils from '../session.utils';
import { AccountType, AccountStatus } from '../../account/Account.types';
import { BadRequestError } from '../../../types/response.types';
import { getModels } from '../../../config/db.config';

// Mock dependencies
vi.mock('../session.utils', () => ({
  getAccountSessionFromCookies: vi.fn(),
  addAccountToSession: vi.fn(),
  removeAccountFromSession: vi.fn(),
  setCurrentAccountInSession: vi.fn(),
  clearAccountSession: vi.fn(),
}));

vi.mock('../../../config/db.config', () => ({
  getModels: vi.fn(),
}));

describe('Session Service', () => {
  const mockAccountId = '507f1f77bcf86cd799439011';
  const mockAccountId2 = '507f1f77bcf86cd799439012';
  const mockAccountId3 = '507f1f77bcf86cd799439013';

  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockAccountModel: any;
  let mockAccount: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      cookies: {},
    };

    mockResponse = {};

    // Create mock account
    mockAccount = {
      _id: { toString: () => mockAccountId },
      accountType: AccountType.Local,
      status: AccountStatus.Active,
      userDetails: {
        name: 'Test User',
        email: 'test@example.com',
        username: 'testuser',
        imageUrl: 'https://example.com/avatar.jpg',
        emailVerified: true,
      },
      provider: undefined,
    };

    // Mock account model with proper query chain
    mockAccountModel = {
      find: vi.fn().mockReturnValue({
        distinct: vi.fn(),
      }),
      findById: vi.fn().mockResolvedValue(mockAccount),
    };

    // Mock database models
    vi.mocked(getModels).mockResolvedValue({
      accounts: {
        Account: mockAccountModel,
      },
    } as any);

    // Default session utils mocks
    vi.mocked(sessionUtils.getAccountSessionFromCookies).mockReturnValue({
      hasSession: true,
      accountIds: [mockAccountId],
      currentAccountId: mockAccountId,
      isValid: true,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getAccountSession', () => {
    it('should return session info when no session exists', async () => {
      const session = {
        hasSession: false,
        accountIds: [],
        currentAccountId: null,
        isValid: false,
      };

      const result = await SessionService.getAccountSession(session);

      expect(result).toEqual({
        hasSession: false,
        accountIds: [],
        currentAccountId: null,
        missingAccountIds: [],
        isValid: false,
      });
    });

    it('should return session info when session is invalid', async () => {
      const session = {
        hasSession: true,
        accountIds: [mockAccountId],
        currentAccountId: mockAccountId,
        isValid: false,
      };

      const result = await SessionService.getAccountSession(session);

      expect(result).toEqual({
        hasSession: false,
        accountIds: [],
        currentAccountId: null,
        missingAccountIds: [],
        isValid: false,
      });
    });

    it('should return valid session when all accounts exist', async () => {
      const accountIds = [mockAccountId, mockAccountId2];
      const session = {
        hasSession: true,
        accountIds,
        currentAccountId: mockAccountId,
        isValid: true,
      };

      // Mock the distinct method to return the account IDs
      mockAccountModel.find.mockReturnValue({
        distinct: vi.fn().mockResolvedValue([mockAccountId, mockAccountId2]),
      });

      const result = await SessionService.getAccountSession(session);

      expect(mockAccountModel.find).toHaveBeenCalledWith({ _id: { $in: accountIds } }, { _id: 1 });
      expect(mockAccountModel.find().distinct).toHaveBeenCalledWith('_id');

      expect(result).toEqual({
        hasSession: true,
        accountIds,
        currentAccountId: mockAccountId,
        missingAccountIds: [],
        isValid: true,
      });
    });

    it('should clean up session when some accounts no longer exist', async () => {
      const accountIds = [mockAccountId, mockAccountId2, mockAccountId3];
      const session = {
        hasSession: true,
        accountIds,
        currentAccountId: mockAccountId2,
        isValid: true,
      };

      // Only return two accounts (one is missing)
      mockAccountModel.find.mockReturnValue({
        distinct: vi.fn().mockResolvedValue([mockAccountId, mockAccountId3]),
      });

      const result = await SessionService.getAccountSession(session);

      expect(result).toEqual({
        hasSession: true,
        accountIds: [mockAccountId, mockAccountId3],
        currentAccountId: mockAccountId, // Should switch to first available
        missingAccountIds: [mockAccountId2],
        isValid: true,
      });
    });

    it('should handle current account being removed', async () => {
      const accountIds = [mockAccountId, mockAccountId2];
      const session = {
        hasSession: true,
        accountIds,
        currentAccountId: mockAccountId2,
        isValid: true,
      };

      // Only return first account (current account is missing)
      mockAccountModel.find.mockReturnValue({
        distinct: vi.fn().mockResolvedValue([mockAccountId]),
      });

      const result = await SessionService.getAccountSession(session);

      expect(result.currentAccountId).toBe(mockAccountId);
    });

    it('should handle database errors gracefully', async () => {
      const session = {
        hasSession: true,
        accountIds: [mockAccountId],
        currentAccountId: mockAccountId,
        isValid: true,
      };

      mockAccountModel.find.mockReturnValue({
        distinct: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const result = await SessionService.getAccountSession(session);

      expect(result).toEqual({
        hasSession: true,
        accountIds: [mockAccountId],
        currentAccountId: mockAccountId,
        missingAccountIds: [],
        isValid: false,
      });
    });
  });

  describe('getSessionAccountsData', () => {
    const mockAccounts = [
      {
        _id: { toString: () => mockAccountId },
        accountType: AccountType.Local,
        status: AccountStatus.Active,
        userDetails: {
          name: 'Test User',
          email: 'test@example.com',
          username: 'testuser',
          imageUrl: 'https://example.com/avatar.jpg',
        },
      },
      {
        _id: { toString: () => mockAccountId2 },
        accountType: AccountType.OAuth,
        status: AccountStatus.Active,
        userDetails: {
          name: 'OAuth User',
          email: 'oauth@example.com',
          imageUrl: 'https://example.com/oauth.jpg',
        },
        provider: 'google',
      },
    ];

    const session = {
      hasSession: true,
      accountIds: [mockAccountId, mockAccountId2],
      currentAccountId: mockAccountId,
      isValid: true,
    };

    beforeEach(() => {
      // Reset the find mock for getSessionAccountsData tests with intelligent filtering
      mockAccountModel.find = vi.fn().mockImplementation((query) => {
        const requestedIds = query._id.$in;
        const filteredAccounts = mockAccounts.filter((account) => requestedIds.includes(account._id.toString()));
        return Promise.resolve(filteredAccounts);
      });
    });

    it('should return account data for all session accounts', async () => {
      const result = await SessionService.getSessionAccountsData(session);

      expect(mockAccountModel.find).toHaveBeenCalledWith({
        _id: { $in: [mockAccountId, mockAccountId2] },
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: mockAccountId,
        accountType: AccountType.Local,
        status: AccountStatus.Active,
        userDetails: {
          name: 'Test User',
          email: 'test@example.com',
          username: 'testuser',
          imageUrl: 'https://example.com/avatar.jpg',
        },
      });
      expect(result[1]).toEqual({
        id: mockAccountId2,
        accountType: AccountType.OAuth,
        status: AccountStatus.Active,
        userDetails: {
          name: 'OAuth User',
          email: 'oauth@example.com',
          imageUrl: 'https://example.com/oauth.jpg',
        },
        provider: 'google',
      });
    });

    it('should return account data for specific account IDs', async () => {
      const result = await SessionService.getSessionAccountsData(session, [mockAccountId]);

      expect(mockAccountModel.find).toHaveBeenCalledWith({
        _id: { $in: [mockAccountId] },
      });

      expect(result).toHaveLength(1);
    });

    it('should handle string account ID parameter', async () => {
      const result = await SessionService.getSessionAccountsData(session, mockAccountId);

      expect(mockAccountModel.find).toHaveBeenCalledWith({
        _id: { $in: [mockAccountId] },
      });

      expect(result).toHaveLength(1);
    });

    it('should filter account IDs to only include session accounts', async () => {
      const unauthorizedAccountId = '507f1f77bcf86cd799439099';

      await SessionService.getSessionAccountsData(session, [mockAccountId, unauthorizedAccountId]);

      // Should only query for the account that's in the session
      expect(mockAccountModel.find).toHaveBeenCalledWith({
        _id: { $in: [mockAccountId] },
      });
    });

    it('should return empty array on database error', async () => {
      mockAccountModel.find.mockRejectedValue(new Error('Database error'));

      const result = await SessionService.getSessionAccountsData(session);

      expect(result).toEqual([]);
    });

    it('should handle empty account IDs', async () => {
      await SessionService.getSessionAccountsData(session, []);

      expect(mockAccountModel.find).toHaveBeenCalledWith({
        _id: { $in: [mockAccountId, mockAccountId2] },
      });
    });
  });

  describe('addAccountToSession', () => {
    it('should add account to session when account exists', async () => {
      await SessionService.addAccountToSession(mockRequest as Request, mockResponse as Response, mockAccountId, true);

      expect(mockAccountModel.findById).toHaveBeenCalledWith(mockAccountId);
      expect(sessionUtils.addAccountToSession).toHaveBeenCalledWith(mockRequest, mockResponse, mockAccountId, true);
    });

    it('should add account without setting as current', async () => {
      await SessionService.addAccountToSession(mockRequest as Request, mockResponse as Response, mockAccountId, false);

      expect(sessionUtils.addAccountToSession).toHaveBeenCalledWith(mockRequest, mockResponse, mockAccountId, false);
    });

    it('should use default setAsCurrent value', async () => {
      await SessionService.addAccountToSession(mockRequest as Request, mockResponse as Response, mockAccountId);

      expect(sessionUtils.addAccountToSession).toHaveBeenCalledWith(mockRequest, mockResponse, mockAccountId, true);
    });

    it('should throw error for invalid account ID', async () => {
      await expect(
        SessionService.addAccountToSession(mockRequest as Request, mockResponse as Response, 'invalid-id'),
      ).rejects.toThrow('Invalid Account ID format');
    });

    it('should throw error when account does not exist', async () => {
      mockAccountModel.findById.mockResolvedValue(null);

      await expect(
        SessionService.addAccountToSession(mockRequest as Request, mockResponse as Response, mockAccountId),
      ).rejects.toThrow(BadRequestError);
      await expect(
        SessionService.addAccountToSession(mockRequest as Request, mockResponse as Response, mockAccountId),
      ).rejects.toThrow('Account not found');
    });
  });

  describe('removeAccountFromSession', () => {
    it('should remove account from session when account is in session', async () => {
      await SessionService.removeAccountFromSession(mockRequest as Request, mockResponse as Response, mockAccountId);

      expect(sessionUtils.removeAccountFromSession).toHaveBeenCalledWith(mockRequest, mockResponse, mockAccountId);
    });

    it('should throw error for invalid account ID', async () => {
      await expect(
        SessionService.removeAccountFromSession(mockRequest as Request, mockResponse as Response, 'invalid-id'),
      ).rejects.toThrow('Invalid Account ID format');
    });

    it('should throw error when account is not in session', async () => {
      vi.mocked(sessionUtils.getAccountSessionFromCookies).mockReturnValue({
        hasSession: true,
        accountIds: [mockAccountId2], // Different account
        currentAccountId: mockAccountId2,
        isValid: true,
      });

      await expect(
        SessionService.removeAccountFromSession(mockRequest as Request, mockResponse as Response, mockAccountId),
      ).rejects.toThrow(BadRequestError);
      await expect(
        SessionService.removeAccountFromSession(mockRequest as Request, mockResponse as Response, mockAccountId),
      ).rejects.toThrow('Account not found in session');
    });
  });

  describe('setCurrentAccountInSession', () => {
    it('should set current account when account is in session', async () => {
      await SessionService.setCurrentAccountInSession(mockRequest as Request, mockResponse as Response, mockAccountId);

      expect(sessionUtils.setCurrentAccountInSession).toHaveBeenCalledWith(mockRequest, mockResponse, mockAccountId);
    });

    it('should set current account to null', async () => {
      await SessionService.setCurrentAccountInSession(mockRequest as Request, mockResponse as Response, null);

      expect(sessionUtils.setCurrentAccountInSession).toHaveBeenCalledWith(mockRequest, mockResponse, null);
    });

    it('should throw error for invalid account ID', async () => {
      await expect(
        SessionService.setCurrentAccountInSession(mockRequest as Request, mockResponse as Response, 'invalid-id'),
      ).rejects.toThrow('Invalid Account ID format');
    });

    it('should throw error when account is not in session', async () => {
      vi.mocked(sessionUtils.getAccountSessionFromCookies).mockReturnValue({
        hasSession: true,
        accountIds: [mockAccountId2], // Different account
        currentAccountId: mockAccountId2,
        isValid: true,
      });

      await expect(
        SessionService.setCurrentAccountInSession(mockRequest as Request, mockResponse as Response, mockAccountId),
      ).rejects.toThrow(BadRequestError);
      await expect(
        SessionService.setCurrentAccountInSession(mockRequest as Request, mockResponse as Response, mockAccountId),
      ).rejects.toThrow('Account not found in session');
    });
  });

  describe('clearEntireAccountSession', () => {
    it('should clear entire account session', async () => {
      await SessionService.clearEntireAccountSession(mockRequest as Request, mockResponse as Response);

      expect(sessionUtils.clearAccountSession).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });

  describe('removeAccountsFromSession', () => {
    it('should remove multiple accounts from session', async () => {
      const accountIds = [mockAccountId, mockAccountId2];

      await SessionService.removeAccountsFromSession(mockRequest as Request, mockResponse as Response, accountIds);

      expect(sessionUtils.clearAccountSession).toHaveBeenCalledWith(mockRequest, mockResponse, accountIds);
    });

    it('should validate all account IDs', async () => {
      const accountIds = ['invalid-id', mockAccountId];

      await expect(
        SessionService.removeAccountsFromSession(mockRequest as Request, mockResponse as Response, accountIds),
      ).rejects.toThrow('Invalid Account ID format');
    });

    it('should handle empty account IDs array', async () => {
      await SessionService.removeAccountsFromSession(mockRequest as Request, mockResponse as Response, []);

      expect(sessionUtils.clearAccountSession).toHaveBeenCalledWith(mockRequest, mockResponse, []);
    });
  });

  describe('Edge Cases', () => {
    it('should handle session with no current account ID', async () => {
      const session = {
        hasSession: true,
        accountIds: [mockAccountId],
        currentAccountId: null,
        isValid: true,
      };

      mockAccountModel.find.mockReturnValue({
        distinct: vi.fn().mockResolvedValue([mockAccountId]),
      });

      const result = await SessionService.getAccountSession(session);

      expect(result.currentAccountId).toBe(mockAccountId);
    });

    it('should handle session with empty account IDs', async () => {
      const session = {
        hasSession: true,
        accountIds: [],
        currentAccountId: null,
        isValid: true,
      };

      const result = await SessionService.getAccountSession(session);

      expect(result).toEqual({
        hasSession: false,
        accountIds: [],
        currentAccountId: null,
        missingAccountIds: [],
        isValid: false,
      });
    });

    it('should handle null account documents from database', async () => {
      const session = {
        hasSession: true,
        accountIds: [mockAccountId],
        currentAccountId: mockAccountId,
        isValid: true,
      };

      // Mock toSafeSessionAccount to return null for invalid accounts
      mockAccountModel.find.mockResolvedValue([null]);

      const result = await SessionService.getSessionAccountsData(session);

      expect(result).toEqual([]);
    });
  });
});
