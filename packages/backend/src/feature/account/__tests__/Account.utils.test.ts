import { describe, it, expect } from 'vitest';
import { toSafeAccount, toSafeSessionAccount } from '../Account.utils';
import { AccountType, AccountStatus, OAuthProviders } from '../Account.types';

describe('Account Utils', () => {
  describe('toSafeAccount', () => {
    const mockAccountDoc = {
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      created: '2023-01-01T00:00:00.000Z',
      updated: '2023-01-01T00:00:00.000Z',
      accountType: AccountType.Local,
      status: AccountStatus.Active,
      userDetails: {
        firstName: 'John',
        lastName: 'Doe',
        name: 'John Doe',
        email: 'john@example.com',
        imageUrl: 'https://example.com/avatar.jpg',
        birthdate: '1990-01-01',
        username: 'johndoe',
        emailVerified: true,
      },
      security: {
        password: 'hashedPassword123',
        twoFactorEnabled: false,
        twoFactorSecret: 'secret123',
        twoFactorBackupCodes: ['code1', 'code2'],
        sessionTimeout: 3600,
        autoLock: false,
        passwordSalt: 'salt123',
        lastPasswordChange: new Date('2023-01-01'),
        previousPasswords: ['oldHash1', 'oldHash2'],
        failedLoginAttempts: 0,
      },
    };

    it('should convert account document to safe format', () => {
      const result = toSafeAccount(mockAccountDoc);

      expect(result).toMatchObject({
        id: '507f1f77bcf86cd799439011',
        created: '2023-01-01T00:00:00.000Z',
        updated: '2023-01-01T00:00:00.000Z',
        accountType: AccountType.Local,
        status: AccountStatus.Active,
        userDetails: {
          firstName: 'John',
          lastName: 'Doe',
          name: 'John Doe',
          email: 'john@example.com',
          imageUrl: 'https://example.com/avatar.jpg',
          birthdate: '1990-01-01',
          username: 'johndoe',
          emailVerified: true,
        },
      });
    });

    it('should only include safe security fields', () => {
      const result = toSafeAccount(mockAccountDoc);

      expect(result?.security).toEqual({
        twoFactorEnabled: false,
        sessionTimeout: 3600,
        autoLock: false,
      });

      // Ensure sensitive fields are not included
      expect(result?.security).not.toHaveProperty('password');
      expect(result?.security).not.toHaveProperty('twoFactorSecret');
      expect(result?.security).not.toHaveProperty('twoFactorBackupCodes');
      expect(result?.security).not.toHaveProperty('passwordSalt');
      expect(result?.security).not.toHaveProperty('previousPasswords');
    });

    it('should handle OAuth account with provider', () => {
      const oauthDoc = {
        ...mockAccountDoc,
        accountType: AccountType.OAuth,
        provider: OAuthProviders.Google,
        security: {
          twoFactorEnabled: true,
          sessionTimeout: 7200,
          autoLock: true,
        },
      };

      const result = toSafeAccount(oauthDoc);

      expect(result?.accountType).toBe(AccountType.OAuth);
      expect(result?.provider).toBe(OAuthProviders.Google);
      expect(result?.security.twoFactorEnabled).toBe(true);
    });

    it('should handle missing optional userDetails fields', () => {
      const docWithMinimalUserDetails = {
        ...mockAccountDoc,
        userDetails: {
          name: 'Jane Doe',
        },
      };

      const result = toSafeAccount(docWithMinimalUserDetails);

      expect(result?.userDetails).toEqual({
        firstName: undefined,
        lastName: undefined,
        name: 'Jane Doe',
        email: undefined,
        imageUrl: undefined,
        birthdate: undefined,
        username: undefined,
        emailVerified: undefined,
      });
    });

    it('should handle missing security fields with defaults', () => {
      const docWithMinimalSecurity = {
        ...mockAccountDoc,
        security: {},
      };

      const result = toSafeAccount(docWithMinimalSecurity);

      expect(result?.security).toEqual({
        twoFactorEnabled: false,
        sessionTimeout: 3600,
        autoLock: false,
      });
    });

    it('should return null for null input', () => {
      expect(toSafeAccount(null)).toBe(null);
    });

    it('should return null for undefined input', () => {
      expect(toSafeAccount(undefined)).toBe(null);
    });

    it('should handle malformed account documents gracefully', () => {
      const malformedDoc = {
        _id: null,
        created: undefined,
        userDetails: null,
      };

      const result = toSafeAccount(malformedDoc);
      // Should return null or handle gracefully without throwing
      expect(result).toBe(null);
    });

    it('should handle account without _id field', () => {
      const docWithoutId = {
        ...mockAccountDoc,
        _id: undefined,
      };

      const result = toSafeAccount(docWithoutId);
      expect(result).toBe(null);
    });

    it('should handle _id that throws on toString', () => {
      const docWithBadId = {
        ...mockAccountDoc,
        _id: {
          toString: () => {
            throw new Error('toString failed');
          },
        },
      };

      const result = toSafeAccount(docWithBadId);
      expect(result).toBe(null);
    });

    it('should handle all account statuses', () => {
      const statuses = [
        AccountStatus.Active,
        AccountStatus.Inactive,
        AccountStatus.Suspended,
        AccountStatus.Unverified,
      ];

      statuses.forEach((status) => {
        const doc = { ...mockAccountDoc, status };
        const result = toSafeAccount(doc);
        expect(result?.status).toBe(status);
      });
    });

    it('should handle all OAuth providers', () => {
      const providers = [OAuthProviders.Google, OAuthProviders.Microsoft, OAuthProviders.Facebook];

      providers.forEach((provider) => {
        const doc = {
          ...mockAccountDoc,
          accountType: AccountType.OAuth,
          provider,
        };
        const result = toSafeAccount(doc);
        expect(result?.provider).toBe(provider);
      });
    });
  });

  describe('toSafeSessionAccount', () => {
    const mockAccountDoc = {
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      accountType: AccountType.Local,
      status: AccountStatus.Active,
      userDetails: {
        firstName: 'John',
        lastName: 'Doe',
        name: 'John Doe',
        email: 'john@example.com',
        imageUrl: 'https://example.com/avatar.jpg',
        username: 'johndoe',
        extraField: 'should-not-be-included',
      },
      security: {
        password: 'should-not-be-included',
        twoFactorSecret: 'should-not-be-included',
      },
      extraAccountField: 'should-not-be-included',
    };

    it('should convert account document to safe session format', () => {
      const result = toSafeSessionAccount(mockAccountDoc);

      expect(result).toEqual({
        id: '507f1f77bcf86cd799439011',
        accountType: AccountType.Local,
        status: AccountStatus.Active,
        userDetails: {
          name: 'John Doe',
          email: 'john@example.com',
          username: 'johndoe',
          imageUrl: 'https://example.com/avatar.jpg',
        },
        provider: undefined,
      });
    });

    it('should include provider for OAuth accounts', () => {
      const oauthDoc = {
        ...mockAccountDoc,
        accountType: AccountType.OAuth,
        provider: OAuthProviders.Google,
      };

      const result = toSafeSessionAccount(oauthDoc);

      expect(result?.accountType).toBe(AccountType.OAuth);
      expect(result?.provider).toBe(OAuthProviders.Google);
    });

    it('should handle missing optional userDetails fields', () => {
      const docWithMinimalUserDetails = {
        ...mockAccountDoc,
        userDetails: {
          name: 'Jane Doe',
        },
      };

      const result = toSafeSessionAccount(docWithMinimalUserDetails);

      expect(result?.userDetails).toEqual({
        name: 'Jane Doe',
        email: undefined,
        username: undefined,
        imageUrl: undefined,
      });
    });

    it('should return null for null input', () => {
      expect(toSafeSessionAccount(null)).toBe(null);
    });

    it('should return null for undefined input', () => {
      expect(toSafeSessionAccount(undefined)).toBe(null);
    });

    it('should handle malformed account documents gracefully', () => {
      const malformedDoc = {
        _id: null,
        userDetails: null,
        accountType: undefined,
      };

      const result = toSafeSessionAccount(malformedDoc);
      expect(result).toBe(null);
    });

    it('should not include sensitive information', () => {
      const result = toSafeSessionAccount(mockAccountDoc);

      expect(result).not.toHaveProperty('security');
      expect(result).not.toHaveProperty('created');
      expect(result).not.toHaveProperty('updated');
      expect(result).not.toHaveProperty('extraAccountField');
      expect(result?.userDetails).not.toHaveProperty('firstName');
      expect(result?.userDetails).not.toHaveProperty('lastName');
      expect(result?.userDetails).not.toHaveProperty('birthdate');
      expect(result?.userDetails).not.toHaveProperty('emailVerified');
      expect(result?.userDetails).not.toHaveProperty('extraField');
    });

    it('should handle account without userDetails', () => {
      const docWithoutUserDetails = {
        ...mockAccountDoc,
        userDetails: undefined,
      };

      const result = toSafeSessionAccount(docWithoutUserDetails);
      expect(result).toBe(null);
    });

    it('should handle all account types and statuses', () => {
      const testCases = [
        { accountType: AccountType.Local, status: AccountStatus.Active },
        { accountType: AccountType.OAuth, status: AccountStatus.Inactive },
        { accountType: AccountType.Local, status: AccountStatus.Suspended },
        { accountType: AccountType.OAuth, status: AccountStatus.Unverified },
      ];

      testCases.forEach(({ accountType, status }) => {
        const doc = { ...mockAccountDoc, accountType, status };
        const result = toSafeSessionAccount(doc);

        expect(result?.accountType).toBe(accountType);
        expect(result?.status).toBe(status);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle circular references in account documents', () => {
      const circularDoc: any = {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        accountType: AccountType.Local,
        status: AccountStatus.Active,
        userDetails: {
          name: 'Test User',
        },
      };

      // Create circular reference
      circularDoc.circular = circularDoc;

      // Should not throw and handle gracefully
      expect(() => toSafeAccount(circularDoc)).not.toThrow();
      expect(() => toSafeSessionAccount(circularDoc)).not.toThrow();
    });

    it('should handle very large account documents', () => {
      const largeUserDetails = {
        name: 'User',
        email: 'user@example.com',
        // Add a large property
        largeProperty: 'x'.repeat(10000),
      };

      const largeDoc = {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        accountType: AccountType.Local,
        status: AccountStatus.Active,
        userDetails: largeUserDetails,
      };

      const result = toSafeAccount(largeDoc);
      expect(result?.userDetails.name).toBe('User');
      expect(result?.userDetails.email).toBe('user@example.com');
      // Large property should not be included in safe conversion
    });

    it('should handle documents with prototype pollution attempts', () => {
      const maliciousDoc = {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        accountType: AccountType.Local,
        status: AccountStatus.Active,
        userDetails: {
          name: 'Test User',
        },
        __proto__: { malicious: 'property' },
        constructor: { prototype: { malicious: 'property' } },
      };

      const result = toSafeAccount(maliciousDoc);
      expect(result).toBeTruthy();
      expect(result).not.toHaveProperty('__proto__');
      expect(result).not.toHaveProperty('constructor');
    });

    it('should handle documents with getter properties that throw', () => {
      const docWithThrowingGetter = {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        accountType: AccountType.Local,
        status: AccountStatus.Active,
        userDetails: {
          name: 'Test User',
        },
        get throwingProperty() {
          throw new Error('Getter throws');
        },
      };

      // Should handle gracefully without throwing
      expect(() => toSafeAccount(docWithThrowingGetter)).not.toThrow();
      expect(() => toSafeSessionAccount(docWithThrowingGetter)).not.toThrow();
    });
  });
});
