import express from "express";
import { authenticateGoogleApi } from "../../middleware";
import { getTokenInfoController, checkScopeAccess } from "./token.controller";

const router = express.Router({ mergeParams: true });

/**
 * @route GET /:accountId/google/token
 * @desc Get token information and granted scopes
 * @access Private (requires Google authentication)
 */
router.get('/', authenticateGoogleApi, getTokenInfoController);

/**
 * @route GET /:accountId/google/token/check
 * @desc Check if token has access to specific scope names
 * @access Private (requires Google authentication)
 * @query scope - Single scope name (e.g., 'gmail.readonly')
 * @query scopes - Multiple scope names as JSON array or comma-separated string
 * 
 * Examples:
 * - GET /123/google/token/check?scope=gmail.readonly
 * - GET /123/google/token/check?scopes=gmail.readonly,calendar.events
 * - GET /123/google/token/check?scopes=["gmail.readonly","calendar.events"]
 */
router.get('/check', authenticateGoogleApi, checkScopeAccess);

export default router;