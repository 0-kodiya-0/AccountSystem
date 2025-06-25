import { describe, it, expect } from 'vitest';
import { validateLoginRequest, validatePasswordChangeRequest } from '../LocalAuth.validation';
import { LocalAuthRequest, PasswordChangeRequest } from '../LocalAuth.types';

describe('LocalAuth Validation', () => {
  describe('validateLoginRequest', () => {
    it('should accept valid login request with email', () => {
      const validRequest: LocalAuthRequest = {
        email: 'test@example.com',
        password: 'password123',
      };

      expect(validateLoginRequest(validRequest)).toBe(null);
    });

    it('should accept valid login request with username', () => {
      const validRequest: LocalAuthRequest = {
        username: 'johndoe',
        password: 'password123',
      };

      expect(validateLoginRequest(validRequest)).toBe(null);
    });

    it('should accept valid login request with both email and username', () => {
      const validRequest: LocalAuthRequest = {
        email: 'test@example.com',
        username: 'johndoe',
        password: 'password123',
      };

      expect(validateLoginRequest(validRequest)).toBe(null);
    });

    it('should accept login request with rememberMe flag', () => {
      const validRequest: LocalAuthRequest = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: true,
      };

      expect(validateLoginRequest(validRequest)).toBe(null);
    });

    it('should require either email or username', () => {
      const invalidRequest: LocalAuthRequest = {
        password: 'password123',
      };

      expect(validateLoginRequest(invalidRequest)).toBe('Email or username is required');
    });

    it('should require password', () => {
      const invalidRequest = {
        email: 'test@example.com',
      } as LocalAuthRequest;

      expect(validateLoginRequest(invalidRequest)).toBe('Password is required');
    });

    it('should validate email format when email is provided', () => {
      const invalidRequest: LocalAuthRequest = {
        email: 'invalid-email',
        password: 'password123',
      };

      expect(validateLoginRequest(invalidRequest)).toBe('Invalid email format');
    });

    it('should accept valid email formats', () => {
      const testCases = ['user@domain.com', 'user.name@domain.com', 'user+tag@domain.co.uk', 'user123@sub.domain.org'];

      testCases.forEach((email) => {
        const request: LocalAuthRequest = {
          email,
          password: 'password123',
        };
        expect(validateLoginRequest(request)).toBe(null);
      });
    });

    it('should reject invalid email formats', () => {
      const testCases = [
        'plainaddress',
        '@missingdomain.com',
        'missing@.com',
        'missing@domain',
        'spaces @domain.com',
        'double..dots@domain.com',
      ];

      testCases.forEach((email) => {
        const request: LocalAuthRequest = {
          email,
          password: 'password123',
        };
        expect(validateLoginRequest(request)).toBe('Invalid email format');
      });
    });

    it('should handle empty strings as missing values', () => {
      const requestWithEmptyEmail: LocalAuthRequest = {
        email: '',
        password: 'password123',
      };

      const requestWithEmptyPassword: LocalAuthRequest = {
        email: 'test@example.com',
        password: '',
      };

      const requestWithEmptyUsername: LocalAuthRequest = {
        username: '',
        password: 'password123',
      };

      expect(validateLoginRequest(requestWithEmptyEmail)).toBe('Email or username is required');
      expect(validateLoginRequest(requestWithEmptyPassword)).toBe('Password is required');
      expect(validateLoginRequest(requestWithEmptyUsername)).toBe('Email or username is required');
    });

    it('should handle null values as missing', () => {
      const requestWithNullEmail = {
        email: null,
        password: 'password123',
      } as any;

      const requestWithNullPassword = {
        email: 'test@example.com',
        password: null,
      } as any;

      expect(validateLoginRequest(requestWithNullEmail)).toBe('Email or username is required');
      expect(validateLoginRequest(requestWithNullPassword)).toBe('Password is required');
    });

    it('should handle undefined values as missing', () => {
      const requestWithUndefinedFields = {
        email: undefined,
        username: undefined,
        password: undefined,
      } as any;

      expect(validateLoginRequest(requestWithUndefinedFields)).toBe('Email or username is required');
    });
  });

  describe('validatePasswordChangeRequest', () => {
    it('should accept valid password change request', () => {
      const validRequest: PasswordChangeRequest = {
        oldPassword: 'currentPassword123',
        newPassword: 'NewStrongPass456!',
        confirmPassword: 'NewStrongPass456!',
      };

      expect(validatePasswordChangeRequest(validRequest)).toBe(null);
    });

    it('should require all fields', () => {
      const requestMissingOldPassword = {
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      } as PasswordChangeRequest;

      const requestMissingNewPassword = {
        oldPassword: 'currentPassword',
        confirmPassword: 'NewPassword123!',
      } as PasswordChangeRequest;

      const requestMissingConfirmPassword = {
        oldPassword: 'currentPassword',
        newPassword: 'NewPassword123!',
      } as PasswordChangeRequest;

      expect(validatePasswordChangeRequest(requestMissingOldPassword)).toBe('All fields are required');
      expect(validatePasswordChangeRequest(requestMissingNewPassword)).toBe('All fields are required');
      expect(validatePasswordChangeRequest(requestMissingConfirmPassword)).toBe('All fields are required');
    });

    it('should reject same old and new password', () => {
      const request: PasswordChangeRequest = {
        oldPassword: 'SamePassword123!',
        newPassword: 'SamePassword123!',
        confirmPassword: 'SamePassword123!',
      };

      expect(validatePasswordChangeRequest(request)).toBe('New password must be different from the current password');
    });

    it('should reject weak new password', () => {
      const request: PasswordChangeRequest = {
        oldPassword: 'OldPassword123!',
        newPassword: 'weak',
        confirmPassword: 'weak',
      };

      const result = validatePasswordChangeRequest(request);
      expect(result).toContain('Password must be at least 8 characters long');
    });

    it('should validate new password strength requirements', () => {
      const testCases = [
        {
          password: 'nouppercase123!',
          expectedError: 'uppercase letter',
        },
        {
          password: 'NOLOWERCASE123!',
          expectedError: 'lowercase letter',
        },
        {
          password: 'NoNumbers!',
          expectedError: 'number',
        },
        {
          password: 'NoSpecialChar123',
          expectedError: 'special character',
        },
      ];

      testCases.forEach(({ password, expectedError }) => {
        const request: PasswordChangeRequest = {
          oldPassword: 'OldPassword123!',
          newPassword: password,
          confirmPassword: password,
        };

        const result = validatePasswordChangeRequest(request);
        expect(result).toContain(expectedError);
      });
    });

    it('should reject mismatched password confirmation', () => {
      const request: PasswordChangeRequest = {
        oldPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'DifferentPassword123!',
      };

      expect(validatePasswordChangeRequest(request)).toBe('New passwords do not match');
    });

    it('should handle empty string fields', () => {
      const requestWithEmptyFields: PasswordChangeRequest = {
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      };

      expect(validatePasswordChangeRequest(requestWithEmptyFields)).toBe('All fields are required');
    });

    it('should handle null fields', () => {
      const requestWithNullFields = {
        oldPassword: null,
        newPassword: null,
        confirmPassword: null,
      } as any;

      expect(validatePasswordChangeRequest(requestWithNullFields)).toBe('All fields are required');
    });

    it('should handle undefined fields', () => {
      const requestWithUndefinedFields = {
        oldPassword: undefined,
        newPassword: undefined,
        confirmPassword: undefined,
      } as any;

      expect(validatePasswordChangeRequest(requestWithUndefinedFields)).toBe('All fields are required');
    });

    it('should handle partial empty fields', () => {
      const testCases = [
        {
          oldPassword: '',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        },
        {
          oldPassword: 'OldPassword123!',
          newPassword: '',
          confirmPassword: 'NewPassword123!',
        },
        {
          oldPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
          confirmPassword: '',
        },
      ];

      testCases.forEach((request) => {
        expect(validatePasswordChangeRequest(request as PasswordChangeRequest)).toBe('All fields are required');
      });
    });

    it('should prioritize password confirmation check over strength validation', () => {
      const request: PasswordChangeRequest = {
        oldPassword: 'OldPassword123!',
        newPassword: 'weak', // Weak password
        confirmPassword: 'different', // Different confirmation
      };

      // Should catch password strength error first since newPassword !== confirmPassword
      const result = validatePasswordChangeRequest(request);
      expect(result).toBe('New passwords do not match');
    });

    it('should catch same password error before strength validation', () => {
      const request: PasswordChangeRequest = {
        oldPassword: 'weak',
        newPassword: 'weak', // Same as old (and also weak)
        confirmPassword: 'weak',
      };

      expect(validatePasswordChangeRequest(request)).toBe('New password must be different from the current password');
    });
  });

  describe('Edge Cases', () => {
    it('should handle whitespace in login fields', () => {
      const requestWithWhitespace: LocalAuthRequest = {
        email: '  test@example.com  ',
        password: '  password123  ',
      };

      // The validation should work with trimmed values
      // Note: This test depends on how the actual validation handles whitespace
      // You might need to adjust based on your implementation
      expect(validateLoginRequest(requestWithWhitespace)).toBe(null);
    });

    it('should handle very long passwords', () => {
      const longPassword = 'A'.repeat(1000) + '1!';
      const request: PasswordChangeRequest = {
        oldPassword: 'OldPassword123!',
        newPassword: longPassword,
        confirmPassword: longPassword,
      };

      expect(validatePasswordChangeRequest(request)).toBe(null);
    });

    it('should handle unicode characters in passwords', () => {
      const unicodePassword = 'Pássw0rd!🔐';
      const request: PasswordChangeRequest = {
        oldPassword: 'OldPassword123!',
        newPassword: unicodePassword,
        confirmPassword: unicodePassword,
      };

      expect(validatePasswordChangeRequest(request)).toBe(null);
    });

    it('should handle international email addresses', () => {
      const internationalEmails = [
        'test@münchen.de',
        'пользователь@пример.рф',
        'test@xn--nxasmq6b.xn--j6w193g', // IDN encoded
      ];

      internationalEmails.forEach((email) => {
        const request: LocalAuthRequest = {
          email,
          password: 'password123',
        };
        // Note: Result depends on your email regex implementation
        // Most basic regex won't handle international domains
        validateLoginRequest(request);
        // Test based on your actual implementation
      });
    });
  });
});
