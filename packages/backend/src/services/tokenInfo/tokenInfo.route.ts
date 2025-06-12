import express from 'express';
import * as TokenInfoController from './tokenInfo.controller';

const router = express.Router({ mergeParams: true });

/**
 * @route POST /token/info
 * @desc Get comprehensive token information - validity, expiration details
 * @access Public
 * @body {token: string}
 * @returns {isValid: boolean, expiresAt?: number, timeRemaining?: number, isExpired?: boolean, error?: string}
 *
 * @example
 * POST /token/info
 * {
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "isValid": true,
 *     "expiresAt": 1703097600000,
 *     "timeRemaining": 3600000,
 *     "isExpired": false
 *   }
 * }
 */
router.post('/info', TokenInfoController.getTokenInfo);

/**
 * @route POST /token/expiry
 * @desc Check if token is expired (lightweight endpoint)
 * @access Public
 * @body {token: string}
 * @returns {isExpired: boolean, timeRemaining: number, expiresAt: number | null}
 *
 * @example
 * POST /token/expiry
 * {
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "isExpired": false,
 *     "timeRemaining": 3600000,
 *     "expiresAt": 1703097600000
 *   }
 * }
 */
router.post('/expiry', TokenInfoController.checkTokenExpiry);

export default router;
