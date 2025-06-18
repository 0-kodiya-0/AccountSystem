import { google } from 'googleapis';
import { ApiErrorCode, ProviderValidationError } from '../../../../types/response.types';
import { OAuthProviders } from '../../../account/Account.types';
import db from '../../../../config/db';
import { getGoogleClientId, getGoogleClientSecret } from '../../../../config/env.config';
import { logger } from '../../../../utils/logger';
import { ValidationUtils } from '../../../../utils/validation';

/**
 * Get detailed token information from Google
 * @param accessToken The access token to check
 */
export async function getGoogleTokenInfo(accessToken: string) {
  ValidationUtils.validateAccessToken(accessToken, 'getTokenInfo');

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
 * Get token scopes from Google
 * @param accessToken The access token to check
 * @returns Array of granted scope URLs
 */
export async function getGoogleTokenScopes(accessToken: string): Promise<string[]> {
  ValidationUtils.validateAccessToken(accessToken, 'getTokenScopes');

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
 * Update Google permissions for an account
 * @param accountId The account ID to update
 * @param accessToken The access token containing scopes
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
 * @param accountId The account ID to check
 */
export async function getGoogleAccountScopes(accountId: string): Promise<string[]> {
  try {
    // Get database models
    const models = await db.getModels();

    // Retrieve the permissions
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
 * Refresh an access token using a refresh token
 * @param refreshToken The refresh token to use
 */
export async function refreshGoogleToken(refreshToken: string) {
  ValidationUtils.validateRefreshToken(refreshToken, 'refreshGoogleToken');

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
 * Revoke multiple Google OAuth tokens
 * @param tokens Array of tokens to revoke (can be access or refresh tokens)
 */
export async function revokeGoogleTokens(tokens: (string | undefined)[]) {
  if (!tokens || tokens.length === 0) {
    throw new Error('No tokens provided for revocation');
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

    // Log summary
    logger.info(
      `Token revocation completed: ${results.successfulRevocations}/${results.totalTokens} tokens successfully revoked`,
    );

    // Throw error if no tokens were successfully revoked
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
 * Verifies that the token belongs to the correct user account
 *
 * @param accessToken The access token to verify
 * @param accountId The account ID that should own this token
 * @returns Object indicating if the token is valid and reason if not
 */
export async function verifyGoogleTokenOwnership(
  accessToken: string,
  accountId: string,
): Promise<{ isValid: boolean; reason?: string }> {
  try {
    // Get the models
    const models = await db.getModels();

    // Get the account that should own this token
    const account = await models.accounts.Account.findOne({ _id: accountId });

    if (!account) {
      return { isValid: false, reason: 'Account not found' };
    }

    // Get the email from the account
    const expectedEmail = account.userDetails.email;

    if (!expectedEmail) {
      return { isValid: false, reason: 'Account missing email' };
    }

    // Get user information from the token
    const googleAuth = new google.auth.OAuth2(getGoogleClientId(), getGoogleClientSecret());

    googleAuth.setCredentials({ access_token: accessToken });

    // Get the user info using the oauth2 API
    const oauth2 = google.oauth2({
      auth: googleAuth,
      version: 'v2',
    });

    const userInfo = await oauth2.userinfo.get();

    if (!userInfo.data.email) {
      return { isValid: false, reason: 'Could not get email from token' };
    }

    // Compare emails
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
 * Exchange Google authorization code for tokens
 * @param code Authorization code from Google
 * @param redirectUri The redirect URI that was used in the authorization request
 */
export async function exchangeGoogleCode(code: string, redirectUri: string) {
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
