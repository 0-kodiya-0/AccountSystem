import express from 'express';
import { getTokenInfoController } from './token.controller';

const router = express.Router({ mergeParams: true });

/**
 * @route GET /:accountId/google/token
 * @desc Get token information and granted scopes
 * @access Private (requires Google authentication)
 */
router.get('/', getTokenInfoController);

export default router;
