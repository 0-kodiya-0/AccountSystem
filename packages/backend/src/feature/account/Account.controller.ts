// packages/backend/src/feature/account/Account.controller.ts

import { NextFunction, Request, Response } from 'express';
import { JsonSuccess, Redirect } from '../../types/response.types';
import { AccountDocument } from './Account.model';
import { asyncHandler } from '../../utils/response';
import * as AccountService from './Account.service';
import { CallbackCode } from '../../types/response.types';
import { getCallbackUrl } from '../../utils/redirect';

/**
 * Search for an account by email
 */
export const searchAccount = asyncHandler(async (req, res, next) => {
    const email = req.query.email as string;

    const result = await AccountService.searchAccountByEmail(email);

    next(new JsonSuccess({ accountId: result?.id }, 200));
});

/**
 * Logout all accounts (clear entire session)
 */
export const logoutAll = (req: Request, res: Response, next: NextFunction) => {
    const { accountIds } = req.query;

    const accountIdArray = AccountService.validateAccountIds(accountIds as string[]);
    AccountService.clearAllAccountSessions(res, accountIdArray);

    // Redirect to auth callback with logout success code
    next(new Redirect(
        {
            code: CallbackCode.LOGOUT_ALL_SUCCESS,
            message: "All accounts logged out successfully",
            accountIds: accountIdArray
        },
        getCallbackUrl()
    ));
};

/**
 * Logout single account
 */
export const logout = (req: Request, res: Response, next: NextFunction) => {
    const { accountId, clearClientAccountState } = req.query;

    const validatedAccountId = AccountService.validateSingleAccountId(accountId as string);
    AccountService.clearSingleAccountSession(res, validatedAccountId);

    const shouldClearClient = clearClientAccountState !== "false";

    // Redirect to auth callback with appropriate logout code
    next(new Redirect(
        {
            code: shouldClearClient ? CallbackCode.LOGOUT_SUCCESS : CallbackCode.LOGOUT_DISABLE_SUCCESS,
            message: shouldClearClient 
                ? "Account logged out successfully" 
                : "Account logged out and disabled for reactivation",
            accountId: validatedAccountId,
            clearClientAccountState: shouldClearClient
        },
        getCallbackUrl()
    ));
};

/**
 * Get account details
 */
export const getAccount = asyncHandler(async (req, res, next) => {
    const account = req.account as AccountDocument;
    const safeAccount = AccountService.convertToSafeAccount(account);

    next(new JsonSuccess(safeAccount, 200));
});

/**
 * Update account
 */
export const updateAccount = asyncHandler(async (req, res, next) => {
    const account = req.account as AccountDocument;
    const updates = req.body;

    const updatedAccount = await AccountService.updateAccount(account, updates);

    next(new JsonSuccess(updatedAccount, 200));
});

/**
 * Get email address for a specific account
 */
export const getAccountEmail = (req: Request, res: Response, next: NextFunction) => {
    const account = req.account as AccountDocument;
    const email = AccountService.getAccountEmail(account);

    next(new JsonSuccess({ email }, 200));
};

/**
 * Update account security settings
 */
export const updateAccountSecurity = asyncHandler(async (req, res, next) => {
    const securityUpdates = req.body;
    const account = req.account as AccountDocument;

    const updatedAccount = await AccountService.updateAccountSecurity(account, securityUpdates);

    next(new JsonSuccess(updatedAccount, 200));
});

/**
 * Refresh access token
 */
export const refreshToken = asyncHandler(async (req, res, next) => {
    const accountId = req.params.accountId as string;
    const account = req.account as AccountDocument;
    const refreshToken = req.oauthRefreshToken as string;
    const { redirectUrl } = req.query;

    const finalRedirectUrl = AccountService.validateRedirectUrl(redirectUrl as string);

    await AccountService.refreshAccountToken(req, res, accountId, account, refreshToken);

    next(new Redirect(null, finalRedirectUrl));
});

/**
 * Revoke refresh token
 */
export const revokeToken = asyncHandler(async (req, res, next) => {
    const accountId = req.params.accountId as string;
    const account = req.account as AccountDocument;
    const accessToken = req.oauthAccessToken as string;
    const refreshToken = req.oauthRefreshToken as string;

    const result = await AccountService.revokeAccountTokens(res, accountId, account, accessToken, refreshToken);

    next(new JsonSuccess(result, undefined, "Token revoked"));
});