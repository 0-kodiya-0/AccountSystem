import { asyncHandler } from '../../utils/response';
import {
  JsonSuccess,
  ValidationError,
  ApiErrorCode,
  BadRequestError,
  AuthError,
  Redirect,
} from '../../types/response.types';
import * as LocalAuthService from './LocalAuth.service';
import {
  validateSignupRequest,
  validateLoginRequest,
  validatePasswordChangeRequest,
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
  AccountType,
} from '../account/Account.types';
import {
  extractAccessToken,
  extractRefreshToken,
  handleTokenRefresh,
  setupCompleteAccountSession,
} from '../../services';
import { sendTwoFactorEnabledNotification } from '../email/Email.service';
import QRCode from 'qrcode';
import { ValidationUtils } from '../../utils/validation';
import {
  createLocalJwtToken,
  createLocalRefreshToken,
  verifyLocalJwtToken,
  verifyLocalRefreshToken,
} from './LocalAuth.jwt';
import { AccountDocument, findUserById } from '../account';
import { logger } from '../../utils/logger';
import { sendNonCriticalEmail } from '../email/Email.utils';

/**
 * Sign up (register) with email and password
 */
export const signup = asyncHandler(async (req, res, next) => {
  const signupData = req.body as SignupRequest;

  // Validate signup request
  const validationError = validateSignupRequest(signupData);
  if (validationError) {
    throw new ValidationError(validationError, 400, ApiErrorCode.VALIDATION_ERROR);
  }

  // Create account
  const account = await LocalAuthService.createLocalAccount(signupData);

  // Return success response
  next(
    new JsonSuccess(
      {
        message: 'Account created successfully. Please check your email to verify your account.',
        accountId: account.id,
      },
      201,
    ),
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
        tempToken: result.tempToken,
        accountId: result.accountId,
        message: 'Please enter your two-factor authentication code',
      }),
    );
    return;
  }

  // Normal login (no 2FA)
  const account = result as Account;

  // Generate JWT token
  const accessToken = await createLocalJwtToken(account.id);
  const refreshToken = await createLocalRefreshToken(account.id);

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
 * Verify two-factor authentication during login - UPDATED with session integration
 */
export const verifyTwoFactor = asyncHandler(async (req, res, next) => {
  const { token, tempToken } = req.body as VerifyTwoFactorRequest & {
    tempToken: string;
  };

  if (!token || !tempToken) {
    throw new BadRequestError('Verification token and temporary token are required', 400, ApiErrorCode.MISSING_DATA);
  }

  // Verify the temporary token first (ensures this is a valid 2FA session)
  try {
    // Verify 2FA using the temporary token system
    const account = await LocalAuthService.verifyTwoFactorLogin(tempToken, token);

    // Generate JWT token
    const jwtToken = await createLocalJwtToken(account.id);
    const refreshToken = await createLocalRefreshToken(account.id);

    // Set up complete account session (auth cookies + account session)
    const expiresIn = (account.security.sessionTimeout || 3600) * 1000;

    setupCompleteAccountSession(
      req,
      res,
      account.id,
      jwtToken,
      expiresIn,
      refreshToken, // Always set refresh token for 2FA verified sessions
      true, // set as current account
    );

    // Return success response
    next(
      new JsonSuccess({
        accountId: account.id,
        name: account.userDetails.name,
        message: 'Two-factor authentication successful',
      }),
    );
  } catch {
    throw new AuthError('Temporary token expired or invalid', 401, ApiErrorCode.AUTH_FAILED);
  }
});

/**
 * Verify email address - now uses cache
 */
export const verifyEmail = asyncHandler(async (req, res, next) => {
  const { token } = req.query as unknown as VerifyEmailRequest;

  if (!token) {
    throw new BadRequestError('Verification token is required', 400, ApiErrorCode.MISSING_DATA);
  }

  // Verify email using cached token
  await LocalAuthService.verifyEmail(token);

  // Redirect to login page with success message
  next(new JsonSuccess({ message: 'Email verified successfully. You can now log in.' }));
});

/**
 * Request password reset - now uses cache
 */
export const requestPasswordReset = asyncHandler(async (req, res, next) => {
  const data = req.body as PasswordResetRequest;

  if (!data.email) {
    throw new BadRequestError('Email is required', 400, ApiErrorCode.MISSING_DATA);
  }

  // Request password reset using cached tokens
  await LocalAuthService.requestPasswordReset(data);

  // Return success response (even if email not found for security)
  next(
    new JsonSuccess({
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

/**
 * Set up two-factor authentication
 */
export const setupTwoFactor = asyncHandler(async (req, res, next) => {
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
      const account = (await findUserById(accountId)) as Account;
      if (account.userDetails.email) {
        sendNonCriticalEmail(
          sendTwoFactorEnabledNotification,
          [account.userDetails.email, account.userDetails.firstName || account.userDetails.name.split(' ')[0]],
          { maxAttempts: 2, delayMs: 1000 },
        );
      }

      next(
        new JsonSuccess({
          message: '2FA setup successful. Please scan the QR code with your authenticator app.',
          qrCode: qrCodeDataUrl,
          secret: result.secret,
          backupCodes,
        }),
      );
    } catch (error) {
      logger.error('Failed to generate QR code:', error);
      throw new BadRequestError('Failed to generate QR code', 500, ApiErrorCode.SERVER_ERROR);
    }
  } else {
    // If disabling 2FA
    next(
      new JsonSuccess({
        message: '2FA has been disabled for your account.',
      }),
    );
  }
});

/**
 * Verify and enable two-factor authentication
 */
export const verifyAndEnableTwoFactor = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const { token } = req.body;

  if (!token) {
    throw new BadRequestError('Verification token is required', 400, ApiErrorCode.MISSING_DATA);
  }

  // Verify and enable 2FA
  const success = await LocalAuthService.verifyAndEnableTwoFactor(accountId, token);

  if (success) {
    next(
      new JsonSuccess({
        message: 'Two-factor authentication has been successfully enabled for your account.',
      }),
    );
  } else {
    throw new AuthError('Failed to verify token', 400, ApiErrorCode.AUTH_FAILED);
  }
});

/**
 * Generate new backup codes for two-factor authentication
 */
export const generateBackupCodes = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const { password } = req.body;

  if (!password) {
    throw new BadRequestError('Password is required', 400, ApiErrorCode.MISSING_DATA);
  }

  // Generate new backup codes
  const backupCodes = await LocalAuthService.generateNewBackupCodes(accountId, password);

  next(
    new JsonSuccess({
      message: 'New backup codes generated successfully. Please save these codes in a secure location.',
      backupCodes,
    }),
  );
});

/**
 * Get local auth access token information
 * Route: GET /:accountId/auth/token
 */
export const getLocalTokenInfo = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;

  // First try to get token from body, then from cookies
  let accessToken = req.body.token;
  if (!accessToken) {
    accessToken = extractAccessToken(req, accountId);
  }

  if (!accessToken) {
    throw new BadRequestError('Access token not found in body or cookies', 400, ApiErrorCode.TOKEN_INVALID);
  }

  try {
    // Verify and decode our JWT token
    const { accountId: tokenAccountId, exp } = verifyLocalJwtToken(accessToken);

    // Check if token is expired
    const isExpired = exp && Date.now() >= exp * 1000;
    if (isExpired) {
      return next(
        new JsonSuccess({
          isExpired: true,
          type: 'local_jwt',
        }),
      );
    }

    // Verify token belongs to correct account
    if (tokenAccountId !== accountId) {
      throw new BadRequestError('Token does not belong to this account', 400, ApiErrorCode.TOKEN_INVALID);
    }

    const response = {
      isExpired: false,
      type: 'local_jwt',
      expiresAt: exp ? exp * 1000 : null,
      timeRemaining: exp ? Math.max(0, exp * 1000 - Date.now()) : null,
      accountId: tokenAccountId,
    };

    next(new JsonSuccess(response));
  } catch {
    // If JWT verification fails, token is invalid/expired
    next(
      new JsonSuccess({
        isExpired: true,
        type: 'local_jwt',
        error: 'Invalid or expired token',
      }),
    );
  }
});

/**
 * Get local auth refresh token information
 * Route: GET /:accountId/auth/refresh/token
 */
export const getLocalRefreshTokenInfo = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;

  // First try to get token from body, then from cookies
  let refreshToken = req.body.token;
  if (!refreshToken) {
    refreshToken = extractRefreshToken(req, accountId);
  }

  if (!refreshToken) {
    throw new BadRequestError('Refresh token not found in body or cookies', 400, ApiErrorCode.TOKEN_INVALID);
  }

  try {
    // Verify and decode our refresh token
    const { accountId: tokenAccountId, exp } = verifyLocalRefreshToken(refreshToken);

    // Check if token is expired
    const isExpired = exp && Date.now() >= exp * 1000;
    if (isExpired) {
      return next(
        new JsonSuccess({
          isExpired: true,
          type: 'local_refresh_jwt',
        }),
      );
    }

    // Verify token belongs to correct account
    if (tokenAccountId !== accountId) {
      throw new BadRequestError('Token does not belong to this account', 400, ApiErrorCode.TOKEN_INVALID);
    }

    const response = {
      isExpired: false,
      type: 'local_refresh_jwt',
      expiresAt: exp ? exp * 1000 : null,
      timeRemaining: exp ? Math.max(0, exp * 1000 - Date.now()) : null,
      accountId: tokenAccountId,
    };

    next(new JsonSuccess(response));
  } catch {
    next(
      new JsonSuccess({
        isExpired: true,
        type: 'local_refresh_jwt',
        error: 'Invalid or expired refresh token',
      }),
    );
  }
});

/**
 * Refresh local auth access token
 * Route: POST /:accountId/auth/refresh
 */
export const refreshLocalToken = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const account = req.account as AccountDocument;
  const { redirectUrl } = req.query;

  // Validate account type
  if (account.accountType !== AccountType.Local) {
    throw new BadRequestError('Account is not a local authentication account', 400, ApiErrorCode.AUTH_FAILED);
  }

  // Extract refresh token
  const refreshToken = extractRefreshToken(req, accountId);
  if (!refreshToken) {
    throw new BadRequestError('Refresh token not found', 400, ApiErrorCode.TOKEN_INVALID);
  }

  // Refresh token is already verified by middleware, just use it
  const refreshTokenToUse = req.refreshToken;

  if (!refreshTokenToUse) {
    throw new BadRequestError('Refresh token not available', 400, ApiErrorCode.TOKEN_INVALID);
  }

  // Use the session manager to handle token refresh
  await handleTokenRefresh(accountId, refreshTokenToUse, AccountType.Local, req, res);

  // Validate and determine redirect URL
  if (!redirectUrl) {
    throw new BadRequestError('Missing redirectUrl query parameter', 400, ApiErrorCode.MISSING_DATA);
  }

  ValidationUtils.validateUrl(redirectUrl as string, 'Redirect URL');

  next(new Redirect(null, redirectUrl as string));
});
