import express from 'express';
import * as TokenMockController from './Token.controller.mock';

export const tokenMockRouter = express.Router();

/**
 * Token Information & Status
 */

/**
 * @route GET /mock/token/status
 * @desc Get token mock status and current token information
 * @access Public (development/test only)
 */
tokenMockRouter.get('/info', TokenMockController.getTokenInfoMock);

/**
 * @route GET /mock/token/info/:accountId
 * @desc Get detailed token information for a specific account
 * @access Public (development/test only)
 * @param accountId - Account ID to get token info for
 */
tokenMockRouter.get('/info/:accountId', TokenMockController.getMockTokenInfo);

/**
 * Access Token Management
 */

/**
 * @route POST /mock/token/access/create
 * @desc Create a mock access token
 * @access Public (development/test only)
 * @body { accountId: string, accountType: AccountType, expiresIn?: number, oauthAccessToken?: string, setCookie?: boolean }
 */
tokenMockRouter.post('/access/create', TokenMockController.createMockAccessToken);

/**
 * Refresh Token Management
 */

/**
 * @route POST /mock/token/refresh/create
 * @desc Create a mock refresh token
 * @access Public (development/test only)
 * @body { accountId: string, accountType: AccountType, oauthRefreshToken?: string, setCookie?: boolean }
 */
tokenMockRouter.post('/refresh/create', TokenMockController.createMockRefreshToken);

/**
 * Token Pair Management
 */

/**
 * @route POST /mock/token/pair/create
 * @desc Create both access and refresh tokens for an account
 * @access Public (development/test only)
 * @body { accountId: string, accountType: AccountType, accessTokenExpiresIn?: number, oauthAccessToken?: string, oauthRefreshToken?: string, setCookies?: boolean }
 */
tokenMockRouter.post('/pair/create', TokenMockController.createMockTokenPair);

/**
 * Token Validation
 */

/**
 * @route POST /mock/token/validate
 * @desc Validate any token (access or refresh)
 * @access Public (development/test only)
 * @body { token: string }
 */
tokenMockRouter.post('/validate', TokenMockController.validateMockToken);

/**
 * Special Token Creation (for testing edge cases)
 */

/**
 * @route POST /mock/token/expired/create
 * @desc Create an expired token for testing
 * @access Public (development/test only)
 * @body { accountId: string, accountType: AccountType, tokenType?: 'access' | 'refresh', pastSeconds?: number }
 */
tokenMockRouter.post('/expired/create', TokenMockController.createExpiredMockToken);

/**
 * @route POST /mock/token/malformed/create
 * @desc Create a malformed token for testing error handling
 * @access Public (development/test only)
 * @body { type?: 'invalid_signature' | 'malformed_structure' | 'missing_parts' | 'empty_parts' | 'invalid_json' }
 */
tokenMockRouter.post('/malformed/create', TokenMockController.createMalformedMockToken);

/**
 * Token Cleanup
 */

/**
 * @route DELETE /mock/token/clear/:accountId
 * @desc Clear all tokens for a specific account
 * @access Public (development/test only)
 * @param accountId - Account ID to clear tokens for
 */
tokenMockRouter.delete('/clear/:accountId', TokenMockController.clearMockTokens);
