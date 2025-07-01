import express from 'express';
import * as OAuthMockController from './OAuth.mock.controller';

export const oauthMockRouter = express.Router();

/**
 * Multi-Provider OAuth Mock Routes
 * These routes simulate OAuth endpoints for multiple providers (Google, Microsoft, Facebook)
 */

// ============================================================================
// Provider-Specific OAuth Routes
// ============================================================================

/**
 * @route GET /mock/oauth/:provider/authorize
 * @desc Generic OAuth authorization endpoint for any supported provider
 * @access Public (development/test only)
 * @params provider - OAuth provider (google, microsoft, facebook)
 * @query client_id, response_type, scope, state, redirect_uri, access_type, prompt, login_hint, include_granted_scopes
 */
oauthMockRouter.get('/:provider/authorize', OAuthMockController.mockOAuthAuthorize);

/**
 * @route POST /mock/oauth/:provider/token
 * @desc Generic OAuth token endpoint for any supported provider
 * @access Public (development/test only)
 * @params provider - OAuth provider (google, microsoft, facebook)
 * @body grant_type, code, client_id, client_secret, redirect_uri (for authorization_code)
 * @body grant_type, refresh_token, client_id, client_secret (for refresh_token)
 */
oauthMockRouter.post('/:provider/token', OAuthMockController.mockOAuthToken);

/**
 * @route GET /mock/oauth/:provider/userinfo
 * @desc Generic OAuth userinfo endpoint for any supported provider
 * @access Public (development/test only)
 * @params provider - OAuth provider (google, microsoft, facebook)
 * @headers Authorization: Bearer {access_token}
 */
oauthMockRouter.get('/:provider/userinfo', OAuthMockController.mockOAuthUserInfo);

/**
 * @route GET /mock/oauth/:provider/tokeninfo
 * @desc Generic OAuth tokeninfo endpoint for any supported provider
 * @access Public (development/test only)
 * @params provider - OAuth provider (google, microsoft, facebook)
 * @query access_token
 */
oauthMockRouter.get('/:provider/tokeninfo', OAuthMockController.mockOAuthTokenInfo);

/**
 * @route POST /mock/oauth/:provider/revoke
 * @desc Generic OAuth token revocation endpoint for any supported provider
 * @access Public (development/test only)
 * @params provider - OAuth provider (google, microsoft, facebook)
 * @body token
 */
oauthMockRouter.post('/:provider/revoke', OAuthMockController.mockOAuthRevoke);

/**
 * @route GET /mock/oauth/:provider/info
 */
oauthMockRouter.get('/:provider/info', OAuthMockController.getProviderInfo);

/**
 * @route GET /mock/oauth/status
 */
oauthMockRouter.get('/status', OAuthMockController.getOAuthMockStatus);

/**
 * @route GET /mock/oauth/clear
 */
oauthMockRouter.delete('/clear', OAuthMockController.clearOAuthMockCache);
/**
 * @route GET /mock/oauth/config
 */
oauthMockRouter.post('/config', OAuthMockController.updateOAuthMockConfig);
