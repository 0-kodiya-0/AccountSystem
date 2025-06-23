import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InternalSocketClient } from '../../src';
import { TestSocketServer } from '../helpers/socket-server';
import { mockTokenVerificationResponse, mockUserResponse } from '../helpers/mock-data';

describe('InternalSocketClient', () => {
  let client: InternalSocketClient;
  let testServer: TestSocketServer;
  let serverPort: number;

  const config = {
    baseUrl: 'http://localhost',
    serviceId: 'test-service',
    serviceName: 'Test Service',
    serviceSecret: 'test-secret',
    namespace: '/internal-socket',
    timeout: 5000,
    enableLogging: false,
    autoConnect: false,
    maxReconnectAttempts: 3,
  };

  beforeEach(async () => {
    testServer = new TestSocketServer();
    serverPort = await testServer.start();

    client = new InternalSocketClient({
      ...config,
      baseUrl: `http://localhost:${serverPort}`,
    });
  });

  afterEach(async () => {
    client.disconnect();
    await testServer.stop();
  });

  describe('constructor and configuration', () => {
    it('should create client with correct configuration', () => {
      expect(client).toBeInstanceOf(InternalSocketClient);
      expect(client['config']).toMatchObject({
        ...config,
        baseUrl: `http://localhost:${serverPort}`,
      });
    });

    it('should set default configuration values', () => {
      const defaultClient = new InternalSocketClient({
        baseUrl: 'http://localhost',
        serviceId: 'test',
        serviceName: 'test',
        serviceSecret: 'secret',
      });

      expect(defaultClient['config']).toMatchObject({
        namespace: '/internal-socket',
        timeout: 30000,
        enableLogging: false,
        autoConnect: true,
        maxReconnectAttempts: 5,
      });
    });
  });

  describe('connection management', () => {
    it('should connect successfully with valid credentials', async () => {
      const connectPromise = client.connect();
      await expect(connectPromise).resolves.toBeUndefined();
      expect(client.isConnected()).toBe(true);
    });

    it('should fail to connect with invalid credentials', async () => {
      const invalidClient = new InternalSocketClient({
        ...config,
        baseUrl: `http://localhost:${serverPort}`,
        serviceId: '', // Invalid
        serviceName: '',
      });

      await expect(invalidClient.connect()).rejects.toThrow();
    });

    it('should disconnect gracefully', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);

      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    it('should handle connection timeout', async () => {
      const timeoutClient = new InternalSocketClient({
        ...config,
        baseUrl: 'http://localhost:99999', // Non-existent server
        timeout: 1000,
      });

      await expect(timeoutClient.connect()).rejects.toThrow();
    });
  });

  describe('token verification', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should verify valid access token', async () => {
      return new Promise<void>((resolve) => {
        client.verifyToken('valid_token', 'access', (response) => {
          expect(response.success).toBe(true);
          expect(response.data).toEqual(mockTokenVerificationResponse);
          resolve();
        });
      });
    });

    it('should verify valid refresh token', async () => {
      return new Promise<void>((resolve) => {
        client.verifyToken('valid_token', 'refresh', (response) => {
          expect(response.success).toBe(true);
          expect(response.data).toEqual(mockTokenVerificationResponse);
          resolve();
        });
      });
    });

    it('should handle invalid token', async () => {
      return new Promise<void>((resolve) => {
        client.verifyToken('invalid_token', 'access', (response) => {
          expect(response.success).toBe(false);
          expect(response.error?.code).toBe('TOKEN_INVALID');
          expect(response.error?.message).toBe('Invalid token');
          resolve();
        });
      });
    });

    it('should get token info', async () => {
      return new Promise<void>((resolve) => {
        client.getTokenInfo('valid_token', 'access', (response) => {
          expect(response.success).toBe(true);
          expect(response.data?.tokenInfo).toBeDefined();
          resolve();
        });
      });
    });
  });

  describe('user operations', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should get user by ID successfully', async () => {
      const accountId = '507f1f77bcf86cd799439011';

      return new Promise<void>((resolve) => {
        client.getUserById(accountId, (response) => {
          expect(response.success).toBe(true);
          expect(response.data).toEqual(mockUserResponse);
          resolve();
        });
      });
    });

    it('should handle user not found', async () => {
      const accountId = 'nonexistent_id';

      return new Promise<void>((resolve) => {
        client.getUserById(accountId, (response) => {
          expect(response.success).toBe(false);
          expect(response.error?.code).toBe('USER_NOT_FOUND');
          resolve();
        });
      });
    });

    it('should get user by email', async () => {
      const email = 'test@example.com';

      return new Promise<void>((resolve) => {
        client.getUserByEmail(email, (response) => {
          expect(response.success).toBe(true);
          expect(response.data?.user).toBeDefined();
          resolve();
        });
      });
    });

    it('should check if user exists', async () => {
      const accountId = '507f1f77bcf86cd799439011';

      return new Promise<void>((resolve) => {
        client.checkUserExists(accountId, (response) => {
          expect(response.success).toBe(true);
          expect(response.data?.exists).toBe(true);
          expect(response.data?.accountId).toBe(accountId);
          resolve();
        });
      });
    });
  });

  describe('session operations', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should get session info', async () => {
      return new Promise<void>((resolve) => {
        client.getSessionInfo(undefined, (response) => {
          expect(response.success).toBe(true);
          expect(response.data?.session).toBeDefined();
          resolve();
        });
      });
    });

    it('should get session accounts', async () => {
      const data = {
        accountIds: ['507f1f77bcf86cd799439011'],
        sessionCookie: 'test_cookie',
      };

      return new Promise<void>((resolve) => {
        client.getSessionAccounts(data, (response) => {
          expect(response.success).toBe(true);
          expect(response.data?.accounts).toBeDefined();
          expect(response.data?.count).toBeDefined();
          resolve();
        });
      });
    });

    it('should validate session', async () => {
      const data = {
        accountId: '507f1f77bcf86cd799439011',
        sessionCookie: 'test_cookie',
      };

      return new Promise<void>((resolve) => {
        client.validateSession(data, (response) => {
          expect(response.success).toBe(true);
          expect(response.data?.session).toBeDefined();
          resolve();
        });
      });
    });
  });

  describe('utility operations', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should perform health check', async () => {
      return new Promise<void>((resolve) => {
        client.healthCheck((response) => {
          expect(response.success).toBe(true);
          expect(response.data?.status).toBe('healthy');
          expect(response.data?.server).toBe('internal-socket');
          expect(response.data?.serviceId).toBe('test-service');
          expect(response.data?.serviceName).toBe('Test Service');
          resolve();
        });
      });
    });

    it('should perform ping', async () => {
      return new Promise<void>((resolve) => {
        client.ping((response) => {
          expect(response.success).toBe(true);
          expect(response.data?.pong).toBe(true);
          expect(response.data?.serviceId).toBe('test-service');
          resolve();
        });
      });
    });
  });

  describe('event listeners', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should handle user updated events', async () => {
      const mockData = {
        accountId: '507f1f77bcf86cd799439011',
        user: mockUserResponse.user,
        timestamp: new Date().toISOString(),
      };

      return new Promise<void>((resolve) => {
        client.onUserUpdated((data) => {
          expect(data).toEqual(mockData);
          resolve();
        });

        // Simulate server event by accessing the socket directly
        const socket = client['socket'];
        if (socket) {
          // Cast to any to emit events not in the type definitions
          (socket as any).emit('user-updated', mockData);
        }
      });
    });

    it('should handle user deleted events', async () => {
      const mockData = {
        accountId: '507f1f77bcf86cd799439011',
        timestamp: new Date().toISOString(),
      };

      return new Promise<void>((resolve) => {
        client.onUserDeleted((data) => {
          expect(data).toEqual(mockData);
          resolve();
        });

        const socket = client['socket'];
        if (socket) {
          (socket as any).emit('user-deleted', mockData);
        }
      });
    });

    it('should handle session expired events', async () => {
      const mockData = {
        accountId: '507f1f77bcf86cd799439011',
        sessionId: 'session_123',
        timestamp: new Date().toISOString(),
      };

      return new Promise<void>((resolve) => {
        client.onSessionExpired((data) => {
          expect(data).toEqual(mockData);
          resolve();
        });

        const socket = client['socket'];
        if (socket) {
          (socket as any).emit('session-expired', mockData);
        }
      });
    });

    it('should handle service notifications', async () => {
      const mockData = {
        message: 'Service notification',
        level: 'info' as const,
        timestamp: new Date().toISOString(),
      };

      return new Promise<void>((resolve) => {
        client.onServiceNotification((data) => {
          expect(data).toEqual(mockData);
          resolve();
        });

        const socket = client['socket'];
        if (socket) {
          (socket as any).emit('service-notification', mockData);
        }
      });
    });

    it('should handle maintenance mode events', async () => {
      const mockData = {
        enabled: true,
        message: 'Maintenance mode enabled',
        timestamp: new Date().toISOString(),
      };

      return new Promise<void>((resolve) => {
        client.onMaintenanceMode((data) => {
          expect(data).toEqual(mockData);
          resolve();
        });

        const socket = client['socket'];
        if (socket) {
          (socket as any).emit('maintenance-mode', mockData);
        }
      });
    });
  });

  describe('connection state management', () => {
    it('should throw error when calling methods without connection', () => {
      expect(() => {
        client.verifyToken('token', 'access', () => {});
      }).toThrow('Socket not connected');

      expect(() => {
        client.getUserById('123', () => {});
      }).toThrow('Socket not connected');

      expect(() => {
        client.healthCheck(() => {});
      }).toThrow('Socket not connected');
    });

    it('should track reconnection attempts', async () => {
      expect(client.getReconnectAttempts()).toBe(0);

      // Simulate reconnection attempts by accessing private socket
      const socket = client['socket'];
      if (socket) {
        (socket as any).emit('reconnect_attempt', 1);
        expect(client.getReconnectAttempts()).toBe(1);

        (socket as any).emit('reconnect_attempt', 2);
        expect(client.getReconnectAttempts()).toBe(2);
      }
    });

    it('should reset reconnection attempts on successful connection', async () => {
      await client.connect();
      expect(client.getReconnectAttempts()).toBe(0);
    });
  });

  describe('error scenarios', () => {
    it('should handle connection errors', async () => {
      const errorClient = new InternalSocketClient({
        ...config,
        baseUrl: 'http://localhost:99999', // Non-existent server
      });

      await expect(errorClient.connect()).rejects.toThrow('Socket connection failed');
    });

    it('should handle authentication errors', async () => {
      const authErrorClient = new InternalSocketClient({
        ...config,
        baseUrl: `http://localhost:${serverPort}`,
        serviceId: '', // Will cause auth error
        serviceName: '',
      });

      await expect(authErrorClient.connect()).rejects.toThrow();
    });
  });
});
