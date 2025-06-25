import { describe, it, expect } from 'vitest';
import { validateUserDetails, validateSecuritySettings, validateAccount } from '../Account.validation';
import { AccountType, AccountStatus, OAuthProviders, UserDetails, SecuritySettings, Account } from '../Account.types';
import { AccountValidationError } from '../../../types/response.types';

describe('Account Validation', () => {
  describe('validateUserDetails', () => {
    it('should accept valid user details with all fields', () => {
      const userDetails: UserDetails = {
        firstName: 'John',
        lastName: 'Doe',
        name: 'John Doe',
        email: 'john@example.com',
        imageUrl: 'https://example.com/avatar.jpg',
        birthdate: '1990-01-01',
        username: 'johndoe',
        emailVerified: true,
      };

      expect(validateUserDetails(userDetails)).toBe(true);
    });

    it('should accept valid user details with only required fields', () => {
      const userDetails: UserDetails = {
        name: 'Jane Doe',
      };

      expect(validateUserDetails(userDetails)).toBe(true);
    });

    it('should accept user details with optional email', () => {
      const userDetails: UserDetails = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      expect(validateUserDetails(userDetails)).toBe(true);
    });

    it('should accept user details with undefined optional fields', () => {
      const userDetails: UserDetails = {
        name: 'John Doe',
        email: undefined,
        imageUrl: undefined,
        username: undefined,
        firstName: undefined,
        lastName: undefined,
        birthdate: undefined,
        emailVerified: undefined,
      };

      expect(validateUserDetails(userDetails)).toBe(true);
    });

    it('should reject user details without name', () => {
      const userDetails = {
        email: 'john@example.com',
      } as any;

      expect(validateUserDetails(userDetails)).toBe(false);
    });

    it('should reject user details with invalid name type', () => {
      const userDetails = {
        name: 123,
      } as any;

      expect(validateUserDetails(userDetails)).toBe(false);
    });

    it('should reject user details with invalid email type', () => {
      const userDetails = {
        name: 'John Doe',
        email: 123,
      } as any;

      expect(validateUserDetails(userDetails)).toBe(false);
    });

    it('should reject null user details', () => {
      expect(validateUserDetails(null as any)).toBe(false);
    });

    it('should reject non-object user details', () => {
      expect(validateUserDetails('string' as any)).toBe(false);
      expect(validateUserDetails(123 as any)).toBe(false);
    });

    it('should reject user details with invalid boolean fields', () => {
      const userDetails = {
        name: 'John Doe',
        emailVerified: 'true', // Should be boolean
      } as any;

      expect(validateUserDetails(userDetails)).toBe(false);
    });
  });

  describe('validateSecuritySettings', () => {
    it('should accept valid security settings for local account with password', () => {
      const securitySettings: SecuritySettings = {
        password: 'hashedPassword123',
        twoFactorEnabled: false,
        sessionTimeout: 3600,
        autoLock: false,
        passwordSalt: 'salt123',
        failedLoginAttempts: 0,
      };

      expect(validateSecuritySettings(securitySettings, AccountType.Local)).toBe(true);
    });

    it('should accept valid security settings for OAuth account without password', () => {
      const securitySettings: SecuritySettings = {
        twoFactorEnabled: false,
        sessionTimeout: 3600,
        autoLock: false,
      };

      expect(validateSecuritySettings(securitySettings, AccountType.OAuth)).toBe(true);
    });

    it('should require password for local accounts', () => {
      const securitySettings: SecuritySettings = {
        twoFactorEnabled: false,
        sessionTimeout: 3600,
        autoLock: false,
      };

      expect(() => validateSecuritySettings(securitySettings, AccountType.Local)).toThrow(AccountValidationError);
      expect(() => validateSecuritySettings(securitySettings, AccountType.Local)).toThrow(
        'Local accounts must have a password',
      );
    });

    it('should reject password for OAuth accounts', () => {
      const securitySettings: SecuritySettings = {
        password: 'shouldNotHaveThis',
        twoFactorEnabled: false,
        sessionTimeout: 3600,
        autoLock: false,
      };

      expect(() => validateSecuritySettings(securitySettings, AccountType.OAuth)).toThrow(AccountValidationError);
      expect(() => validateSecuritySettings(securitySettings, AccountType.OAuth)).toThrow(
        'OAuth accounts should not have a password',
      );
    });

    it('should reject invalid security settings structure', () => {
      const invalidSettings = {
        twoFactorEnabled: 'false', // Should be boolean
        sessionTimeout: 3600,
        autoLock: false,
      } as any;

      expect(() => validateSecuritySettings(invalidSettings, AccountType.Local)).toThrow(AccountValidationError);
    });

    it('should reject security settings with invalid sessionTimeout', () => {
      const invalidSettings = {
        twoFactorEnabled: false,
        sessionTimeout: 'invalid', // Should be number
        autoLock: false,
      } as any;

      expect(() => validateSecuritySettings(invalidSettings, AccountType.Local)).toThrow(AccountValidationError);
    });

    it('should reject security settings with invalid autoLock', () => {
      const invalidSettings = {
        twoFactorEnabled: false,
        sessionTimeout: 3600,
        autoLock: 'false', // Should be boolean
      } as any;

      expect(() => validateSecuritySettings(invalidSettings, AccountType.Local)).toThrow(AccountValidationError);
    });

    it('should reject null security settings', () => {
      expect(() => validateSecuritySettings(null as any, AccountType.Local)).toThrow(AccountValidationError);
    });
  });

  describe('validateAccount', () => {
    it('should accept valid local account', () => {
      const account = {
        created: '2023-01-01T00:00:00.000Z',
        updated: '2023-01-01T00:00:00.000Z',
        accountType: AccountType.Local,
        status: AccountStatus.Active,
        userDetails: {
          name: 'John Doe',
          email: 'john@example.com',
          emailVerified: true,
        },
        security: {
          password: 'hashedPassword',
          twoFactorEnabled: false,
          sessionTimeout: 3600,
          autoLock: false,
        },
      };

      expect(validateAccount(account)).toBe(true);
    });

    it('should accept valid OAuth account', () => {
      const account = {
        created: '2023-01-01T00:00:00.000Z',
        updated: '2023-01-01T00:00:00.000Z',
        accountType: AccountType.OAuth,
        status: AccountStatus.Active,
        provider: OAuthProviders.Google,
        userDetails: {
          name: 'Jane Doe',
          email: 'jane@gmail.com',
          emailVerified: true,
        },
        security: {
          twoFactorEnabled: false,
          sessionTimeout: 3600,
          autoLock: false,
        },
      };

      expect(validateAccount(account)).toBe(true);
    });

    it('should require provider for OAuth accounts', () => {
      const account = {
        created: '2023-01-01T00:00:00.000Z',
        updated: '2023-01-01T00:00:00.000Z',
        accountType: AccountType.OAuth,
        status: AccountStatus.Active,
        userDetails: {
          name: 'Jane Doe',
          email: 'jane@gmail.com',
        },
        security: {
          twoFactorEnabled: false,
          sessionTimeout: 3600,
          autoLock: false,
        },
      };

      expect(() => validateAccount(account)).toThrow(AccountValidationError);
      expect(() => validateAccount(account)).toThrow('OAuth accounts must have a provider');
    });

    it('should reject invalid OAuth provider', () => {
      const account = {
        created: '2023-01-01T00:00:00.000Z',
        updated: '2023-01-01T00:00:00.000Z',
        accountType: AccountType.OAuth,
        status: AccountStatus.Active,
        provider: 'invalid-provider' as any,
        userDetails: {
          name: 'Jane Doe',
          email: 'jane@gmail.com',
        },
        security: {
          twoFactorEnabled: false,
          sessionTimeout: 3600,
          autoLock: false,
        },
      };

      expect(() => validateAccount(account)).toThrow(AccountValidationError);
      expect(() => validateAccount(account)).toThrow('Invalid OAuth provider');
    });

    it('should reject provider for local accounts', () => {
      const account = {
        created: '2023-01-01T00:00:00.000Z',
        updated: '2023-01-01T00:00:00.000Z',
        accountType: AccountType.Local,
        status: AccountStatus.Active,
        provider: OAuthProviders.Google,
        userDetails: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        security: {
          password: 'hashedPassword',
          twoFactorEnabled: false,
          sessionTimeout: 3600,
          autoLock: false,
        },
      };

      expect(() => validateAccount(account)).toThrow(AccountValidationError);
      expect(() => validateAccount(account)).toThrow('Local accounts should not have a provider');
    });

    it('should reject account with invalid created timestamp', () => {
      const account = {
        created: 'invalid-date',
        updated: '2023-01-01T00:00:00.000Z',
        accountType: AccountType.Local,
        status: AccountStatus.Active,
        userDetails: {
          name: 'John Doe',
        },
        security: {
          password: 'hashedPassword',
          twoFactorEnabled: false,
          sessionTimeout: 3600,
          autoLock: false,
        },
      };

      expect(() => validateAccount(account)).toThrow(AccountValidationError);
    });

    it('should reject account with invalid account type', () => {
      const account = {
        created: '2023-01-01T00:00:00.000Z',
        updated: '2023-01-01T00:00:00.000Z',
        accountType: 'invalid-type' as any,
        status: AccountStatus.Active,
        userDetails: {
          name: 'John Doe',
        },
        security: {
          twoFactorEnabled: false,
          sessionTimeout: 3600,
          autoLock: false,
        },
      };

      expect(() => validateAccount(account)).toThrow(AccountValidationError);
    });

    it('should reject account with invalid status', () => {
      const account = {
        created: '2023-01-01T00:00:00.000Z',
        updated: '2023-01-01T00:00:00.000Z',
        accountType: AccountType.Local,
        status: 'invalid-status' as any,
        userDetails: {
          name: 'John Doe',
        },
        security: {
          password: 'hashedPassword',
          twoFactorEnabled: false,
          sessionTimeout: 3600,
          autoLock: false,
        },
      };

      expect(() => validateAccount(account)).toThrow(AccountValidationError);
    });

    it('should reject account with invalid user details', () => {
      const account = {
        created: '2023-01-01T00:00:00.000Z',
        updated: '2023-01-01T00:00:00.000Z',
        accountType: AccountType.Local,
        status: AccountStatus.Active,
        userDetails: {
          // Missing required name field
          email: 'john@example.com',
        },
        security: {
          password: 'hashedPassword',
          twoFactorEnabled: false,
          sessionTimeout: 3600,
          autoLock: false,
        },
      };

      expect(() => validateAccount(account as Account)).toThrow(AccountValidationError);
    });

    it('should reject null account', () => {
      expect(() => validateAccount(null as any)).toThrow(AccountValidationError);
    });

    it('should reject account missing required fields', () => {
      const account = {
        created: '2023-01-01T00:00:00.000Z',
        // Missing updated, accountType, status, userDetails, security
      };

      expect(() => validateAccount(account as any)).toThrow(AccountValidationError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle accounts with extra fields', () => {
      const account = {
        created: '2023-01-01T00:00:00.000Z',
        updated: '2023-01-01T00:00:00.000Z',
        accountType: AccountType.Local,
        status: AccountStatus.Active,
        extraField: 'should-be-ignored', // Extra field
        userDetails: {
          name: 'John Doe',
          extraUserField: 'ignored', // Extra field in userDetails
        },
        security: {
          password: 'hashedPassword',
          twoFactorEnabled: false,
          sessionTimeout: 3600,
          autoLock: false,
          extraSecurityField: 'ignored', // Extra field in security
        },
      };

      // Should still pass validation despite extra fields
      expect(validateAccount(account)).toBe(true);
    });

    it('should handle undefined vs null distinctions', () => {
      const userDetailsWithUndefined: UserDetails = {
        name: 'John Doe',
        email: undefined,
        imageUrl: undefined,
      };

      const userDetailsWithNull = {
        name: 'John Doe',
        email: null,
        imageUrl: null,
      } as any;

      expect(validateUserDetails(userDetailsWithUndefined)).toBe(true);
      expect(validateUserDetails(userDetailsWithNull)).toBe(false);
    });
  });
});
