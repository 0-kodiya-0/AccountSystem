import {
  LocalAuthRequest,
  CompleteProfileRequest,
  PasswordChangeRequest,
  PasswordResetRequest,
} from '../../feature/local_auth/LocalAuth.types';
import { SetupTwoFactorRequest, VerifyTwoFactorLoginRequest } from '../../feature/twofa/TwoFA.types';

export const mockLocalAuthRequest: LocalAuthRequest = {
  email: 'john.doe@example.com',
  password: 'SecurePassword123!',
  rememberMe: true,
};

export const mockUsernameAuthRequest: LocalAuthRequest = {
  username: 'johndoe90',
  password: 'SecurePassword123!',
  rememberMe: false,
};

export const mockCompleteProfileRequest: CompleteProfileRequest = {
  firstName: 'John',
  lastName: 'Doe',
  username: 'johndoe90',
  password: 'SecurePassword123!',
  confirmPassword: 'SecurePassword123!',
  birthdate: '1990-05-15',
  agreeToTerms: true,
};

export const mockPasswordChangeRequest: PasswordChangeRequest = {
  oldPassword: 'OldPassword123!',
  newPassword: 'NewSecurePassword456!',
  confirmPassword: 'NewSecurePassword456!',
};

export const mockPasswordResetRequest: PasswordResetRequest = {
  email: 'john.doe@example.com',
  callbackUrl: 'https://app.example.com/reset-password-callback',
};

export const mockSetupTwoFactorRequest: SetupTwoFactorRequest = {
  enableTwoFactor: true,
  password: 'SecurePassword123!', // For local accounts
};

export const mockVerifyTwoFactorLoginRequest: VerifyTwoFactorLoginRequest = {
  token: '123456',
  tempToken: 'temp_2fa_token_example_12345',
};
