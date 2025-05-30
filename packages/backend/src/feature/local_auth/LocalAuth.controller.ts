import { NextFunction, Request, Response } from 'express';
import { asyncHandler } from '../../utils/response';
import {
    JsonSuccess,
    RedirectSuccess,
    ValidationError,
    ApiErrorCode,
    BadRequestError,
    AuthError
} from '../../types/response.types';
import * as LocalAuthService from './LocalAuth.service';
import {
    validateSignupRequest,
    validateLoginRequest,
    validatePasswordChangeRequest
} from '../account/Account.validation';
import {
    LocalAuthRequest,
    SignupRequest,
    PasswordResetRequest,
    PasswordChangeRequest,
    SetupTwoFactorRequest,
    VerifyTwoFactorRequest,
    VerifyEmailRequest,
    Account,
} from '../account/Account.types';
import { setAccessTokenCookie, setRefreshTokenCookie } from '../../services/session';
import { sendTwoFactorEnabledNotification } from '../email/Email.service';
import QRCode from 'qrcode';
import { ValidationUtils } from '../../utils/validation';
import { createLocalJwtToken, createLocalRefreshToken } from './LocalAuth.jwt';
import { findUserById } from '../account';

/**
 * Sign up (register) with email and password
 */
export const signup = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const signupData = req.body as SignupRequest;

    // Validate signup request
    const validationError = validateSignupRequest(signupData);
    if (validationError) {
        throw new ValidationError(validationError, 400, ApiErrorCode.VALIDATION_ERROR);
    }

    // Create account
    const account = await LocalAuthService.createLocalAccount(signupData);

    // Return success response
    next(new JsonSuccess({
        message: 'Account created successfully. Please check your email to verify your account.',
        accountId: account.id
    }, 201));
});

/**
 * Login with email/username and password
 */
export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const loginData = req.body as LocalAuthRequest;

    // Validate login request
    const validationError = validateLoginRequest(loginData);
    if (validationError) {
        throw new ValidationError(validationError, 400, ApiErrorCode.VALIDATION_ERROR);
    }

    // Authenticate user
    const result = await LocalAuthService.authenticateLocalUser(loginData);

    // Check if 2FA is required
    if ('requiresTwoFactor' in result && result.requiresTwoFactor) {
        next(new JsonSuccess({
            requiresTwoFactor: true,
            tempToken: result.tempToken,
            accountId: result.accountId,
            message: 'Please enter your two-factor authentication code'
        }));
        return;
    }

    // Normal login (no 2FA)
    const account = result as Account;

    // Generate JWT token
    const accessToken = await createLocalJwtToken(account.id);
    const refreshToken = await createLocalRefreshToken(account.id);

    // Set cookies
    const expiresIn = account.security.sessionTimeout || 3600;
    setAccessTokenCookie(res, account.id, accessToken, expiresIn * 1000);

    // Set remember me cookie if requested
    if (loginData.rememberMe) {
        setRefreshTokenCookie(res, account.id, refreshToken);
    }
    
    // Return success response
    next(new JsonSuccess({
        accountId: account.id,
        name: account.userDetails.name
    }));
});

/**
 * Verify two-factor authentication during login
 */
export const verifyTwoFactor = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { token, tempToken } = req.body as VerifyTwoFactorRequest & { tempToken: string };

    if (!token || !tempToken) {
        throw new BadRequestError('Verification token and temporary token are required', 400, ApiErrorCode.MISSING_DATA);
    }

    // Verify the temporary token first (ensures this is a valid 2FA session)
    try {
        // Verify 2FA using the temporary token system
        const account = await LocalAuthService.verifyTwoFactorLogin(tempToken, token);

        // Generate JWT token
        const jwtToken = await createLocalJwtToken(account.id);

        // Set cookies
        const expiresIn = account.security.sessionTimeout || 3600;
        setAccessTokenCookie(res, account.id, jwtToken, expiresIn * 1000);

        // Return success response
        next(new JsonSuccess({
            accountId: account.id,
            name: account.userDetails.name,
            message: 'Two-factor authentication successful'
        }));
    } catch {
        throw new AuthError('Temporary token expired or invalid', 401, ApiErrorCode.AUTH_FAILED);
    }
});

/**
 * Verify email address - now uses cache
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { token } = req.query as unknown as VerifyEmailRequest;

    if (!token) {
        throw new BadRequestError('Verification token is required', 400, ApiErrorCode.MISSING_DATA);
    }

    // Verify email using cached token
    await LocalAuthService.verifyEmail(token);

    // Redirect to login page with success message
    next(new RedirectSuccess(
        { message: 'Email verified successfully. You can now log in.' },
        '/login',
        302
    ));
});

/**
 * Request password reset - now uses cache
 */
export const requestPasswordReset = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const data = req.body as PasswordResetRequest;

    if (!data.email) {
        throw new BadRequestError('Email is required', 400, ApiErrorCode.MISSING_DATA);
    }

    // Request password reset using cached tokens
    await LocalAuthService.requestPasswordReset(data);

    // Return success response (even if email not found for security)
    next(new JsonSuccess({
        message: 'If your email is registered, you will receive instructions to reset your password.'
    }));
});

/**
 * Reset password with token - now uses cache
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { token } = req.query;
    const { password, confirmPassword } = req.body;

    ValidationUtils.validateRequiredFields(req.query, ['token']);
    ValidationUtils.validateRequiredFields(req.body, ['password', 'confirmPassword']);

    if (password !== confirmPassword) {
        throw new ValidationError('Passwords do not match', 400, ApiErrorCode.VALIDATION_ERROR);
    }

    // Use centralized password validation
    ValidationUtils.validatePasswordStrength(password);

    // Reset password using cached token
    await LocalAuthService.resetPassword(token as string, password);

    next(new JsonSuccess({
        message: 'Password reset successfully. You can now log in with your new password.'
    }));
});

/**
 * Change password (authenticated user)
 */
export const changePassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const accountId = req.params.accountId;
    const data = req.body as PasswordChangeRequest;

    // Validate change password request
    const validationError = validatePasswordChangeRequest(data);
    if (validationError) {
        throw new ValidationError(validationError, 400, ApiErrorCode.VALIDATION_ERROR);
    }

    // Change password
    await LocalAuthService.changePassword(accountId, data);

    // Return success response
    next(new JsonSuccess({
        message: 'Password changed successfully.'
    }));
});

/**
 * Set up two-factor authentication
 */
export const setupTwoFactor = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const accountId = req.params.accountId;
    const data = req.body as SetupTwoFactorRequest;

    if (!data.password) {
        throw new BadRequestError('Password is required', 400, ApiErrorCode.MISSING_DATA);
    }

    // Set up 2FA
    const result = await LocalAuthService.setupTwoFactor(accountId, data);

    // If enabling 2FA, generate QR code
    if (data.enableTwoFactor && result.secret && result.qrCodeUrl) {
        try {
            const qrCodeDataUrl = await QRCode.toDataURL(result.qrCodeUrl);

            // Generate backup codes if not already present
            const backupCodes = await LocalAuthService.generateNewBackupCodes(accountId, data.password);

            // Send notification email (async - don't wait)
            const account = await findUserById(accountId) as Account;
            if (account.userDetails.email) {
                sendTwoFactorEnabledNotification(
                    account.userDetails.email,
                    account.userDetails.firstName || account.userDetails.name.split(' ')[0]
                ).catch(err => {
                    console.error('Failed to send 2FA enabled notification:', err);
                });
            }

            next(new JsonSuccess({
                message: '2FA setup successful. Please scan the QR code with your authenticator app.',
                qrCode: qrCodeDataUrl,
                secret: result.secret,
                backupCodes
            }));
        } catch (error) {
            console.error('Failed to generate QR code:', error);
            throw new BadRequestError('Failed to generate QR code', 500, ApiErrorCode.SERVER_ERROR);
        }
    } else {
        // If disabling 2FA
        next(new JsonSuccess({
            message: '2FA has been disabled for your account.'
        }));
    }
});

/**
 * Verify and enable two-factor authentication
 */
export const verifyAndEnableTwoFactor = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const accountId = req.params.accountId;
    const { token } = req.body;

    if (!token) {
        throw new BadRequestError('Verification token is required', 400, ApiErrorCode.MISSING_DATA);
    }

    // Verify and enable 2FA
    const success = await LocalAuthService.verifyAndEnableTwoFactor(accountId, token);

    if (success) {
        next(new JsonSuccess({
            message: 'Two-factor authentication has been successfully enabled for your account.'
        }));
    } else {
        throw new AuthError('Failed to verify token', 400, ApiErrorCode.AUTH_FAILED);
    }
});

/**
 * Generate new backup codes for two-factor authentication
 */
export const generateBackupCodes = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const accountId = req.params.accountId;
    const { password } = req.body;

    if (!password) {
        throw new BadRequestError('Password is required', 400, ApiErrorCode.MISSING_DATA);
    }

    // Generate new backup codes
    const backupCodes = await LocalAuthService.generateNewBackupCodes(accountId, password);

    next(new JsonSuccess({
        message: 'New backup codes generated successfully. Please save these codes in a secure location.',
        backupCodes
    }));
});