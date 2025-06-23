import { describe, it, expect } from 'vitest';
import { InternalSocketClient } from '../../src';

describe('InternalSocketClient', () => {
  const config = {
    baseUrl: 'http://localhost:3000',
    serviceId: 'test-service',
    serviceName: 'Test Service',
    serviceSecret: 'test-secret',
  };

  describe('constructor and configuration', () => {
    it('should create client with correct configuration', () => {
      const client = new InternalSocketClient(config);

      expect(client).toBeInstanceOf(InternalSocketClient);
      expect(client['config']).toMatchObject({
        ...config,
        namespace: '/internal-socket',
        timeout: 30000,
        enableLogging: false,
        autoConnect: true,
        maxReconnectAttempts: 5,
      });
    });

    it('should set custom configuration values', () => {
      const customConfig = {
        ...config,
        namespace: '/custom',
        timeout: 5000,
        enableLogging: true,
        autoConnect: false,
        maxReconnectAttempts: 3,
      };

      const client = new InternalSocketClient(customConfig);
      expect(client['config']).toMatchObject(customConfig);
    });
  });

  describe('connection state management', () => {
    it('should start in disconnected state', () => {
      const client = new InternalSocketClient(config);
      expect(client.isConnected()).toBe(false);
    });

    it('should track reconnection attempts', () => {
      const client = new InternalSocketClient(config);
      expect(client.getReconnectAttempts()).toBe(0);
    });

    it('should throw error when calling methods without connection', () => {
      const client = new InternalSocketClient(config);

      expect(() => {
        client.verifyToken('token', 'access', () => {});
      }).toThrow('Socket not connected');

      expect(() => {
        client.getUserById('123', () => {});
      }).toThrow('Socket not connected');

      expect(() => {
        client.getTokenInfo('token', 'access', () => {});
      }).toThrow('Socket not connected');

      expect(() => {
        client.checkUserExists('123', () => {});
      }).toThrow('Socket not connected');

      expect(() => {
        client.getSessionInfo(undefined, () => {});
      }).toThrow('Socket not connected');

      expect(() => {
        client.healthCheck(() => {});
      }).toThrow('Socket not connected');

      expect(() => {
        client.ping(() => {});
      }).toThrow('Socket not connected');
    });
  });

  describe('disconnect method', () => {
    it('should handle disconnect when not connected', () => {
      const client = new InternalSocketClient(config);

      // Should not throw error
      expect(() => client.disconnect()).not.toThrow();
      expect(client.isConnected()).toBe(false);
    });
  });
});
