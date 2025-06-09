import { Request, Response } from 'express';
import { 
    getAccountSessionFromCookies,
    addAccountToSession as addAccountToSessionManager,
    removeAccountFromSession as removeAccountFromSessionManager,
    setCurrentAccountInSession as setCurrentAccountInSessionManager,
    clearAccountSession
} from './session.manager';
import { GetAccountSessionResponse } from '../../types/session.types';
import { ValidationUtils } from '../../utils/validation';
import { BadRequestError, ApiErrorCode } from '../../types/response.types';
import db from '../../config/db';
import { toSafeAccount } from '../../feature/account/Account.utils';

/**
 * Get account session with account data
 */
export async function getAccountSessionWithData(req: Request): Promise<GetAccountSessionResponse> {
    const session = getAccountSessionFromCookies(req);
    
    if (!session.hasSession || !session.isValid || session.accountIds.length === 0) {
        return {
            session: {
                hasSession: false,
                accountIds: [],
                currentAccountId: null,
                isValid: false
            }
        };
    }
    
    try {
        // Fetch account data for all account IDs in session
        const models = await db.getModels();
        const accountDocs = await models.accounts.Account.find({
            _id: { $in: session.accountIds }
        });
        
        // Convert to safe account objects
        const accounts = accountDocs.map(doc => toSafeAccount(doc)).filter(Boolean);
        
        // Verify all accounts still exist
        const foundAccountIds: string[] = accounts.map(acc => acc!.id);
        const missingAccountIds = session.accountIds.filter(id => !foundAccountIds.includes(id));
        
        if (missingAccountIds.length > 0) {
            // Some accounts no longer exist - we should clean up the session
            // For now, just log and return the valid accounts
            console.warn('Some accounts in session no longer exist:', missingAccountIds);
        }
        
        // Ensure current account is valid
        const validCurrentAccountId: string | null = session.currentAccountId && foundAccountIds.includes(session.currentAccountId)
            ? session.currentAccountId
            : (foundAccountIds.length > 0 ? foundAccountIds[0] : null);
        
        return {
            session: {
                hasSession: true,
                accountIds: foundAccountIds,
                currentAccountId: validCurrentAccountId,
                isValid: true
            },
            accounts: accounts
        };
        
    } catch (error) {
        console.error('Error fetching account data for session:', error);
        
        return {
            session: {
                hasSession: true,
                accountIds: session.accountIds,
                currentAccountId: session.currentAccountId,
                isValid: false
            }
        };
    }
}

/**
 * Add account to session
 */
export async function addAccountToSession(
    req: Request, 
    res: Response, 
    accountId: string, 
    setAsCurrent: boolean = true
): Promise<void> {
    ValidationUtils.validateObjectId(accountId, 'Account ID');
    
    // Verify account exists
    const models = await db.getModels();
    const account = await models.accounts.Account.findById(accountId);
    
    if (!account) {
        throw new BadRequestError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
    }
    
    addAccountToSessionManager(req, res, accountId, setAsCurrent);
}

/**
 * Remove account from session
 */
export async function removeAccountFromSession(
    req: Request, 
    res: Response, 
    accountId: string
): Promise<void> {
    ValidationUtils.validateObjectId(accountId, 'Account ID');
    
    const session = getAccountSessionFromCookies(req);
    
    if (!session.accountIds.includes(accountId)) {
        throw new BadRequestError('Account not found in session', 400, ApiErrorCode.USER_NOT_FOUND);
    }
    
    removeAccountFromSessionManager(req, res, accountId);
}

/**
 * Set current account in session
 */
export async function setCurrentAccountInSession(
    req: Request, 
    res: Response, 
    accountId: string | null
): Promise<void> {
    if (accountId) {
        ValidationUtils.validateObjectId(accountId, 'Account ID');
        
        const session = getAccountSessionFromCookies(req);
        
        if (!session.accountIds.includes(accountId)) {
            throw new BadRequestError('Account not found in session', 400, ApiErrorCode.USER_NOT_FOUND);
        }
    }
    
    setCurrentAccountInSessionManager(req, res, accountId);
}

/**
 * Clear entire account session
 */
export async function clearEntireAccountSession(req: Request, res: Response): Promise<void> {
    clearAccountSession(req, res);
}

/**
 * Remove specific accounts from session (for logout scenarios)
 */
export async function removeAccountsFromSession(
    req: Request, 
    res: Response, 
    accountIds: string[]
): Promise<void> {
    accountIds.forEach(id => ValidationUtils.validateObjectId(id, 'Account ID'));
    
    clearAccountSession(req, res, accountIds);
}