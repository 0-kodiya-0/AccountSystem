import { google } from 'googleapis';
import { ApiErrorCode, ProviderValidationError } from '../../../../types/response.types';
import { OAuthProviders } from '../../../account/Account.types';
import db from '../../../../config/db';
import { getGoogleClientId, getGoogleClientSecret, getNodeEnv } from '../../../../config/env.config';
import { getOAuthMockConfig } from '../../../../config/mock.config';
import { logger } from '../../../../utils/logger';
import { ValidationUtils } from '../../../../utils/validation';
import { oauthMockService } from '../../../../mocks/oauth/OAuthMockService';

/**
 * Check if we should use mock services
 */
function shouldUseMock(): boolean {
  const mockConfig = getOAuthMockConfig();
  const isProduction = getNodeEnv() === 'production';
  return !isProduction && mockConfig.enabled;
}

/**
 * Get detailed token information from Google (with mock support)
 */
export async function getGoogleTokenInfo(accessToken: string) {
  ValidationUtils.validateAccessToken(accessToken, 'getTokenInfo');

  if (shouldUseMock()) {
    // Use mock service
    const tokenInfo = oauthMockService.getTokenInfo(accessToken.trim(), OAuthProviders.Google);

    if (!tokenInfo) {
      throw new ProviderValidationError(
        OAuthProviders.Google,
        'Failed to validate access token (mock)',
        401,
        ApiErrorCode.TOKEN_INVALID,
      );
    }

    return tokenInfo;
  }

  try {
    const tokenInfoResult = await google.oauth2('v2').tokeninfo({
      access_token: accessToken.trim(),
    });

    return tokenInfoResult.data;
  } catch (error) {
    logger.error('Error getting token info:', error);
    throw new ProviderValidationError(
      OAuthProviders.Google,
      'Failed to validate access token',
      401,
      ApiErrorCode.TOKEN_INVALID,
    );
  }
}

/**
 * Get token scopes from Google (with mock support)
 */
export async function getGoogleTokenScopes(accessToken: string): Promise<string[]> {
  ValidationUtils.validateAccessToken(accessToken, 'getTokenScopes');

  if (shouldUseMock()) {
    // Use mock service
    const tokenInfo = oauthMockService.getTokenInfo(accessToken.trim(), OAuthProviders.Google);

    if (!tokenInfo) {
      throw new ProviderValidationError(
        OAuthProviders.Google,
        'Failed to get token scopes (mock)',
        401,
        ApiErrorCode.TOKEN_INVALID,
      );
    }

    return tokenInfo.scope ? tokenInfo.scope.split(' ') : [];
  }

  try {
    const tokenInfoResult = await google.oauth2('v2').tokeninfo({
      access_token: accessToken.trim(),
    });

    return tokenInfoResult.data.scope ? tokenInfoResult.data.scope.split(' ') : [];
  } catch (error) {
    logger.error('Error getting token scopes:', error);
    throw new ProviderValidationError(
      OAuthProviders.Google,
      'Failed to get token scopes',
      401,
      ApiErrorCode.TOKEN_INVALID,
    );
  }
}

/**
 * Update Google permissions for an account (with mock support)
 */
export async function updateAccountScopes(accountId: string, accessToken: string): Promise<string[]> {
  ValidationUtils.validateObjectIdWithContext(accountId, 'Account ID', 'updateAccountScopes');
  ValidationUtils.validateAccessToken(accessToken, 'updateAccountScopes');

  try {
    // Get token info for scopes
    const tokenInfo = await getGoogleTokenInfo(accessToken);
    const grantedScopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : [];

    if (grantedScopes.length === 0) {
      return [];
    }

    // Get database models
    const models = await db.getModels();

    // Check if permissions already exist
    const existingPermissions = await models.google.GooglePermissions.findOne({
      accountId,
    });

    if (existingPermissions) {
      // Check if there are new scopes to add
      const existingScopeSet = new Set(existingPermissions.scopes);
      const newScopes = grantedScopes.filter((scope) => !existingScopeSet.has(scope));

      if (newScopes.length > 0) {
        (existingPermissions as any).addScopes(newScopes);
        await existingPermissions.save();
      }
    } else {
      // Create new permissions record
      await models.google.GooglePermissions.create({
        accountId,
        scopes: grantedScopes,
        lastUpdated: new Date().toISOString(),
      });
    }

    return grantedScopes;
  } catch (error) {
    logger.error('Error updating account scopes:', error);
    throw new ProviderValidationError(
      OAuthProviders.Google,
      'Failed to update account scopes',
      500,
      ApiErrorCode.SERVER_ERROR,
    );
  }
}

/**
 * Get all previously granted scopes for an account from GooglePermissions
 */
export async function getGoogleAccountScopes(accountId: string): Promise<string[]> {
  try {
    const models = await db.getModels();

    const permissions = await models.google.GooglePermissions.findOne({
      accountId,
    });

    if (!permissions) {
      return [];
    }

    return permissions.scopes;
  } catch (error) {
    logger.error('Error getting account scopes:', error);
    return [];
  }
}

/**
 * Refresh an access token using a refresh token (with mock support)
 */
export async function refreshGoogleToken(refreshToken: string) {
  ValidationUtils.validateRefreshToken(refreshToken, 'refreshGoogleToken');

  if (shouldUseMock()) {
    // Use mock service
    const tokens = oauthMockService.refreshAccessToken(refreshToken.trim(), OAuthProviders.Google);

    if (!tokens) {
      throw new ProviderValidationError(
        OAuthProviders.Google,
        'Failed to refresh access token (mock)',
        401,
        ApiErrorCode.TOKEN_INVALID,
      );
    }

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: Date.now() + tokens.expires_in * 1000,
    };
  }

  try {
    const refreshClient = new google.auth.OAuth2(getGoogleClientId(), getGoogleClientSecret());

    refreshClient.setCredentials({ refresh_token: refreshToken.trim() });
    const { credentials } = await refreshClient.refreshAccessToken();

    if (!credentials.access_token || !credentials.expiry_date) {
      throw new Error('Missing required token details in refresh response');
    }

    return credentials;
  } catch (error) {
    logger.error('Error refreshing access token:', error);
    throw new ProviderValidationError(
      OAuthProviders.Google,
      'Failed to refresh access token',
      401,
      ApiErrorCode.TOKEN_INVALID,
    );
  }
}

/**
 * Revoke multiple Google OAuth tokens (with mock support)
 */
export async function revokeGoogleTokens(tokens: (string | undefined)[]) {
  if (!tokens || tokens.length === 0) {
    throw new Error('No tokens provided for revocation');
  }

  if (shouldUseMock()) {
    // Use mock service
    const results = {
      totalTokens: tokens.length,
      successfulRevocations: 0,
      failedRevocations: 0,
      errors: [] as string[],
    };

    for (const token of tokens) {
      if (!token || !token.trim()) {
        results.failedRevocations++;
        results.errors.push('Empty or invalid token provided');
        continue;
      }

      try {
        const success = oauthMockService.revokeToken(token.trim(), OAuthProviders.Google);
        if (success) {
          results.successfulRevocations++;
          logger.info(`Successfully revoked mock token: ${token.substring(0, 10)}...`);
        } else {
          results.failedRevocations++;
          results.errors.push(`Failed to revoke mock token ${token.substring(0, 10)}...: Token not found`);
        }
      } catch (error) {
        results.failedRevocations++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Failed to revoke mock token ${token.substring(0, 10)}...: ${errorMessage}`);
        logger.error(`Error revoking mock token ${token.substring(0, 10)}...:`, error);
      }
    }

    logger.info(
      `Mock token revocation completed: ${results.successfulRevocations}/${results.totalTokens} tokens successfully revoked`,
    );

    if (results.successfulRevocations === 0) {
      throw new Error(
        `Failed to revoke any of the ${tokens.length} provided mock tokens. Errors: ${results.errors.join(', ')}`,
      );
    }

    return results;
  }

  try {
    const oAuth2Client = new google.auth.OAuth2(getGoogleClientId(), getGoogleClientSecret());

    const results = {
      totalTokens: tokens.length,
      successfulRevocations: 0,
      failedRevocations: 0,
      errors: [] as string[],
    };

    // Revoke each token
    for (const token of tokens) {
      if (!token || !token.trim()) {
        results.failedRevocations++;
        results.errors.push('Empty or invalid token provided');
        continue;
      }

      try {
        await oAuth2Client.revokeToken(token.trim());
        results.successfulRevocations++;
        logger.info(`Successfully revoked token: ${token.substring(0, 10)}...`);
      } catch (error) {
        results.failedRevocations++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Failed to revoke token ${token.substring(0, 10)}...: ${errorMessage}`);
        logger.error(`Error revoking token ${token.substring(0, 10)}...:`, error);
      }
    }

    logger.info(
      `Token revocation completed: ${results.successfulRevocations}/${results.totalTokens} tokens successfully revoked`,
    );

    if (results.successfulRevocations === 0) {
      throw new Error(
        `Failed to revoke any of the ${tokens.length} provided tokens. Errors: ${results.errors.join(', ')}`,
      );
    }

    return results;
  } catch (error) {
    logger.error('Error during token revocation:', error);
    throw new ProviderValidationError(OAuthProviders.Google, 'Failed to revoke tokens', 500, ApiErrorCode.SERVER_ERROR);
  }
}

/**
 * Helper function to check if a user has additional scopes in GooglePermissions
 * that aren't included in their current access token
 */
export async function checkForAdditionalGoogleScopes(
  accountId: string,
  accessToken: string,
): Promise<{
  needsAdditionalScopes: boolean;
  missingScopes: string[];
}> {
  // Get scopes from the current token
  const tokenInfo = await getGoogleTokenInfo(accessToken);
  const currentScopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : [];

  // Get previously granted scopes from GooglePermissions
  const storedScopes = await getGoogleAccountScopes(accountId);

  // Only care about missing scopes that aren't the basic profile and email
  const filteredStoredScopes = storedScopes.filter(
    (scope) => !scope.includes('auth/userinfo.email') && !scope.includes('auth/userinfo.profile') && scope !== 'openid',
  );

  // Find scopes that are in GooglePermissions but not in the current token
  const missingScopes = filteredStoredScopes.filter((scope) => !currentScopes.includes(scope));

  return {
    needsAdditionalScopes: missingScopes.length > 0,
    missingScopes,
  };
}

/**
 * Verifies that the token belongs to the correct user account (with mock support)
 */
export async function verifyGoogleTokenOwnership(
  accessToken: string,
  accountId: string,
): Promise<{ isValid: boolean; reason?: string }> {
  try {
    const models = await db.getModels();

    const account = await models.accounts.Account.findOne({ _id: accountId });

    if (!account) {
      return { isValid: false, reason: 'Account not found' };
    }

    const expectedEmail = account.userDetails.email;

    if (!expectedEmail) {
      return { isValid: false, reason: 'Account missing email' };
    }

    if (shouldUseMock()) {
      // Use mock service
      const userInfo = oauthMockService.getUserInfo(accessToken, OAuthProviders.Google);

      if (!userInfo) {
        return { isValid: false, reason: 'Could not get user info from mock token' };
      }

      if (userInfo.email.toLowerCase() !== expectedEmail.toLowerCase()) {
        return {
          isValid: false,
          reason: `Mock token email (${userInfo.email}) does not match account email (${expectedEmail})`,
        };
      }

      return { isValid: true };
    }

    // Use real Google API
    const googleAuth = new google.auth.OAuth2(getGoogleClientId(), getGoogleClientSecret());

    googleAuth.setCredentials({ access_token: accessToken });

    const oauth2 = google.oauth2({
      auth: googleAuth,
      version: 'v2',
    });

    const userInfo = await oauth2.userinfo.get();

    if (!userInfo.data.email) {
      return { isValid: false, reason: 'Could not get email from token' };
    }

    if (userInfo.data.email.toLowerCase() !== expectedEmail.toLowerCase()) {
      return {
        isValid: false,
        reason: `Token email (${userInfo.data.email}) does not match account email (${expectedEmail})`,
      };
    }

    return { isValid: true };
  } catch (error) {
    logger.error('Error verifying token ownership:', error);
    return { isValid: false, reason: 'Error verifying token ownership' };
  }
}

/**
 * Exchange Google authorization code for tokens (with mock support)
 */
export async function exchangeGoogleCode(code: string, redirectUri: string) {
  if (shouldUseMock()) {
    // Use mock service
    const result = oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Google);

    if (!result) {
      throw new Error('Invalid or expired authorization code (mock)');
    }

    const { tokens, userInfo } = result;

    return {
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: Date.now() + tokens.expires_in * 1000,
      },
      userInfo: {
        email: userInfo.email,
        name: userInfo.name,
        imageUrl: userInfo.picture,
        provider: OAuthProviders.Google,
      },
    };
  }

  // Use real Google OAuth
  const oAuth2Client = new google.auth.OAuth2(getGoogleClientId(), getGoogleClientSecret(), redirectUri);

  const { tokens } = await oAuth2Client.getToken(code);

  if (!tokens.access_token) {
    throw new Error('Missing access token in Google OAuth response');
  }

  // Get user info using the access token
  oAuth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
  const userInfoResponse = await oauth2.userinfo.get();

  const userInfo = {
    email: userInfoResponse.data.email,
    name: userInfoResponse.data.name,
    imageUrl: userInfoResponse.data.picture,
    provider: OAuthProviders.Google,
  };

  return {
    tokens: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    },
    userInfo,
  };
}
