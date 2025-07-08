import express from 'express';
import * as TwoFAMockController from './TwoFA.controller.mock';

export const twoFactorMockRouter = express.Router({ mergeParams: true });

/**
 * @route GET /mock/twofa/generate-code/:secret
 * @desc Generate TOTP code for a given secret (simulates authenticator app)
 * @access Public (Mock only)
 * @param secret - The 2FA secret to generate code for
 */
twoFactorMockRouter.get('/generate-code/:secret', TwoFAMockController.generateTotpCode);

/**
 * @route GET /mock/twofa/account/:accountId/secret
 * @desc Get the 2FA secret for an account (for testing purposes)
 * @access Public (Mock only)
 * @param accountId - The account ID to get secret for
 */
twoFactorMockRouter.get('/account/:accountId/secret', TwoFAMockController.getAccountSecret);

/**
 * @route GET /mock/twofa/account/:accountId/generate-code
 * @desc Generate TOTP code for an account using its stored secret
 * @access Public (Mock only)
 * @param accountId - The account ID to generate code for
 */
twoFactorMockRouter.get('/account/:accountId/generate-code', TwoFAMockController.generateAccountTotpCode);

/**
 * @route GET /mock/twofa/validate-token/:secret/:token
 * @desc Validate a TOTP token against a secret (simulates authenticator verification)
 * @access Public (Mock only)
 * @param secret - The 2FA secret
 * @param token - The TOTP token to validate
 */
twoFactorMockRouter.get('/validate-token/:secret/:token', TwoFAMockController.validateTotpToken);

/**
 * @route GET /mock/twofa/cache/stats
 * @desc Get 2FA cache statistics (temp tokens, setup tokens)
 * @access Public (Mock only)
 */
twoFactorMockRouter.get('/cache/stats', TwoFAMockController.getCacheStats);

/**
 * @route GET /mock/twofa/cache/temp-tokens
 * @desc Get all temporary tokens (for debugging login flows)
 * @access Public (Mock only)
 */
twoFactorMockRouter.get('/cache/temp-tokens', TwoFAMockController.getAllTempTokens);

/**
 * @route GET /mock/twofa/cache/setup-tokens
 * @desc Get all setup tokens (for debugging setup flows)
 * @access Public (Mock only)
 */
twoFactorMockRouter.get('/cache/setup-tokens', TwoFAMockController.getAllSetupTokens);

/**
 * @route GET /mock/twofa/cache/temp-token/:token
 * @desc Get specific temporary token data
 * @access Public (Mock only)
 * @param token - The temporary token to look up
 */
twoFactorMockRouter.get('/cache/temp-token/:token', TwoFAMockController.getTempTokenData);

/**
 * @route GET /mock/twofa/cache/setup-token/:token
 * @desc Get specific setup token data
 * @access Public (Mock only)
 * @param token - The setup token to look up
 */
twoFactorMockRouter.get('/cache/setup-token/:token', TwoFAMockController.getSetupTokenData);

/**
 * @route POST /mock/twofa/generate-backup-codes
 * @desc Generate mock backup codes (for testing backup code flows)
 * @access Public (Mock only)
 * @body { count?: number } - Number of backup codes to generate (default: 10)
 */
twoFactorMockRouter.post('/generate-backup-codes', TwoFAMockController.generateBackupCodes);
