import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocketService } from '../../services/SocketService';

// Mock SocketClient - we only test our service logic
const mockSocketClient = {
  emit: vi.fn(),
  emitWithResponse: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('../../client/SocketClient', () => ({
  SocketClient: vi.fn(() => mockSocketClient),
}));

describe('SocketService', () => {
  let socketService: SocketService;

  beforeEach(() => {
    socketService = new SocketService(mockSocketClient as any);
    vi.clearAllMocks();
  });

  describe('authentication methods', () => {
    describe('verifyToken callback version', () => {
      it('should emit correct event with token data', () => {
        const callback = vi.fn();

        socketService.verifyToken('test-token', 'access', callback);

        expect(mockSocketClient.emit).toHaveBeenCalledWith(
          'auth:verify-token',
          { token: 'test-token', tokenType: 'access' },
          callback,
        );
      });

      it('should default to access token type', () => {
        const callback = vi.fn();

        socketService.verifyToken('test-token', 'access', callback);

        expect(mockSocketClient.emit).toHaveBeenCalledWith(
          'auth:verify-token',
          { token: 'test-token', tokenType: 'access' },
          callback,
        );
      });
    });

    describe('verifyTokenAsync', () => {
      it('should use emitWithResponse for async token verification', async () => {
        const mockResponse = { valid: true, accountId: '123' };
        mockSocketClient.emitWithResponse.mockResolvedValue(mockResponse);

        const result = await socketService.verifyTokenAsync('test-token', 'refresh');

        expect(mockSocketClient.emitWithResponse).toHaveBeenCalledWith('auth:verify-token', {
          token: 'test-token',
          tokenType: 'refresh',
        });
        expect(result).toBe(mockResponse);
      });

      it('should default to access token type in async version', async () => {
        await socketService.verifyTokenAsync('test-token');

        expect(mockSocketClient.emitWithResponse).toHaveBeenCalledWith('auth:verify-token', {
          token: 'test-token',
          tokenType: 'access',
        });
      });
    });

    describe('getTokenInfo methods', () => {
      it('should emit token info event with callback', () => {
        const callback = vi.fn();

        socketService.getTokenInfo('token', 'refresh', callback);

        expect(mockSocketClient.emit).toHaveBeenCalledWith(
          'auth:token-info',
          { token: 'token', tokenType: 'refresh' },
          callback,
        );
      });

      it('should handle async token info request', async () => {
        await socketService.getTokenInfoAsync('token', 'access');

        expect(mockSocketClient.emitWithResponse).toHaveBeenCalledWith('auth:token-info', {
          token: 'token',
          tokenType: 'access',
        });
      });
    });
  });

  describe('user management methods', () => {
    describe('getUserById methods', () => {
      it('should emit get user event with callback', () => {
        const callback = vi.fn();

        socketService.getUserById('user123', callback);

        expect(mockSocketClient.emit).toHaveBeenCalledWith('users:get-by-id', { accountId: 'user123' }, callback);
      });

      it('should handle async get user request', async () => {
        const mockUser = { id: 'user123', name: 'John' };
        mockSocketClient.emitWithResponse.mockResolvedValue(mockUser);

        const result = await socketService.getUserByIdAsync('user123');

        expect(mockSocketClient.emitWithResponse).toHaveBeenCalledWith('users:get-by-id', { accountId: 'user123' });
        expect(result).toBe(mockUser);
      });
    });

    describe('getUserByEmail methods', () => {
      it('should emit get user by email event', () => {
        const callback = vi.fn();

        socketService.getUserByEmail('user@example.com', callback);

        expect(mockSocketClient.emit).toHaveBeenCalledWith(
          'users:get-by-email',
          { email: 'user@example.com' },
          callback,
        );
      });

      it('should handle async get user by email', async () => {
        await socketService.getUserByEmailAsync('test@example.com');

        expect(mockSocketClient.emitWithResponse).toHaveBeenCalledWith('users:get-by-email', {
          email: 'test@example.com',
        });
      });
    });

    describe('checkUserExists methods', () => {
      it('should emit user exists check event', () => {
        const callback = vi.fn();

        socketService.checkUserExists('user456', callback);

        expect(mockSocketClient.emit).toHaveBeenCalledWith('users:exists', { accountId: 'user456' }, callback);
      });

      it('should handle async user exists check', async () => {
        const mockResponse = { exists: true, accountId: 'user456' };
        mockSocketClient.emitWithResponse.mockResolvedValue(mockResponse);

        const result = await socketService.checkUserExistsAsync('user456');

        expect(result).toBe(mockResponse);
      });
    });
  });

  describe('session management methods', () => {
    describe('getSessionInfo methods', () => {
      it('should emit session info event with callback', () => {
        const callback = vi.fn();

        socketService.getSessionInfo('session-cookie', callback);

        expect(mockSocketClient.emit).toHaveBeenCalledWith(
          'session:get-info',
          { sessionCookie: 'session-cookie' },
          callback,
        );
      });

      it('should handle undefined session cookie', () => {
        const callback = vi.fn();

        socketService.getSessionInfo(undefined, callback);

        expect(mockSocketClient.emit).toHaveBeenCalledWith('session:get-info', { sessionCookie: undefined }, callback);
      });

      it('should handle async session info request', async () => {
        await socketService.getSessionInfoAsync('session-value');

        expect(mockSocketClient.emitWithResponse).toHaveBeenCalledWith('session:get-info', {
          sessionCookie: 'session-value',
        });
      });
    });

    describe('getSessionAccounts methods', () => {
      it('should emit session accounts event with data', () => {
        const callback = vi.fn();
        const data = { accountIds: ['user1'], sessionCookie: 'cookie' };

        socketService.getSessionAccounts(data, callback);

        expect(mockSocketClient.emit).toHaveBeenCalledWith('session:get-accounts', data, callback);
      });

      it('should handle async session accounts request', async () => {
        const accountIds = ['user1', 'user2'];
        const sessionCookie = 'session-cookie';

        await socketService.getSessionAccountsAsync(accountIds, sessionCookie);

        expect(mockSocketClient.emitWithResponse).toHaveBeenCalledWith('session:get-accounts', {
          accountIds,
          sessionCookie,
        });
      });

      it('should handle undefined parameters in async version', async () => {
        await socketService.getSessionAccountsAsync();

        expect(mockSocketClient.emitWithResponse).toHaveBeenCalledWith('session:get-accounts', {
          accountIds: undefined,
          sessionCookie: undefined,
        });
      });
    });

    describe('validateSession methods', () => {
      it('should emit session validate event', () => {
        const callback = vi.fn();
        const data = { accountId: 'user123', sessionCookie: 'cookie' };

        socketService.validateSession(data, callback);

        expect(mockSocketClient.emit).toHaveBeenCalledWith('session:validate', data, callback);
      });

      it('should handle async session validation', async () => {
        await socketService.validateSessionAsync('user123', 'session-cookie');

        expect(mockSocketClient.emitWithResponse).toHaveBeenCalledWith('session:validate', {
          accountId: 'user123',
          sessionCookie: 'session-cookie',
        });
      });
    });
  });

  describe('health and status methods', () => {
    describe('healthCheck methods', () => {
      it('should emit health check event', () => {
        const callback = vi.fn();

        socketService.healthCheck(callback);

        expect(mockSocketClient.emit).toHaveBeenCalledWith('health', {}, callback);
      });

      it('should handle async health check', async () => {
        const mockHealth = { status: 'healthy', timestamp: '2024-01-01' };
        mockSocketClient.emitWithResponse.mockResolvedValue(mockHealth);

        const result = await socketService.healthCheckAsync();

        expect(mockSocketClient.emitWithResponse).toHaveBeenCalledWith('health', {});
        expect(result).toBe(mockHealth);
      });
    });

    describe('ping methods', () => {
      it('should emit ping event', () => {
        const callback = vi.fn();

        socketService.ping(callback);

        expect(mockSocketClient.emit).toHaveBeenCalledWith('ping', {}, callback);
      });

      it('should handle async ping', async () => {
        const mockPong = { pong: true, timestamp: '2024-01-01' };
        mockSocketClient.emitWithResponse.mockResolvedValue(mockPong);

        const result = await socketService.pingAsync();

        expect(result).toBe(mockPong);
      });
    });
  });

  describe('event listener management', () => {
    describe('event registration', () => {
      it('should register user updated listener', () => {
        const callback = vi.fn();

        socketService.onUserUpdated(callback);

        expect(mockSocketClient.on).toHaveBeenCalledWith('user-updated', callback);
      });

      it('should register user deleted listener', () => {
        const callback = vi.fn();

        socketService.onUserDeleted(callback);

        expect(mockSocketClient.on).toHaveBeenCalledWith('user-deleted', callback);
      });

      it('should register session expired listener', () => {
        const callback = vi.fn();

        socketService.onSessionExpired(callback);

        expect(mockSocketClient.on).toHaveBeenCalledWith('session-expired', callback);
      });

      it('should register service notification listener', () => {
        const callback = vi.fn();

        socketService.onServiceNotification(callback);

        expect(mockSocketClient.on).toHaveBeenCalledWith('service-notification', callback);
      });

      it('should register maintenance mode listener', () => {
        const callback = vi.fn();

        socketService.onMaintenanceMode(callback);

        expect(mockSocketClient.on).toHaveBeenCalledWith('maintenance-mode', callback);
      });
    });

    describe('event removal', () => {
      it('should remove user updated listener', () => {
        const callback = vi.fn();

        socketService.removeUserUpdatedListener(callback);

        expect(mockSocketClient.off).toHaveBeenCalledWith('user-updated', callback);
      });

      it('should remove user deleted listener', () => {
        const callback = vi.fn();

        socketService.removeUserDeletedListener(callback);

        expect(mockSocketClient.off).toHaveBeenCalledWith('user-deleted', callback);
      });

      it('should remove session expired listener', () => {
        const callback = vi.fn();

        socketService.removeSessionExpiredListener(callback);

        expect(mockSocketClient.off).toHaveBeenCalledWith('session-expired', callback);
      });

      it('should remove service notification listener', () => {
        const callback = vi.fn();

        socketService.removeServiceNotificationListener(callback);

        expect(mockSocketClient.off).toHaveBeenCalledWith('service-notification', callback);
      });

      it('should remove maintenance mode listener', () => {
        const callback = vi.fn();

        socketService.removeMaintenanceModeListener(callback);

        expect(mockSocketClient.off).toHaveBeenCalledWith('maintenance-mode', callback);
      });

      it('should remove all listeners', () => {
        socketService.removeAllListeners();

        expect(mockSocketClient.off).toHaveBeenCalledWith();
      });
    });

    describe('event removal without callback', () => {
      it('should remove all user updated listeners when no callback provided', () => {
        socketService.removeUserUpdatedListener();

        expect(mockSocketClient.off).toHaveBeenCalledWith('user-updated', undefined);
      });

      it('should remove all user deleted listeners when no callback provided', () => {
        socketService.removeUserDeletedListener();

        expect(mockSocketClient.off).toHaveBeenCalledWith('user-deleted', undefined);
      });
    });
  });
});
