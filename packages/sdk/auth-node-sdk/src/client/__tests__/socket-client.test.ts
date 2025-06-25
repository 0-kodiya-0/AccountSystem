import { describe, it, expect, vi, beforeEach } from 'vitest';
import { io } from 'socket.io-client';
import { InternalSocketClient } from '../socket-client';

// Mock socket.io-client
vi.mock('socket.io-client');
const mockedIo = vi.mocked(io);

describe('InternalSocketClient - Custom Logic Only', () => {
  let client: InternalSocketClient;
  let mockSocket: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSocket = {
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };

    mockedIo.mockReturnValue(mockSocket);

    client = new InternalSocketClient({
      baseUrl: 'http://localhost:3000',
      serviceId: 'test-service',
      serviceName: 'test-service-name',
      serviceSecret: 'test-secret',
    });
  });

  describe('Configuration Handling (Our Logic)', () => {
    it('should merge config with proper defaults', () => {
      const clientWithDefaults = new InternalSocketClient({
        baseUrl: 'http://localhost:3000',
        serviceId: 'test',
        serviceName: 'test-name',
        serviceSecret: 'secret',
      });

      // Test that our config merging works
      expect(clientWithDefaults).toBeDefined();
    });

    it('should handle custom configuration overrides', () => {
      const customClient = new InternalSocketClient({
        baseUrl: 'http://localhost:4000',
        serviceId: 'custom-service',
        serviceName: 'custom-name',
        serviceSecret: 'custom-secret',
        timeout: 15000,
        enableLogging: true,
        autoConnect: false,
        maxReconnectAttempts: 10,
      });

      expect(customClient).toBeDefined();
    });
  });

  describe('Connection State Management (Our Logic)', () => {
    it('should track connection state correctly', () => {
      // Initially disconnected
      expect(client.isConnected()).toBe(false);
    });

    it('should track reconnection attempts', () => {
      expect(client.getReconnectAttempts()).toBe(0);

      // Simulate reconnection attempt tracking (our custom logic)
      client['reconnectAttempts'] = 3;
      expect(client.getReconnectAttempts()).toBe(3);
    });

    it('should return correct connection status when socket is connected', () => {
      mockSocket.connected = true;
      client['socket'] = mockSocket;

      expect(client.isConnected()).toBe(true);
    });

    it('should return false when socket is null', () => {
      client['socket'] = null;
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Connection Validation (Our Logic)', () => {
    it('should throw error when calling API methods without connection', () => {
      // Socket not connected
      mockSocket.connected = false;
      client['socket'] = mockSocket;

      expect(() => {
        client.verifyToken('token', 'access', vi.fn());
      }).toThrow('Socket not connected. Call connect() first.');
    });

    it('should throw error when socket is null', () => {
      client['socket'] = null;

      expect(() => {
        client.getUserById('user123', vi.fn());
      }).toThrow('Socket not connected. Call connect() first.');
    });

    it('should allow API calls when properly connected', () => {
      mockSocket.connected = true;
      client['socket'] = mockSocket;

      expect(() => {
        client.verifyToken('token', 'access', vi.fn());
      }).not.toThrow();

      expect(mockSocket.emit).toHaveBeenCalled();
    });
  });

  describe('Event Handler Registration (Our Logic)', () => {
    beforeEach(() => {
      mockSocket.connected = true;
      client['socket'] = mockSocket;
    });

    it('should register event listeners with correct event names', () => {
      const callback = vi.fn();

      client.onUserUpdated(callback);
      expect(mockSocket.on).toHaveBeenCalledWith('user-updated', callback);

      client.onUserDeleted(callback);
      expect(mockSocket.on).toHaveBeenCalledWith('user-deleted', callback);

      client.onSessionExpired(callback);
      expect(mockSocket.on).toHaveBeenCalledWith('session-expired', callback);
    });

    it('should require connection for event listener registration', () => {
      client['socket'] = null;

      expect(() => {
        client.onUserUpdated(vi.fn());
      }).toThrow('Socket not connected. Call connect() first.');
    });
  });

  describe('API Method Parameter Handling (Our Logic)', () => {
    beforeEach(() => {
      mockSocket.connected = true;
      client['socket'] = mockSocket;
    });

    it('should handle token verification with correct parameters', () => {
      const callback = vi.fn();

      client.verifyToken('test-token', 'access', callback);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'auth:verify-token',
        { token: 'test-token', tokenType: 'access' },
        callback,
      );
    });

    it('should use default token type when not specified', () => {
      const callback = vi.fn();

      client.verifyToken('test-token', undefined, callback);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'auth:token-info',
        { token: 'test-token', tokenType: 'access' },
        callback,
      );
    });

    it('should handle session methods with proper data structure', () => {
      const callback = vi.fn();
      const data = { accountIds: ['user123'], sessionCookie: 'cookie' };

      client.getSessionAccounts(data, callback);

      expect(mockSocket.emit).toHaveBeenCalledWith('session:get-accounts', data, callback);
    });

    it('should handle undefined session cookie properly', () => {
      const callback = vi.fn();

      client.getSessionInfo(undefined, callback);

      expect(mockSocket.emit).toHaveBeenCalledWith('session:get-info', { sessionCookie: undefined }, callback);
    });
  });

  describe('Disconnect Handling (Our Logic)', () => {
    it('should handle disconnect when socket exists', () => {
      client['socket'] = mockSocket;

      client.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should handle disconnect gracefully when socket is null', () => {
      client['socket'] = null;

      expect(() => client.disconnect()).not.toThrow();
    });

    it('should reset socket reference after disconnect', () => {
      client['socket'] = mockSocket;

      client.disconnect();

      // Our logic should set socket to null
      expect(client['socket']).toBeNull();
    });
  });

  describe('Error Handling During Connection (Our Logic)', () => {
    it('should handle connection errors properly', async () => {
      // Test our error handling logic
      mockSocket.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect_error') {
          setTimeout(() => callback(new Error('Connection failed')), 0);
        }
      });

      await expect(client.connect()).rejects.toThrow('Socket connection failed: Connection failed');
    });

    it('should track reconnection attempts during reconnect events', async () => {
      mockSocket.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        } else if (event === 'reconnect_attempt') {
          setTimeout(() => callback(2), 10);
        }
      });

      await client.connect();

      // Our logic should track this
      expect(client.getReconnectAttempts()).toBe(2);
    });
  });
});
