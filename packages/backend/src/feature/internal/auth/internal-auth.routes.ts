import express from 'express';
import * as InternalAuthController from './internal-auth.controller';

const router = express.Router({ mergeParams: true });

/**
 * User Information Routes
 */

/**
 * @route GET /internal/auth/users/:accountId
 * @desc Get user information (without sensitive data)
 * @access Internal Services Only
 */
router.get('/users/:accountId', InternalAuthController.getUserInfo);

/**
 * @route GET /internal/auth/users/search
 * @desc Search user by email
 * @access Internal Services Only
 * @query email - Email address to search
 */
router.get('/users/search', InternalAuthController.searchUserByEmail);

/**
 * @route GET /internal/auth/users/:accountId/scopes
 * @desc Get user's Google scopes
 * @access Internal Services Only
 */
router.get('/users/:accountId/scopes', InternalAuthController.getUserScopes);

/**
 * Session Validation Routes
 */

/**
 * @route POST /internal/auth/session/validate
 * @desc Validate session token and return account info
 * @access Internal Services Only
 * @body { accountId: string, accessToken?: string, refreshToken?: string }
 */
router.post('/session/validate', InternalAuthController.validateSession);

/**
 * Google API Validation Routes
 */

/**
 * @route POST /internal/auth/google/validate
 * @desc Validate Google API access and required scopes
 * @access Internal Services Only
 * @body { accountId: string, accessToken: string, requiredScopes?: string[] }
 */
router.post('/google/validate', InternalAuthController.validateGoogleAccess);

/**
 * @route POST /internal/auth/google/token/verify
 * @desc Verify Google token ownership
 * @access Internal Services Only
 * @body { accountId: string, accessToken: string }
 */
router.post('/google/token/verify', InternalAuthController.verifyGoogleToken);

/**
 * @route GET /internal/auth/google/token/info/:accountId
 * @desc Get Google token information
 * @access Internal Services Only
 */
router.get('/google/token/info/:accountId', InternalAuthController.getGoogleTokenInfo);

export default router;