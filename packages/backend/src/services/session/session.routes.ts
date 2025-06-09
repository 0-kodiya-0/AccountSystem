import express from 'express';
import * as SessionController from './session.controller';

export const sessionRouter = express.Router({ mergeParams: true });

/**
 * @route GET /account/session
 * @desc Get current account session information
 * @access Public (but requires session cookie)
 */
sessionRouter.get('/session', SessionController.getAccountSession);

/**
 * @route POST /account/session/current
 * @desc Set current account in session
 * @access Public (but requires session cookie)
 */
sessionRouter.post('/session/current', SessionController.setCurrentAccount);

/**
 * @route POST /account/session/add
 * @desc Add account to session (internal use)
 * @access Public
 */
sessionRouter.post('/session/add', SessionController.addAccountToSession);

/**
 * @route POST /account/session/remove
 * @desc Remove account from session (internal use)
 * @access Public
 */
sessionRouter.post('/session/remove', SessionController.removeAccountFromSession);