import { NextFunction, Response, Request } from "express";
import { ApiErrorCode, AuthError, ServerError } from "../../../types/response.types";
import { hasScope } from "../services/token/token.services";
import { GoogleApiRequest } from "../types";
import { asyncHandler } from "../../../utils/response";
import { google } from "googleapis";
import { getGoogleClientId, getGoogleClientSecret } from "../../../config/env.config";
import { buildGoogleScopeUrl, buildGoogleScopeUrls } from "../config";

/**
 * Core middleware for Google API authentication
 * This middleware:
 * 1. Validates the session token
 * 2. Validates and refreshes the OAuth token if needed
 * 3. Creates a Google OAuth2 client
 * 4. Attaches the client to the request for downstream middleware and route handlers
 */
export const authenticateGoogleApi = asyncHandler(async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const accessToken = req.oauthAccessToken as string;

    // Create OAuth2 client with the valid token
    const oauth2Client = new google.auth.OAuth2(
        getGoogleClientId(),
        getGoogleClientSecret()
    );

    oauth2Client.setCredentials({
        access_token: accessToken
    });

    // Attach the Google Auth client to the request for use in route handlers
    const googleReq = req as GoogleApiRequest;
    googleReq.googleAuth = oauth2Client;

    next();
});

/**
 * Middleware to verify required scope URL
 * This middleware builds on authenticateGoogleApi and checks if the required scope is granted
 * 
 * @param requiredScopeUrl The exact scope URL required (e.g., 'https://www.googleapis.com/auth/gmail.readonly')
 */
export const requireGoogleScope = (requiredScopeUrl: string) => {
    return asyncHandler(async (req: GoogleApiRequest, res, next) => {
        // Ensure we have a Google client attached by authenticateGoogleApi
        if (!req.googleAuth) {
            throw new ServerError('Google API client not initialized', 500, ApiErrorCode.SERVER_ERROR);
        }

        // Basic validation of scope URL format
        if (!requiredScopeUrl || typeof requiredScopeUrl !== 'string' || requiredScopeUrl.trim().length === 0) {
            throw new ServerError('Invalid required scope configuration', 500, ApiErrorCode.SERVER_ERROR);
        }

        // Get the token from the OAuth client
        const credentials = req.googleAuth.credentials;
        const accessToken = credentials.access_token as string;

        const result = await hasScope(accessToken, requiredScopeUrl);

        if (!result) {
            // Send an error response with permission info
            throw new AuthError('Insufficient scope', 403, ApiErrorCode.INSUFFICIENT_SCOPE, {
                requiredPermission: {
                    requiredScope: requiredScopeUrl
                }
            });
        }

        // Token has the required scope, continue
        next();
    });
};

/**
 * Middleware to verify multiple required scope URLs
 * All scopes must be granted for the request to proceed
 * 
 * @param requiredScopeUrls Array of exact scope URLs required
 */
export const requireGoogleScopes = (requiredScopeUrls: string[]) => {
    return asyncHandler(async (req: GoogleApiRequest, res, next) => {
        // Ensure we have a Google client attached by authenticateGoogleApi
        if (!req.googleAuth) {
            throw new ServerError('Google API client not initialized', 500, ApiErrorCode.SERVER_ERROR);
        }

        // Basic validation of scope URLs
        if (!Array.isArray(requiredScopeUrls) || requiredScopeUrls.length === 0) {
            throw new ServerError('Invalid required scopes configuration', 500, ApiErrorCode.SERVER_ERROR);
        }

        // Get the token from the OAuth client
        const credentials = req.googleAuth.credentials;
        const accessToken = credentials.access_token as string;

        // Check all required scopes
        const scopeChecks = await Promise.all(
            requiredScopeUrls.map(async (scopeUrl) => ({
                scopeUrl,
                hasAccess: await hasScope(accessToken, scopeUrl)
            }))
        );

        const missingScopes = scopeChecks.filter(check => !check.hasAccess);

        if (missingScopes.length > 0) {
            // Send an error response with permission info
            throw new AuthError('Insufficient scopes', 403, ApiErrorCode.INSUFFICIENT_SCOPE, {
                requiredPermission: {
                    requiredScopes: requiredScopeUrls,
                    missingScopes: missingScopes.map(s => s.scopeUrl)
                }
            });
        }

        // Token has all required scopes, continue
        next();
    });
};

/**
 * Middleware to verify required scope by scope name
 * Converts scope name to URL and checks if the required scope is granted
 * 
 * @param scopeName The scope name (e.g., 'gmail.readonly', 'calendar.events')
 */
export const requireGoogleScopeName = (scopeName: string) => {
    return asyncHandler(async (req: GoogleApiRequest, res: Response, next: NextFunction) => {
        // Convert scope name to URL
        const requiredScopeUrl = buildGoogleScopeUrl(scopeName);

        // Use the existing scope URL middleware
        return requireGoogleScope(requiredScopeUrl)(req, res, next);
    });
};

/**
 * Middleware to verify multiple required scopes by scope names
 * Converts scope names to URLs and checks if all required scopes are granted
 * 
 * @param scopeNames Array of scope names
 */
export const requireGoogleScopeNames = (scopeNames: string[]) => {
    const requiredScopeUrls = buildGoogleScopeUrls(scopeNames);

    // Use the existing scope URLs middleware
    return requireGoogleScopes(requiredScopeUrls);
};

/**
 * Factory function for Google API routes that require a specific scope URL
 * Creates a middleware array with authentication and scope checking
 * 
 * @param requiredScopeUrl The exact scope URL required
 */
export const googleApiAuth = (requiredScopeUrl: string) => {
    return [
        authenticateGoogleApi,
        requireGoogleScope(requiredScopeUrl)
    ];
};

/**
 * Factory function for Google API routes that require a specific scope name
 * Creates a middleware array with authentication and scope checking
 * 
 * @param scopeName The scope name (e.g., 'gmail.readonly')
 */
export const googleApiAuthByName = (scopeName: string) => {
    return [
        authenticateGoogleApi,
        requireGoogleScopeName(scopeName)
    ];
};

/**
 * Factory function for Google API routes that require multiple scope URLs
 * Creates a middleware array with authentication and scope checking
 * 
 * @param requiredScopeUrls Array of exact scope URLs required
 */
export const googleApiAuthMultiple = (requiredScopeUrls: string[]) => {
    return [
        authenticateGoogleApi,
        requireGoogleScopes(requiredScopeUrls)
    ];
};

/**
 * Factory function for Google API routes that require multiple scope names
 * Creates a middleware array with authentication and scope checking
 * 
 * @param scopeNames Array of scope names required
 */
export const googleApiAuthByNames = (scopeNames: string[]) => {
    return [
        authenticateGoogleApi,
        requireGoogleScopeNames(scopeNames)
    ];
};