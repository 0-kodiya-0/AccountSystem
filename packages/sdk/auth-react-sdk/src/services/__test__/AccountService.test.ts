import { describe, test, expect, vi, beforeEach } from 'vitest';
import { AccountService } from '../AccountService';
import { HttpClient } from '../../client/HttpClient';

// Mock HttpClient
const mockHttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  put: vi.fn(),
} as unknown as HttpClient;

describe('AccountService', () => {
  let accountService: AccountService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Service Initialization', () => {
    test('should initialize with HttpClient', () => {
      expect(() => {
        accountService = new AccountService(mockHttpClient);
      }).not.toThrow();

      expect(accountService).toBeInstanceOf(AccountService);
    });

    test('should throw error without HttpClient', () => {
      expect(() => {
        // @ts-expect-error - Testing invalid input
        accountService = new AccountService(null);
      }).toThrow('HttpClient is required for AccountService');

      expect(() => {
        // @ts-expect-error - Testing invalid input
        accountService = new AccountService(undefined);
      }).toThrow('HttpClient is required for AccountService');
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      accountService = new AccountService(mockHttpClient);
    });

    describe('Account ID Validation', () => {
      test('should validate account ID format - valid ObjectId', () => {
        const validAccountId = '507f1f77bcf86cd799439011';

        expect(() => {
          accountService.getAccount(validAccountId);
        }).not.toThrow();
      });

      test('should validate account ID format - invalid formats', () => {
        const invalidAccountIds = [
          '', // empty
          '   ', // whitespace
          'invalid-id', // not ObjectId format
          '123', // too short
          '507f1f77bcf86cd799439011x', // too long
          '507f1f77bcf86cd79943901G', // invalid hex character
          '507f1f77bcf86cd79943901', // too short by 1
          '507f1f77bcf86cd799439011a', // too long by 1
        ];

        invalidAccountIds.forEach((invalidId) => {
          expect(() => {
            accountService.getAccount(invalidId);
          }).toThrow('Valid accountId is required for get account');
        });
      });

      test('should validate account ID format - null or undefined', () => {
        expect(() => {
          // @ts-expect-error - Testing invalid input
          accountService.getAccount(null);
        }).toThrow('Valid accountId is required for get account');

        expect(() => {
          // @ts-expect-error - Testing invalid input
          accountService.getAccount(undefined);
        }).toThrow('Valid accountId is required for get account');
      });
    });

    describe('Email Format Validation', () => {
      test('should validate email format - valid emails', () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.uk',
          'user+tag@example.org',
          'user123@test-domain.com',
          'a@b.co',
        ];

        validEmails.forEach((email) => {
          expect(() => {
            accountService.searchAccount(email);
          }).not.toThrow();
        });
      });

      test('should validate email format - invalid emails', () => {
        const invalidEmails = [
          '', // empty
          '   ', // whitespace
          'invalid-email', // no @ symbol
          '@domain.com', // no local part
          'user@', // no domain
          'user@.com', // invalid domain
          'user name@domain.com', // space in local part
          'user@domain', // no TLD
          'user@domain.', // ending with dot
          '.user@domain.com', // starting with dot
        ];

        invalidEmails.forEach((email) => {
          expect(() => {
            accountService.searchAccount(email);
          }).toThrow('Invalid email format for account search');
        });
      });
    });

    describe('String Length Validation', () => {
      const validAccountId = '507f1f77bcf86cd799439011';

      test('should validate string lengths - firstName', () => {
        // Valid firstName
        expect(() => {
          accountService.updateAccount(validAccountId, { firstName: 'John' });
        }).not.toThrow();

        expect(() => {
          accountService.updateAccount(validAccountId, { firstName: 'A' }); // 1 char
        }).not.toThrow();

        expect(() => {
          accountService.updateAccount(validAccountId, { firstName: 'A'.repeat(50) }); // 50 chars
        }).not.toThrow();

        // Invalid firstName
        expect(() => {
          accountService.updateAccount(validAccountId, { firstName: '' }); // empty
        }).toThrow('firstName must be at least 1 characters for account update');

        expect(() => {
          accountService.updateAccount(validAccountId, { firstName: '   ' }); // whitespace
        }).toThrow('firstName must be at least 1 characters for account update');

        expect(() => {
          accountService.updateAccount(validAccountId, { firstName: 'A'.repeat(51) }); // too long
        }).toThrow('firstName cannot exceed 50 characters for account update');
      });

      test('should validate string lengths - lastName', () => {
        // Valid lastName
        expect(() => {
          accountService.updateAccount(validAccountId, { lastName: 'Doe' });
        }).not.toThrow();

        // Invalid lastName
        expect(() => {
          accountService.updateAccount(validAccountId, { lastName: '' });
        }).toThrow('lastName must be at least 1 characters for account update');

        expect(() => {
          accountService.updateAccount(validAccountId, { lastName: 'A'.repeat(51) });
        }).toThrow('lastName cannot exceed 50 characters for account update');
      });

      test('should validate string lengths - name', () => {
        // Valid name
        expect(() => {
          accountService.updateAccount(validAccountId, { name: 'John Doe' });
        }).not.toThrow();

        expect(() => {
          accountService.updateAccount(validAccountId, { name: 'A'.repeat(100) });
        }).not.toThrow();

        // Invalid name
        expect(() => {
          accountService.updateAccount(validAccountId, { name: '' });
        }).toThrow('name must be at least 1 characters for account update');

        expect(() => {
          accountService.updateAccount(validAccountId, { name: 'A'.repeat(101) });
        }).toThrow('name cannot exceed 100 characters for account update');
      });

      test('should validate string lengths - username', () => {
        // Valid username
        expect(() => {
          accountService.updateAccount(validAccountId, { username: 'johndoe' });
        }).not.toThrow();

        expect(() => {
          accountService.updateAccount(validAccountId, { username: 'abc' }); // 3 chars
        }).not.toThrow();

        expect(() => {
          accountService.updateAccount(validAccountId, { username: 'A'.repeat(30) }); // 30 chars
        }).not.toThrow();

        // Invalid username
        expect(() => {
          accountService.updateAccount(validAccountId, { username: 'ab' }); // too short
        }).toThrow('username must be at least 3 characters for account update');

        expect(() => {
          accountService.updateAccount(validAccountId, { username: 'A'.repeat(31) }); // too long
        }).toThrow('username cannot exceed 30 characters for account update');
      });

      test('should allow null or empty string for optional fields', () => {
        // These should be allowed for optional fields that can be cleared
        expect(() => {
          accountService.updateAccount(validAccountId, { imageUrl: '' });
        }).not.toThrow();

        expect(() => {
          accountService.updateAccount(validAccountId, { imageUrl: null });
        }).not.toThrow();

        expect(() => {
          accountService.updateAccount(validAccountId, { birthdate: '' });
        }).not.toThrow();

        expect(() => {
          accountService.updateAccount(validAccountId, { birthdate: null });
        }).not.toThrow();

        expect(() => {
          accountService.updateAccount(validAccountId, { username: '' });
        }).not.toThrow();

        expect(() => {
          accountService.updateAccount(validAccountId, { username: null });
        }).not.toThrow();
      });
    });

    describe('URL Validation', () => {
      const validAccountId = '507f1f77bcf86cd799439011';

      test('should validate URLs - valid URLs', () => {
        const validUrls = [
          'https://example.com/avatar.jpg',
          'http://localhost:3000/image.png',
          'https://cdn.example.com/path/to/image.jpg',
          'https://example.com/image.jpg?size=large',
          'https://sub.domain.example.com/image.png',
        ];

        validUrls.forEach((url) => {
          expect(() => {
            accountService.updateAccount(validAccountId, { imageUrl: url });
          }).not.toThrow();
        });
      });

      test('should validate URLs - invalid URLs', () => {
        const invalidUrls = [
          'not-a-url',
          'ftp://example.com/file.txt', // Valid URL but different protocol
          'javascript:alert(1)', // Potentially dangerous
          'data:image/png;base64,iVBOR...', // Data URL
          'file:///local/path/image.jpg', // File URL
          'relative/path/image.jpg', // Relative path
          '//example.com/image.jpg', // Protocol-relative URL
        ];

        invalidUrls.forEach((url) => {
          expect(() => {
            accountService.updateAccount(validAccountId, { imageUrl: url });
          }).toThrow('Invalid URL format for account update');
        });
      });

      test('should allow empty or null imageUrl for clearing', () => {
        expect(() => {
          accountService.updateAccount(validAccountId, { imageUrl: '' });
        }).not.toThrow();

        expect(() => {
          accountService.updateAccount(validAccountId, { imageUrl: null });
        }).not.toThrow();
      });
    });

    describe('Birthdate Format Validation', () => {
      const validAccountId = '507f1f77bcf86cd799439011';

      test('should validate birthdate format - valid dates', () => {
        const validDates = [
          '1990-01-01',
          '2000-12-31',
          '1985-06-15',
          '1975-02-28',
          '2020-02-29', // Leap year
        ];

        validDates.forEach((date) => {
          expect(() => {
            accountService.updateAccount(validAccountId, { birthdate: date });
          }).not.toThrow();
        });
      });

      test('should validate birthdate format - invalid formats', () => {
        const invalidFormats = [
          '01/01/1990', // MM/DD/YYYY
          '1990/01/01', // YYYY/MM/DD with slashes
          '1990-1-1', // Missing leading zeros
          '90-01-01', // 2-digit year
          '1990-13-01', // Invalid month
          '1990-01-32', // Invalid day
          '1990-02-30', // Invalid day for February
          'January 1, 1990', // Text format
          '1990-01', // Missing day
          '01-01', // Missing year
        ];

        invalidFormats.forEach((date) => {
          expect(() => {
            accountService.updateAccount(validAccountId, { birthdate: date });
          }).toThrow('Invalid birthdate format for account update. Use YYYY-MM-DD format');
        });
      });

      test('should validate birthdate - future dates', () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        const futureDateString = futureDate.toISOString().split('T')[0];

        expect(() => {
          accountService.updateAccount(validAccountId, { birthdate: futureDateString });
        }).toThrow('Birthdate cannot be in the future for account update');
      });

      test('should validate birthdate - invalid dates', () => {
        const invalidDates = [
          '2021-02-29', // Not a leap year
          '2021-04-31', // April has 30 days
          '2021-13-01', // Invalid month
          '2021-00-01', // Invalid month
          '2021-01-00', // Invalid day
        ];

        invalidDates.forEach((date) => {
          expect(() => {
            accountService.updateAccount(validAccountId, { birthdate: date });
          }).toThrow('Invalid birthdate for account update');
        });
      });

      test('should allow empty or null birthdate for clearing', () => {
        expect(() => {
          accountService.updateAccount(validAccountId, { birthdate: '' });
        }).not.toThrow();

        expect(() => {
          accountService.updateAccount(validAccountId, { birthdate: null });
        }).not.toThrow();
      });
    });

    describe('Update Request Field Validation', () => {
      const validAccountId = '507f1f77bcf86cd799439011';

      test('should reject invalid update fields', () => {
        const invalidUpdates = [
          { invalidField: 'value' },
          { password: 'secret' }, // Not allowed in account update
          { email: 'new@example.com' }, // Not allowed in account update
          { id: 'new-id' }, // Not allowed
          { created: '2024-01-01' }, // Not allowed
          { accountType: 'oauth' }, // Not allowed
        ];

        invalidUpdates.forEach((update) => {
          expect(() => {
            accountService.updateAccount(validAccountId, update as any);
          }).toThrow(/Invalid fields provided|Only these fields can be updated/);
        });
      });

      test('should require at least one valid field for update', () => {
        // Empty object
        expect(() => {
          accountService.updateAccount(validAccountId, {});
        }).toThrow('At least one valid field must be provided for account update');

        // Object with only invalid fields
        expect(() => {
          accountService.updateAccount(validAccountId, {
            // @ts-expect-error - Testing invalid fields
            invalidField: 'value',
            anotherInvalid: 'value2',
          });
        }).toThrow('At least one valid field must be provided for account update');

        // Null update object
        expect(() => {
          // @ts-expect-error - Testing invalid input
          accountService.updateAccount(validAccountId, null);
        }).toThrow('account updates is required for account update');

        // Undefined update object
        expect(() => {
          // @ts-expect-error - Testing invalid input
          accountService.updateAccount(validAccountId, undefined);
        }).toThrow('account updates is required for account update');
      });

      test('should accept valid update fields', () => {
        const validUpdates = [
          { firstName: 'John' },
          { lastName: 'Doe' },
          { name: 'John Doe' },
          { imageUrl: 'https://example.com/avatar.jpg' },
          { birthdate: '1990-01-01' },
          { username: 'johndoe' },
          // Multiple valid fields
          { firstName: 'John', lastName: 'Doe' },
          { name: 'John Doe', imageUrl: 'https://example.com/avatar.jpg' },
        ];

        validUpdates.forEach((update) => {
          expect(() => {
            accountService.updateAccount(validAccountId, update);
          }).not.toThrow();
        });
      });

      test('should validate mixed valid and invalid fields', () => {
        expect(() => {
          accountService.updateAccount(validAccountId, {
            firstName: 'John', // valid
            // @ts-expect-error - Testing mixed valid/invalid
            password: 'secret', // invalid
          });
        }).toThrow('Invalid fields provided: password');

        expect(() => {
          accountService.updateAccount(validAccountId, {
            firstName: 'John', // valid
            lastName: 'Doe', // valid
            // @ts-expect-error - Testing mixed valid/invalid
            email: 'new@example.com', // invalid
            invalidField: 'value', // invalid
          });
        }).toThrow('Invalid fields provided: email, invalidField');
      });
    });

    describe('Type Validation', () => {
      const validAccountId = '507f1f77bcf86cd799439011';

      test('should validate field types', () => {
        // Non-string values for string fields
        expect(() => {
          accountService.updateAccount(validAccountId, {
            // @ts-expect-error - Testing invalid type
            firstName: 123,
          });
        }).toThrow('firstName must be a string for account update');

        expect(() => {
          accountService.updateAccount(validAccountId, {
            // @ts-expect-error - Testing invalid type
            imageUrl: true,
          });
        }).toThrow('imageUrl must be a string for account update');

        expect(() => {
          accountService.updateAccount(validAccountId, {
            // @ts-expect-error - Testing invalid type
            birthdate: new Date(),
          });
        }).toThrow('Birthdate must be a string for account update');
      });
    });
  });
});
