import express from 'express';
import * as AuthController from './OAuth.controller';

export const authNotRequiredRouter = express.Router({ mergeParams: true });
export const authRequiredRouter = express.Router({ mergeParams: true });

/**
 * Common Google authentication route for all auth types
 */
authNotRequiredRouter.get('/auth/google', AuthController.initiateGoogleAuth);

/**
 * Signup route for all providers
 */
authNotRequiredRouter.get('/signup/:provider?', AuthController.signup);

/**
 * Signin route for all providers
 */
authNotRequiredRouter.get('/signin/:provider?', AuthController.signin);

/**
 * Callback route for OAuth providers
 */
authNotRequiredRouter.get('/callback/:provider', AuthController.handleCallback);

/**
 * Dedicated callback route for permission requests - focused only on token handling
 */
authNotRequiredRouter.get('/callback/permission/:provider', AuthController.handlePermissionCallback);

/**
 * Route specifically for re-requesting all previously granted scopes during sign-in flow
 */
authNotRequiredRouter.get('/permission/reauthorize', AuthController.reauthorizePermissions);

/**
 * Route to request permission for specific scope names
 * Now accepts scope names that get auto-converted to proper Google OAuth URLs
 *
 * Examples:
 * - GET /permission/gmail.readonly?accountId=123&redirectUrl=/dashboard
 * - GET /permission/gmail.readonly,calendar.events?accountId=123&redirectUrl=/dashboard
 * - GET /permission/["gmail.readonly","calendar.events"]?accountId=123&redirectUrl=/dashboard
 */
authNotRequiredRouter.get('/permission/:scopeNames', AuthController.requestPermission);

// Refresh token route
authRequiredRouter.post('/refresh', AuthController.refreshOAuthToken);

// Revoke tokens route
authRequiredRouter.post('/revoke', AuthController.revokeOAuthToken);

// Token information routes
authRequiredRouter.get('/token', AuthController.getOAuthTokenInfo);
authRequiredRouter.get('/refresh/token', AuthController.getOAuthRefreshTokenInfo);
