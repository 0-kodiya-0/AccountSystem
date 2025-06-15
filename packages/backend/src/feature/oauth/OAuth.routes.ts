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
oauthPublicRouter.get('/callback/:provider', OAuthController.handleOAuthCallback);
oauthPublicRouter.get('/permission/callback/:provider', OAuthController.handlePermissionCallback);

// Two-Factor Authentication Routes for OAuth (Public - uses temp tokens)
oauthPublicRouter.post('/verify-two-factor', OAuthController.verifyOAuthTwoFactor);

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

// ============================================================================
// OAuth Two-Factor Authentication Routes (Require Authentication)
// ============================================================================

/**
 * @route POST /:accountId/oauth/setup-two-factor
 * @desc Set up two-factor authentication for OAuth account
 * @access Private (requires valid OAuth token)
 * @body { enableTwoFactor: boolean }
 */
oauthAuthenticatedRouter.post('/setup-two-factor', OAuthController.setupOAuthTwoFactor);

/**
 * @route POST /:accountId/oauth/verify-two-factor-setup
 * @desc Verify and enable two-factor authentication for OAuth account
 * @access Private (requires valid OAuth token)
 * @body { token: string }
 */
oauthAuthenticatedRouter.post('/verify-two-factor-setup', OAuthController.verifyAndEnableOAuthTwoFactor);

/**
 * @route POST /:accountId/oauth/generate-backup-codes
 * @desc Generate new backup codes for OAuth account with 2FA
 * @access Private (requires valid OAuth token)
 */
oauthAuthenticatedRouter.post('/generate-backup-codes', OAuthController.generateOAuthBackupCodes);
