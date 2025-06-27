import { describe, test, expect, vi, beforeEach, Mock } from 'vitest';
import { AccountService } from '../AccountService';
import { HttpClient } from '../../client/HttpClient';

// Mock HttpClient
const createMockHttpClient = () => ({
  get: vi.fn() as Mock,
  post: vi.fn() as Mock,
  patch: vi.fn() as Mock,
  delete: vi.fn() as Mock,
  put: vi.fn() as Mock,
});

describe('AccountService', () => {
  let accountService: AccountService;
  let mockHttpClient: ReturnType<typeof createMockHttpClient>;

  beforeEach(() => {
    mockHttpClient = createMockHttpClient();
    vi.clearAllMocks();
  });

  describe('Service Initialization', () => {
    test('should initialize with HttpClient', () => {
      expect(() => {
        accountService = new AccountService(mockHttpClient as unknown as HttpClient);
      }).not.toThrow();

      expect(accountService).toBeInstanceOf(AccountService);
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      accountService = new AccountService(mockHttpClient as unknown as HttpClient);
    });

    describe('Account ID Validation', () => {
      test('should validate account ID format - valid ObjectId', async () => {
        const validAccountId = '507f1f77bcf86cd799439011';

        // For async service methods, don't expect errors to throw synchronously
        // Instead, mock the HttpClient to prevent actual API calls
        mockHttpClient.get.mockResolvedValue({ id: validAccountId });

        await expect(accountService.getAccount(validAccountId)).resolves.toBeDefined();
      });

      test('should validate account ID format - invalid formats', async () => {
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

        // Test each invalid ID - these should throw synchronously during validation
        for (const invalidId of invalidAccountIds) {
          await expect(async () => {
            await accountService.getAccount(invalidId);
          }).rejects.toThrow('Valid accountId is required for get account');
        }
      });

      test('should validate account ID format - null or undefined', async () => {
        await expect(async () => {
          await accountService.getAccount(null as any);
        }).rejects.toThrow('Valid accountId is required for get account');

        await expect(async () => {
          await accountService.getAccount(undefined as any);
        }).rejects.toThrow('Valid accountId is required for get account');
      });
    });

    describe('Email Format Validation', () => {
      test('should validate email format - valid emails', async () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.uk',
          'user+tag@example.org',
          'user123@test-domain.com',
          'a@b.co',
        ];

        // Mock successful search results
        mockHttpClient.get.mockResolvedValue({ found: true });

        for (const email of validEmails) {
          await expect(accountService.searchAccount(email)).resolves.toBeDefined();
        }
      });

      test('should validate email format - invalid emails', async () => {
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

        for (const email of invalidEmails) {
          await expect(async () => {
            await accountService.searchAccount(email);
          }).rejects.toThrow('Invalid email format for account search');
        }
      });
    });

    describe('String Length Validation', () => {
      const validAccountId = '507f1f77bcf86cd799439011';

      test('should validate string lengths - firstName', async () => {
        // Mock successful update
        mockHttpClient.patch.mockResolvedValue({ success: true });

        // Valid firstName
        await expect(accountService.updateAccount(validAccountId, { firstName: 'John' })).resolves.toBeDefined();
        await expect(accountService.updateAccount(validAccountId, { firstName: 'A' })).resolves.toBeDefined(); // 1 char
        await expect(
          accountService.updateAccount(validAccountId, { firstName: 'A'.repeat(50) }),
        ).resolves.toBeDefined(); // 50 chars

        // Invalid firstName
        await expect(async () => {
          await accountService.updateAccount(validAccountId, { firstName: '' });
        }).rejects.toThrow('firstName must be at least 1 characters for account update');

        await expect(async () => {
          await accountService.updateAccount(validAccountId, { firstName: '   ' });
        }).rejects.toThrow('firstName must be at least 1 characters for account update');

        await expect(async () => {
          await accountService.updateAccount(validAccountId, { firstName: 'A'.repeat(51) });
        }).rejects.toThrow('firstName cannot exceed 50 characters for account update');
      });

      test('should validate string lengths - lastName', async () => {
        // Mock successful update
        mockHttpClient.patch.mockResolvedValue({ success: true });

        // Valid lastName
        await expect(accountService.updateAccount(validAccountId, { lastName: 'Doe' })).resolves.toBeDefined();

        // Invalid lastName
        await expect(async () => {
          await accountService.updateAccount(validAccountId, { lastName: '' });
        }).rejects.toThrow('lastName must be at least 1 characters for account update');

        await expect(async () => {
          await accountService.updateAccount(validAccountId, { lastName: 'A'.repeat(51) });
        }).rejects.toThrow('lastName cannot exceed 50 characters for account update');
      });

      test('should validate string lengths - name', async () => {
        // Mock successful update
        mockHttpClient.patch.mockResolvedValue({ success: true });

        // Valid name
        await expect(accountService.updateAccount(validAccountId, { name: 'John Doe' })).resolves.toBeDefined();
        await expect(accountService.updateAccount(validAccountId, { name: 'A'.repeat(100) })).resolves.toBeDefined();

        // Invalid name
        await expect(async () => {
          await accountService.updateAccount(validAccountId, { name: '' });
        }).rejects.toThrow('name must be at least 1 characters for account update');

        await expect(async () => {
          await accountService.updateAccount(validAccountId, { name: 'A'.repeat(101) });
        }).rejects.toThrow('name cannot exceed 100 characters for account update');
      });

      test('should validate string lengths - username', async () => {
        // Mock successful update
        mockHttpClient.patch.mockResolvedValue({ success: true });

        // Valid username
        await expect(accountService.updateAccount(validAccountId, { username: 'johndoe' })).resolves.toBeDefined();
        await expect(accountService.updateAccount(validAccountId, { username: 'abc' })).resolves.toBeDefined(); // 3 chars
        await expect(accountService.updateAccount(validAccountId, { username: 'A'.repeat(30) })).resolves.toBeDefined(); // 30 chars

        // Invalid username
        await expect(async () => {
          await accountService.updateAccount(validAccountId, { username: 'ab' });
        }).rejects.toThrow('username must be at least 3 characters for account update');

        await expect(async () => {
          await accountService.updateAccount(validAccountId, { username: 'A'.repeat(31) });
        }).rejects.toThrow('username cannot exceed 30 characters for account update');
      });

      test('should allow null or empty string for optional fields', async () => {
        // Mock successful update
        mockHttpClient.patch.mockResolvedValue({ success: true });

        // These should be allowed for optional fields that can be cleared
        await expect(accountService.updateAccount(validAccountId, { imageUrl: '' } as any)).resolves.toBeDefined();
        await expect(accountService.updateAccount(validAccountId, { imageUrl: null } as any)).resolves.toBeDefined();
        await expect(accountService.updateAccount(validAccountId, { birthdate: '' } as any)).resolves.toBeDefined();
        await expect(accountService.updateAccount(validAccountId, { birthdate: null } as any)).resolves.toBeDefined();
        await expect(accountService.updateAccount(validAccountId, { username: '' } as any)).resolves.toBeDefined();
        await expect(accountService.updateAccount(validAccountId, { username: null } as any)).resolves.toBeDefined();
      });
    });

    describe('URL Validation', () => {
      const validAccountId = '507f1f77bcf86cd799439011';

      test('should validate URLs - valid URLs', async () => {
        const validUrls = [
          'https://example.com/avatar.jpg',
          'http://localhost:3000/image.png',
          'https://cdn.example.com/path/to/image.jpg',
          'https://example.com/image.jpg?size=large',
          'https://sub.domain.example.com/image.png',
        ];

        // Mock successful update
        mockHttpClient.patch.mockResolvedValue({ success: true });

        for (const url of validUrls) {
          await expect(accountService.updateAccount(validAccountId, { imageUrl: url })).resolves.toBeDefined();
        }
      });

      test('should validate URLs - invalid URLs', async () => {
        const invalidUrls = [
          'not-a-url',
          'ftp://example.com/file.txt', // Valid URL but different protocol
          'javascript:alert(1)', // Potentially dangerous
          'data:image/png;base64,iVBOR...', // Data URL
          'file:///local/path/image.jpg', // File URL
          'relative/path/image.jpg', // Relative path
          '//example.com/image.jpg', // Protocol-relative URL
        ];

        for (const url of invalidUrls) {
          await expect(async () => {
            await accountService.updateAccount(validAccountId, { imageUrl: url });
          }).rejects.toThrow('Invalid URL format for account update');
        }
      });

      test('should allow empty or null imageUrl for clearing', async () => {
        // Mock successful update
        mockHttpClient.patch.mockResolvedValue({ success: true });

        await expect(accountService.updateAccount(validAccountId, { imageUrl: '' })).resolves.toBeDefined();
        await expect(accountService.updateAccount(validAccountId, { imageUrl: null } as any)).resolves.toBeDefined();
      });
    });

    describe('Birthdate Format Validation', () => {
      const validAccountId = '507f1f77bcf86cd799439011';

      test('should validate birthdate format - valid dates', async () => {
        const validDates = [
          '1990-01-01',
          '2000-12-31',
          '1985-06-15',
          '1975-02-28',
          '2020-02-29', // Leap year
        ];

        // Mock successful update
        mockHttpClient.patch.mockResolvedValue({ success: true });

        for (const date of validDates) {
          await expect(accountService.updateAccount(validAccountId, { birthdate: date })).resolves.toBeDefined();
        }
      });

      test('should validate birthdate format - invalid formats', async () => {
        const invalidFormats = [
          '01/01/1990', // MM/DD/YYYY
          '1990/01/01', // YYYY/MM/DD with slashes
          '1990-1-1', // Missing leading zeros
          '90-01-01', // 2-digit year
          'January 1, 1990', // Text format
          '1990-01', // Missing day
          '01-01', // Missing year
        ];

        for (const date of invalidFormats) {
          await expect(async () => {
            await accountService.updateAccount(validAccountId, { birthdate: date });
          }).rejects.toThrow('Invalid birthdate format for account update. Use YYYY-MM-DD format');
        }
      });

      test('should validate birthdate - future dates', async () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        const futureDateString = futureDate.toISOString().split('T')[0];

        await expect(async () => {
          await accountService.updateAccount(validAccountId, { birthdate: futureDateString });
        }).rejects.toThrow('Birthdate cannot be in the future for account update');
      });

      test('should validate birthdate - invalid dates', async () => {
        const invalidDates = [
          '2021-02-29', // Not a leap year
          '2021-04-31', // April has 30 days
          '2021-13-01', // Invalid month
          '2021-00-01', // Invalid month
          '2021-01-00', // Invalid day
        ];

        for (const date of invalidDates) {
          await expect(async () => {
            await accountService.updateAccount(validAccountId, { birthdate: date });
          }).rejects.toThrow('Invalid birthdate for account update');
        }
      });

      test('should allow empty or null birthdate for clearing', async () => {
        // Mock successful update
        mockHttpClient.patch.mockResolvedValue({ success: true });

        await expect(accountService.updateAccount(validAccountId, { birthdate: '' })).resolves.toBeDefined();
        await expect(accountService.updateAccount(validAccountId, { birthdate: null } as any)).resolves.toBeDefined();
      });
    });

    describe('Update Request Field Validation', () => {
      const validAccountId = '507f1f77bcf86cd799439011';

      test('should reject invalid update fields', async () => {
        const invalidUpdates = [
          { invalidField: 'value' },
          { password: 'secret' }, // Not allowed in account update
          { email: 'new@example.com' }, // Not allowed in account update
          { id: 'new-id' }, // Not allowed
          { created: '2024-01-01' }, // Not allowed
          { accountType: 'oauth' }, // Not allowed
        ];

        for (const update of invalidUpdates) {
          await expect(async () => {
            await accountService.updateAccount(validAccountId, update as any);
          }).rejects.toThrow('At least one valid field must be provided for account update');
        }
      });

      test('should require at least one valid field for update', async () => {
        // Empty object
        await expect(async () => {
          await accountService.updateAccount(validAccountId, {});
        }).rejects.toThrow('At least one valid field must be provided for account update');

        // Object with only invalid fields
        await expect(async () => {
          await accountService.updateAccount(validAccountId, {
            // @ts-expect-error - Testing invalid fields
            invalidField: 'value',
            anotherInvalid: 'value2',
          });
        }).rejects.toThrow('At least one valid field must be provided for account update');

        // Null update object
        await expect(async () => {
          await accountService.updateAccount(validAccountId, null as any);
        }).rejects.toThrow('account updates is required for account update');

        // Undefined update object
        await expect(async () => {
          await accountService.updateAccount(validAccountId, undefined as any);
        }).rejects.toThrow('account updates is required for account update');
      });

      test('should accept valid update fields', async () => {
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

        // Mock successful update
        mockHttpClient.patch.mockResolvedValue({ success: true });

        for (const update of validUpdates) {
          await expect(accountService.updateAccount(validAccountId, update)).resolves.toBeDefined();
        }
      });

      test('should validate mixed valid and invalid fields', async () => {
        await expect(async () => {
          await accountService.updateAccount(validAccountId, {
            firstName: 'John', // valid
            // @ts-expect-error - Testing mixed valid/invalid
            password: 'secret', // invalid
          });
        }).rejects.toThrow('Invalid fields provided: password');

        await expect(async () => {
          await accountService.updateAccount(validAccountId, {
            firstName: 'John', // valid
            lastName: 'Doe', // valid
            // @ts-expect-error - Testing mixed valid/invalid
            email: 'new@example.com', // invalid
            invalidField: 'value', // invalid
          });
        }).rejects.toThrow('Invalid fields provided: email, invalidField');
      });
    });

    describe('Type Validation', () => {
      const validAccountId = '507f1f77bcf86cd799439011';

      test('should validate field types', async () => {
        // Non-string values for string fields
        await expect(async () => {
          await accountService.updateAccount(validAccountId, {
            // @ts-expect-error - Testing invalid type
            firstName: 123,
          });
        }).rejects.toThrow('firstName must be a string for account update');

        await expect(async () => {
          await accountService.updateAccount(validAccountId, {
            // @ts-expect-error - Testing invalid type
            imageUrl: true,
          });
        }).rejects.toThrow('imageUrl must be a string for account update');

        await expect(async () => {
          await accountService.updateAccount(validAccountId, {
            // @ts-expect-error - Testing invalid type
            birthdate: new Date(),
          });
        }).rejects.toThrow('Birthdate must be a string for account update');
      });
    });
  });
});
