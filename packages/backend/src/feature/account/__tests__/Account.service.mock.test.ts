import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import * as AccountMockService from '../__mock__/Account.service.mock';
import { AccountType, AccountStatus, OAuthProviders } from '../Account.types';
import { BadRequestError, NotFoundError, ValidationError } from '../../../types/response.types';
import { getAccountsMockConfig } from '../../../config/mock.config';
import { getModels } from '../../../config/db.config';

vi.mock('../../../config/mock.config', () => ({
  getAccountsMockConfig: vi.fn(() => ({
    enabled: true,
    accounts: [
      {
        id: 'mock-1',
        accountType: AccountType.Local,
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
        emailVerified: true,
        status: AccountStatus.Active,
      },
      {
        id: 'mock-2',
        accountType: AccountType.OAuth,
        email: 'oauth@example.com',
        name: 'OAuth User',
        provider: OAuthProviders.Google,
        emailVerified: true,
        status: AccountStatus.Active,
      },
    ],
  })),
  getMockAccountsForSeeding: vi.fn(() => [
    {
      id: 'mock-seed-1',
      accountType: AccountType.Local,
      email: 'seed@example.com',
      name: 'Seed User',
      password: 'password123',
      emailVerified: true,
      status: AccountStatus.Active,
    },
  ]),
}));

// Mock database models
const mockAccountModel = {
  find: vi.fn(),
  findOne: vi.fn(),
  findById: vi.fn(),
  findByIdAndDelete: vi.fn(),
  create: vi.fn(),
  countDocuments: vi.fn(),
  deleteMany: vi.fn(),
};

const mockAccount = {
  _id: new mongoose.Types.ObjectId(),
  created: '2023-01-01T00:00:00.000Z',
  updated: '2023-01-01T00:00:00.000Z',
  accountType: AccountType.Local,
  status: AccountStatus.Active,
  userDetails: {
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
  },
  security: {
    twoFactorEnabled: false,
    sessionTimeout: 3600,
    autoLock: false,
  },
  save: vi.fn(),
  toObject: vi.fn(),
};

vi.mock('../../../config/db.config', () => ({
  getModels: vi.fn(() => ({
    accounts: {
      Account: mockAccountModel,
    },
  })),
}));

vi.mock('../Account.utils', () => ({
  toSafeAccount: vi.fn((doc) => {
    if (!doc) return null;
    return {
      id: doc._id.toString(),
      created: doc.created,
      updated: doc.updated,
      accountType: doc.accountType,
      status: doc.status,
      userDetails: doc.userDetails,
      security: {
        twoFactorEnabled: doc.security?.twoFactorEnabled || false,
        sessionTimeout: doc.security?.sessionTimeout || 3600,
        autoLock: doc.security?.autoLock || false,
      },
      provider: doc.provider,
    };
  }),
}));

describe('Account Mock Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllMockAccounts', () => {
    it('should return paginated mock accounts', async () => {
      const mockAccounts = [mockAccount];
      mockAccountModel.find.mockReturnValue({
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        sort: vi.fn().mockResolvedValue(mockAccounts),
      });
      mockAccountModel.countDocuments.mockResolvedValue(1);

      const result = await AccountMockService.getAllMockAccounts({
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual({
        accounts: expect.any(Array),
        total: 1,
        limit: 10,
        offset: 0,
      });
      expect(result.accounts).toHaveLength(1);
    });

    it('should filter by account type', async () => {
      mockAccountModel.find.mockReturnValue({
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        sort: vi.fn().mockResolvedValue([]),
      });
      mockAccountModel.countDocuments.mockResolvedValue(0);

      await AccountMockService.getAllMockAccounts({
        accountType: AccountType.OAuth,
      });

      expect(mockAccountModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          accountType: AccountType.OAuth,
        }),
      );
    });

    it('should handle database errors', async () => {
      mockAccountModel.find.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(AccountMockService.getAllMockAccounts()).rejects.toThrow(BadRequestError);
    });
  });

  describe('getMockAccountById', () => {
    it('should return account by valid ID', async () => {
      const accountId = new mongoose.Types.ObjectId().toString();
      mockAccountModel.findById.mockResolvedValue(mockAccount);

      const result = await AccountMockService.getMockAccountById(accountId);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockAccount._id.toString());
      expect(mockAccountModel.findById).toHaveBeenCalledWith(accountId);
    });

    it('should throw NotFoundError for non-existent account', async () => {
      const accountId = new mongoose.Types.ObjectId().toString();
      mockAccountModel.findById.mockResolvedValue(null);

      await expect(AccountMockService.getMockAccountById(accountId)).rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError for invalid ID format', async () => {
      await expect(AccountMockService.getMockAccountById('invalid-id')).rejects.toThrow(BadRequestError);
    });
  });

  describe('createMockAccount', () => {
    const validLocalAccount = {
      accountType: AccountType.Local,
      email: 'new@example.com',
      name: 'New User',
      password: 'password123',
    };

    const validOAuthAccount = {
      accountType: AccountType.OAuth,
      email: 'oauth-new@example.com',
      name: 'OAuth New User',
      provider: OAuthProviders.Google,
    };

    it('should create a valid local account', async () => {
      mockAccountModel.findOne.mockResolvedValue(null); // No existing account
      mockAccountModel.create.mockResolvedValue({
        ...mockAccount,
        userDetails: {
          ...mockAccount.userDetails,
          email: validLocalAccount.email,
        },
      });

      const result = await AccountMockService.createMockAccount(validLocalAccount);

      expect(result).toBeDefined();
      expect(result.userDetails.email).toBe(validLocalAccount.email);
      expect(mockAccountModel.create).toHaveBeenCalled();
    });

    it('should create a valid OAuth account', async () => {
      mockAccountModel.findOne.mockResolvedValue(null);
      mockAccountModel.create.mockResolvedValue({
        ...mockAccount,
        accountType: AccountType.OAuth,
        provider: OAuthProviders.Google,
        userDetails: {
          ...mockAccount.userDetails,
          email: validOAuthAccount.email,
        },
      });

      const result = await AccountMockService.createMockAccount(validOAuthAccount);

      expect(result).toBeDefined();
      expect(result.accountType).toBe(AccountType.OAuth);
      expect(result.provider).toBe(OAuthProviders.Google);
    });

    it('should throw ValidationError for OAuth account without provider', async () => {
      const invalidOAuth = {
        accountType: AccountType.OAuth,
        email: 'oauth@example.com',
        name: 'OAuth User',
        // Missing provider
      };

      await expect(AccountMockService.createMockAccount(invalidOAuth)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for local account without password', async () => {
      const invalidLocal = {
        accountType: AccountType.Local,
        email: 'local@example.com',
        name: 'Local User',
        // Missing password
      };

      await expect(AccountMockService.createMockAccount(invalidLocal)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for existing email', async () => {
      mockAccountModel.findOne.mockResolvedValue(mockAccount); // Existing account

      await expect(AccountMockService.createMockAccount(validLocalAccount)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for missing required fields', async () => {
      const incomplete = {
        accountType: AccountType.Local,
        // Missing email and name
      };

      await expect(AccountMockService.createMockAccount(incomplete as any)).rejects.toThrow(BadRequestError);
    });

    it('should throw ValidationError for invalid email format', async () => {
      const invalidEmail = {
        ...validLocalAccount,
        email: 'invalid-email',
      };

      await expect(AccountMockService.createMockAccount(invalidEmail)).rejects.toThrow(ValidationError);
    });
  });

  describe('updateMockAccount', () => {
    const accountId = new mongoose.Types.ObjectId().toString();
    const updates = {
      name: 'Updated Name',
      firstName: 'Updated',
      lastName: 'Name',
    };

    it('should update account successfully', async () => {
      const updatedAccount = { ...mockAccount };
      updatedAccount.save.mockResolvedValue(updatedAccount);
      mockAccountModel.findById.mockResolvedValue(updatedAccount);

      const result = await AccountMockService.updateMockAccount(accountId, updates);

      expect(result).toBeDefined();
      expect(updatedAccount.save).toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent account', async () => {
      mockAccountModel.findById.mockResolvedValue(null);

      await expect(AccountMockService.updateMockAccount(accountId, updates)).rejects.toThrow(NotFoundError);
    });

    it('should validate username uniqueness', async () => {
      const accountWithUsername = { ...mockAccount };
      accountWithUsername.save.mockResolvedValue(accountWithUsername);
      mockAccountModel.findById.mockResolvedValue(accountWithUsername);
      mockAccountModel.findOne.mockResolvedValue(mockAccount); // Existing username

      await expect(AccountMockService.updateMockAccount(accountId, { username: 'existing' })).rejects.toThrow(
        ValidationError,
      );
    });

    it('should allow updating to same username', async () => {
      const accountWithUsername = { ...mockAccount };
      accountWithUsername.save.mockResolvedValue(accountWithUsername);
      mockAccountModel.findById.mockResolvedValue(accountWithUsername);
      mockAccountModel.findOne.mockResolvedValue(null); // No conflict

      const result = await AccountMockService.updateMockAccount(accountId, { username: 'newusername' });

      expect(result).toBeDefined();
    });
  });

  describe('deleteMockAccount', () => {
    it('should delete account successfully', async () => {
      const accountId = new mongoose.Types.ObjectId().toString();
      mockAccountModel.findByIdAndDelete.mockResolvedValue(mockAccount);

      await AccountMockService.deleteMockAccount(accountId);

      expect(mockAccountModel.findByIdAndDelete).toHaveBeenCalledWith(accountId);
    });

    it('should throw NotFoundError for non-existent account', async () => {
      const accountId = new mongoose.Types.ObjectId().toString();
      mockAccountModel.findByIdAndDelete.mockResolvedValue(null);

      await expect(AccountMockService.deleteMockAccount(accountId)).rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError for invalid ID format', async () => {
      await expect(AccountMockService.deleteMockAccount('invalid-id')).rejects.toThrow(BadRequestError);
    });
  });

  describe('clearAllMockAccounts', () => {
    it('should clear all mock accounts', async () => {
      mockAccountModel.deleteMany.mockResolvedValue({ deletedCount: 2 });

      const result = await AccountMockService.clearAllMockAccounts();

      expect(result.deletedCount).toBe(2);
      expect(mockAccountModel.deleteMany).toHaveBeenCalledWith({
        'userDetails.email': { $in: ['test@example.com', 'oauth@example.com'] },
      });
    });

    it('should return 0 when no mock emails configured', async () => {
      vi.mocked(getAccountsMockConfig).mockReturnValue({
        enabled: true,
        accounts: [],
      } as any);

      const result = await AccountMockService.clearAllMockAccounts();

      expect(result.deletedCount).toBe(0);
    });
  });

  describe('seedMockAccounts', () => {
    it('should seed accounts successfully', async () => {
      mockAccountModel.findOne.mockResolvedValue(null); // No existing accounts
      mockAccountModel.create.mockResolvedValue({
        ...mockAccount,
        userDetails: { ...mockAccount.userDetails, email: 'seed@example.com' },
      });

      const result = await AccountMockService.seedMockAccounts();

      expect(result.seeded).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.details).toHaveLength(1);
      expect(result.details[0].status).toBe('seeded');
    });

    it('should skip existing accounts', async () => {
      mockAccountModel.findOne.mockResolvedValue(mockAccount); // Existing account

      const result = await AccountMockService.seedMockAccounts();

      expect(result.seeded).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.details[0].status).toBe('skipped');
      expect(result.details[0].reason).toBe('Account already exists');
    });

    it('should handle failed account creation', async () => {
      mockAccountModel.findOne.mockResolvedValue(null);
      mockAccountModel.create.mockRejectedValue(new Error('Creation failed'));

      const result = await AccountMockService.seedMockAccounts();

      expect(result.seeded).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.details[0].status).toBe('failed');
    });
  });

  describe('searchMockAccounts', () => {
    it('should search accounts by query', async () => {
      mockAccountModel.find.mockReturnValue({
        limit: vi.fn().mockReturnThis(),
        sort: vi.fn().mockResolvedValue([mockAccount]),
      });

      const result = await AccountMockService.searchMockAccounts('test', 10);

      expect(result).toHaveLength(1);
      expect(mockAccountModel.find).toHaveBeenCalledWith({
        $and: [
          { 'userDetails.email': { $in: ['test@example.com', 'oauth@example.com'] } },
          {
            $or: [
              { 'userDetails.email': { $regex: 'test', $options: 'i' } },
              { 'userDetails.username': { $regex: 'test', $options: 'i' } },
              { 'userDetails.name': { $regex: 'test', $options: 'i' } },
            ],
          },
        ],
      });
    });

    it('should throw ValidationError for empty query', async () => {
      await expect(AccountMockService.searchMockAccounts('')).rejects.toThrow(BadRequestError);
    });

    it('should throw ValidationError for query too long', async () => {
      const longQuery = 'a'.repeat(101);
      await expect(AccountMockService.searchMockAccounts(longQuery)).rejects.toThrow(ValidationError);
    });
  });

  describe('getMockAccountStats', () => {
    it('should return account statistics', async () => {
      const accounts = [
        { ...mockAccount, accountType: AccountType.Local, status: AccountStatus.Active },
        {
          ...mockAccount,
          accountType: AccountType.OAuth,
          status: AccountStatus.Active,
          provider: OAuthProviders.Google,
        },
      ];
      mockAccountModel.find.mockResolvedValue(accounts);

      const result = await AccountMockService.getMockAccountStats();

      expect(result.total).toBe(2);
      expect(result.configuredMockAccounts).toBe(2);
      expect(result.databaseMockAccounts).toBe(2);
      expect(result.byType[AccountType.Local]).toBe(1);
      expect(result.byType[AccountType.OAuth]).toBe(1);
      expect(result.byProvider[OAuthProviders.Google]).toBe(1);
    });

    it('should return empty stats when no mock accounts configured', async () => {
      vi.mocked(getAccountsMockConfig).mockReturnValue({
        enabled: true,
        accounts: [],
      } as any);

      const result = await AccountMockService.getMockAccountStats();

      expect(result.total).toBe(0);
      expect(result.configuredMockAccounts).toBe(0);
    });
  });
});
