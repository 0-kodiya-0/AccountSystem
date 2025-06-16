import express from 'express';
import * as OAuthController from './OAuth.controller';

export const oauthPublicRouter = express.Router({ mergeParams: true });

// ============================================================================
// Public OAuth Routes (No Authentication Required)
// ============================================================================

// URL Generation Routes
oauthPublicRouter.get('/signup/:provider', OAuthController.generateSignupUrl);
oauthPublicRouter.get('/signin/:provider', OAuthController.generateSigninUrl);
oauthPublicRouter.get('/permission/:provider', OAuthController.generatePermissionUrl);
oauthPublicRouter.get('/reauthorize/:provider', OAuthController.generateReauthorizeUrl);

// OAuth Callback Routes
oauthPublicRouter.get('/callback/:provider', OAuthController.handleOAuthCallback);
oauthPublicRouter.get('/permission/callback/:provider', OAuthController.handlePermissionCallback);
