import { describe, it, expect } from 'vitest';
import { ValidationUtils } from '../validation';
import { ValidationError, BadRequestError, ApiErrorCode } from '../../types/response.types';

describe('ValidationUtils', () => {
  describe('validateObjectId', () => {
    it('should accept valid MongoDB ObjectIds', () => {
      expect(() => ValidationUtils.validateObjectId('507f1f77bcf86cd799439011')).not.toThrow();
      expect(() => ValidationUtils.validateObjectId('65a1b2c3d4e5f6a7b8c9d0e1')).not.toThrow();
    });

    it('should reject invalid ObjectIds', () => {
      expect(() => ValidationUtils.validateObjectId('invalid-id')).toThrow(BadRequestError);
      expect(() => ValidationUtils.validateObjectId('123')).toThrow('Invalid ID format');
      expect(() => ValidationUtils.validateObjectId('507f1f77bcf86cd79943901')).toThrow('Invalid ID format'); // Too short
    });

    it('should reject empty ObjectIds', () => {
      expect(() => ValidationUtils.validateObjectId('')).toThrow('ID is required');
      expect(() => ValidationUtils.validateObjectId(null as any)).toThrow('ID is required');
      expect(() => ValidationUtils.validateObjectId(undefined as any)).toThrow('ID is required');
    });

    it('should use custom field name in error message', () => {
      expect(() => ValidationUtils.validateObjectId('invalid', 'Account ID')).toThrow('Invalid Account ID format');
      expect(() => ValidationUtils.validateObjectId('', 'User ID')).toThrow('User ID is required');
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email formats', () => {
      expect(() => ValidationUtils.validateEmail('test@example.com')).not.toThrow();
      expect(() => ValidationUtils.validateEmail('user.name+tag@example.co.uk')).not.toThrow();
      expect(() => ValidationUtils.validateEmail('user123@domain-name.org')).not.toThrow();
      expect(() => ValidationUtils.validateEmail('a@b.co')).not.toThrow();
    });

    it('should reject invalid email formats', () => {
      expect(() => ValidationUtils.validateEmail('invalid-email')).toThrow(ValidationError);
      expect(() => ValidationUtils.validateEmail('test@')).toThrow('Invalid email format');
      expect(() => ValidationUtils.validateEmail('@domain.com')).toThrow('Invalid email format');
      expect(() => ValidationUtils.validateEmail('test..email@domain.com')).toThrow('Invalid email format');
      expect(() => ValidationUtils.validateEmail('test@domain')).toThrow('Invalid email format');
    });

    it('should reject empty emails', () => {
      expect(() => ValidationUtils.validateEmail('')).toThrow('Email is required');
      expect(() => ValidationUtils.validateEmail(null as any)).toThrow('Email is required');
      expect(() => ValidationUtils.validateEmail(undefined as any)).toThrow('Email is required');
    });

    it('should throw ValidationError with correct code', () => {
      try {
        ValidationUtils.validateEmail('invalid');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError<any>).code).toBe(ApiErrorCode.VALIDATION_ERROR);
      }
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept strong passwords', () => {
      expect(() => ValidationUtils.validatePasswordStrength('StrongPass123!')).not.toThrow();
      expect(() => ValidationUtils.validatePasswordStrength('MyP@ssw0rd')).not.toThrow();
      expect(() => ValidationUtils.validatePasswordStrength('ComplexP@ss1')).not.toThrow();
    });

    it('should reject passwords that are too short', () => {
      expect(() => ValidationUtils.validatePasswordStrength('Short1!')).toThrow(
        'Password must be at least 8 characters long',
      );
      expect(() => ValidationUtils.validatePasswordStrength('P@s1')).toThrow(
        'Password must be at least 8 characters long',
      );
    });

    it('should require uppercase letters', () => {
      expect(() => ValidationUtils.validatePasswordStrength('nouppercase123!')).toThrow(
        'Password must contain at least one uppercase letter',
      );
      expect(() => ValidationUtils.validatePasswordStrength('alllowercase1!')).toThrow('uppercase letter');
    });

    it('should require lowercase letters', () => {
      expect(() => ValidationUtils.validatePasswordStrength('NOLOWERCASE123!')).toThrow(
        'Password must contain at least one lowercase letter',
      );
      expect(() => ValidationUtils.validatePasswordStrength('ALLUPPERCASE1!')).toThrow('lowercase letter');
    });

    it('should require numbers', () => {
      expect(() => ValidationUtils.validatePasswordStrength('NoNumbers!')).toThrow(
        'Password must contain at least one number',
      );
      expect(() => ValidationUtils.validatePasswordStrength('OnlyLetters!')).toThrow('number');
    });

    it('should require special characters', () => {
      expect(() => ValidationUtils.validatePasswordStrength('NoSpecialChar123')).toThrow(
        'Password must contain at least one special character',
      );
      expect(() => ValidationUtils.validatePasswordStrength('AlphaNumeric123')).toThrow('special character');
    });

    it('should reject empty passwords', () => {
      expect(() => ValidationUtils.validatePasswordStrength('')).toThrow('Password is required');
      expect(() => ValidationUtils.validatePasswordStrength(null as any)).toThrow('Password is required');
    });
  });

  describe('validateRequiredFields', () => {
    it('should pass when all required fields are present', () => {
      const obj = { name: 'John', email: 'john@example.com', age: 25 };
      expect(() => ValidationUtils.validateRequiredFields(obj, ['name', 'email'])).not.toThrow();
    });

    it('should throw when required fields are missing', () => {
      const obj = { name: 'John' };
      expect(() => ValidationUtils.validateRequiredFields(obj, ['name', 'email'])).toThrow(BadRequestError);
      expect(() => ValidationUtils.validateRequiredFields(obj, ['name', 'email'])).toThrow(
        'Missing required fields: email',
      );
    });

    it('should throw when multiple fields are missing', () => {
      const obj = { age: 25 };
      expect(() => ValidationUtils.validateRequiredFields(obj, ['name', 'email', 'password'])).toThrow(
        'Missing required fields: name, email, password',
      );
    });

    it('should handle empty values as missing', () => {
      const obj = { name: '', email: null, password: undefined };
      expect(() => ValidationUtils.validateRequiredFields(obj, ['name', 'email', 'password'])).toThrow(
        'Missing required fields: name, email, password',
      );
    });
  });

  describe('validatePaginationParams', () => {
    it('should return default values for empty params', () => {
      const result = ValidationUtils.validatePaginationParams({});
      expect(result).toEqual({ limit: 50, offset: 0 });
    });

    it('should parse valid limit and offset', () => {
      const result = ValidationUtils.validatePaginationParams({ limit: '10', offset: '20' });
      expect(result).toEqual({ limit: 10, offset: 20 });
    });

    it('should reject invalid limit values', () => {
      expect(() => ValidationUtils.validatePaginationParams({ limit: '0' })).toThrow('Limit must be between 1 and 100');
      expect(() => ValidationUtils.validatePaginationParams({ limit: '101' })).toThrow(
        'Limit must be between 1 and 100',
      );
      expect(() => ValidationUtils.validatePaginationParams({ limit: 'invalid' })).toThrow(
        'Limit must be between 1 and 100',
      );
    });

    it('should reject invalid offset values', () => {
      expect(() => ValidationUtils.validatePaginationParams({ offset: '-1' })).toThrow(
        'Offset must be a non-negative number',
      );
      expect(() => ValidationUtils.validatePaginationParams({ offset: 'invalid' })).toThrow(
        'Offset must be a non-negative number',
      );
    });
  });

  describe('validateStringLength', () => {
    it('should accept strings within valid length range', () => {
      expect(() => ValidationUtils.validateStringLength('hello', 'Name', 3, 10)).not.toThrow();
      expect(() => ValidationUtils.validateStringLength('test', 'Field', 4, 4)).not.toThrow();
    });

    it('should reject strings that are too short', () => {
      expect(() => ValidationUtils.validateStringLength('hi', 'Name', 3)).toThrow('Name must be at least 3 characters');
    });

    it('should reject strings that are too long', () => {
      expect(() => ValidationUtils.validateStringLength('verylongstring', 'Name', 1, 5)).toThrow(
        'Name cannot exceed 5 characters',
      );
    });

    it('should reject empty strings', () => {
      expect(() => ValidationUtils.validateStringLength('', 'Name')).toThrow('Name is required');
    });

    it('should work with only minimum length specified', () => {
      expect(() => ValidationUtils.validateStringLength('test', 'Name', 3)).not.toThrow();
      expect(() => ValidationUtils.validateStringLength('hi', 'Name', 3)).toThrow('Name must be at least 3 characters');
    });

    it('should work with only maximum length specified', () => {
      expect(() => ValidationUtils.validateStringLength('test', 'Name', undefined, 5)).not.toThrow();
      expect(() => ValidationUtils.validateStringLength('toolong', 'Name', undefined, 5)).toThrow(
        'Name cannot exceed 5 characters',
      );
    });
  });

  describe('validateEnum', () => {
    enum TestEnum {
      VALUE1 = 'value1',
      VALUE2 = 'value2',
      VALUE3 = 'value3',
    }

    it('should accept valid enum values', () => {
      expect(ValidationUtils.validateEnum('value1', TestEnum, 'Test Field')).toBe('value1');
      expect(ValidationUtils.validateEnum('value2', TestEnum, 'Test Field')).toBe('value2');
    });

    it('should reject invalid enum values', () => {
      expect(() => ValidationUtils.validateEnum('invalid', TestEnum, 'Test Field')).toThrow(
        'Invalid Test Field. Must be one of: value1, value2, value3',
      );
    });

    it('should reject empty values', () => {
      expect(() => ValidationUtils.validateEnum('', TestEnum, 'Test Field')).toThrow('Test Field is required');
    });
  });

  describe('validateUrl', () => {
    it('should accept valid URLs', () => {
      expect(() => ValidationUtils.validateUrl('https://example.com')).not.toThrow();
      expect(() => ValidationUtils.validateUrl('http://localhost:3000')).not.toThrow();
      expect(() => ValidationUtils.validateUrl('https://sub.domain.com/path?query=1')).not.toThrow();
    });

    it('should reject invalid URLs', () => {
      expect(() => ValidationUtils.validateUrl('invalid-url')).toThrow('Invalid URL format');
      expect(() => ValidationUtils.validateUrl('not-a-url')).toThrow('Invalid URL format');
      expect(() => ValidationUtils.validateUrl('ftp://example.com')).not.toThrow(); // Valid URL protocol
    });

    it('should reject empty URLs', () => {
      expect(() => ValidationUtils.validateUrl('')).toThrow('URL is required');
      expect(() => ValidationUtils.validateUrl('', 'Callback URL')).toThrow('Callback URL is required');
    });

    it('should use custom field name in error message', () => {
      expect(() => ValidationUtils.validateUrl('invalid', 'Redirect URL')).toThrow('Invalid Redirect URL format');
    });
  });

  describe('validateAccessToken', () => {
    it('should accept valid access tokens', () => {
      expect(() => ValidationUtils.validateAccessToken('valid.access.token', 'test')).not.toThrow();
      expect(() => ValidationUtils.validateAccessToken('ya29.a0AVvZVsoKj1234567890')).not.toThrow();
    });

    it('should reject empty tokens', () => {
      expect(() => ValidationUtils.validateAccessToken('', 'test')).toThrow('Access token is required for test');
      expect(() => ValidationUtils.validateAccessToken(null as any)).toThrow('Access token is required for operation');
    });

    it('should reject non-string tokens', () => {
      expect(() => ValidationUtils.validateAccessToken(123 as any, 'test')).toThrow(
        'Access token must be a string for test',
      );
    });

    it('should reject tokens that are too short', () => {
      expect(() => ValidationUtils.validateAccessToken('short', 'test')).toThrow(
        'Invalid access token format for test',
      );
    });

    it('should reject whitespace-only tokens', () => {
      expect(() => ValidationUtils.validateAccessToken('   ', 'test')).toThrow('Access token cannot be empty for test');
    });
  });

  describe('validateJwtToken', () => {
    it('should accept valid JWT format', () => {
      expect(() => ValidationUtils.validateJwtToken('header.payload.signature')).not.toThrow();
      expect(() => ValidationUtils.validateJwtToken('a.b.c', 'Custom Token', 'test')).not.toThrow();
    });

    it('should reject malformed JWT tokens', () => {
      expect(() => ValidationUtils.validateJwtToken('invalid.jwt')).toThrow('Invalid JWT token format for operation');
      expect(() => ValidationUtils.validateJwtToken('a.b.c.d')).toThrow('Invalid JWT token format for operation');
    });

    it('should reject tokens with empty parts', () => {
      expect(() => ValidationUtils.validateJwtToken('a..c')).toThrow('Invalid JWT token structure for operation');
      expect(() => ValidationUtils.validateJwtToken('.b.c')).toThrow('Invalid JWT token structure for operation');
    });

    it('should use custom token type and context in error messages', () => {
      expect(() => ValidationUtils.validateJwtToken('', 'Access Token', 'login')).toThrow(
        'Access Token is required for login',
      );
      expect(() => ValidationUtils.validateJwtToken('invalid', 'Refresh Token', 'refresh')).toThrow(
        'Invalid Refresh Token format for refresh',
      );
    });
  });
});
