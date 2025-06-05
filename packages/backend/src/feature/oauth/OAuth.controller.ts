import passport from 'passport';
import {
    ApiErrorCode,
    BadRequestError,
    NotFoundError,
    RedirectError,
    RedirectSuccess
} from '../../types/response.types';
import * as AuthService from './OAuth.service';
import { AuthType, AuthUrls, OAuthState, PermissionState, ProviderResponse, SignInState } from './OAuth.types';
import { OAuthProviders } from '../account/Account.types';
import {
    validateOAuthState,
    validateSignInState,
    validateSignUpState,
    validatePermissionState,
    validateProvider,
    validateState,
} from './OAuth.validation';
import {
    clearOAuthState,
    clearSignInState,
    clearSignUpState,
    generateOAuthState,
    generatePermissionState
} from './OAuth.utils';
import {
    getTokenInfo,
    verifyTokenOwnership
} from '../google/services/token';
import { setAccessTokenCookie, setRefreshTokenCookie } from '../../services';
import { createRedirectUrl, RedirectType } from '../../utils/redirect';
import { SignUpRequest, SignInRequest, OAuthCallBackRequest } from './OAuth.dto';
import { ValidationUtils } from '../../utils/validation';
import { buildGoogleScopeUrls, validateScopeNames } from '../google/config';
import { asyncHandler } from '../../utils/response';
import { logger } from '../../utils/logger';

/**
 * Initiate Google authentication
 */
export const initiateGoogleAuth = asyncHandler(async (req, res, next) => {
    const { state } = req.query;

    await validateState(state as string,
        (state) => validateOAuthState(state, OAuthProviders.Google),
        res
    );

    // Default Google authentication options
    const authOptions = {
        scope: ['profile', 'email'],
        state: state as string,
        accessType: 'offline',
        prompt: 'consent'
    };

    // Pass control to passport middleware
    passport.authenticate('google', authOptions)(req, res, next);
});

/**
 * Handle sign up process
 */
export const signup = asyncHandler(async (req: SignUpRequest, res, next) => {
    const frontendRedirectUrl = req.query.redirectUrl as string;
    const provider = req.params.provider as OAuthProviders;

    if (!frontendRedirectUrl) {
        throw new BadRequestError("Missing redirectUrl query parameter");
    }

    if (!validateProvider(provider, res)) {
        throw new RedirectError(ApiErrorCode.INVALID_PROVIDER, frontendRedirectUrl, 'Invalid provider');
    }

    const reqState = req.query.state;
    if (reqState && typeof reqState === 'string') {
        const stateDetails = await validateState(reqState, validateSignUpState, res) as SignInState;

        try {
            const result = await AuthService.processSignup(stateDetails, provider);
            await clearSignUpState(stateDetails.state);

            if (result.accessTokenInfo && result.accessTokenInfo.expires_in) {
                setAccessTokenCookie(
                    res,
                    result.accountId,
                    result.accessToken, // This is now our JWT token that wraps the OAuth token
                    result.accessTokenInfo.expires_in * 1000
                );

                if (result.refreshToken) {
                    setRefreshTokenCookie(res, result.accountId, result.refreshToken); // This is our JWT refresh token
                }
            }

            // Use the stored redirect URL if available, otherwise use the default
            const redirectTo = stateDetails.redirectUrl || frontendRedirectUrl;

            next(new RedirectSuccess({
                accountId: result.accountId,
                name: result.name
            }, redirectTo));

            return;
        } catch (error) {
            logger.error(error);
            throw new RedirectError(ApiErrorCode.SERVER_ERROR, frontendRedirectUrl, 'Database operation failed');
        }
    }

    const generatedState = await generateOAuthState(provider as OAuthProviders, AuthType.SIGN_UP, frontendRedirectUrl);
    const authUrls: AuthUrls = {
        [OAuthProviders.Google]: '/auth/google',
        [OAuthProviders.Microsoft]: '/auth/microsoft',
        [OAuthProviders.Facebook]: '/auth/facebook',
    };

    next(new RedirectSuccess({ state: generatedState }, authUrls[provider], 302, "State generated", frontendRedirectUrl));
});

/**
 * Handle sign in process
 */
export const signin = asyncHandler(async (req: SignInRequest, res, next) => {
    const frontendRedirectUrl = req.query.redirectUrl as string;
    const provider = req.params.provider as OAuthProviders;
    const { state } = req.query;

    if (!frontendRedirectUrl) {
        throw new BadRequestError("Missing redirectUrl query parameter");
    }

    if (!validateProvider(provider, res)) {
        throw new BadRequestError('Invalid provider');
    }

    if (state && typeof state === 'string') {
        const stateDetails = await validateState(state, validateSignInState, res) as SignInState;

        try {
            const result = await AuthService.processSignIn(stateDetails, frontendRedirectUrl);
            await clearSignInState(stateDetails.state);

            if (result.accessTokenInfo && result.accessTokenInfo.expires_in) {
                setAccessTokenCookie(
                    res,
                    result.userId,
                    result.accessToken, // This is now our JWT token that wraps the OAuth token
                    result.accessTokenInfo.expires_in * 1000
                );

                if (result.refreshToken) {
                    setRefreshTokenCookie(res, result.userId, result.refreshToken); // This is our JWT refresh token
                }
            }

            // Handle additional scopes
            if (result.needsAdditionalScopes) {
                const redirectTo = createRedirectUrl(req, stateDetails.redirectUrl || frontendRedirectUrl, {
                    type: RedirectType.SUCCESS,
                    data: {
                        accountId: result.userId,
                        name: result.userName
                    }
                });

                next(new RedirectSuccess({
                    accountId: result.userId,
                    name: result.userName,
                    skipRedirectUrl: redirectTo
                }, '/auth/permission-confirmation', undefined, undefined, `/oauth/permission/reauthorize?redirectUrl=${redirectTo}`));
            } else {
                // No additional scopes needed, continue with normal flow
                const redirectTo = stateDetails.redirectUrl || frontendRedirectUrl;

                next(new RedirectSuccess({
                    accountId: result.userId,
                    name: result.userName
                }, redirectTo));
            }

            return;
        } catch (error) {
            logger.error(error);
            throw new RedirectError(ApiErrorCode.DATABASE_ERROR, frontendRedirectUrl, 'Failed to validate state');
        }
    }

    const generatedState = await generateOAuthState(provider as OAuthProviders, AuthType.SIGN_IN, frontendRedirectUrl);
    const authUrls: AuthUrls = {
        [OAuthProviders.Google]: '/auth/google',
        [OAuthProviders.Microsoft]: '/auth/microsoft',
        [OAuthProviders.Facebook]: '/auth/facebook',
    };

    next(new RedirectSuccess({ state: generatedState }, authUrls[provider], 302, undefined, frontendRedirectUrl));
});

/**
 * Handle callback from OAuth provider
 */
export const handleCallback = asyncHandler(async (req: OAuthCallBackRequest, res, next) => {
    const provider = req.params.provider;
    const stateFromProvider = req.query.state;

    if (!validateProvider(provider, res)) {
        throw new BadRequestError('Invalid provider');
    }

    const stateDetails = await validateState(
        stateFromProvider,
        (state) => validateOAuthState(state, provider as OAuthProviders),
        res
    ) as OAuthState;

    // Extract redirect URL from state
    const redirectUrl = stateDetails.redirectUrl || '/';

    await clearOAuthState(stateDetails.state);

    passport.authenticate(provider as OAuthProviders, { session: false }, async (err: Error | null, userData: ProviderResponse) => {
        try {
            if (err) {
                return next(new RedirectError(ApiErrorCode.AUTH_FAILED, redirectUrl, 'Authentication failed'));
            }

            if (!userData) {
                return next(new RedirectError(ApiErrorCode.AUTH_FAILED, redirectUrl, 'Authentication failed - no user data'));
            }

            const result = await AuthService.processSignInSignupCallback(userData, stateDetails, redirectUrl);

            if (result.authType === AuthType.SIGN_UP) {
                next(new RedirectSuccess({ state: result.state },
                    `/signup/${provider}`,
                    302,
                    "User authenticated by provider", redirectUrl));
            } else {
                next(new RedirectSuccess({ state: result.state },
                    `/signin/${provider}`,
                    302,
                    "User authenticated by provider", redirectUrl));
            }
        } catch (error) {
            logger.error(error);
            next(new RedirectError(ApiErrorCode.SERVER_ERROR, redirectUrl, 'Failed to process authentication'));
        }
    })(req, res, next);
});

/**
 * Handle callback for permission request
 */
export const handlePermissionCallback = asyncHandler(async (req, res, next) => {
    const provider = req.params.provider;
    const stateFromProvider = req.query.state as string;

    if (!validateProvider(provider, res)) {
        throw new BadRequestError('Invalid provider');
    }

    const permissionDetails = await validateState(
        stateFromProvider,
        (state) => validatePermissionState(state, provider as OAuthProviders),
        res
    ) as PermissionState;

    // Get the details we need from the permission state
    const { accountId, service, scopeLevel, redirectUrl } = permissionDetails;

    // Use the permission-specific passport strategy
    passport.authenticate(`${provider}-permission`, { session: false }, async (err: Error | null, result: ProviderResponse) => {
        try {
            if (err) {
                logger.error('Permission token exchange error:', err);
                return next(new RedirectError(ApiErrorCode.AUTH_FAILED, redirectUrl, 'Permission token exchange failed'));
            }

            if (!result || !result.tokenDetails || !result.tokenDetails.accessToken || !result.tokenDetails.refreshToken) {
                return next(new RedirectError(ApiErrorCode.AUTH_FAILED, redirectUrl, 'Permission request failed'));
            }

            const exists = await AuthService.checkUserExists(accountId);

            if (!exists) {
                return next(new RedirectError(ApiErrorCode.USER_NOT_FOUND, redirectUrl, 'User record not found in database'));
            }

            logger.info(`Processing permission callback for account ${accountId}, service ${service}, scope ${scopeLevel}`);

            // Verify that the token belongs to the correct user account
            const token = await verifyTokenOwnership(result.tokenDetails.accessToken, accountId);

            if (!token.isValid) {
                logger.error('Token ownership verification failed:', token.reason);
                return next(new RedirectError(ApiErrorCode.AUTH_FAILED, redirectUrl, 'Permission was granted with an incorrect account. Please try again and ensure you use the correct Google account.'));
            }

            const accessTokenInfo = await getTokenInfo(result.tokenDetails.accessToken);

            if (!accessTokenInfo.expires_in) {
                return next(new RedirectError(ApiErrorCode.SERVER_ERROR, redirectUrl, 'Failed to fetch token information'));
            }

            // Update tokens and scopes
            await AuthService.updateTokensAndScopes(
                accountId,
                result.tokenDetails.accessToken
            );

            // Create our JWT tokens that wrap the OAuth tokens
            const { createOAuthJwtToken, createOAuthRefreshToken } = await import('./OAuth.jwt');

            const jwtAccessToken = await createOAuthJwtToken(
                accountId,
                result.tokenDetails.accessToken,
                accessTokenInfo.expires_in
            );

            const jwtRefreshToken = await createOAuthRefreshToken(
                accountId,
                result.tokenDetails.refreshToken
            );

            setAccessTokenCookie(
                res,
                accountId,
                jwtAccessToken, // Our JWT token that wraps the OAuth token
                accessTokenInfo.expires_in * 1000
            );

            if (jwtRefreshToken) {
                setRefreshTokenCookie(res, accountId, jwtRefreshToken); // Our JWT refresh token
            }

            logger.info(`Token updated for ${service} ${scopeLevel}. Redirecting to ${redirectUrl}`);

            next(new RedirectSuccess({
                accountId,
                service,
                scopeLevel,
            }, redirectUrl));
        } catch (error) {
            logger.error('Error updating token:', error);
            next(new RedirectError(ApiErrorCode.SERVER_ERROR, redirectUrl, 'Failed to update token'));
        }
    })(req, res, next);
});

/**
 * Request permission for specific scope names
 * Accepts scope names and converts them to proper Google OAuth scope URLs
 */
export const requestPermission = asyncHandler(async (req, res, next) => {
    const requestedScopeNames = req.params.scopeNames as string; // Changed from scopes to scopeNames
    const { accountId, redirectUrl } = req.query;

    ValidationUtils.validateRequiredFields(req.query, ['redirectUrl', 'accountId']);
    ValidationUtils.validateUrl(redirectUrl as string, 'Redirect URL');
    ValidationUtils.validateObjectId(accountId as string, 'Account ID');

    // Get user account information
    const account = await AuthService.getUserAccount(accountId as string);

    if (!account || !account.userDetails.email) {
        throw new NotFoundError('Account not found or missing email', 404, ApiErrorCode.USER_NOT_FOUND);
    }

    const userEmail = account.userDetails.email;

    // Parse scope names - support both single scope and comma-separated scope names
    let scopeNames: string[];

    try {
        // Try to parse as JSON array first
        scopeNames = JSON.parse(requestedScopeNames);
        if (!Array.isArray(scopeNames)) {
            throw new Error('Not an array');
        }
    } catch {
        // Fall back to comma-separated string
        scopeNames = requestedScopeNames.split(',').map(name => name.trim());
    }

    const validation = validateScopeNames(scopeNames);

    if (!validation.valid) {
        throw new BadRequestError(`Invalid scope name format: ${validation.errors.join(', ')}`);
    }

    if (scopeNames.length === 0) {
        throw new BadRequestError('At least one scope name is required');
    }

    const scopes = buildGoogleScopeUrls(scopeNames);

    // Generate state and save permission state
    const state = await generatePermissionState(
        OAuthProviders.Google,
        redirectUrl as string,
        accountId as string,
        'custom', // service field - keeping for backward compatibility
        requestedScopeNames // Store original scope names string
    );

    // CRITICAL: These options force Google to use the specified account
    const authOptions = {
        scope: scopes, // Full Google OAuth scope URLs - Google will validate these
        accessType: 'offline',
        prompt: 'consent',
        loginHint: userEmail,     // Pre-select the account
        state,
        includeGrantedScopes: true
    };

    logger.info(`Initiating permission request for scope names: ${scopeNames.join(', ')}`);
    logger.info(`Converted to scope URLs: ${scopes.join(', ')}`);
    logger.info(`Account: ${userEmail}`);

    // Redirect to Google authorization page - Google will validate the scopes
    passport.authenticate('google-permission', authOptions)(req, res, next);
});

/**
 * Reauthorize permissions
 */
export const reauthorizePermissions = asyncHandler(async (req, res, next) => {
    const { accountId, redirectUrl } = req.query;

    if (!accountId || !redirectUrl) {
        throw new BadRequestError("Missing required parameters");
    }

    // Get the user's account details
    const account = await AuthService.getUserAccount(accountId as string);

    if (!account || !account.userDetails.email) {
        throw new NotFoundError('Account not found or missing email', 404, ApiErrorCode.USER_NOT_FOUND);
    }

    // Get previously granted scopes from the database
    const storedScopes = await AuthService.getAccountScopes(accountId as string);

    if (!storedScopes || storedScopes.length === 0) {
        // No additional scopes to request, just redirect to final destination
        return next(new RedirectSuccess({ message: "No additional scopes needed" }, redirectUrl as string));
    }

    // Generate a unique state for this re-authorization
    const state = await generatePermissionState(
        OAuthProviders.Google,
        redirectUrl as string,
        accountId as string,
        "reauthorize",
        "all"
    );

    // Build the authentication options
    const authOptions = {
        scope: storedScopes,
        accessType: 'offline',
        prompt: 'consent',
        loginHint: account.userDetails.email,
        state,
        includeGrantedScopes: true
    };

    logger.info(`Re-requesting scopes for account ${accountId}:`, storedScopes);

    // Redirect to Google authorization page
    passport.authenticate('google-permission', authOptions)(req, res, next);
});