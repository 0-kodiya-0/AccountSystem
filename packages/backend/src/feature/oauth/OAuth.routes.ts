import express from 'express';
import {
  // URL Generation Functions (no auth required)
  generateSignupUrl,
  generateSigninUrl,
  generatePermissionUrl,
  generateReauthorizeUrl,

  // OAuth Callback Handlers (no auth required)
  handleOAuthCallback,
  handlePermissionCallback,

  // Authenticated OAuth Functions (require validateTokenAccess)
  refreshOAuthToken,
  getOAuthTokenInfo,
  getOAuthRefreshTokenInfo,
  revokeOAuthToken,
} from './OAuth.controller';

// ============================================================================
// Public OAuth Routes (No Authentication Required)
// ============================================================================

export const oauthPublicRouter = express.Router({ mergeParams: true });

// URL Generation Routes - Return authorization URLs for frontend
oauthPublicRouter.get('/signup/:provider', generateSignupUrl);
oauthPublicRouter.get('/signin/:provider', generateSigninUrl);
oauthPublicRouter.get('/permission/:scopeNames', generatePermissionUrl);
oauthPublicRouter.get('/reauthorize', generateReauthorizeUrl);

// OAuth Callback Routes - Handle code exchange from OAuth providers
oauthPublicRouter.post('/callback', handleOAuthCallback);
oauthPublicRouter.post('/permission/callback', handlePermissionCallback);

// ============================================================================
// Authenticated OAuth Routes (Require Authentication)
// ============================================================================

export const oauthAuthenticatedRouter = express.Router({ mergeParams: true });

// Token Management Routes
oauthAuthenticatedRouter.post('/refresh', refreshOAuthToken);
oauthAuthenticatedRouter.post('/revoke', revokeOAuthToken);

// Token Information Routes
oauthAuthenticatedRouter.get('/token', getOAuthTokenInfo);
oauthAuthenticatedRouter.get('/refresh/token', getOAuthRefreshTokenInfo);
