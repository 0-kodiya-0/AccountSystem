import express from 'express';
import * as TokenController from './Token.controller';

export const tokenRouter = express.Router({ mergeParams: true });

/**
 * @route GET /:accountId/tokens/status
 * @desc Get comprehensive token status for account
 * @access Private
 */
tokenRouter.get('/status', TokenController.getTokenStatus);

/**
 * @route GET /:accountId/tokens/access
 * @desc Get access token information
 * @access Private
 */
tokenRouter.get('/access', TokenController.getAccessTokenInfo);

/**
 * @route GET /:accountId/tokens/refresh
 * @desc Get refresh token information
 * @access Private
 */
tokenRouter.get('/refresh', TokenController.getRefreshTokenInfo);

/**
 * @route POST /:accountId/tokens/refresh
 * @desc Refresh access token (unified for local and OAuth)
 * @access Private
 */
tokenRouter.post('/refresh', TokenController.refreshAccessToken);

/**
 * @route POST /:accountId/tokens/revoke
 * @desc Revoke tokens (unified for local and OAuth)
 * @access Private
 */
tokenRouter.post('/revoke', TokenController.revokeTokens);

/**
 * @route POST /:accountId/tokens/validate
 * @desc Validate token ownership and get info
 * @access Private
 * @body { token: string, tokenType?: 'access' | 'refresh' }
 */
tokenRouter.post('/validate', TokenController.validateToken);
