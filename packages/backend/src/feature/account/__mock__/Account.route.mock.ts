import express from 'express';
import * as AccountMockController from './Account.controller.mock';

// Create the mock account router
export const accountMockRouter = express.Router({ mergeParams: true });

/**
 * Account Mock Routes
 * Base path: /mock/account
 *
 * These routes provide development and testing utilities for account management.
 * They should only be available in non-production environments.
 */

// Health and configuration endpoints
accountMockRouter.get('/config', AccountMockController.getMockAccountConfig);
accountMockRouter.get('/stats', AccountMockController.getMockAccountStats);

// Search and preview endpoints
accountMockRouter.get('/search', AccountMockController.searchMockAccounts);
accountMockRouter.post('/preview-seed', AccountMockController.previewSeedMockAccounts);

// Seeding endpoints
accountMockRouter.post('/seed', AccountMockController.seedMockAccounts);

// CRUD operations for individual accounts
accountMockRouter.get('/:accountId', AccountMockController.getMockAccountById);
accountMockRouter.patch('/:accountId', AccountMockController.updateMockAccount);
accountMockRouter.delete('/:accountId', AccountMockController.deleteMockAccount);

// Bulk operations
accountMockRouter.get('/', AccountMockController.getAllMockAccounts);
accountMockRouter.post('/', AccountMockController.createMockAccount);
accountMockRouter.delete('/', AccountMockController.clearAllMockAccounts);

export default accountMockRouter;
