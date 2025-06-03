import { ApiErrorCode, AuthError, BadRequestError, JsonSuccess, ServerError } from '../../../../types/response.types';
import { GoogleApiRequest } from '../../types';
import { getTokenInfo, getTokenScopes, hasScope } from '../../services/token';
import { buildGoogleScopeUrls, validateScopeNames } from '../../config';
import { asyncHandler } from '../../../../utils/response';

/**
 * Get token information for the current user
 * This endpoint retrieves detailed information about the token including granted scopes
 */
export const getTokenInfoController = asyncHandler(async (req: GoogleApiRequest, res, next) => {
    // Ensure we have a Google client attached by the middleware
    if (!req.googleAuth) {
        throw new ServerError('Google API client not initialized');
    }

    // Get the token from the OAuth client
    const credentials = req.googleAuth.credentials;
    const accessToken = credentials.access_token;

    if (!accessToken) {
        throw new AuthError('Access token not available', 401, ApiErrorCode.TOKEN_INVALID);
    }

    // Get token info and scopes using the service functions
    const tokenInfo = await getTokenInfo(accessToken);
    const grantedScopes = await getTokenScopes(accessToken);

    // Create a response with token info and scopes
    const response = {
        tokenInfo,
        grantedScopes,
        scopeCount: grantedScopes.length
    };

    next(new JsonSuccess(response));
});

/**
 * Check if the token has access to specific scope names
 * @param req Request with scopes query parameter (can be single scope name or array)
 * @param res Response
 * @returns Response indicating whether the token has access to the specified scopes
 */
export const checkScopeAccess = asyncHandler(async (req: GoogleApiRequest, res, next) => {
    // Get scope names from query parameters
    const { scopes, scope } = req.query;

    // Determine scope names to check
    let scopeNamesToCheck: string[] = [];

    if (scopes) {
        try {
            // Parse the JSON array of scope names
            scopeNamesToCheck = JSON.parse(scopes.toString());
            if (!Array.isArray(scopeNamesToCheck)) {
                scopeNamesToCheck = [];
            }
        } catch {
            // Try treating it as a comma-separated string if JSON parsing fails
            scopeNamesToCheck = scopes.toString().split(',').map(s => s.trim());
        }
    } else if (scope) {
        // Fall back to single scope
        scopeNamesToCheck = [scope.toString().trim()];
    }

    if (scopeNamesToCheck.length === 0) {
        throw new BadRequestError('At least one scope is required. Use "scopes" (JSON array) or "scope" (single scope) query parameter');
    }

    // Basic validation of scope name format
    const validation = validateScopeNames(scopeNamesToCheck);
    if (!validation.valid) {
        throw new BadRequestError(`Invalid scope name format: ${validation.errors.join(', ')}`);
    }

    // Ensure we have a Google client attached by the middleware
    if (!req.googleAuth) {
        throw new ServerError('Google API client not initialized');
    }

    // Get the token from the OAuth client
    const credentials = req.googleAuth.credentials;
    const accessToken = credentials.access_token;

    if (!accessToken) {
        throw new AuthError('Access token not available', 401, ApiErrorCode.TOKEN_INVALID);
    }

    // Convert scope names to URLs and check access
    const requestedScopeUrls = buildGoogleScopeUrls(scopeNamesToCheck);
    
    // Check each requested scope using the service function
    const results: Record<string, { hasAccess: boolean; scopeName: string; scopeUrl: string }> = {};

    for (let i = 0; i < requestedScopeUrls.length; i++) {
        const scopeUrl = requestedScopeUrls[i];
        const scopeName = scopeNamesToCheck[i];
        const hasAccess = await hasScope(accessToken, scopeUrl);
        
        results[`scope_${i}`] = {
            hasAccess,
            scopeName,
            scopeUrl
        };
    }

    // Provide a summary
    const allGranted = Object.values(results).every(result => result.hasAccess);
    const grantedCount = Object.values(results).filter(result => result.hasAccess).length;

    next(new JsonSuccess({
        summary: {
            totalRequested: scopeNamesToCheck.length,
            totalGranted: grantedCount,
            allGranted
        },
        requestedScopeNames: scopeNamesToCheck,
        requestedScopeUrls,
        results
    }));
});