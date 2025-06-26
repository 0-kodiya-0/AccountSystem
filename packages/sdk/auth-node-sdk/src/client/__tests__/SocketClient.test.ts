import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SocketClient } from '../../client/SocketClient';
import { SocketClientConfig, SocketResponse } from '../../types';

// Mock socket.io-client - we only test our configuration and logic
const mockSocket = {
  id: 'mock-socket-id',
  connected: false,
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  removeAllListeners: vi.fn(),
  io: {
    engine: {
      transport: {
        name: 'websocket',
      },
    },
  },
};

const mockIo = vi.fn(() => mockSocket);

vi.mock('socket.io-client', () => ({
  io: mockIo,
}));

describe('SocketClient', () => {
  let socketClient: SocketClient;
  let config: SocketClientConfig;

  beforeEach(() => {
    config = {
      baseUrl: 'https://api.example.com',
      serviceId: 'test-service-123',
      serviceName: 'TestService',
      serviceSecret: 'super-secret-key',
      namespace: '/custom-namespace',
      timeout: 15000,
      enableLogging: false,
      autoConnect: true,
      maxReconnectAttempts: 3,
    };

    vi.clearAllMocks();

    // Reset mock socket state
    mockSocket.connected = false;
    mockSocket.id = 'mock-socket-id';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor and configuration processing', () => {
    it('should apply default values for missing config properties', () => {
      const minimalConfig = {
        baseUrl: 'https://api.example.com',
        serviceId: 'test-service',
        serviceName: 'TestService',
        serviceSecret: 'secret',
      };

      socketClient = new SocketClient(minimalConfig);

      expect(socketClient.getConfig()).toEqual(
        expect.objectContaining({
          namespace: '/internal-socket',
          timeout: 30000,
          enableLogging: false,
          autoConnect: true,
          maxReconnectAttempts: 5,
        }),
      );
    });

    it('should preserve provided config values over defaults', () => {
      socketClient = new SocketClient(config);

      expect(socketClient.getConfig()).toEqual(
        expect.objectContaining({
          namespace: '/custom-namespace',
          timeout: 15000,
          enableLogging: false,
          autoConnect: true,
          maxReconnectAttempts: 3,
        }),
      );
    });
  });

  describe('URL construction logic', () => {
    it('should construct correct socket URL with namespace', () => {
      const socketClient = new SocketClient(config);
      socketClient.connect();

      expect(mockIo).toHaveBeenCalledWith('https://api.example.com/custom-namespace', expect.any(Object));
    });

    it('should use default namespace when not provided', () => {
      const configWithoutNamespace = { ...config };
      delete configWithoutNamespace.namespace;

      const client = new SocketClient(configWithoutNamespace);
      client.connect();

      expect(mockIo).toHaveBeenCalledWith('https://api.example.com/internal-socket', expect.any(Object));
    });
  });

  describe('communication logic', () => {
    beforeEach(() => {
      socketClient = new SocketClient(config);
      mockSocket.connected = true;
    });

    it('should throw error when emitting while not connected', () => {
      mockSocket.connected = false;

      expect(() => socketClient.emit('test', {})).toThrow('Socket not connected. Call connect() first.');
    });

    it('should resolve promise with successful response', async () => {
      const testData = { message: 'test' };
      const mockResponse: SocketResponse<any> = {
        success: true,
        data: { result: 'success' },
      };

      // Mock emit to call callback with response
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (callback) callback(mockResponse);
      });

      const result = await socketClient.emitWithResponse('test-event', testData);

      expect(result).toEqual({ result: 'success' });
    });

    it('should reject promise with error response', async () => {
      const testData = { message: 'test' };
      const mockResponse: SocketResponse<any> = {
        success: false,
        error: { code: 'TEST_ERROR', message: 'Test error occurred' },
      };

      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (callback) callback(mockResponse);
      });

      await expect(socketClient.emitWithResponse('test-event', testData)).rejects.toThrow('Test error occurred');
    });

    it('should reject with default message when error message missing', async () => {
      const mockResponse: SocketResponse<any> = {
        success: false,
        error: { code: 'TEST_ERROR' } as any,
      };

      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (callback) callback(mockResponse);
      });

      await expect(socketClient.emitWithResponse('test-event', {})).rejects.toThrow('Socket request failed');
    });
  });

  describe('ping functionality', () => {
    beforeEach(() => {
      socketClient = new SocketClient(config);
      mockSocket.connected = true;
    });

    it('should resolve with latency on successful ping', async () => {
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'ping' && callback) {
          // Simulate 50ms delay
          setTimeout(() => callback(), 50);
        }
      });

      const latency = await socketClient.ping();

      expect(latency).toBeGreaterThanOrEqual(40); // Allow for some variance
      expect(latency).toBeLessThan(100);
    });

    it('should reject when not connected', async () => {
      mockSocket.connected = false;

      await expect(socketClient.ping()).rejects.toThrow('Socket not connected');
    });

    it('should reject on timeout', async () => {
      const quickTimeoutConfig = { ...config, timeout: 100 };
      const quickClient = new SocketClient(quickTimeoutConfig);
      mockSocket.connected = true;

      // Don't call the callback to simulate timeout
      mockSocket.emit.mockImplementation(() => {});

      await expect(quickClient.ping()).rejects.toThrow('Ping timeout');
    });
  });
});
