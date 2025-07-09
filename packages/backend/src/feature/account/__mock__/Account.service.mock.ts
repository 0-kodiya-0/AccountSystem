import { BadRequestError, NotFoundError, ValidationError, ApiErrorCode } from '../../../types/response.types';
import { Account, AccountType, AccountStatus, OAuthProviders } from '../Account.types';
import { logger } from '../../../utils/logger';
import { ValidationUtils } from '../../../utils/validation';
import { toSafeAccount } from '../Account.utils';
import { getAccountsMockConfig, getMockAccountsForSeeding, type SeedingOptions } from '../../../config/mock.config';
import { getModels } from '../../../config/db.config';

/**
 * Get all mock accounts with filtering options
 */
export async function getAllMockAccounts(
  options: {
    accountType?: AccountType;
    status?: AccountStatus;
    provider?: OAuthProviders;
    tags?: string[];
    limit?: number;
    offset?: number;
  } = {},
): Promise<{
  accounts: Account[];
  total: number;
  limit: number;
  offset: number;
}> {
  const { accountType, status, provider, tags, limit = 50, offset = 0 } = options;

  try {
    const models = await getModels();

    // Build query filter
    const filter: any = {};

    if (accountType) {
      filter.accountType = accountType;
    }

    if (status) {
      filter.status = status;
    }

    if (provider) {
      filter.provider = provider;
    }

    // For development, we can identify mock accounts by checking against our mock config
    const mockConfig = getAccountsMockConfig();
    const mockEmails = mockConfig.accounts.map((acc) => acc.email);

    if (mockEmails.length > 0) {
      filter['userDetails.email'] = { $in: mockEmails };
    }

    // Execute query with pagination
    const [accounts, total] = await Promise.all([
      models.accounts.Account.find(filter).skip(offset).limit(limit).sort({ created: -1 }),
      models.accounts.Account.countDocuments(filter),
    ]);

    const safeAccounts = accounts.map((doc) => toSafeAccount(doc)).filter((acc): acc is Account => acc !== null);

    return {
      accounts: safeAccounts,
      total,
      limit,
      offset,
    };
  } catch (error) {
    logger.error('Error getting mock accounts:', error);
    throw new BadRequestError('Failed to retrieve mock accounts', 500, ApiErrorCode.DATABASE_ERROR);
  }
}

/**
 * Get mock account by ID
 */
export async function getMockAccountById(accountId: string): Promise<Account> {
  ValidationUtils.validateObjectIdWithContext(accountId, 'Account ID', 'mock account retrieval');

  try {
    const models = await getModels();
    const accountDoc = await models.accounts.Account.findById(accountId);

    if (!accountDoc) {
      throw new NotFoundError('Mock account not found', 404, ApiErrorCode.USER_NOT_FOUND);
    }

    const safeAccount = toSafeAccount(accountDoc);
    if (!safeAccount) {
      throw new BadRequestError('Failed to process account data', 500, ApiErrorCode.SERVER_ERROR);
    }

    return safeAccount;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error getting mock account by ID:', error);
    throw new BadRequestError('Failed to retrieve mock account', 500, ApiErrorCode.DATABASE_ERROR);
  }
}

/**
 * Create a new mock account
 */
export async function createMockAccount(accountData: {
  accountType: AccountType;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  imageUrl?: string;
  emailVerified?: boolean;
  provider?: OAuthProviders;
  password?: string;
  status?: AccountStatus;
  birthdate?: string;
}): Promise<Account> {
  // Validate required fields
  ValidationUtils.validateRequiredFields(accountData, ['accountType', 'email', 'name']);
  ValidationUtils.validateEmail(accountData.email);
  ValidationUtils.validateStringLength(accountData.name, 'Name', 1, 100);

  // Validate account type specific requirements
  if (accountData.accountType === AccountType.OAuth && !accountData.provider) {
    throw new ValidationError('OAuth accounts require a provider', 400, ApiErrorCode.VALIDATION_ERROR);
  }

  if (accountData.accountType === AccountType.Local && !accountData.password) {
    throw new ValidationError('Local accounts require a password', 400, ApiErrorCode.VALIDATION_ERROR);
  }

  try {
    const models = await getModels();

    // Check if account already exists
    const existingAccount = await models.accounts.Account.findOne({
      'userDetails.email': accountData.email,
    });

    if (existingAccount) {
      throw new ValidationError('Account with this email already exists', 400, ApiErrorCode.USER_EXISTS);
    }

    // Check username uniqueness if provided
    if (accountData.username) {
      const existingUsername = await models.accounts.Account.findOne({
        'userDetails.username': accountData.username,
      });

      if (existingUsername) {
        throw new ValidationError('Username already taken', 400, ApiErrorCode.USER_EXISTS);
      }
    }

    const timestamp = new Date().toISOString();

    const newAccountData = {
      created: timestamp,
      updated: timestamp,
      accountType: accountData.accountType,
      status: accountData.status || AccountStatus.Active,
      userDetails: {
        name: accountData.name,
        email: accountData.email,
        firstName: accountData.firstName,
        lastName: accountData.lastName,
        username: accountData.username,
        imageUrl: accountData.imageUrl,
        emailVerified: accountData.emailVerified || false,
        birthdate: accountData.birthdate,
      },
      security: {
        password: accountData.password,
        twoFactorEnabled: false,
        sessionTimeout: 3600,
        autoLock: false,
        failedLoginAttempts: 0,
      },
      ...(accountData.provider && { provider: accountData.provider }),
    };

    const newAccount = await models.accounts.Account.create(newAccountData);
    const safeAccount = toSafeAccount(newAccount);

    if (!safeAccount) {
      throw new BadRequestError('Failed to create mock account', 500, ApiErrorCode.SERVER_ERROR);
    }

    logger.info(`Created mock account: ${accountData.email} (${accountData.accountType})`);
    return safeAccount;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.error('Error creating mock account:', error);
    throw new BadRequestError('Failed to create mock account', 500, ApiErrorCode.DATABASE_ERROR);
  }
}

/**
 * Update a mock account
 */
export async function updateMockAccount(
  accountId: string,
  updates: {
    firstName?: string;
    lastName?: string;
    name?: string;
    imageUrl?: string;
    birthdate?: string;
    username?: string;
    status?: AccountStatus;
    emailVerified?: boolean;
  },
): Promise<Account> {
  ValidationUtils.validateObjectIdWithContext(accountId, 'Account ID', 'mock account update');

  try {
    const models = await getModels();
    const accountDoc = await models.accounts.Account.findById(accountId);

    if (!accountDoc) {
      throw new NotFoundError('Mock account not found', 404, ApiErrorCode.USER_NOT_FOUND);
    }

    // Validate updates
    if (updates.name !== undefined) {
      ValidationUtils.validateStringLength(updates.name, 'Name', 1, 100);
    }

    if (updates.username !== undefined && updates.username !== '') {
      ValidationUtils.validateStringLength(updates.username, 'Username', 3, 30);

      // Check username uniqueness
      const existingAccount = await models.accounts.Account.findOne({
        'userDetails.username': updates.username,
        _id: { $ne: accountId },
      });

      if (existingAccount) {
        throw new ValidationError('Username already taken', 400, ApiErrorCode.USER_EXISTS);
      }
    }

    // Apply updates
    if (updates.firstName !== undefined) accountDoc.userDetails.firstName = updates.firstName;
    if (updates.lastName !== undefined) accountDoc.userDetails.lastName = updates.lastName;
    if (updates.name !== undefined) accountDoc.userDetails.name = updates.name;
    if (updates.imageUrl !== undefined) accountDoc.userDetails.imageUrl = updates.imageUrl;
    if (updates.birthdate !== undefined) accountDoc.userDetails.birthdate = updates.birthdate;
    if (updates.username !== undefined) accountDoc.userDetails.username = updates.username;
    if (updates.status !== undefined) accountDoc.status = updates.status;
    if (updates.emailVerified !== undefined) accountDoc.userDetails.emailVerified = updates.emailVerified;

    accountDoc.updated = new Date().toISOString();
    await accountDoc.save();

    const safeAccount = toSafeAccount(accountDoc);
    if (!safeAccount) {
      throw new BadRequestError('Failed to update mock account', 500, ApiErrorCode.SERVER_ERROR);
    }

    logger.info(`Updated mock account: ${accountId}`);
    return safeAccount;
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }
    logger.error('Error updating mock account:', error);
    throw new BadRequestError('Failed to update mock account', 500, ApiErrorCode.DATABASE_ERROR);
  }
}

/**
 * Delete a mock account
 */
export async function deleteMockAccount(accountId: string): Promise<void> {
  ValidationUtils.validateObjectIdWithContext(accountId, 'Account ID', 'mock account deletion');

  try {
    const models = await getModels();
    const result = await models.accounts.Account.findByIdAndDelete(accountId);

    if (!result) {
      throw new NotFoundError('Mock account not found', 404, ApiErrorCode.USER_NOT_FOUND);
    }

    logger.info(`Deleted mock account: ${accountId}`);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error deleting mock account:', error);
    throw new BadRequestError('Failed to delete mock account', 500, ApiErrorCode.DATABASE_ERROR);
  }
}

/**
 * Clear all mock accounts
 */
export async function clearAllMockAccounts(): Promise<{ deletedCount: number }> {
  try {
    const mockConfig = getAccountsMockConfig();
    const mockEmails = mockConfig.accounts.map((acc) => acc.email);

    if (mockEmails.length === 0) {
      return { deletedCount: 0 };
    }

    const models = await getModels();
    const result = await models.accounts.Account.deleteMany({
      'userDetails.email': { $in: mockEmails },
    });

    logger.info(`Cleared ${result.deletedCount} mock accounts`);
    return { deletedCount: result.deletedCount };
  } catch (error) {
    logger.error('Error clearing mock accounts:', error);
    throw new BadRequestError('Failed to clear mock accounts', 500, ApiErrorCode.DATABASE_ERROR);
  }
}

/**
 * Seed mock accounts from configuration
 */
export async function seedMockAccounts(seedingOptions?: SeedingOptions): Promise<{
  seeded: number;
  skipped: number;
  failed: number;
  details: Array<{
    email: string;
    status: 'seeded' | 'skipped' | 'failed';
    reason?: string;
    accountId?: string;
  }>;
}> {
  try {
    const accountsToSeed = getMockAccountsForSeeding(seedingOptions);
    const results = {
      seeded: 0,
      skipped: 0,
      failed: 0,
      details: [] as Array<{
        email: string;
        status: 'seeded' | 'skipped' | 'failed';
        reason?: string;
        accountId?: string;
      }>,
    };

    const models = await getModels();

    for (const mockAccount of accountsToSeed) {
      try {
        // Check if account already exists
        const existingAccount = await models.accounts.Account.findOne({
          'userDetails.email': mockAccount.email,
        });

        if (existingAccount) {
          results.skipped++;
          results.details.push({
            email: mockAccount.email,
            status: 'skipped',
            reason: 'Account already exists',
          });
          continue;
        }

        // Create the account
        const account = await createMockAccount({
          accountType: mockAccount.accountType,
          email: mockAccount.email,
          name: mockAccount.name,
          firstName: mockAccount.firstName,
          lastName: mockAccount.lastName,
          username: mockAccount.username,
          imageUrl: mockAccount.imageUrl,
          emailVerified: mockAccount.emailVerified,
          provider: mockAccount.provider,
          password: mockAccount.password,
          status: mockAccount.status,
          birthdate: mockAccount.birthdate,
        });

        results.seeded++;
        results.details.push({
          email: mockAccount.email,
          status: 'seeded',
          accountId: account.id,
        });
      } catch (error) {
        results.failed++;
        results.details.push({
          email: mockAccount.email,
          status: 'failed',
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
        logger.error(`Failed to seed account ${mockAccount.email}:`, error);
      }
    }

    logger.info(`Seeding completed: ${results.seeded} seeded, ${results.skipped} skipped, ${results.failed} failed`);
    return results;
  } catch (error) {
    logger.error('Error seeding mock accounts:', error);
    throw new BadRequestError('Failed to seed mock accounts', 500, ApiErrorCode.SERVER_ERROR);
  }
}

/**
 * Search mock accounts by email or username
 */
export async function searchMockAccounts(query: string, limit: number = 10): Promise<Account[]> {
  const sanitizedQuery = ValidationUtils.validateSearchQuery(query, 100);

  try {
    const models = await getModels();
    const mockConfig = getAccountsMockConfig();
    const mockEmails = mockConfig.accounts.map((acc) => acc.email);

    const searchFilter = {
      $and: [
        { 'userDetails.email': { $in: mockEmails } }, // Only search mock accounts
        {
          $or: [
            { 'userDetails.email': { $regex: sanitizedQuery, $options: 'i' } },
            { 'userDetails.username': { $regex: sanitizedQuery, $options: 'i' } },
            { 'userDetails.name': { $regex: sanitizedQuery, $options: 'i' } },
          ],
        },
      ],
    };

    const accounts = await models.accounts.Account.find(searchFilter).limit(limit).sort({ created: -1 });

    const safeAccounts = accounts.map((doc) => toSafeAccount(doc)).filter((acc): acc is Account => acc !== null);

    return safeAccounts;
  } catch (error) {
    logger.error('Error searching mock accounts:', error);
    throw new BadRequestError('Failed to search mock accounts', 500, ApiErrorCode.DATABASE_ERROR);
  }
}

/**
 * Get mock account statistics
 */
export async function getMockAccountStats(): Promise<{
  total: number;
  byType: Record<AccountType, number>;
  byStatus: Record<AccountStatus, number>;
  byProvider: Record<OAuthProviders, number>;
  configuredMockAccounts: number;
  databaseMockAccounts: number;
}> {
  try {
    const mockConfig = getAccountsMockConfig();
    const mockEmails = mockConfig.accounts.map((acc) => acc.email);

    if (mockEmails.length === 0) {
      return {
        total: 0,
        byType: {} as Record<AccountType, number>,
        byStatus: {} as Record<AccountStatus, number>,
        byProvider: {} as Record<OAuthProviders, number>,
        configuredMockAccounts: 0,
        databaseMockAccounts: 0,
      };
    }

    const models = await getModels();
    const accounts = await models.accounts.Account.find({
      'userDetails.email': { $in: mockEmails },
    });

    const stats = {
      total: accounts.length,
      byType: {} as Record<AccountType, number>,
      byStatus: {} as Record<AccountStatus, number>,
      byProvider: {} as Record<OAuthProviders, number>,
      configuredMockAccounts: mockConfig.accounts.length,
      databaseMockAccounts: accounts.length,
    };

    // Initialize counters
    Object.values(AccountType).forEach((type) => {
      stats.byType[type] = 0;
    });
    Object.values(AccountStatus).forEach((status) => {
      stats.byStatus[status] = 0;
    });
    Object.values(OAuthProviders).forEach((provider) => {
      stats.byProvider[provider] = 0;
    });

    // Count accounts
    accounts.forEach((account) => {
      stats.byType[account.accountType]++;
      stats.byStatus[account.status]++;
      if (account.provider) {
        stats.byProvider[account.provider]++;
      }
    });

    return stats;
  } catch (error) {
    logger.error('Error getting mock account stats:', error);
    throw new BadRequestError('Failed to get mock account statistics', 500, ApiErrorCode.DATABASE_ERROR);
  }
}
