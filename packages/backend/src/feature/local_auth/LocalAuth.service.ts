import bcrypt from 'bcrypt';
import { AccountStatus, AccountType, Account } from '../account/Account.types';
import { getModels } from '../../config/db.config';
import { BadRequestError, NotFoundError, ValidationError, ApiErrorCode, ServerError } from '../../types/response.types';
import { toSafeAccount } from '../account/Account.utils';
import {
  sendPasswordResetEmail,
  sendPasswordChangedNotification,
  sendSignupEmailVerification,
} from '../email/Email.service';
import { ValidationUtils } from '../../utils/validation';
import {
  getPasswordResetToken,
  removePasswordResetToken,
  savePasswordResetToken,
  removeProfileCompletionData,
  cleanupSignupData,
  getProfileCompletionData,
  markEmailVerifiedAndCreateProfileStep,
  getEmailVerificationDataByToken,
  removeEmailVerificationData,
  saveEmailForVerification,
  getEmailVerificationData,
} from './LocalAuth.cache';
import { logger } from '../../utils/logger';
import { sendCriticalEmail, sendNonCriticalEmail } from '../email/Email.utils';
import {
  CompleteProfileRequest,
  LocalAuthRequest,
  PasswordChangeRequest,
  PasswordResetRequest,
  PasswordResetVerificationRequest,
  PasswordResetVerificationResponse,
} from './LocalAuth.types';
import { saveTwoFactorTempToken } from '../twofa/TwoFA.cache';

export async function requestEmailVerification(email: string, callbackUrl: string): Promise<{ token: string }> {
  ValidationUtils.validateEmail(email);
  ValidationUtils.validateUrl(callbackUrl, 'Callback URL');

  // Check if email already exists in database
  const models = await getModels();
  const existingAccount = await models.accounts.Account.findOne({
    'userDetails.email': email,
  });

  if (existingAccount) {
    throw new BadRequestError(
      'Email already registered. Please use a different email or try logging in.',
      400,
      ApiErrorCode.USER_EXISTS,
    );
  }

  // Check if email is already in verification process
  const existingVerification = getEmailVerificationData(email);
  if (existingVerification) {
    // Resend verification email with existing token
    try {
      await sendCriticalEmail(
        sendSignupEmailVerification,
        [email, existingVerification.verificationToken, callbackUrl],
        { maxAttempts: 3, delayMs: 2000 },
      );
      logger.info(`Verification email resent to ${email}`);
    } catch (emailError) {
      logger.error('Failed to resend verification email:', emailError);
      throw new ServerError('Failed to send verification email. Please try again.', 500, ApiErrorCode.SERVER_ERROR);
    }

    return { token: existingVerification.verificationToken };
  }

  // Save email for verification and get token
  const verificationToken = saveEmailForVerification(email);

  // Send verification email with callback URL
  try {
    await sendCriticalEmail(sendSignupEmailVerification, [email, verificationToken, callbackUrl], {
      maxAttempts: 3,
      delayMs: 2000,
    });
    logger.info(`Verification email sent to ${email}`);
  } catch (emailError) {
    logger.error('Failed to send verification email:', emailError);

    // Clean up cache entry
    removeEmailVerificationData(email);

    throw new ServerError('Failed to send verification email. Please try again.', 500, ApiErrorCode.SERVER_ERROR);
  }

  return { token: verificationToken };
}

/**
 * Step 2: Verify email and move to profile completion
 */
export async function verifyEmailAndProceedToProfile(token: string): Promise<{ profileToken: string; email: string }> {
  ValidationUtils.validateRequiredFields({ token }, ['token']);

  // Get email verification data by token
  const emailData = getEmailVerificationDataByToken(token);
  if (!emailData) {
    throw new ValidationError('Invalid or expired verification token', 400, ApiErrorCode.TOKEN_INVALID);
  }

  // Mark email as verified and create profile completion step
  const profileToken = markEmailVerifiedAndCreateProfileStep(emailData.email);

  logger.info(`Email verified for ${emailData.email}, proceeding to profile completion`);

  return {
    profileToken,
    email: emailData.email,
  };
}

/**
 * Step 3: Complete profile and create account
 */
export async function completeProfileAndCreateAccount(
  profileToken: string,
  profileData: CompleteProfileRequest,
): Promise<Account> {
  const models = await getModels();

  ValidationUtils.validateRequiredFields(profileData, ['firstName', 'lastName', 'password', 'confirmPassword']);

  // Get profile completion data
  const completionData = getProfileCompletionData(profileToken);
  if (!completionData) {
    throw new ValidationError('Invalid or expired profile token', 400, ApiErrorCode.TOKEN_INVALID);
  }

  if (!completionData.emailVerified) {
    throw new ValidationError('Email must be verified before completing profile', 400, ApiErrorCode.AUTH_FAILED);
  }

  // Validate profile data
  ValidationUtils.validatePasswordStrength(profileData.password);
  ValidationUtils.validateStringLength(profileData.firstName, 'First name', 1, 50);
  ValidationUtils.validateStringLength(profileData.lastName, 'Last name', 1, 50);

  if (profileData.password !== profileData.confirmPassword) {
    throw new ValidationError('Passwords do not match', 400, ApiErrorCode.VALIDATION_ERROR);
  }

  if (!profileData.agreeToTerms) {
    throw new ValidationError('You must agree to the terms and conditions', 400, ApiErrorCode.VALIDATION_ERROR);
  }

  if (profileData.username) {
    ValidationUtils.validateStringLength(profileData.username, 'Username', 3, 30);

    // Check if username exists
    const existingUsername = await models.accounts.Account.findOne({
      'userDetails.username': profileData.username,
    });

    if (existingUsername) {
      throw new BadRequestError('Username already in use', 400, ApiErrorCode.USER_EXISTS);
    }
  }

  // Double-check email doesn't exist (safety check)
  const existingAccount = await models.accounts.Account.findOne({
    'userDetails.email': completionData.email,
  });

  if (existingAccount) {
    throw new BadRequestError('Email already registered', 400, ApiErrorCode.USER_EXISTS);
  }

  // Create account with verified email
  const timestamp = new Date().toISOString();

  const newAccount = await models.accounts.Account.create({
    created: timestamp,
    updated: timestamp,
    accountType: AccountType.Local,
    status: AccountStatus.Active, // Already verified!
    userDetails: {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      name: `${profileData.firstName} ${profileData.lastName}`,
      email: completionData.email,
      username: profileData.username,
      birthdate: profileData.birthdate,
      emailVerified: true, // Already verified in step 2
    },
    security: {
      password: profileData.password, // Will be hashed by pre-save hook
      twoFactorEnabled: false,
      sessionTimeout: 3600,
      autoLock: false,
      failedLoginAttempts: 0,
    },
  });

  // Clean up cache data
  removeProfileCompletionData(profileToken);

  logger.info(`Account created successfully for ${completionData.email}`);

  return toSafeAccount(newAccount) as Account;
}

/**
 * Delete email verification data (cancel signup)
 */
export async function cancelEmailVerification(email: string): Promise<boolean> {
  ValidationUtils.validateEmail(email);

  // Clean up all signup data for this email
  cleanupSignupData(email);

  logger.info(`Email verification cancelled for ${email}`);
  return true;
}

/**
 * Authenticate a user with local credentials
 */
export async function authenticateLocalUser(
  authData: LocalAuthRequest,
): Promise<Account | { requiresTwoFactor: true; tempToken: string; accountId: string }> {
  const models = await getModels();

  // Use ValidationUtils for validation
  if (!authData.email && !authData.username) {
    throw new BadRequestError('Email or username is required');
  }

  ValidationUtils.validateRequiredFields(authData, ['password']);

  if (authData.email) {
    ValidationUtils.validateEmail(authData.email);
  }

  if (authData.username) {
    ValidationUtils.validateStringLength(authData.username, 'Username', 3, 30);
  }

  // Find user by email or username
  const query = authData.email
    ? { 'userDetails.email': authData.email, accountType: AccountType.Local }
    : {
        'userDetails.username': authData.username,
        accountType: AccountType.Local,
      };

  const account = await models.accounts.Account.findOne(query);

  if (!account) {
    throw new NotFoundError('Invalid email/username or password', 401, ApiErrorCode.AUTH_FAILED);
  }

  // Check if account is locked
  if (account.security.lockoutUntil && account.security.lockoutUntil > new Date()) {
    throw new ValidationError(
      `Account is temporarily locked. Try again later or reset your password.`,
      401,
      ApiErrorCode.AUTH_FAILED,
    );
  }

  // Check if account is suspended
  if (account.status === AccountStatus.Suspended) {
    throw new ValidationError(
      'This account has been suspended. Please contact support.',
      401,
      ApiErrorCode.AUTH_FAILED,
    );
  }

  // Check if account is unverified
  if (account.status === AccountStatus.Unverified || !account.userDetails.emailVerified) {
    throw new ValidationError('Please verify your email address before logging in.', 401, ApiErrorCode.AUTH_FAILED);
  }

  // Verify password
  const isPasswordValid = await account.comparePassword!(authData.password);

  if (!isPasswordValid) {
    // Increment failed login attempts
    account.security.failedLoginAttempts = (account.security.failedLoginAttempts || 0) + 1;

    // Lock account after 5 failed attempts
    if (account.security.failedLoginAttempts >= 5) {
      account.security.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await account.save();

      throw new ValidationError(
        'Too many failed login attempts. Account locked for 15 minutes.',
        401,
        ApiErrorCode.AUTH_FAILED,
      );
    }

    await account.save();

    throw new NotFoundError('Invalid email/username or password', 401, ApiErrorCode.AUTH_FAILED);
  }

  // Reset failed login attempts on successful login
  if (!account.security.failedLoginAttempts || account.security.failedLoginAttempts > 0) {
    account.security.failedLoginAttempts = 0;
    account.security.lockoutUntil = undefined;
    await account.save();
  }

  // Check if 2FA is enabled
  if (account.security.twoFactorEnabled) {
    // Generate temporary token for 2FA verification
    const tempToken = saveTwoFactorTempToken(
      account._id.toString(),
      account.userDetails.email as string,
      AccountType.Local,
    );

    return {
      requiresTwoFactor: true,
      tempToken,
      accountId: account._id.toString(),
    };
  }

  // Return account
  return toSafeAccount(account) as Account;
}

/**
 * Request a password reset with callback URL
 */
export async function requestPasswordReset(data: PasswordResetRequest) {
  const models = await getModels();

  ValidationUtils.validateRequiredFields(data, ['email', 'callbackUrl']);
  ValidationUtils.validateEmail(data.email);
  ValidationUtils.validateUrl(data.callbackUrl, 'Callback URL');

  // Find account by email
  const account = await models.accounts.Account.findOne({
    'userDetails.email': data.email,
    accountType: AccountType.Local,
  });

  // If no account found, we still return success (security through obscurity)
  // But we don't send an email
  if (!account) {
    throw new BadRequestError(`Password reset requested for non-existent email: ${data.email}`);
  }

  // Generate reset token using cache
  const resetToken = savePasswordResetToken(account._id.toString(), account.userDetails.email as string);

  // Send password reset email with callback URL
  try {
    await sendCriticalEmail(
      sendPasswordResetEmail,
      [
        account.userDetails.email as string,
        account.userDetails.firstName || account.userDetails.name.split(' ')[0],
        resetToken,
        data.callbackUrl,
      ],
      { maxAttempts: 3, delayMs: 2000 },
    );
    logger.info(`Password reset email sent successfully to ${data.email}`);
    return { resetToken: resetToken };
  } catch (emailError) {
    logger.error('Failed to send password reset email:', emailError);

    // Clean up: Remove the reset token since email failed
    removePasswordResetToken(resetToken);

    // For password reset, we might want to fail silently or throw
    // Throwing is better for user feedback
    throw new ServerError(
      'Unable to send password reset email. Please try again or contact support if the issue persists.',
      500,
      ApiErrorCode.SERVER_ERROR,
    );
  }
}

export async function verifyPasswordResetRequest(
  data: PasswordResetVerificationRequest,
): Promise<PasswordResetVerificationResponse> {
  ValidationUtils.validateRequiredFields(data, ['token']);

  // Get token from cache
  const tokenData = getPasswordResetToken(data.token);

  if (!tokenData) {
    throw new ValidationError('Password reset token is invalid or has expired', 400, ApiErrorCode.TOKEN_INVALID);
  }

  // Verify token hasn't expired
  const expiresAt = new Date(tokenData.expiresAt).getTime();
  const currentTime = Date.now();
  if (expiresAt < currentTime) {
    removePasswordResetToken(data.token);
    throw new ValidationError('Password reset token has expired', 400, ApiErrorCode.TOKEN_EXPIRED);
  }

  // Cache the new reset token
  const resetToken = savePasswordResetToken(tokenData.accountId, tokenData.email);

  // Optional: Remove the verification token since it's been used
  removePasswordResetToken(data.token);

  // Log the verification for security audit
  logger.info('Password reset token verified successfully', {
    accountId: tokenData.accountId,
    email: tokenData.email,
    timestamp: currentTime,
  });

  return {
    success: true,
    message: 'Token verified successfully. You can now reset your password.',
    resetToken: resetToken,
    expiresAt: tokenData.expiresAt,
  };
}

/**
 * Reset password with cached token
 */
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const models = await getModels();

  ValidationUtils.validateRequiredFields({ token, newPassword }, ['token', 'newPassword']);
  ValidationUtils.validatePasswordStrength(newPassword);

  // Get token from cache
  const tokenData = getPasswordResetToken(token);

  if (!tokenData) {
    throw new ValidationError('Password reset token is invalid or has expired', 400, ApiErrorCode.TOKEN_INVALID);
  }

  // Find account by ID
  const account = await models.accounts.Account.findById(tokenData.accountId);

  if (!account || account.accountType !== AccountType.Local) {
    throw new ValidationError('Account not found', 400, ApiErrorCode.USER_NOT_FOUND);
  }

  // Verify email matches
  if (account.userDetails.email !== tokenData.email) {
    throw new ValidationError('Token email mismatch', 400, ApiErrorCode.TOKEN_INVALID);
  }

  // Check if new password matches any of the previous passwords
  if (account.security.previousPasswords && account.security.previousPasswords.length > 0) {
    const isReused = await Promise.all(
      account.security.previousPasswords.map((oldHash) => bcrypt.compare(newPassword, oldHash)),
    ).then((results) => results.some((result) => result === true));

    if (isReused) {
      throw new ValidationError(
        'New password cannot be the same as any of your previous passwords',
        400,
        ApiErrorCode.VALIDATION_ERROR,
      );
    }
  }

  // FIXED: Store the current password in previous passwords array (limited to last 5)
  if (account.security.password) {
    account.security.previousPasswords = account.security.previousPasswords || [];

    // Add current password to history and keep only the last 5
    account.security.previousPasswords.push(account.security.password);
    if (account.security.previousPasswords.length > 5) {
      account.security.previousPasswords.shift();
    }
  }

  // FIXED: Set the new password directly - the pre-save middleware will hash it
  account.security.password = newPassword;

  // Update last password change timestamp
  account.security.lastPasswordChange = new Date();

  // Reset failed login attempts
  account.security.failedLoginAttempts = 0;
  account.security.lockoutUntil = undefined;

  // Save the account - pre-save middleware will hash the password
  await account.save();

  // Remove token from cache
  removePasswordResetToken(token);

  await sendNonCriticalEmail(
    sendPasswordChangedNotification,
    [account.userDetails.email as string, account.userDetails.firstName || account.userDetails.name.split(' ')[0]],
    { maxAttempts: 2, delayMs: 1000 },
  );

  return true;
}

/**
 * Change password - now handles notification email failures properly
 */
export async function changePassword(accountId: string, data: PasswordChangeRequest): Promise<boolean> {
  const models = await getModels();

  ValidationUtils.validateObjectId(accountId, 'Account ID');
  ValidationUtils.validateRequiredFields(data, ['oldPassword', 'newPassword']);
  ValidationUtils.validatePasswordStrength(data.newPassword);

  // Find account by ID
  const account = await models.accounts.Account.findById(accountId);

  if (!account || account.accountType !== AccountType.Local) {
    throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
  }

  // Verify current password
  const isCurrentPasswordValid = await account.comparePassword!(data.oldPassword);

  if (!isCurrentPasswordValid) {
    throw new ValidationError('Current password is incorrect', 401, ApiErrorCode.AUTH_FAILED);
  }

  // Check if new password matches any of the previous passwords
  if (account.security.previousPasswords && account.security.previousPasswords.length > 0) {
    const isReused = await Promise.all(
      account.security.previousPasswords.map((oldHash) => bcrypt.compare(data.newPassword, oldHash)),
    ).then((results) => results.some((result) => result === true));

    if (isReused) {
      throw new ValidationError(
        'New password cannot be the same as any of your previous 5 passwords',
        400,
        ApiErrorCode.VALIDATION_ERROR,
      );
    }
  }

  // FIXED: Store the current password in previous passwords array (limited to last 5)
  if (account.security.password) {
    account.security.previousPasswords = account.security.previousPasswords || [];

    // Add current password to history and keep only the last 5
    account.security.previousPasswords.push(account.security.password);
    if (account.security.previousPasswords.length > 5) {
      account.security.previousPasswords.shift();
    }
  }

  // FIXED: Set the new password directly - the pre-save middleware will hash it
  account.security.password = data.newPassword;

  // Update last password change timestamp
  account.security.lastPasswordChange = new Date();

  // Save the account - pre-save middleware will hash the password
  await account.save();

  sendNonCriticalEmail(
    sendPasswordChangedNotification,
    [account.userDetails.email as string, account.userDetails.firstName || account.userDetails.name.split(' ')[0]],
    { maxAttempts: 2, delayMs: 1000 },
  );

  return true;
}
