import express from 'express';
import * as InternalController from './internal.controller';

const router = express.Router();

// Health check
router.get('/health', InternalController.healthCheck);

// ============================================================================
// Token Verification & Information Routes
// ============================================================================

/**
 * @route POST /internal/auth/verify-token
 * @desc Verify token and extract information (unified for local and OAuth)
 * @access Internal Services Only
 * @body { token: string, tokenType?: 'access' | 'refresh' }
 */
router.post('/auth/verify-token', InternalController.verifyAndExtractToken);

/**
 * @route POST /internal/auth/token-info
 * @desc Get token information without verification
 * @access Internal Services Only
 * @body { token: string, tokenType?: 'access' | 'refresh' }
 */
router.post('/auth/token-info', InternalController.getTokenInfo);

// ============================================================================
// User Information Routes
// ============================================================================

/**
 * @route GET /internal/users/:accountId
 * @desc Get user information by account ID
 * @access Internal Services Only
 */
router.get('/users/:accountId', InternalController.getUserById);

/**
 * @route GET /internal/users/search/email/:email
 * @desc Find user by email address (path parameter)
 * @access Internal Services Only
 */
router.get('/users/search/email/:email', InternalController.getUserByEmail);

/**
 * @route GET /internal/users/search
 * @desc Search user by email (query parameter)
 * @access Internal Services Only
 * @query email - Email address to search
 */
router.get('/users/search', InternalController.searchUserByEmail);

/**
 * @route GET /internal/users/:accountId/exists
 * @desc Check if user exists (lightweight validation)
 * @access Internal Services Only
 */
router.get('/users/:accountId/exists', InternalController.checkUserExists);

// ============================================================================
// Session Information Routes
// ============================================================================

/**
 * @route POST /internal/session/info
 * @desc Get session information from request
 * @access Internal Services Only
 * @body { sessionCookie?: string } (optional, reads from cookies by default)
 */
router.post('/session/info', InternalController.getSessionInfo);

/**
 * @route POST /internal/session/accounts
 * @desc Get session accounts data
 * @access Internal Services Only
 * @body { accountIds?: string[] } (optional, reads from session by default)
 */
router.post('/session/accounts', InternalController.getSessionAccountsData);

/**
 * @route POST /internal/session/validate
 * @desc Validate session and optionally check specific account
 * @access Internal Services Only
 * @body { accountId?: string } (optional account ID to validate)
 */
router.post('/session/validate', InternalController.validateSession);

export default router;
