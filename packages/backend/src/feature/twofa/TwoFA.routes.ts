import express from 'express';
import * as TwoFAController from './TwoFA.controller';

// ============================================================================
// Public 2FA Routes (No Authentication Required)
// ============================================================================

export const twoFactorPublicRouter = express.Router({ mergeParams: true });

/**
 * @route POST /twofa/verify-login
 * @desc Verify 2FA code during login process
 * @access Public (uses temporary token)
 * @body { token: string, tempToken: string }
 */
twoFactorPublicRouter.post('/verify-login', TwoFAController.verifyTwoFactorLogin);

// ============================================================================
// Authenticated 2FA Routes (Require Authentication)
// ============================================================================

export const twoFactorAuthenticatedRouter = express.Router({ mergeParams: true });

/**
 * @route GET /:accountId/twofa/status
 * @desc Get 2FA status for current account
 * @access Private
 */
twoFactorAuthenticatedRouter.get('/status', TwoFAController.getTwoFactorStatus);

/**
 * @route POST /:accountId/twofa/setup
 * @desc Set up 2FA for current account (unified for local and OAuth)
 * @access Private
 * @body For Local: { enableTwoFactor: boolean, password?: string }
 * @body For OAuth: { enableTwoFactor: boolean } (access token from middleware)
 */
twoFactorAuthenticatedRouter.post('/setup', TwoFAController.setupTwoFactor);

/**
 * @route POST /:accountId/twofa/verify-setup
 * @desc Verify and enable 2FA setup
 * @access Private
 * @body { token: string }
 */
twoFactorAuthenticatedRouter.post('/verify-setup', TwoFAController.verifyAndEnableTwoFactor);

/**
 * @route POST /:accountId/twofa/backup-codes
 * @desc Generate new backup codes
 * @access Private
 * @body For Local: { password: string }
 * @body For OAuth: {} (access token from middleware)
 */
twoFactorAuthenticatedRouter.post('/backup-codes', TwoFAController.generateBackupCodes);
