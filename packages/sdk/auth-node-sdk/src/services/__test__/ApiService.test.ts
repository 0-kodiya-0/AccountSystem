import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiService } from '../../services/ApiService';

// Mock HttpClient - we only test our service logic
const mockHttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../client/HttpClient', () => ({
  HttpClient: vi.fn(() => mockHttpClient),
}));

describe('ApiService', () => {
  let apiService: ApiService;

  beforeEach(() => {
    apiService = new ApiService(mockHttpClient as any);
    vi.clearAllMocks();
  });

  describe('authentication methods', () => {
    describe('verifyToken', () => {
      it('should call correct endpoint with token data', async () => {
        const mockResponse = { valid: true, accountId: '123' };
        mockHttpClient.post.mockResolvedValue(mockResponse);

        const result = await apiService.verifyToken('test-token');

        expect(mockHttpClient.post).toHaveBeenCalledWith('/auth/verify-token', {
          token: 'test-token',
          tokenType: 'access',
        });
        expect(result).toBe(mockResponse);
      });

      it('should handle refresh token type', async () => {
        await apiService.verifyToken('refresh-token', 'refresh');

        expect(mockHttpClient.post).toHaveBeenCalledWith('/auth/verify-token', {
          token: 'refresh-token',
          tokenType: 'refresh',
        });
      });

      it('should default to access token type', async () => {
        await apiService.verifyToken('token');

        expect(mockHttpClient.post).toHaveBeenCalledWith('/auth/verify-token', {
          token: 'token',
          tokenType: 'access',
        });
      });
    });

    describe('getTokenInfo', () => {
      it('should call correct endpoint with token data', async () => {
        await apiService.getTokenInfo('test-token', 'refresh');

        expect(mockHttpClient.post).toHaveBeenCalledWith('/auth/token-info', {
          token: 'test-token',
          tokenType: 'refresh',
        });
      });
    });
  });

  describe('user management methods', () => {
    describe('getUserById', () => {
      it('should call correct endpoint with account ID', async () => {
        await apiService.getUserById('user123');

        expect(mockHttpClient.get).toHaveBeenCalledWith('/users/user123');
      });
    });

    describe('getUserByEmail', () => {
      it('should call correct endpoint with encoded email', async () => {
        await apiService.getUserByEmail('user@example.com');

        expect(mockHttpClient.get).toHaveBeenCalledWith('/users/search/email/user%40example.com');
      });

      it('should handle emails with special characters', async () => {
        await apiService.getUserByEmail('user+test@example.com');

        expect(mockHttpClient.get).toHaveBeenCalledWith('/users/search/email/user%2Btest%40example.com');
      });
    });

    describe('searchUserByEmail', () => {
      it('should call search endpoint with encoded email parameter', async () => {
        await apiService.searchUserByEmail('search@example.com');

        expect(mockHttpClient.get).toHaveBeenCalledWith('/users/search?email=search%40example.com');
      });
    });

    describe('checkUserExists', () => {
      it('should call exists endpoint with account ID', async () => {
        await apiService.checkUserExists('user456');

        expect(mockHttpClient.get).toHaveBeenCalledWith('/users/user456/exists');
      });
    });
  });

  describe('session management methods', () => {
    describe('getSessionInfo', () => {
      it('should call session info endpoint with cookie', async () => {
        await apiService.getSessionInfo('session-cookie-value');

        expect(mockHttpClient.post).toHaveBeenCalledWith('/session/info', {
          sessionCookie: 'session-cookie-value',
        });
      });

      it('should handle undefined session cookie', async () => {
        await apiService.getSessionInfo();

        expect(mockHttpClient.post).toHaveBeenCalledWith('/session/info', {
          sessionCookie: undefined,
        });
      });
    });

    describe('getSessionAccounts', () => {
      it('should call session accounts endpoint with account IDs and cookie', async () => {
        const accountIds = ['user1', 'user2'];
        const sessionCookie = 'session-value';

        await apiService.getSessionAccounts(accountIds, sessionCookie);

        expect(mockHttpClient.post).toHaveBeenCalledWith('/session/accounts', {
          accountIds,
          sessionCookie,
        });
      });

      it('should handle undefined parameters', async () => {
        await apiService.getSessionAccounts();

        expect(mockHttpClient.post).toHaveBeenCalledWith('/session/accounts', {
          accountIds: undefined,
          sessionCookie: undefined,
        });
      });
    });

    describe('validateSession', () => {
      it('should call session validate endpoint', async () => {
        await apiService.validateSession('user123', 'session-cookie');

        expect(mockHttpClient.post).toHaveBeenCalledWith('/session/validate', {
          accountId: 'user123',
          sessionCookie: 'session-cookie',
        });
      });
    });
  });

  describe('health check methods', () => {
    describe('healthCheck', () => {
      it('should call health endpoint', async () => {
        await apiService.healthCheck();

        expect(mockHttpClient.get).toHaveBeenCalledWith('/health');
      });
    });

    describe('isHealthy', () => {
      it('should return true for healthy status', async () => {
        mockHttpClient.get.mockResolvedValue({ status: 'healthy' });

        const result = await apiService.isHealthy();

        expect(result).toBe(true);
      });

      it('should return true for ok status', async () => {
        mockHttpClient.get.mockResolvedValue({ status: 'ok' });

        const result = await apiService.isHealthy();

        expect(result).toBe(true);
      });

      it('should return false for unhealthy status', async () => {
        mockHttpClient.get.mockResolvedValue({ status: 'degraded' });

        const result = await apiService.isHealthy();

        expect(result).toBe(false);
      });

      it('should return false when health check throws error', async () => {
        mockHttpClient.get.mockRejectedValue(new Error('Network error'));

        const result = await apiService.isHealthy();

        expect(result).toBe(false);
      });
    });
  });
});
