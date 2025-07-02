import { asyncHandler } from '../../utils/response';
import { JsonSuccess, ValidationError, ApiErrorCode, BadRequestError } from '../../types/response.types';
import * as LocalAuthService from './LocalAuth.service';
import { validateLoginRequest, validatePasswordChangeRequest } from './LocalAuth.validation';
import { LocalAuthRequest, PasswordChangeRequest, CompleteProfileRequest } from './LocalAuth.types';
import { setupCompleteAccountSession } from '../session/session.utils';
import { ValidationUtils } from '../../utils/validation';
import { createLocalAccessToken, createLocalRefreshToken } from '../tokens';
import { Account } from '../account';
import {
  getEmailVerificationData,
  getProfileCompletionData,
  getAllPasswordResetTokens,
  getAllProfileCompletionTokens,
  getAllEmailVerificationTokens,
} from './LocalAuth.cache';
import { getNodeEnv, isMockEnabled } from '../../config/env.config';
import { logger } from '../../utils/logger';

const isMock = getNodeEnv() !== 'production' && isMockEnabled();

/**
 * Step 1: Request email verification - UPDATED to require callback URL
 */
export const requestEmailVerification = asyncHandler(async (req, res, next) => {
  const { email, callbackUrl } = req.body;

  if (!email || !callbackUrl) {
    throw new BadRequestError('Email and callbackUrl are required', 400, ApiErrorCode.MISSING_DATA);
  }

  const { token } = await LocalAuthService.requestEmailVerification(email, callbackUrl);

  if (isMock) {
    next(
      new JsonSuccess({
        message: 'Verification email sent. Please check your email to continue.',
        email: email,
        callbackUrl: callbackUrl,
        // Mock data only included when mock is enabled
        mock: {
          verificationToken: token,
          verifyUrl: `${callbackUrl}?token=${token}`,
          note: 'Mock data included for testing',
        },
      }),
    );
  } else {
    next(
      new JsonSuccess({
        message: 'Verification email sent. Please check your email to continue.',
        email: email,
        callbackUrl: callbackUrl,
      }),
    );
  }
});

/**
 * Step 2: Verify email and get profile completion token
 */
export const verifyEmailForSignup = asyncHandler(async (req, res, next) => {
  const { token } = req.query;

  if (!token) {
    throw new BadRequestError('Verification token is required', 400, ApiErrorCode.TOKEN_INVALID);
  }

  const result = await LocalAuthService.verifyEmailAndProceedToProfile(token as string);

  next(
    new JsonSuccess({
      message: 'Email verified successfully. Please complete your profile.',
      profileToken: result.profileToken,
      email: result.email,
    }),
  );
});

/**
 * Step 3: Complete profile and create account
 */
export const completeProfile = asyncHandler(async (req, res, next) => {
  const { token } = req.query;
  const profileData = req.body as CompleteProfileRequest;

  if (!token) {
    throw new BadRequestError('Profile token is required', 400, ApiErrorCode.TOKEN_INVALID);
  }

  const account = await LocalAuthService.completeProfileAndCreateAccount(token as string, profileData);

  next(
    new JsonSuccess(
      {
        message: 'Account created successfully. You can now log in.',
        accountId: account.id,
        name: account.userDetails.name,
      },
      201,
    ),
  );
});

/**
 * Cancel email verification (delete cache)
 */
export const cancelEmailVerification = asyncHandler(async (req, res, next) => {
  const { email } = req.query;

  if (!email) {
    throw new BadRequestError('Email is required', 400, ApiErrorCode.MISSING_DATA);
  }

  await LocalAuthService.cancelEmailVerification(email as string);

  next(
    new JsonSuccess({
      message: 'Email verification cancelled successfully.',
    }),
  );
});

/**
 * Get signup status (check current step)
 */
export const getSignupStatus = asyncHandler(async (req, res, next) => {
  const { email, token } = req.query;

  if (email) {
    // Check email verification step
    const emailData = getEmailVerificationData(email as string);
    if (emailData) {
      next(
        new JsonSuccess({
          step: 'email_verification',
          email: emailData.email,
          token: emailData.verificationToken,
          expiresAt: emailData.expiresAt,
        }),
      );
      return;
    }
  }

  if (token) {
    // Check profile completion step
    const profileData = getProfileCompletionData(token as string);
    if (profileData) {
      next(
        new JsonSuccess({
          step: 'profile_completion',
          email: profileData.email,
          emailVerified: profileData.emailVerified,
          expiresAt: profileData.expiresAt,
        }),
      );
      return;
    }
  }

  next(
    new JsonSuccess({
      step: 'not_found',
      message: 'No active signup process found.',
    }),
  );
});

/**
 * Login with email/username and password - UPDATED with session integration
 */
export const login = asyncHandler(async (req, res, next) => {
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
    next(
      new JsonSuccess({
        requiresTwoFactor: true,
        accountId: result.accountId,
        tempToken: result.tempToken,
        message: 'Please complete two-factor authentication to continue.',
      }),
    );
    return;
  }

  // Normal login (no 2FA)
  const account = result as Account;

  // Generate JWT token
  const accessToken = createLocalAccessToken(account.id);
  const refreshToken = createLocalRefreshToken(account.id);

  // Set up complete account session (auth cookies + account session)
  const expiresIn = (account.security.sessionTimeout || 3600) * 1000;
  const shouldSetRefreshToken = loginData.rememberMe;

  setupCompleteAccountSession(
    req,
    res,
    account.id,
    accessToken,
    expiresIn,
    shouldSetRefreshToken ? refreshToken : undefined,
    true, // set as current account
  );

  // Return success response
  next(
    new JsonSuccess({
      accountId: account.id,
      name: account.userDetails.name,
    }),
  );
});

/**
 * Request password reset - UPDATED to require callback URL
 */
export const requestPasswordReset = asyncHandler(async (req, res, next) => {
  const { email, callbackUrl } = req.body;

  if (!email || !callbackUrl) {
    throw new BadRequestError('Email and callbackUrl are required', 400, ApiErrorCode.MISSING_DATA);
  }

  // Request password reset using cached tokens with callback URL
  const { resetToken } = await LocalAuthService.requestPasswordReset({ email, callbackUrl });

  // Return success response (even if email not found for security)
  if (isMock) {
    next(
      new JsonSuccess({
        message: 'If your email is registered, you will receive instructions to reset your password.',
        callbackUrl: callbackUrl,
        // Mock data only included when mock is enabled
        mock: {
          resetToken: resetToken,
          resetUrl: resetToken ? `${callbackUrl}?token=${resetToken}` : null,
          note: 'Reset token exposed for testing',
        },
      }),
    );
  } else {
    next(
      new JsonSuccess({
        message: 'If your email is registered, you will receive instructions to reset your password.',
        callbackUrl: callbackUrl,
      }),
    );
  }
});

export const verifyPasswordResetRequest = asyncHandler(async (req, res, next) => {
  const { token } = req.body;

  if (!token) {
    throw new BadRequestError('Token is required', 400, ApiErrorCode.MISSING_DATA);
  }

  const result = await LocalAuthService.verifyPasswordResetRequest({ token });

  next(
    new JsonSuccess({
      ...result,
      message: 'If your email is registered, you will receive instructions to reset your password.',
    }),
  );
});

/**
 * Reset password with token - now uses cache
 */
export const resetPassword = asyncHandler(async (req, res, next) => {
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

  next(
    new JsonSuccess({
      message: 'Password reset successfully. You can now log in with your new password.',
    }),
  );
});

/**
 * Change password (authenticated user)
 */
export const changePassword = asyncHandler(async (req, res, next) => {
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
  next(
    new JsonSuccess({
      message: 'Password changed successfully.',
    }),
  );
});

export const getActiveTokens = asyncHandler(async (req, res, next) => {
  if (getNodeEnv() === 'production') {
    throw new BadRequestError('Token inspection disabled in production', 400, ApiErrorCode.INVALID_REQUEST);
  }

  const emailTokens = getAllEmailVerificationTokens();
  const profileTokens = getAllProfileCompletionTokens();
  const resetTokens = getAllPasswordResetTokens();

  next(
    new JsonSuccess({
      emailVerification: {
        tokens: emailTokens.map((token) => ({
          email: token.email,
          verificationToken: token.verificationToken,
          step: token.step,
          expiresAt: token.expiresAt,
          createdAt: token.createdAt,
        })),
        count: emailTokens.length,
      },
      profileCompletion: {
        tokens: profileTokens.map((token) => ({
          email: token.email,
          verificationToken: token.verificationToken,
          emailVerified: token.emailVerified,
          expiresAt: token.expiresAt,
        })),
        count: profileTokens.length,
      },
      passwordReset: {
        tokens: resetTokens.map((token) => ({
          accountId: token.accountId,
          email: token.email,
          token: token.token,
          expiresAt: token.expiresAt,
        })),
        count: resetTokens.length,
      },
      message: 'Active tokens retrieved successfully',
    }),
  );
});
