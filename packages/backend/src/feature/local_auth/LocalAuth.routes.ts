import express from 'express';
import * as LocalAuthController from './LocalAuth.controller';

// Create routers for authenticated and non-authenticated routes
export const authNotRequiredRouter = express.Router({ mergeParams: true });
export const authRequiredRouter = express.Router({ mergeParams: true });

/**
 * Public routes (no authentication required)
 */

// Signup routes
authNotRequiredRouter.post('/signup/request-email', LocalAuthController.requestEmailVerification);
authNotRequiredRouter.get('/signup/verify-email', LocalAuthController.verifyEmailForSignup);
authNotRequiredRouter.post('/signup/complete-profile', LocalAuthController.completeProfile);
authNotRequiredRouter.delete('/signup/cancel', LocalAuthController.cancelEmailVerification);
authNotRequiredRouter.get('/signup/status', LocalAuthController.getSignupStatus);

// Login routes
authNotRequiredRouter.post('/login', LocalAuthController.login);

// Password reset routes
authNotRequiredRouter.post('/reset-password-request', LocalAuthController.requestPasswordReset);
authNotRequiredRouter.post('/verify-password-request', LocalAuthController.verifyPasswordResetRequest);
authNotRequiredRouter.post('/reset-password', LocalAuthController.resetPassword);

/**
 * Authenticated routes (require authentication)
 */

// Password management
authRequiredRouter.post('/change-password', LocalAuthController.changePassword);
