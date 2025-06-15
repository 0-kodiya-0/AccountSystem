import { ValidationUtils } from '../../utils/validation';
import { LocalAuthRequest, PasswordChangeRequest } from './LocalAuth.types';

// Validate login request
export function validateLoginRequest(request: LocalAuthRequest): string | null {
  // Either email or username must be provided
  if (!request.email && !request.username) {
    return 'Email or username is required';
  }

  // Password must be provided
  if (!request.password) {
    return 'Password is required';
  }

  // If email is provided, validate format
  if (request.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(request.email)) {
      return 'Invalid email format';
    }
  }

  return null;
}

// Validate password change request
export function validatePasswordChangeRequest(request: PasswordChangeRequest): string | null {
  // Check if required fields are present
  if (!request.oldPassword || !request.newPassword || !request.confirmPassword) {
    return 'All fields are required';
  }

  // Check if new password is different from old password
  if (request.oldPassword === request.newPassword) {
    return 'New password must be different from the current password';
  }

  // Validate password strength
  try {
    ValidationUtils.validatePasswordStrength(request.newPassword);
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid new password';
  }

  // Validate password confirmation
  if (request.newPassword !== request.confirmPassword) {
    return 'New passwords do not match';
  }

  return null;
}
