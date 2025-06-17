import { AccountType } from '../account';

// Auth request interfaces
export interface LocalAuthRequest {
  email?: string;
  username?: string;
  password: string;
  rememberMe?: boolean;
}

export interface PasswordResetRequest {
  email: string;
  callbackUrl: string; // NEW: Required callback URL for password reset
}

export interface EmailVerificationRequest {
  email: string;
  callbackUrl: string; // NEW: Required callback URL for email verification
}

export interface PasswordChangeRequest {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface VerifyTwoFactorRequest {
  token: string;
}

// Password reset token interface
export interface PasswordResetToken {
  token: string;
  accountId: string;
  email: string;
  expiresAt: string;
}

// Email verification token interface
export interface EmailVerificationToken {
  token: string;
  accountId: string;
  email: string;
  expiresAt: string;
}

/**
 * JWT payload interface for local auth tokens
 */
export interface LocalAuthTokenPayload {
  sub: string; // accountId
  type: AccountType.Local;
  iat: number;
  exp?: number;
  isRefreshToken?: boolean;
}

export interface EmailVerificationData {
  email: string;
  verificationToken: string;
  step: 'email_verification' | 'profile_completion';
  expiresAt: string;
  createdAt: string;
}

export interface ProfileCompletionData {
  email: string;
  emailVerified: boolean;
  verificationToken: string;
  expiresAt: string;
}

export interface CompleteProfileRequest {
  firstName: string;
  lastName: string;
  username?: string;
  password: string;
  confirmPassword: string;
  birthdate?: string;
  agreeToTerms: boolean;
}
