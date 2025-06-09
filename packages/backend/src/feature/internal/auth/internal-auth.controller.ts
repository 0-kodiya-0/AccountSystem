import { JsonSuccess, NotFoundError, BadRequestError, ApiErrorCode, AuthError } from '../../../types/response.types';
import { ValidationUtils } from '../../../utils/validation';
import { toSafeAccount } from '../../account/Account.utils';
import { AccountType } from '../../account/Account.types';
import { verifyLocalJwtToken, verifyLocalRefreshToken } from '../../local_auth';
import { verifyOAuthJwtToken, verifyOAuthRefreshToken } from '../../oauth/OAuth.jwt';
import {
    getTokenInfo,
    getGoogleAccountScopes,
    hasScope,
    verifyTokenOwnership
} from '../../google/services/token/token.services';
import { buildGoogleScopeUrls } from '../../google/config';
import db from '../../../config/db';
import { asyncHandler } from '../../../utils/response';

/**
 * Get user information without sensitive data
 */
export const getUserInfo = asyncHandler(async (req, res, next) => {
    const { accountId } = req.params;

    ValidationUtils.validateObjectId(accountId, 'Account ID');

    const models = await db.getModels();
    const account = await models.accounts.Account.findById(accountId);

    if (!account) {
        throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
    }

    const safeAccount = toSafeAccount(account);

    next(new JsonSuccess({
        account: safeAccount,
        accountType: account.accountType,
        status: account.status
    }));
});

/**
 * Search user by email
 */
export const searchUserByEmail = asyncHandler(async (req, res, next) => {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
        throw new BadRequestError('Email query parameter is required');
    }

    ValidationUtils.validateEmail(email);

    const models = await db.getModels();
    const account = await models.accounts.Account.findOne({ 'userDetails.email': email });

    if (!account) {
        throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
    }

    const safeAccount = toSafeAccount(account);

    next(new JsonSuccess({
        account: safeAccount,
        accountType: account.accountType,
        status: account.status
    }));
});

/**
 * Get user's Google scopes
 */
export const getUserScopes = asyncHandler(async (req, res, next) => {
    const { accountId } = req.params;

    ValidationUtils.validateObjectId(accountId, 'Account ID');

    const models = await db.getModels();
    const account = await models.accounts.Account.findById(accountId);

    if (!account) {
        throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
    }

    if (account.accountType !== AccountType.OAuth) {
        throw new BadRequestError('Google scopes are only available for OAuth accounts');
    }

    const scopes = await getGoogleAccountScopes(accountId);

    next(new JsonSuccess({
        accountId,
        scopes,
        scopeCount: scopes.length
    }));
});

/**
 * Validate session token and return account info
 */
export const validateSession = asyncHandler(async (req, res, next) => {
    const { accountId, accessToken, refreshToken } = req.body;

    ValidationUtils.validateRequiredFields(req.body, ['accountId']);
    ValidationUtils.validateObjectId(accountId, 'Account ID');

    if (!accessToken && !refreshToken) {
        throw new BadRequestError('Either accessToken or refreshToken is required');
    }

    const models = await db.getModels();
    const account = await models.accounts.Account.findById(accountId);

    if (!account) {
        throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
    }

    let tokenValid = false;
    let tokenType: 'access' | 'refresh' | null = null;
    let oauthAccessToken: string | undefined;
    let oauthRefreshToken: string | undefined;

    try {
        if (accessToken) {
            if (account.accountType === AccountType.Local) {
                const { accountId: tokenAccountId } = verifyLocalJwtToken(accessToken);
                tokenValid = tokenAccountId === accountId;
                tokenType = 'access';
            } else if (account.accountType === AccountType.OAuth) {
                const { accountId: tokenAccountId, oauthAccessToken: extractedToken } = verifyOAuthJwtToken(accessToken);
                tokenValid = tokenAccountId === accountId;
                tokenType = 'access';
                oauthAccessToken = extractedToken;
            }
        } else if (refreshToken) {
            if (account.accountType === AccountType.Local) {
                const { accountId: tokenAccountId } = verifyLocalRefreshToken(refreshToken);
                tokenValid = tokenAccountId === accountId;
                tokenType = 'refresh';
            } else if (account.accountType === AccountType.OAuth) {
                const { accountId: tokenAccountId, oauthRefreshToken: extractedToken } = verifyOAuthRefreshToken(refreshToken);
                tokenValid = tokenAccountId === accountId;
                tokenType = 'refresh';
                oauthRefreshToken = extractedToken;
            }
        }
    } catch {
        tokenValid = false;
    }

    if (!tokenValid) {
        throw new AuthError('Invalid or expired token', 401, ApiErrorCode.TOKEN_INVALID);
    }

    const safeAccount = toSafeAccount(account);

    next(new JsonSuccess({
        valid: true,
        account: safeAccount,
        accountType: account.accountType,
        tokenType,
        oauthAccessToken,
        oauthRefreshToken
    }));
});

/**
 * Validate Google API access and required scopes
 */
export const validateGoogleAccess = asyncHandler(async (req, res, next) => {
    const { accountId, accessToken, requiredScopes = [] } = req.body;

    ValidationUtils.validateRequiredFields(req.body, ['accountId', 'accessToken']);
    ValidationUtils.validateObjectId(accountId, 'Account ID');

    const models = await db.getModels();
    const account = await models.accounts.Account.findById(accountId);

    if (!account) {
        throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
    }

    if (account.accountType !== AccountType.OAuth) {
        throw new BadRequestError('Google API access is only available for OAuth accounts');
    }

    try {
        // Verify token ownership
        const ownership = await verifyTokenOwnership(accessToken, accountId);
        if (!ownership.isValid) {
            throw new AuthError(`Token ownership verification failed: ${ownership.reason}`, 403, ApiErrorCode.AUTH_FAILED);
        }

        // Check required scopes if provided
        const scopeResults: Record<string, boolean> = {};
        let allScopesGranted = true;

        if (requiredScopes.length > 0) {
            const scopeUrls = buildGoogleScopeUrls(requiredScopes);

            for (let i = 0; i < scopeUrls.length; i++) {
                const scopeUrl = scopeUrls[i];
                const scopeName = requiredScopes[i];
                const hasAccess = await hasScope(accessToken, scopeUrl);

                scopeResults[scopeName] = hasAccess;
                if (!hasAccess) {
                    allScopesGranted = false;
                }
            }
        }

        // Get token info
        const tokenInfo = await getTokenInfo(accessToken);

        next(new JsonSuccess({
            valid: true,
            accountId,
            tokenInfo,
            scopeResults,
            allScopesGranted,
            requiredScopes
        }));

    } catch (error) {
        if (error instanceof AuthError) {
            throw error;
        }
        throw new AuthError('Failed to validate Google access', 403, ApiErrorCode.AUTH_FAILED);
    }
});

/**
 * Verify Google token ownership
 */
export const verifyGoogleToken = asyncHandler(async (req, res, next) => {
    const { accountId, accessToken } = req.body;

    ValidationUtils.validateRequiredFields(req.body, ['accountId', 'accessToken']);
    ValidationUtils.validateObjectId(accountId, 'Account ID');

    const models = await db.getModels();
    const account = await models.accounts.Account.findById(accountId);

    if (!account) {
        throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
    }

    if (account.accountType !== AccountType.OAuth) {
        throw new BadRequestError('Google token verification is only available for OAuth accounts');
    }

    try {
        const result = await verifyTokenOwnership(accessToken, accountId);

        next(new JsonSuccess({
            valid: result.isValid,
            reason: result.reason,
            accountId
        }));

    } catch {
        throw new AuthError('Failed to verify Google token', 500, ApiErrorCode.SERVER_ERROR);
    }
});

/**
 * Get Google token information
 */
/**
 * Get Google token information
 */
export const getGoogleTokenInfo = asyncHandler(async (req, res, next) => {
    const { accountId } = req.params;
    const { accessToken } = req.body;

    ValidationUtils.validateObjectId(accountId, 'Account ID');

    if (!accessToken) {
        throw new BadRequestError('Access token is required in request body');
    }

    const models = await db.getModels();
    const account = await models.accounts.Account.findById(accountId);

    if (!account) {
        throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
    }

    if (account.accountType !== AccountType.OAuth) {
        throw new BadRequestError('Google token information is only available for OAuth accounts');
    }

    try {
        // Verify token ownership first
        const ownership = await verifyTokenOwnership(accessToken, accountId);
        if (!ownership.isValid) {
            throw new AuthError(`Token ownership verification failed: ${ownership.reason}`, 403, ApiErrorCode.AUTH_FAILED);
        }

        // Get token information from Google
        const tokenInfo = await getTokenInfo(accessToken);

        // Get granted scopes
        const grantedScopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : [];

        // Get stored scopes from our database
        const storedScopes = await getGoogleAccountScopes(accountId);

        next(new JsonSuccess({
            accountId,
            tokenInfo: tokenInfo,
            grantedScopes,
            storedScopes,
            scopeCounts: {
                granted: grantedScopes.length,
                stored: storedScopes.length
            }
        }));

    } catch (error) {
        if (error instanceof AuthError) {
            throw error;
        }
        throw new AuthError('Failed to get Google token information', 500, ApiErrorCode.SERVER_ERROR);
    }
});