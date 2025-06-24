import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountService } from '../AccountService';
import { HttpClient } from '../../client/HttpClient';
import { createMockAccount } from '../../test/utils';

describe('AccountService', () => {
  let accountService: AccountService;
  let mockHttpClient: HttpClient;

  beforeEach(() => {
    mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
    } as any;

    accountService = new AccountService(mockHttpClient);
  });

  describe('constructor', () => {
    it('should throw error if HttpClient is not provided', () => {
      expect(() => new AccountService(null as any)).toThrow('HttpClient is required for AccountService');
    });
  });

  describe('getAccount', () => {
    it('should get account successfully', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockAccount = createMockAccount({ id: accountId });

      vi.mocked(mockHttpClient.get).mockResolvedValue(mockAccount);

      const result = await accountService.getAccount(accountId);

      expect(vi.mocked(mockHttpClient.get)).toHaveBeenCalledWith(`/${accountId}/account`);
      expect(result).toEqual(mockAccount);
    });

    it('should throw error for invalid account ID', async () => {
      const invalidAccountId = 'invalid-id';

      await expect(accountService.getAccount(invalidAccountId)).rejects.toThrow(
        'Valid accountId is required for get account',
      );
    });

    it('should throw error for empty account ID', async () => {
      await expect(accountService.getAccount('')).rejects.toThrow('Valid accountId is required for get account');
    });

    it('should throw error for null account ID', async () => {
      await expect(accountService.getAccount(null as any)).rejects.toThrow(
        'Valid accountId is required for get account',
      );
    });
  });

  describe('updateAccount', () => {
    const accountId = '507f1f77bcf86cd799439011';

    it('should update account with valid fields', async () => {
      const updates = {
        firstName: 'Jane',
        lastName: 'Smith',
        name: 'Jane Smith',
      };
      const mockUpdatedAccount = createMockAccount({
        id: accountId,
        userDetails: { ...createMockAccount().userDetails, ...updates },
      });

      vi.mocked(mockHttpClient.patch).mockResolvedValue(mockUpdatedAccount);

      const result = await accountService.updateAccount(accountId, updates);

      expect(vi.mocked(mockHttpClient.patch)).toHaveBeenCalledWith(`/${accountId}/account`, updates);
      expect(result).toEqual(mockUpdatedAccount);
    });

    it('should update account with imageUrl', async () => {
      const updates = {
        imageUrl: 'https://example.com/new-avatar.jpg',
      };

      vi.mocked(mockHttpClient.patch).mockResolvedValue(createMockAccount());

      await accountService.updateAccount(accountId, updates);

      expect(vi.mocked(mockHttpClient.patch)).toHaveBeenCalledWith(`/${accountId}/account`, updates);
    });

    it('should update account with birthdate', async () => {
      const updates = {
        birthdate: '1990-01-01',
      };

      vi.mocked(mockHttpClient.patch).mockResolvedValue(createMockAccount());

      await accountService.updateAccount(accountId, updates);

      expect(vi.mocked(mockHttpClient.patch)).toHaveBeenCalledWith(`/${accountId}/account`, updates);
    });

    it('should update account with username', async () => {
      const updates = {
        username: 'janesmith',
      };

      vi.mocked(mockHttpClient.patch).mockResolvedValue(createMockAccount());

      await accountService.updateAccount(accountId, updates);

      expect(vi.mocked(mockHttpClient.patch)).toHaveBeenCalledWith(`/${accountId}/account`, updates);
    });

    it('should allow clearing optional fields with empty string', async () => {
      const updates = {
        imageUrl: '',
        birthdate: '',
        username: '',
      };

      vi.mocked(mockHttpClient.patch).mockResolvedValue(createMockAccount());

      await accountService.updateAccount(accountId, updates);

      expect(vi.mocked(mockHttpClient.patch)).toHaveBeenCalledWith(`/${accountId}/account`, updates);
    });

    it('should allow clearing optional fields with undefined', async () => {
      const updates = {
        imageUrl: undefined,
        birthdate: undefined,
        username: undefined,
      };

      vi.mocked(mockHttpClient.patch).mockResolvedValue(createMockAccount());

      await accountService.updateAccount(accountId, updates);

      expect(vi.mocked(mockHttpClient.patch)).toHaveBeenCalledWith(`/${accountId}/account`, updates);
    });

    it('should throw error for invalid account ID', async () => {
      const updates = { firstName: 'Jane' };

      await expect(accountService.updateAccount('invalid-id', updates)).rejects.toThrow(
        'Valid accountId is required for account update',
      );
    });

    it('should throw error for empty updates object', async () => {
      await expect(accountService.updateAccount(accountId, {} as any)).rejects.toThrow(
        'At least one valid field must be provided for account update',
      );
    });

    it('should throw error for null updates', async () => {
      await expect(accountService.updateAccount(accountId, null as any)).rejects.toThrow(
        'account updates is required for account update',
      );
    });

    it('should throw error for invalid fields', async () => {
      const updates = {
        firstName: 'Jane',
        invalidField: 'invalid',
      } as any;

      await expect(accountService.updateAccount(accountId, updates)).rejects.toThrow(
        'Invalid fields provided: invalidField',
      );
    });

    it('should throw error for firstName too long', async () => {
      const updates = {
        firstName: 'a'.repeat(51), // Too long
      };

      await expect(accountService.updateAccount(accountId, updates)).rejects.toThrow(
        'firstName cannot exceed 50 characters',
      );
    });

    it('should throw error for lastName too long', async () => {
      const updates = {
        lastName: 'a'.repeat(51), // Too long
      };

      await expect(accountService.updateAccount(accountId, updates)).rejects.toThrow(
        'lastName cannot exceed 50 characters',
      );
    });

    it('should throw error for name too long', async () => {
      const updates = {
        name: 'a'.repeat(101), // Too long
      };

      await expect(accountService.updateAccount(accountId, updates)).rejects.toThrow(
        'name cannot exceed 100 characters',
      );
    });

    it('should throw error for invalid imageUrl', async () => {
      const updates = {
        imageUrl: 'invalid-url',
      };

      await expect(accountService.updateAccount(accountId, updates)).rejects.toThrow(
        'Invalid URL format for account update',
      );
    });

    it('should throw error for invalid birthdate format', async () => {
      const updates = {
        birthdate: 'invalid-date',
      };

      await expect(accountService.updateAccount(accountId, updates)).rejects.toThrow(
        'Invalid birthdate format for account update',
      );
    });

    it('should throw error for future birthdate', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const updates = {
        birthdate: futureDate.toISOString().split('T')[0],
      };

      await expect(accountService.updateAccount(accountId, updates)).rejects.toThrow(
        'Birthdate cannot be in the future',
      );
    });

    it('should throw error for username too short', async () => {
      const updates = {
        username: 'ab', // Too short
      };

      await expect(accountService.updateAccount(accountId, updates)).rejects.toThrow(
        'username must be at least 3 characters',
      );
    });

    it('should throw error for username too long', async () => {
      const updates = {
        username: 'a'.repeat(31), // Too long
      };

      await expect(accountService.updateAccount(accountId, updates)).rejects.toThrow(
        'username cannot exceed 30 characters',
      );
    });

    it('should throw error for empty required string fields', async () => {
      const updates = {
        firstName: '',
      };

      await expect(accountService.updateAccount(accountId, updates)).rejects.toThrow(
        'firstName must be at least 1 characters',
      );
    });

    it('should throw error for firstName only whitespace', async () => {
      const updates = {
        firstName: '   ',
      };

      await expect(accountService.updateAccount(accountId, updates)).rejects.toThrow(
        'firstName must be at least 1 characters',
      );
    });

    it('should throw error for lastName only whitespace', async () => {
      const updates = {
        lastName: '   ',
      };

      await expect(accountService.updateAccount(accountId, updates)).rejects.toThrow(
        'lastName must be at least 1 characters',
      );
    });

    it('should throw error for name only whitespace', async () => {
      const updates = {
        name: '   ',
      };

      await expect(accountService.updateAccount(accountId, updates)).rejects.toThrow(
        'name must be at least 1 characters',
      );
    });

    it('should handle updates with mixed valid and invalid optional fields', async () => {
      const updates = {
        firstName: 'Jane',
        lastName: 'Smith',
        imageUrl: '', // Valid - clearing field
        username: undefined, // Valid - clearing field
      };

      vi.mocked(mockHttpClient.patch).mockResolvedValue(createMockAccount());

      await accountService.updateAccount(accountId, updates);

      expect(vi.mocked(mockHttpClient.patch)).toHaveBeenCalledWith(`/${accountId}/account`, updates);
    });
  });

  describe('getAccountEmail', () => {
    it('should get account email successfully', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockResponse = { email: 'john@example.com' };

      vi.mocked(mockHttpClient.get).mockResolvedValue(mockResponse);

      const result = await accountService.getAccountEmail(accountId);

      expect(vi.mocked(mockHttpClient.get)).toHaveBeenCalledWith(`/${accountId}/account/email`);
      expect(result).toEqual(mockResponse);
    });

    it('should throw error for invalid account ID', async () => {
      await expect(accountService.getAccountEmail('invalid-id')).rejects.toThrow(
        'Valid accountId is required for get account email',
      );
    });

    it('should throw error for empty account ID', async () => {
      await expect(accountService.getAccountEmail('')).rejects.toThrow(
        'Valid accountId is required for get account email',
      );
    });

    it('should throw error for null account ID', async () => {
      await expect(accountService.getAccountEmail(null as any)).rejects.toThrow(
        'Valid accountId is required for get account email',
      );
    });

    it('should throw error for undefined account ID', async () => {
      await expect(accountService.getAccountEmail(undefined as any)).rejects.toThrow(
        'Valid accountId is required for get account email',
      );
    });
  });

  describe('searchAccount', () => {
    it('should search account by email successfully', async () => {
      const email = 'john@example.com';
      const mockResponse = { accountId: '507f1f77bcf86cd799439011' };

      vi.mocked(mockHttpClient.get).mockResolvedValue(mockResponse);

      const result = await accountService.searchAccount(email);

      expect(vi.mocked(mockHttpClient.get)).toHaveBeenCalledWith(`/account/search?email=${encodeURIComponent(email)}`);
      expect(result).toEqual(mockResponse);
    });

    it('should return empty result when account not found', async () => {
      const email = 'notfound@example.com';
      const mockResponse = {};

      vi.mocked(mockHttpClient.get).mockResolvedValue(mockResponse);

      const result = await accountService.searchAccount(email);

      expect(result).toEqual(mockResponse);
    });

    it('should throw error for invalid email format', async () => {
      await expect(accountService.searchAccount('invalid-email')).rejects.toThrow(
        'Invalid email format for account search',
      );
    });

    it('should throw error for empty email', async () => {
      await expect(accountService.searchAccount('')).rejects.toThrow('Valid email is required for account search');
    });

    it('should throw error for null email', async () => {
      await expect(accountService.searchAccount(null as any)).rejects.toThrow(
        'Valid email is required for account search',
      );
    });

    it('should throw error for undefined email', async () => {
      await expect(accountService.searchAccount(undefined as any)).rejects.toThrow(
        'Valid email is required for account search',
      );
    });

    it('should throw error for email with only whitespace', async () => {
      await expect(accountService.searchAccount('   ')).rejects.toThrow('Valid email is required for account search');
    });

    it('should handle email with special characters', async () => {
      const email = 'test+tag@example.com';
      const mockResponse = { accountId: '507f1f77bcf86cd799439011' };

      vi.mocked(mockHttpClient.get).mockResolvedValue(mockResponse);

      await accountService.searchAccount(email);

      expect(vi.mocked(mockHttpClient.get)).toHaveBeenCalledWith(`/account/search?email=${encodeURIComponent(email)}`);
    });

    it('should handle email with dots and hyphens', async () => {
      const email = 'test.user-name@sub-domain.example.com';
      const mockResponse = { accountId: '507f1f77bcf86cd799439011' };

      vi.mocked(mockHttpClient.get).mockResolvedValue(mockResponse);

      await accountService.searchAccount(email);

      expect(vi.mocked(mockHttpClient.get)).toHaveBeenCalledWith(`/account/search?email=${encodeURIComponent(email)}`);
    });

    it('should throw error for email too long', async () => {
      const longEmail = 'a'.repeat(300) + '@example.com'; // Over 320 char limit

      await expect(accountService.searchAccount(longEmail)).rejects.toThrow('Email too long for account search');
    });

    it('should throw error for email too short', async () => {
      const shortEmail = 'a@'; // Too short

      await expect(accountService.searchAccount(shortEmail)).rejects.toThrow('Email too short for account search');
    });

    it('should throw error for malformed email without @', async () => {
      await expect(accountService.searchAccount('testexample.com')).rejects.toThrow(
        'Invalid email format for account search',
      );
    });

    it('should throw error for malformed email without domain', async () => {
      await expect(accountService.searchAccount('test@')).rejects.toThrow('Invalid email format for account search');
    });

    it('should throw error for malformed email without local part', async () => {
      await expect(accountService.searchAccount('@example.com')).rejects.toThrow(
        'Invalid email format for account search',
      );
    });
  });

  describe('error handling', () => {
    const accountId = '507f1f77bcf86cd799439011';

    it('should handle network errors in getAccount', async () => {
      const networkError = new Error('Network connection failed');
      vi.mocked(mockHttpClient.get).mockRejectedValue(networkError);

      await expect(accountService.getAccount(accountId)).rejects.toThrow('Network connection failed');
    });

    it('should handle server errors in updateAccount', async () => {
      const serverError = new Error('Internal server error');
      vi.mocked(mockHttpClient.patch).mockRejectedValue(serverError);

      const updates = { firstName: 'Jane' };

      await expect(accountService.updateAccount(accountId, updates)).rejects.toThrow('Internal server error');
    });

    it('should handle timeout errors in searchAccount', async () => {
      const timeoutError = new Error('Request timeout');
      vi.mocked(mockHttpClient.get).mockRejectedValue(timeoutError);

      await expect(accountService.searchAccount('test@example.com')).rejects.toThrow('Request timeout');
    });

    it('should handle unexpected response format in getAccountEmail', async () => {
      vi.mocked(mockHttpClient.get).mockResolvedValue(null);

      const result = await accountService.getAccountEmail(accountId);

      expect(result).toBeNull();
    });
  });

  describe('input sanitization', () => {
    const accountId = '507f1f77bcf86cd799439011';

    it('should handle special characters in firstName', async () => {
      const updates = {
        firstName: "O'Connor-Smith",
      };

      vi.mocked(mockHttpClient.patch).mockResolvedValue(createMockAccount());

      await accountService.updateAccount(accountId, updates);

      expect(vi.mocked(mockHttpClient.patch)).toHaveBeenCalledWith(`/${accountId}/account`, updates);
    });

    it('should handle unicode characters in name fields', async () => {
      const updates = {
        firstName: 'José',
        lastName: 'García',
        name: 'José García',
      };

      vi.mocked(mockHttpClient.patch).mockResolvedValue(createMockAccount());

      await accountService.updateAccount(accountId, updates);

      expect(vi.mocked(mockHttpClient.patch)).toHaveBeenCalledWith(`/${accountId}/account`, updates);
    });

    it('should handle numbers in username', async () => {
      const updates = {
        username: 'user123',
      };

      vi.mocked(mockHttpClient.patch).mockResolvedValue(createMockAccount());

      await accountService.updateAccount(accountId, updates);

      expect(vi.mocked(mockHttpClient.patch)).toHaveBeenCalledWith(`/${accountId}/account`, updates);
    });
  });
});
