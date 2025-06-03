import express from 'express';
import * as AuthController from './OAuth.controller';
import { asyncHandler } from '../../utils/response';

export const router = express.Router({ mergeParams: true });

/**
 * Common Google authentication route for all auth types
 */
router.get('/auth/google', asyncHandler(AuthController.initiateGoogleAuth));

/**
 * Signup route for all providers
 */
router.get('/signup/:provider?', asyncHandler(AuthController.signup));

/**
 * Signin route for all providers
 */
router.get('/signin/:provider?', asyncHandler(AuthController.signin));

/**
 * Callback route for OAuth providers
 */
router.get('/callback/:provider', asyncHandler(AuthController.handleCallback));

/**
 * Dedicated callback route for permission requests - focused only on token handling
 */
router.get('/callback/permission/:provider', asyncHandler(AuthController.handlePermissionCallback));

/**
 * Route to request permission for specific scope names
 * Now accepts scope names that get auto-converted to proper Google OAuth URLs
 * 
 * Examples:
 * - GET /permission/gmail.readonly?accountId=123&redirectUrl=/dashboard
 * - GET /permission/gmail.readonly,calendar.events?accountId=123&redirectUrl=/dashboard
 * - GET /permission/["gmail.readonly","calendar.events"]?accountId=123&redirectUrl=/dashboard
 */
router.get('/permission/:scopeNames', asyncHandler(AuthController.requestPermission));

/**
 * Route specifically for re-requesting all previously granted scopes during sign-in flow
 */
router.get('/permission/reauthorize', asyncHandler(AuthController.reauthorizePermissions));