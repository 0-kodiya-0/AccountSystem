import express from 'express';
import * as SessionController from './session.controller';

export const sessionRouter = express.Router({ mergeParams: true });

/**
 * @route GET /session
 * @desc Get current account session information (session data only)
 * @access Public (but requires session cookie)
 * @returns {session: AccountSessionInfo}
 */
sessionRouter.get('/', SessionController.getAccountSession);

/**
 * @route GET /session/accounts
 * @desc Get account data for session account IDs
 * @access Public (but requires session cookie)
 * @returns {SessionAccount[]}
 */
sessionRouter.get('/accounts', SessionController.getSessionAccountsData);

/**
 * @route POST /session/current
 * @desc Set current account in session
 * @access Public (but requires session cookie)
 */
sessionRouter.post('/current', SessionController.setCurrentAccount);

/**
 * @route POST /session/add
 * @desc Add account to session (internal use)
 * @access Public
 */
sessionRouter.post('/add', SessionController.addAccountToSession);

/**
 * @route POST /session/remove
 * @desc Remove account from session (internal use)
 * @access Public
 */
sessionRouter.post('/remove', SessionController.removeAccountFromSession);
