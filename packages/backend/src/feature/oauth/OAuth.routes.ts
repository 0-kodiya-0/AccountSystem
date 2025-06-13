import express from 'express';
import * as OAuthController from './OAuth.controller';

// ============================================================================
// Public OAuth Routes (No Authentication Required)
// ============================================================================

export const oauthPublicRouter = express.Router({ mergeParams: true });

// URL Generation Routes - Return authorization URLs for frontend
oauthPublicRouter.get('/signup/:provider', OAuthController.generateSignupUrl);
oauthPublicRouter.get('/signin/:provider', OAuthController.generateSigninUrl);
oauthPublicRouter.get('/permission/:provider', OAuthController.generatePermissionUrl);
oauthPublicRouter.get('/reauthorize/:provider', OAuthController.generateReauthorizeUrl);

// OAuth Callback Routes - Handle code exchange from OAuth providers
oauthPublicRouter.post('/callback/:provider', OAuthController.handleOAuthCallback);
oauthPublicRouter.post('/permission/callback/:provider', OAuthController.handlePermissionCallback);

// ============================================================================
// Authenticated OAuth Routes (Require Authentication)
// ============================================================================

export const oauthAuthenticatedRouter = express.Router({ mergeParams: true });

// Token Management Routes
oauthAuthenticatedRouter.get('/refresh', OAuthController.refreshOAuthToken);
oauthAuthenticatedRouter.post('/revoke', OAuthController.revokeOAuthToken);

// Token Information Routes
oauthAuthenticatedRouter.get('/token', OAuthController.getOAuthTokenInfo);
oauthAuthenticatedRouter.get('/refresh/token', OAuthController.getOAuthRefreshTokenInfo);
