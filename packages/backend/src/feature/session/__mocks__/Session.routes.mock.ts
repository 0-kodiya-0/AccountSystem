import express from 'express';
import * as SessionMockController from './Session.controller.mock';

export const sessionMockRouter = express.Router();

/**
 * Session Information & Status
 */

/**
 * @route GET /mock/session/status
 * @desc Get session mock status and current session information
 * @access Public (development/test only)
 */
sessionMockRouter.get('/status', SessionMockController.getSessionMockStatus);

/**
 * @route GET /mock/session/info
 * @desc Get detailed session information including cookies and metadata
 * @access Public (development/test only)
 */
sessionMockRouter.get('/info', SessionMockController.getSessionMockInfo);

/**
 * Session Management
 */

/**
 * @route POST /mock/session/create
 * @desc Create a new mock session token
 * @access Public (development/test only)
 * @body { accountIds: string[], currentAccountId?: string }
 */
sessionMockRouter.post('/create', SessionMockController.createMockSessionToken);

/**
 * @route PUT /mock/session/update
 * @desc Update existing session token (add/remove accounts, change current)
 * @access Public (development/test only)
 * @body { action: 'add' | 'remove' | 'setCurrent', accountId?: string, currentAccountId?: string }
 */
sessionMockRouter.put('/update', SessionMockController.updateMockSessionToken);

/**
 * @route POST /mock/session/validate
 * @desc Validate a session token
 * @access Public (development/test only)
 * @body { token: string }
 */
sessionMockRouter.post('/validate', SessionMockController.validateMockSessionToken);

/**
 * @route DELETE /mock/session/clear
 * @desc Clear current session (remove session cookie)
 * @access Public (development/test only)
 */
sessionMockRouter.delete('/clear', SessionMockController.clearMockSession);

/**
 * Testing & Development Utilities
 */

/**
 * @route POST /mock/session/generate
 * @desc Generate multiple mock sessions for testing
 * @access Public (development/test only)
 * @body { count?: number, accountsPerSession?: number }
 */
sessionMockRouter.post('/generate', SessionMockController.generateMockSessions);

/**
 * @route POST /mock/session/corrupt
 * @desc Simulate session corruption for testing error handling
 * @access Public (development/test only)
 * @body { type?: 'malformed' | 'expired' | 'invalid_signature' | 'empty' }
 */
sessionMockRouter.post('/corrupt', SessionMockController.corruptMockSession);
