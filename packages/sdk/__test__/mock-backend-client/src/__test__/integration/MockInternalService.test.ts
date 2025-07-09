import { describe, it, expect, beforeAll } from 'vitest';
import { MockInternalService } from '../../../src/services/MockInternalService';
import { HealthStatus, MockInternalClientConfig } from '../../../src/types';

// Test configuration - adjust these based on your actual server setup
const TEST_CONFIG: MockInternalClientConfig = {
  baseUrl: process.env.MOCK_INTERNAL_SERVER_URL || 'http://localhost:4443',
  timeout: 10000,
  enableLogging: false,
  defaultHeaders: {
    'X-Internal-Service-ID': 'test-service',
    'X-Internal-Service-Name': 'Test Service',
    'X-Internal-Service-Secret': 'test-secret-123',
  },
};

describe('Mock Internal Service Integration Tests', () => {
  let mockService: MockInternalService;

  beforeAll(async () => {
    mockService = new MockInternalService(TEST_CONFIG);

    // Verify server is running by checking health
    try {
      const health = await mockService.pingInternal();
      expect(health.status).toBe('ok');
    } catch (error) {
      throw new Error(`Test server not available at ${TEST_CONFIG.baseUrl}. Please start the mock server.`);
    }
  });

  describe('Health Internal API', () => {
    it('should get internal system health', async () => {
      const response = await mockService.getInternalSystemHealth();

      expect(response.status).toBeOneOf([HealthStatus.HEALTHY, HealthStatus.DEGRADED, HealthStatus.UNHEALTHY]);
      expect(response).toHaveProperty('server_info');
      expect(response.server_info).toHaveProperty('type');
      expect(response.server_info).toHaveProperty('features');
      expect(response.server_info.type).toBe('internal-api');
      expect(response.server_info.features).toHaveProperty('httpApi');
      expect(response.server_info.features).toHaveProperty('socketApi');
      expect(response.server_info.features).toHaveProperty('authentication');
      expect(response.server_info.features).toHaveProperty('typescript');
    });

    it('should get internal API health', async () => {
      const response = await mockService.getInternalApiHealth();

      expect(response.name).toBeTruthy();
      expect(response.status).toBeOneOf([HealthStatus.HEALTHY, HealthStatus.DEGRADED, HealthStatus.UNHEALTHY]);
      expect(response).toHaveProperty('lastCheck');
      expect(typeof response.critical).toBe('boolean');
    });

    it('should ping internal health endpoint', async () => {
      const response = await mockService.pingInternal();

      expect(response.status).toBeOneOf(['ok', 'error']);
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('server');
      expect(response.server).toBe('internal-api');
    });

    it('should get internal uptime', async () => {
      const response = await mockService.getInternalUptime();

      expect(typeof response.uptime_ms).toBe('number');
      expect(typeof response.uptime_seconds).toBe('number');
      expect(response).toHaveProperty('uptime_human');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('server');
      expect(response.server).toBe('internal-api');
    });

    it('should get internal health summary', async () => {
      const response = await mockService.getInternalHealthSummary();

      expect(response.status).toBeOneOf([HealthStatus.HEALTHY, HealthStatus.DEGRADED, HealthStatus.UNHEALTHY]);
      expect(response).toHaveProperty('components_summary');
      expect(response.components_summary).toHaveProperty('total');
      expect(response.components_summary).toHaveProperty('healthy');
      expect(response.components_summary).toHaveProperty('degraded');
      expect(response.components_summary).toHaveProperty('unhealthy');
      expect(response.components_summary).toHaveProperty('critical_unhealthy');
    });

    it('should get internal health checkers', async () => {
      const response = await mockService.getInternalHealthCheckers();

      expect(Array.isArray(response.checkers)).toBe(true);
      expect(typeof response.count).toBe('number');
      expect(response.count).toBe(response.checkers.length);
      expect(response).toHaveProperty('server');
      expect(response.server).toBe('internal-api');
    });
  });

  describe('Header Configuration', () => {
    it('should include required internal service headers', async () => {
      // This test verifies that the service is properly configured with headers
      // by making a successful request (which would fail with 401/403 without proper headers)
      const response = await mockService.pingInternal();
      expect(response.status).toBe('ok');
    });

    it('should work with custom service configuration', async () => {
      const customConfig: MockInternalClientConfig = {
        baseUrl: TEST_CONFIG.baseUrl,
        defaultHeaders: {
          'X-Internal-Service-ID': 'custom-service',
          'X-Internal-Service-Name': 'Custom Test Service',
          'X-Internal-Service-Secret': 'custom-secret',
          'X-Request-ID': 'test-request-123',
        },
      };

      const customService = new MockInternalService(customConfig);
      const response = await customService.pingInternal();
      expect(response.status).toBe('ok');
    });

    it('should work with minimal configuration', async () => {
      const minimalConfig: MockInternalClientConfig = {
        baseUrl: TEST_CONFIG.baseUrl,
        defaultHeaders: {
          'X-Internal-Service-ID': 'minimal-service',
        },
      };

      const minimalService = new MockInternalService(minimalConfig);
      const response = await minimalService.pingInternal();
      expect(response.status).toBe('ok');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const offlineConfig: MockInternalClientConfig = {
        baseUrl: 'http://localhost:9999', // Non-existent server
        timeout: 1000,
        defaultHeaders: {
          'X-Internal-Service-ID': 'test-service',
        },
      };

      const offlineService = new MockInternalService(offlineConfig);
      await expect(offlineService.pingInternal()).rejects.toThrow();
    });

    it('should handle missing required headers', async () => {
      const invalidConfig: MockInternalClientConfig = {
        baseUrl: TEST_CONFIG.baseUrl,
        defaultHeaders: {
          // Missing X-Internal-Service-ID
        } as any,
      };

      const invalidService = new MockInternalService(invalidConfig);

      // This should fail with authentication error due to missing service ID
      await expect(invalidService.pingInternal()).rejects.toThrow();
    });
  });
});
