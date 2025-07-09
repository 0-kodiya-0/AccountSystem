import { Request, Response, NextFunction } from 'express';
import { JsonSuccess, BadRequestError, ApiErrorCode } from '../../../types/response.types';
import { asyncHandler } from '../../../utils/response';
import { ValidationUtils } from '../../../utils/validation';
import * as AccountMockService from './Account.service.mock';
import { AccountType, AccountStatus, OAuthProviders } from '../Account.types';
import { logger } from '../../../utils/logger';
import {
  getAccountsMockConfig,
  getAvailableSeedingTags,
  previewSeeding,
  SeedingOptions,
} from '../../../config/mock.config';

/**
 * Account Mock Controller
 * Handles HTTP requests for mock account operations
 */

/**
 * Get all mock accounts with optional filtering
 * GET /mock/account
 * Query params: accountType, status, provider, tags[], limit, offset
 */
export const getAllMockAccounts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { accountType, status, provider, tags, limit, offset } = req.query;

  // Validate and parse query parameters
  const options: any = {};

  if (accountType) {
    options.accountType = ValidationUtils.validateEnum(accountType as string, AccountType, 'Account Type');
  }

  if (status) {
    options.status = ValidationUtils.validateEnum(status as string, AccountStatus, 'Account Status');
  }

  if (provider) {
    options.provider = ValidationUtils.validateEnum(provider as string, OAuthProviders, 'OAuth Provider');
  }

  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    options.tags = tagArray.map((tag) => String(tag));
  }

  // Parse pagination parameters
  const pagination = ValidationUtils.validatePaginationParams({
    limit: limit as string,
    offset: offset as string,
  });

  options.limit = pagination.limit;
  options.offset = pagination.offset;

  const result = await AccountMockService.getAllMockAccounts(options);

  logger.info(`Retrieved ${result.accounts.length} mock accounts (${result.total} total)`);
  next(new JsonSuccess(result, 200));
});

/**
 * Get mock account by ID
 * GET /mock/account/:accountId
 */
export const getMockAccountById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { accountId } = req.params;

  const account = await AccountMockService.getMockAccountById(accountId);

  logger.info(`Retrieved mock account: ${accountId}`);
  next(new JsonSuccess(account, 200));
});

/**
 * Create a new mock account
 * POST /mock/account
 */
export const createMockAccount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const accountData = req.body;

  if (!accountData || typeof accountData !== 'object') {
    throw new BadRequestError('Request body must be a valid JSON object', 400, ApiErrorCode.INVALID_REQUEST);
  }

  // Validate account type
  if (accountData.accountType) {
    accountData.accountType = ValidationUtils.validateEnum(accountData.accountType, AccountType, 'Account Type');
  }

  // Validate status if provided
  if (accountData.status) {
    accountData.status = ValidationUtils.validateEnum(accountData.status, AccountStatus, 'Account Status');
  }

  // Validate provider if provided
  if (accountData.provider) {
    accountData.provider = ValidationUtils.validateEnum(accountData.provider, OAuthProviders, 'OAuth Provider');
  }

  const account = await AccountMockService.createMockAccount(accountData);

  logger.info(`Created mock account: ${account.userDetails.email} (${account.id})`);
  next(new JsonSuccess(account, 201));
});

/**
 * Update a mock account
 * PATCH /mock/account/:accountId
 */
export const updateMockAccount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { accountId } = req.params;
  const updates = req.body;

  if (!updates || typeof updates !== 'object') {
    throw new BadRequestError('Request body must be a valid JSON object', 400, ApiErrorCode.INVALID_REQUEST);
  }

  // Validate status if provided
  if (updates.status) {
    updates.status = ValidationUtils.validateEnum(updates.status, AccountStatus, 'Account Status');
  }

  const account = await AccountMockService.updateMockAccount(accountId, updates);

  logger.info(`Updated mock account: ${accountId}`);
  next(new JsonSuccess(account, 200));
});

/**
 * Delete a mock account
 * DELETE /mock/account/:accountId
 */
export const deleteMockAccount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { accountId } = req.params;

  await AccountMockService.deleteMockAccount(accountId);

  logger.info(`Deleted mock account: ${accountId}`);
  next(new JsonSuccess({ message: 'Mock account deleted successfully' }, 200));
});

/**
 * Clear all mock accounts
 * DELETE /mock/account
 */
export const clearAllMockAccounts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = await AccountMockService.clearAllMockAccounts();

  logger.info(`Cleared ${result.deletedCount} mock accounts`);
  next(
    new JsonSuccess(
      {
        message: `Successfully cleared ${result.deletedCount} mock accounts`,
        deletedCount: result.deletedCount,
      },
      200,
    ),
  );
});

/**
 * Seed mock accounts from configuration
 * POST /mock/account/seed
 */
export const seedMockAccounts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const seedingOptions: SeedingOptions = req.body || {};

  // Validate seeding options
  if (seedingOptions.mode && !['all', 'default', 'tagged', 'explicit'].includes(seedingOptions.mode)) {
    throw new BadRequestError(
      'Invalid seeding mode. Must be one of: all, default, tagged, explicit',
      400,
      ApiErrorCode.VALIDATION_ERROR,
    );
  }

  if (seedingOptions.tags && !Array.isArray(seedingOptions.tags)) {
    throw new BadRequestError('Tags must be an array of strings', 400, ApiErrorCode.VALIDATION_ERROR);
  }

  if (seedingOptions.accountIds && !Array.isArray(seedingOptions.accountIds)) {
    throw new BadRequestError('Account IDs must be an array of strings', 400, ApiErrorCode.VALIDATION_ERROR);
  }

  const result = await AccountMockService.seedMockAccounts(seedingOptions);

  logger.info(`Seeding completed: ${result.seeded} seeded, ${result.skipped} skipped, ${result.failed} failed`);

  next(
    new JsonSuccess(
      {
        message: `Seeding completed: ${result.seeded} accounts seeded successfully`,
        ...result,
      },
      200,
    ),
  );
});

/**
 * Search mock accounts
 * GET /mock/account/search
 * Query params: q (search query), limit
 */
export const searchMockAccounts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { q: query, limit } = req.query;

  if (!query) {
    throw new BadRequestError('Search query (q) is required', 400, ApiErrorCode.MISSING_DATA);
  }

  const searchLimit = limit ? parseInt(limit as string) : 10;
  if (isNaN(searchLimit) || searchLimit < 1 || searchLimit > 50) {
    throw new BadRequestError('Limit must be between 1 and 50', 400, ApiErrorCode.VALIDATION_ERROR);
  }

  const accounts = await AccountMockService.searchMockAccounts(query as string, searchLimit);

  logger.info(`Found ${accounts.length} mock accounts matching query: ${query}`);
  next(
    new JsonSuccess(
      {
        query,
        accounts,
        count: accounts.length,
      },
      200,
    ),
  );
});

/**
 * Get mock account statistics
 * GET /mock/account/stats
 */
export const getMockAccountStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const stats = await AccountMockService.getMockAccountStats();

  logger.info(`Retrieved mock account statistics: ${stats.total} total accounts`);
  next(new JsonSuccess(stats, 200));
});

/**
 * Get mock configuration information
 * GET /mock/account/config
 */
export const getMockAccountConfig = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = getAccountsMockConfig();
    const availableTags = getAvailableSeedingTags();

    // Get preview of what would be seeded with default settings
    const defaultPreview = previewSeeding();

    const configInfo = {
      enabled: config.enabled,
      seedingMode: config.seedingMode,
      defaultSeedTags: config.defaultSeedTags,
      clearOnSeed: config.clearOnSeed,
      totalConfiguredAccounts: config.accounts.length,
      availableTags,
      accountsByType: config.accounts.reduce((acc, account) => {
        acc[account.accountType] = (acc[account.accountType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      accountsByProvider: config.accounts.reduce((acc, account) => {
        if (account.provider) {
          acc[account.provider] = (acc[account.provider] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
      defaultSeedingPreview: defaultPreview,
    };

    next(new JsonSuccess(configInfo, 200));
  } catch (error) {
    logger.error('Error getting mock account config:', error);
    throw new BadRequestError('Failed to get mock configuration', 500, ApiErrorCode.SERVER_ERROR);
  }
});

/**
 * Preview seeding operation without actually seeding
 * POST /mock/account/preview-seed
 */
export const previewSeedMockAccounts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const seedingOptions: SeedingOptions = req.body || {};

  // Validate seeding options (same validation as seed endpoint)
  if (seedingOptions.mode && !['all', 'default', 'tagged', 'explicit'].includes(seedingOptions.mode)) {
    throw new BadRequestError(
      'Invalid seeding mode. Must be one of: all, default, tagged, explicit',
      400,
      ApiErrorCode.VALIDATION_ERROR,
    );
  }

  if (seedingOptions.tags && !Array.isArray(seedingOptions.tags)) {
    throw new BadRequestError('Tags must be an array of strings', 400, ApiErrorCode.VALIDATION_ERROR);
  }

  if (seedingOptions.accountIds && !Array.isArray(seedingOptions.accountIds)) {
    throw new BadRequestError('Account IDs must be an array of strings', 400, ApiErrorCode.VALIDATION_ERROR);
  }

  try {
    const preview = previewSeeding(seedingOptions);

    logger.info(`Preview seeding: ${preview.accountsToSeed.length} accounts would be seeded`);
    next(new JsonSuccess(preview, 200));
  } catch (error) {
    logger.error('Error previewing seed operation:', error);
    throw new BadRequestError('Failed to preview seeding operation', 500, ApiErrorCode.SERVER_ERROR);
  }
});
