import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { DatabaseHealthChecker } from '../checkers/DatabaseHealthChecker';
import { EnvironmentHealthChecker } from '../checkers/EnvironmentHealthChecker';
import { SocketHealthChecker } from '../checkers/SocketHealthChecker';
import { MockServicesHealthChecker } from '../checkers/MockServicesHealthChecker';
import { InternalApiHealthChecker } from '../checkers/InternalApiHealthChecker';
import { HealthStatus } from '../Health.types';
import { closeAllConnections, getModels } from '../../../config/db.config';
import socketConfig from '../../../config/socket.config';
import {
  envConfig,
  getNodeEnv,
  getInternalServerEnabled,
  getInternalPort,
  isMockEnabled,
  getInternalCACertPath,
  getInternalServerCertPath,
  getInternalServerKeyPath,
} from '../../../config/env.config';
import { oauthMockService } from '../../../mocks/oauth/OAuthMockService';
import { emailMock } from '../../../mocks/email/EmailServiceMock';

// Mock dependencies
vi.mock('../../../config/db.config', () => ({
  getModels: vi.fn(),
}));

vi.mock('../../../config/socket.config', () => ({
  default: {
    isExternalSocketIOInitialized: vi.fn(),
    isInternalSocketIOInitialized: vi.fn(),
    getExternalSocketIO: vi.fn(),
    getInternalSocketIO: vi.fn(),
  },
}));

vi.mock('../../../config/env.config', () => ({
  envConfig: {
    getAll: vi.fn(),
  },
  getNodeEnv: vi.fn(),
  getInternalServerEnabled: vi.fn(),
  getInternalPort: vi.fn(),
  getInternalServerKeyPath: vi.fn(),
  getInternalServerCertPath: vi.fn(),
  getInternalCACertPath: vi.fn(),
  isMockEnabled: vi.fn(),
}));

vi.mock('../../../mocks/oauth/OAuthMockService', () => ({
  oauthMockService: {
    isEnabled: vi.fn(),
    getStats: vi.fn(),
  },
}));

vi.mock('../../../mocks/email/EmailServiceMock', () => ({
  emailMock: {
    isEnabled: vi.fn(),
    getStats: vi.fn(),
  },
}));

vi.mock('mongoose', () => ({
  default: {
    ConnectionStates: {
      connected: 1,
      disconnected: 0,
      connecting: 2,
      disconnecting: 3,
    },
  },
}));

describe('Health Checkers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('DatabaseHealthChecker', () => {
    let checker: DatabaseHealthChecker;

    beforeEach(() => {
      checker = new DatabaseHealthChecker();
    });

    it('should have correct properties', () => {
      expect(checker.name).toBe('database');
      expect(checker.critical).toBe(true);
    });

    it('should return healthy status when database is connected', async () => {
      const mockAccountModel = {
        findOne: vi.fn().mockResolvedValue({}),
      };

      vi.mocked(getModels).mockResolvedValue({
        accounts: { Account: mockAccountModel },
      } as any);

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.message).toBe('Database connections are healthy');
      expect(result.details).toEqual({
        accounts_state: 'connected',
        response_time_ms: expect.any(Number),
      });
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
    });

    it('should return unhealthy status when database is not connected', async () => {
      vi.mocked(getModels).mockResolvedValue({
        accounts: { Account: {} },
      } as any);

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toBe('Database connection not established');
      expect(result.details).toEqual({
        accounts_state: mongoose.ConnectionStates.disconnected,
        connection_states: mongoose.ConnectionStates,
      });
    });

    it('should return unhealthy status when database query fails', async () => {
      const mockAccountModel = {
        findOne: vi.fn().mockRejectedValue(new Error('Connection timeout')),
      };

      vi.mocked(getModels).mockResolvedValue({
        accounts: { Account: mockAccountModel },
      } as any);

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toBe('Database health check failed');
      expect(result.details).toEqual({
        error: 'Connection timeout',
      });
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('should handle null database connection', async () => {
      vi.mocked(getModels).mockResolvedValue({
        accounts: { Account: {} },
      } as any);

      closeAllConnections();

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toBe('Database connection not established');
    });

    it('should handle getModels failure', async () => {
      vi.mocked(getModels).mockRejectedValue(new Error('Models not initialized'));

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toBe('Database health check failed');
      expect(result.details).toEqual({
        error: 'Models not initialized',
      });
    });
  });

  describe('EnvironmentHealthChecker', () => {
    let checker: EnvironmentHealthChecker;

    beforeEach(() => {
      checker = new EnvironmentHealthChecker();
      vi.mocked(getNodeEnv).mockReturnValue('test');
    });

    it('should have correct properties', () => {
      expect(checker.name).toBe('environment');
      expect(checker.critical).toBe(true);
    });

    it('should return healthy status when all required variables are present', async () => {
      vi.mocked(envConfig.getAll).mockReturnValue({
        JWT_SECRET: 'test-secret',
        SESSION_SECRET: 'test-session',
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        BASE_URL: 'http://localhost:3000',
        APP_NAME: 'TestApp',
        NODE_ENV: 'test',
      });

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.message).toBe('Environment configuration is healthy');
      expect(result.details).toEqual({
        environment: 'test',
        config_loaded: true,
        variables_count: 7,
      });
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('should return unhealthy status when required variables are missing', async () => {
      vi.mocked(envConfig.getAll).mockReturnValue({
        // Missing JWT_SECRET and other required vars
        SESSION_SECRET: 'test-session',
        NODE_ENV: 'test',
      });

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toBe('Missing required environment variables');
      expect(result.details).toEqual({
        missing_variables: expect.arrayContaining(['JWT_SECRET']),
        environment: 'test',
      });
    });

    it('should detect multiple missing variables', async () => {
      vi.mocked(envConfig.getAll).mockReturnValue({
        NODE_ENV: 'test',
        // Missing most required variables
      });

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.details?.missing_variables).toEqual(
        expect.arrayContaining([
          'JWT_SECRET',
          'SESSION_SECRET',
          'GOOGLE_CLIENT_ID',
          'GOOGLE_CLIENT_SECRET',
          'BASE_URL',
          'APP_NAME',
        ]),
      );
    });

    it('should handle environment config errors', async () => {
      vi.mocked(envConfig.getAll).mockImplementation(() => {
        throw new Error('Config load failed');
      });

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toBe('Environment health check failed');
      expect(result.details).toEqual({
        error: 'Config load failed',
      });
    });

    it('should handle different environments', async () => {
      vi.mocked(getNodeEnv).mockReturnValue('production');
      vi.mocked(envConfig.getAll).mockReturnValue({
        JWT_SECRET: 'test-secret',
        SESSION_SECRET: 'test-session',
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        BASE_URL: 'http://localhost:3000',
        APP_NAME: 'TestApp',
        NODE_ENV: 'production',
      });

      const result = await checker.check();

      expect(result.details?.environment).toBe('production');
    });
  });

  describe('SocketHealthChecker', () => {
    let checker: SocketHealthChecker;

    beforeEach(() => {
      checker = new SocketHealthChecker();
    });

    it('should have correct properties', () => {
      expect(checker.name).toBe('socket_io');
      expect(checker.critical).toBe(false);
    });

    it('should return healthy status when all sockets are initialized', async () => {
      vi.mocked(socketConfig.isExternalSocketIOInitialized).mockReturnValue(true);
      vi.mocked(socketConfig.isInternalSocketIOInitialized).mockReturnValue(true);
      vi.mocked(getInternalServerEnabled).mockReturnValue(true);

      const mockExternalIO = { engine: { clientsCount: 5 } };
      const mockInternalIO = { engine: { clientsCount: 2 } };
      vi.mocked(socketConfig.getExternalSocketIO).mockReturnValue(mockExternalIO as any);
      vi.mocked(socketConfig.getInternalSocketIO).mockReturnValue(mockInternalIO as any);

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.message).toBe('Socket.IO services are healthy');
      expect(result.details).toEqual({
        external_socket: {
          initialized: true,
          engine_client_count: 5,
        },
        internal_socket: {
          enabled: true,
          initialized: true,
          engine_client_count: 2,
        },
      });
    });

    it('should return degraded status when external socket not initialized', async () => {
      vi.mocked(socketConfig.isExternalSocketIOInitialized).mockReturnValue(false);
      vi.mocked(socketConfig.isInternalSocketIOInitialized).mockReturnValue(true);
      vi.mocked(getInternalServerEnabled).mockReturnValue(true);

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.message).toBe('External Socket.IO not initialized');
    });

    it('should return degraded status when internal socket not initialized but enabled', async () => {
      vi.mocked(socketConfig.isExternalSocketIOInitialized).mockReturnValue(true);
      vi.mocked(socketConfig.isInternalSocketIOInitialized).mockReturnValue(false);
      vi.mocked(getInternalServerEnabled).mockReturnValue(true);

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.message).toBe('Internal Socket.IO not initialized');
    });

    it('should return healthy when internal socket disabled', async () => {
      vi.mocked(socketConfig.isExternalSocketIOInitialized).mockReturnValue(true);
      vi.mocked(socketConfig.isInternalSocketIOInitialized).mockReturnValue(false);
      vi.mocked(getInternalServerEnabled).mockReturnValue(false);

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.details).toEqual({
        external_socket: {
          initialized: true,
        },
        internal_socket: {
          enabled: false,
          initialized: false,
        },
      });
    });

    it('should handle socket IO access errors gracefully', async () => {
      vi.mocked(socketConfig.isExternalSocketIOInitialized).mockReturnValue(true);
      vi.mocked(socketConfig.getExternalSocketIO).mockImplementation(() => {
        throw new Error('Socket not available');
      });

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.message).toBe('Socket.IO health check failed');
      expect(result.details).toEqual({
        error: 'Socket not available',
      });
    });
  });

  describe('MockServicesHealthChecker', () => {
    let checker: MockServicesHealthChecker;

    beforeEach(() => {
      checker = new MockServicesHealthChecker();
    });

    it('should have correct properties', () => {
      expect(checker.name).toBe('mock_services');
      expect(checker.critical).toBe(false);
    });

    it('should return healthy status in production', async () => {
      vi.mocked(getNodeEnv).mockReturnValue('production');

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.message).toBe('Mock services disabled in production');
      expect(result.details).toEqual({
        environment: 'production',
        mock_enabled: false,
      });
    });

    it('should return healthy status when mocks disabled', async () => {
      vi.mocked(getNodeEnv).mockReturnValue('development');
      vi.mocked(isMockEnabled).mockReturnValue(false);

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.message).toBe('Mock services disabled');
      expect(result.details).toEqual({
        mock_enabled: false,
      });
    });

    it('should return healthy status when mocks enabled and working', async () => {
      vi.mocked(getNodeEnv).mockReturnValue('development');
      vi.mocked(isMockEnabled).mockReturnValue(true);

      const oauthStats = { totalRequests: 10, successfulRequests: 9 };
      const emailStats = { totalEmails: 5, successfulEmails: 5 };

      vi.mocked(oauthMockService.isEnabled).mockReturnValue(true);
      vi.mocked(oauthMockService.getStats).mockReturnValue(oauthStats);
      vi.mocked(emailMock.isEnabled).mockReturnValue(true);
      vi.mocked(emailMock.getStats).mockReturnValue(emailStats);

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.message).toBe('Mock services are healthy');
      expect(result.details).toEqual({
        oauth_mock: {
          enabled: true,
          stats: oauthStats,
        },
        email_mock: {
          enabled: true,
          stats: emailStats,
        },
      });
    });

    it('should return degraded status when mock service fails', async () => {
      vi.mocked(getNodeEnv).mockReturnValue('development');
      vi.mocked(isMockEnabled).mockReturnValue(true);
      vi.mocked(oauthMockService.getStats).mockImplementation(() => {
        throw new Error('Mock service error');
      });

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.message).toBe('Mock services health check failed');
      expect(result.details).toEqual({
        error: 'Mock service error',
      });
    });
  });

  describe('InternalApiHealthChecker', () => {
    let checker: InternalApiHealthChecker;

    beforeEach(() => {
      checker = new InternalApiHealthChecker();
    });

    it('should have correct properties', () => {
      expect(checker.name).toBe('internal_api');
      expect(checker.critical).toBe(false);
    });

    it('should return healthy status when internal server disabled', async () => {
      vi.mocked(getInternalServerEnabled).mockReturnValue(false);

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.message).toBe('Internal API is disabled');
      expect(result.details).toEqual({
        enabled: false,
        reason: 'disabled_by_configuration',
      });
    });

    it('should return healthy status when internal server enabled and working', async () => {
      vi.mocked(getInternalServerEnabled).mockReturnValue(true);
      vi.mocked(getInternalPort).mockReturnValue(4443);
      vi.mocked(socketConfig.isInternalSocketIOInitialized).mockReturnValue(true);

      const mockInternalIO = { engine: { clientsCount: 3 } };
      vi.mocked(socketConfig.getInternalSocketIO).mockReturnValue(mockInternalIO as any);

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.message).toBe('Internal API is healthy');
      expect(result.details).toEqual({
        enabled: true,
        port: 4443,
        socket_io: {
          initialized: true,
          connected_clients: 3,
          namespace: '/internal',
        },
        ssl_configured: false,
      });
    });

    it('should return degraded status when socket not initialized', async () => {
      vi.mocked(getInternalServerEnabled).mockReturnValue(true);
      vi.mocked(getInternalPort).mockReturnValue(4443);
      vi.mocked(socketConfig.isInternalSocketIOInitialized).mockReturnValue(false);

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.message).toBe('Internal Socket.IO is not initialized');
    });

    it('should detect SSL configuration', async () => {
      vi.mocked(getInternalServerEnabled).mockReturnValue(true);
      vi.mocked(socketConfig.isInternalSocketIOInitialized).mockReturnValue(true);

      // Mock SSL paths
      vi.mocked(getInternalServerKeyPath).mockReturnValue('/path/to/key.pem');
      vi.mocked(getInternalServerCertPath).mockReturnValue('/path/to/cert.pem');
      vi.mocked(getInternalCACertPath).mockReturnValue('/path/to/ca.pem');

      const result = await checker.check();

      expect(result.details?.ssl_configured).toBe(true);
    });

    it('should handle socket access errors gracefully', async () => {
      vi.mocked(getInternalServerEnabled).mockReturnValue(true);
      vi.mocked(socketConfig.isInternalSocketIOInitialized).mockReturnValue(true);
      vi.mocked(socketConfig.getInternalSocketIO).mockImplementation(() => {
        throw new Error('Socket access failed');
      });

      const result = await checker.check();

      expect(result.details?.socket_io).toEqual({
        initialized: false,
        connected_clients: 0,
        namespace: '/internal',
      });
    });

    it('should handle checker execution errors', async () => {
      vi.mocked(getInternalServerEnabled).mockImplementation(() => {
        throw new Error('Config error');
      });

      const result = await checker.check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toBe('Internal API health check failed');
      expect(result.details).toEqual({
        error: 'Config error',
        enabled: false,
      });
    });
  });

  describe('Response Time Tracking', () => {
    it('should track response time for all checkers', async () => {
      const checkers = [
        new DatabaseHealthChecker(),
        new EnvironmentHealthChecker(),
        new SocketHealthChecker(),
        new MockServicesHealthChecker(),
        new InternalApiHealthChecker(),
      ];

      // Setup mocks for successful checks
      vi.mocked(getModels).mockResolvedValue({
        accounts: { Account: { findOne: vi.fn().mockResolvedValue({}) } },
      } as any);
      vi.mocked(envConfig.getAll).mockReturnValue({
        JWT_SECRET: 'test',
        SESSION_SECRET: 'test',
        GOOGLE_CLIENT_ID: 'test',
        GOOGLE_CLIENT_SECRET: 'test',
        BASE_URL: 'test',
        APP_NAME: 'test',
      });
      vi.mocked(socketConfig.isExternalSocketIOInitialized).mockReturnValue(true);
      vi.mocked(getInternalServerEnabled).mockReturnValue(false);
      vi.mocked(getNodeEnv).mockReturnValue('production');

      for (const checker of checkers) {
        const result = await checker.check();
        expect(result.responseTime).toBeGreaterThan(0);
        expect(typeof result.responseTime).toBe('number');
      }
    });
  });

  describe('Error Recovery', () => {
    it('should handle partial system failures gracefully', async () => {
      const checker = new DatabaseHealthChecker();

      // First call fails
      vi.mocked(getModels).mockRejectedValueOnce(new Error('Temporary failure'));

      let result = await checker.check();
      expect(result.status).toBe(HealthStatus.UNHEALTHY);

      // Second call succeeds
      vi.mocked(getModels).mockResolvedValue({
        accounts: { Account: { findOne: vi.fn().mockResolvedValue({}) } },
      } as any);

      result = await checker.check();
      expect(result.status).toBe(HealthStatus.HEALTHY);
    });
  });
});
