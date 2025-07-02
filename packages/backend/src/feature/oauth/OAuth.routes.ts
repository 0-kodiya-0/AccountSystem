import express from 'express';
import * as OAuthController from './OAuth.controller';

export const oauthPublicRouter = express.Router({ mergeParams: true });

/**
 * @route GET /oauth/signup/:provider
 * @desc Generate OAuth signup URL
 * @access Public
 * @query callbackUrl - URL to redirect after OAuth completion
 */
oauthPublicRouter.get('/signup/:provider', OAuthController.generateSignupUrl);

/**
 * @route GET /oauth/signin/:provider
 * @desc Generate OAuth signin URL
 * @access Public
 * @query callbackUrl - URL to redirect after OAuth completion
 */
oauthPublicRouter.get('/signin/:provider', OAuthController.generateSigninUrl);

/**
 * @route GET /oauth/permission/:provider
 * @desc Generate OAuth permission request URL
 * @access Public
 * @query accountId, callbackUrl, scopeNames - Required parameters
 */
oauthPublicRouter.get('/permission/:provider', OAuthController.generatePermissionUrl);

/**
 * @route GET /oauth/reauthorize/:provider
 * @desc Generate OAuth reauthorization URL
 * @access Public
 * @query accountId, callbackUrl - Required parameters
 */
oauthPublicRouter.get('/reauthorize/:provider', OAuthController.generateReauthorizeUrl);

/**
 * @route GET /oauth/callback/:provider
 * @desc Handle OAuth callback from provider
 * @access Public
 * @query code, state - OAuth callback parameters
 */
oauthPublicRouter.get('/callback/:provider', OAuthController.handleOAuthCallback);

/**
 * @route GET /oauth/permission/callback/:provider
 * @desc Handle OAuth permission callback
 * @access Public
 * @query code, state - OAuth callback parameters
 */
oauthPublicRouter.get('/permission/callback/:provider', OAuthController.handlePermissionCallback);
