import express from 'express';
import * as TokenController from './Token.controller';

export const tokenRouter = express.Router({ mergeParams: true });

/**
 * @route GET /:accountId/tokens/access/info
 * @desc Get access token information
 * @access Private
 */
tokenRouter.get('/access/info', TokenController.getAccessTokenInfo);

/**
 * @route GET /:accountId/tokens/refresh/info
 * @desc Get refresh token information
 * @access Private
 */
tokenRouter.get('/refresh/info', TokenController.getRefreshTokenInfo);

/**
 * @route POST /:accountId/tokens/refresh
 * @desc Refresh access token (unified for local and OAuth)
 * @access Private
 */
tokenRouter.get('/refresh', TokenController.refreshAccessToken);

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
