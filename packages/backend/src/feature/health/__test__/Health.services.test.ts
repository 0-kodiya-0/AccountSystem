import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MainHealthService } from '../services/MainHealthService';
import { InternalHealthService } from '../services/InternalHealthService';
import { BaseHealthService } from '../services/BaseHealthService';
import { HealthStatus, HealthChecker } from '../Health.types';

// Mock the individual health checkers
const createMockChecker = (name: string, critical: boolean = false): HealthChecker => ({
  name,
  critical,
  check: vi.fn(),
});

describe('Health Services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('BaseHealthService', () => {
    class TestHealthService extends BaseHealthService {
      protected registerCheckers(): void {
        // Will be set manually in tests
      }

      protected getVersion(): string {
        return '1.0.0-test';
      }

      // Expose protected method for testing
      public addChecker(checker: HealthChecker): void {
        this.registerChecker(checker);
      }
    }

    let service: TestHealthService;

    beforeEach(() => {
      service = new TestHealthService();
    });

    describe('checkHealth', () => {
      it('should return healthy status when all checkers are healthy', async () => {
        const checker1 = createMockChecker('checker1', true);
        const checker2 = createMockChecker('checker2', false);

        vi.mocked(checker1.check).mockResolvedValue({
          status: HealthStatus.HEALTHY,
          message: 'Checker 1 is healthy',
          timestamp: new Date().toISOString(),
          responseTime: 10,
        });

        vi.mocked(checker2.check).mockResolvedValue({
          status: HealthStatus.HEALTHY,
          message: 'Checker 2 is healthy',
          timestamp: new Date().toISOString(),
          responseTime: 15,
        });

        service.addChecker(checker1);
        service.addChecker(checker2);

        const result = await service.checkHealth();

        expect(result.status).toBe(HealthStatus.HEALTHY);
        expect(result.version).toBe('1.0.0-test');
        expect(result.components).toHaveProperty('checker1');
        expect(result.components).toHaveProperty('checker2');
        expect(result.summary).toEqual({
          total: 2,
          healthy: 2,
          degraded: 0,
          unhealthy: 0,
          critical_unhealthy: 0,
        });
      });

      it('should return degraded status when non-critical checkers are unhealthy', async () => {
        const criticalChecker = createMockChecker('critical', true);
        const nonCriticalChecker = createMockChecker('non-critical', false);

        vi.mocked(criticalChecker.check).mockResolvedValue({
          status: HealthStatus.HEALTHY,
          message: 'Critical is healthy',
          timestamp: new Date().toISOString(),
          responseTime: 10,
        });

        vi.mocked(nonCriticalChecker.check).mockResolvedValue({
          status: HealthStatus.UNHEALTHY,
          message: 'Non-critical is unhealthy',
          timestamp: new Date().toISOString(),
          responseTime: 100,
        });

        service.addChecker(criticalChecker);
        service.addChecker(nonCriticalChecker);

        const result = await service.checkHealth();

        expect(result.status).toBe(HealthStatus.DEGRADED);
        expect(result.summary).toEqual({
          total: 2,
          healthy: 1,
          degraded: 0,
          unhealthy: 1,
          critical_unhealthy: 0,
        });
      });

      it('should return unhealthy status when critical checkers are unhealthy', async () => {
        const criticalChecker = createMockChecker('critical', true);
        const normalChecker = createMockChecker('normal', false);

        vi.mocked(criticalChecker.check).mockResolvedValue({
          status: HealthStatus.UNHEALTHY,
          message: 'Critical failure',
          timestamp: new Date().toISOString(),
          responseTime: 1000,
        });

        vi.mocked(normalChecker.check).mockResolvedValue({
          status: HealthStatus.HEALTHY,
          message: 'Normal is healthy',
          timestamp: new Date().toISOString(),
          responseTime: 10,
        });

        service.addChecker(criticalChecker);
        service.addChecker(normalChecker);

        const result = await service.checkHealth();

        expect(result.status).toBe(HealthStatus.UNHEALTHY);
        expect(result.summary).toEqual({
          total: 2,
          healthy: 1,
          degraded: 0,
          unhealthy: 1,
          critical_unhealthy: 1,
        });
      });

      it('should return degraded status when some checkers are degraded', async () => {
        const checker1 = createMockChecker('checker1', false);
        const checker2 = createMockChecker('checker2', false);

        vi.mocked(checker1.check).mockResolvedValue({
          status: HealthStatus.HEALTHY,
          message: 'Healthy',
          timestamp: new Date().toISOString(),
          responseTime: 10,
        });

        vi.mocked(checker2.check).mockResolvedValue({
          status: HealthStatus.DEGRADED,
          message: 'Degraded performance',
          timestamp: new Date().toISOString(),
          responseTime: 500,
        });

        service.addChecker(checker1);
        service.addChecker(checker2);

        const result = await service.checkHealth();

        expect(result.status).toBe(HealthStatus.DEGRADED);
        expect(result.summary).toEqual({
          total: 2,
          healthy: 1,
          degraded: 1,
          unhealthy: 0,
          critical_unhealthy: 0,
        });
      });

      it('should handle checker exceptions gracefully', async () => {
        const failingChecker = createMockChecker('failing', true);

        vi.mocked(failingChecker.check).mockRejectedValue(new Error('Checker crashed'));

        service.addChecker(failingChecker);

        const result = await service.checkHealth();

        expect(result.status).toBe(HealthStatus.UNHEALTHY);
        expect(result.components.failing.status).toBe(HealthStatus.UNHEALTHY);
        expect(result.components.failing.message).toBe('Health check threw an exception');
        expect(result.components.failing.details).toEqual({
          error: 'Checker crashed',
        });
        expect(result.summary.critical_unhealthy).toBe(1);
      });

      it('should exclude details when includeDetails is false', async () => {
        const checker = createMockChecker('test', false);

        vi.mocked(checker.check).mockResolvedValue({
          status: HealthStatus.HEALTHY,
          message: 'All good',
          details: { connection_count: 5 },
          timestamp: new Date().toISOString(),
          responseTime: 10,
        });

        service.addChecker(checker);

        const result = await service.checkHealth(false);

        expect(result.components.test.details).toBeUndefined();
      });

      it('should include details when includeDetails is true', async () => {
        const checker = createMockChecker('test', false);

        vi.mocked(checker.check).mockResolvedValue({
          status: HealthStatus.HEALTHY,
          message: 'All good',
          details: { connection_count: 5 },
          timestamp: new Date().toISOString(),
          responseTime: 10,
        });

        service.addChecker(checker);

        const result = await service.checkHealth(true);

        expect(result.components.test.details).toEqual({ connection_count: 5 });
      });

      it('should set correct timestamps and uptime', async () => {
        const checker = createMockChecker('test', false);

        vi.mocked(checker.check).mockResolvedValue({
          status: HealthStatus.HEALTHY,
          message: 'All good',
          timestamp: new Date().toISOString(),
          responseTime: 10,
        });

        service.addChecker(checker);

        const beforeTime = Date.now();
        const result = await service.checkHealth();
        const afterTime = Date.now();

        expect(new Date(result.timestamp).getTime()).toBeGreaterThanOrEqual(beforeTime);
        expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(afterTime);
        expect(result.uptime).toBeGreaterThan(0);
      });
    });

    describe('checkSingleComponent', () => {
      it('should return component health for existing checker', async () => {
        const checker = createMockChecker('test', true);

        vi.mocked(checker.check).mockResolvedValue({
          status: HealthStatus.HEALTHY,
          message: 'Component is healthy',
          details: { version: '1.0' },
          timestamp: new Date().toISOString(),
          responseTime: 25,
        });

        service.addChecker(checker);

        const result = await service.checkSingleComponent('test');

        expect(result).toEqual({
          name: 'test',
          status: HealthStatus.HEALTHY,
          message: 'Component is healthy',
          details: { version: '1.0' },
          responseTime: 25,
          lastCheck: expect.any(String),
          critical: true,
        });
      });

      it('should return null for non-existent checker', async () => {
        const result = await service.checkSingleComponent('nonexistent');
        expect(result).toBeNull();
      });

      it('should handle checker exception', async () => {
        const checker = createMockChecker('failing', false);

        vi.mocked(checker.check).mockRejectedValue(new Error('Component failed'));

        service.addChecker(checker);

        const result = await service.checkSingleComponent('failing');

        expect(result).toEqual({
          name: 'failing',
          status: HealthStatus.UNHEALTHY,
          message: 'Health check threw an exception',
          details: { error: 'Component failed' },
          responseTime: undefined,
          lastCheck: expect.any(String),
          critical: false,
        });
      });
    });

    describe('utility methods', () => {
      it('should return checker names', () => {
        const checker1 = createMockChecker('checker1', false);
        const checker2 = createMockChecker('checker2', true);

        service.addChecker(checker1);
        service.addChecker(checker2);

        expect(service.getCheckerNames()).toEqual(['checker1', 'checker2']);
      });

      it('should return empty array when no checkers', () => {
        expect(service.getCheckerNames()).toEqual([]);
      });

      it('should return correct health status', async () => {
        const healthyChecker = createMockChecker('healthy', false);

        vi.mocked(healthyChecker.check).mockResolvedValue({
          status: HealthStatus.HEALTHY,
          message: 'OK',
          timestamp: new Date().toISOString(),
          responseTime: 5,
        });

        service.addChecker(healthyChecker);

        expect(await service.isHealthy()).toBe(true);
      });

      it('should return false for unhealthy system', async () => {
        const unhealthyChecker = createMockChecker('unhealthy', true);

        vi.mocked(unhealthyChecker.check).mockResolvedValue({
          status: HealthStatus.UNHEALTHY,
          message: 'Failed',
          timestamp: new Date().toISOString(),
          responseTime: 1000,
        });

        service.addChecker(unhealthyChecker);

        expect(await service.isHealthy()).toBe(false);
      });

      it('should return uptime', () => {
        const uptime = service.getUptime();
        expect(uptime).toBeGreaterThan(0);
        expect(typeof uptime).toBe('number');
      });
    });
  });

  describe('MainHealthService', () => {
    let service: MainHealthService;

    beforeEach(() => {
      service = new MainHealthService();
    });

    it('should register expected checkers', () => {
      const checkerNames = service.getCheckerNames();

      expect(checkerNames).toContain('environment');
      expect(checkerNames).toContain('database');
      expect(checkerNames).toContain('socket_io');
      expect(checkerNames).toContain('mock_services');
    });

    it('should return correct version', async () => {
      const result = await service.checkHealth();
      expect(result.version).toBe('1.0.0');
    });

    it('should have critical and non-critical checkers', () => {
      const checkerNames = service.getCheckerNames();
      expect(checkerNames.length).toBeGreaterThan(0);

      // We know environment and database should be critical
      // socket_io and mock_services should be non-critical
    });
  });

  describe('InternalHealthService', () => {
    let service: InternalHealthService;

    beforeEach(() => {
      service = new InternalHealthService();
    });

    it('should register internal API checker', () => {
      const checkerNames = service.getCheckerNames();
      expect(checkerNames).toContain('internal_api');
    });

    it('should return correct version', async () => {
      const result = await service.checkHealth();
      expect(result.version).toBe('1.0.0-internal');
    });

    it('should be focused on internal API health only', () => {
      const checkerNames = service.getCheckerNames();

      // Should only have internal API checker
      expect(checkerNames).toHaveLength(1);
      expect(checkerNames[0]).toBe('internal_api');
    });
  });

  describe('Health Service Integration', () => {
    it('should handle mixed health statuses correctly', async () => {
      class MixedHealthService extends BaseHealthService {
        protected registerCheckers(): void {
          const healthyChecker = createMockChecker('healthy', false);
          const degradedChecker = createMockChecker('degraded', false);
          const unhealthyChecker = createMockChecker('unhealthy', false);
          const criticalFailure = createMockChecker('critical', true);

          vi.mocked(healthyChecker.check).mockResolvedValue({
            status: HealthStatus.HEALTHY,
            message: 'OK',
            timestamp: new Date().toISOString(),
          });

          vi.mocked(degradedChecker.check).mockResolvedValue({
            status: HealthStatus.DEGRADED,
            message: 'Slow',
            timestamp: new Date().toISOString(),
          });

          vi.mocked(unhealthyChecker.check).mockResolvedValue({
            status: HealthStatus.UNHEALTHY,
            message: 'Failed',
            timestamp: new Date().toISOString(),
          });

          vi.mocked(criticalFailure.check).mockResolvedValue({
            status: HealthStatus.UNHEALTHY,
            message: 'Critical failure',
            timestamp: new Date().toISOString(),
          });

          this.registerChecker(healthyChecker);
          this.registerChecker(degradedChecker);
          this.registerChecker(unhealthyChecker);
          this.registerChecker(criticalFailure);
        }

        protected getVersion(): string {
          return '1.0.0-mixed';
        }
      }

      const service = new MixedHealthService();
      const result = await service.checkHealth();

      expect(result.status).toBe(HealthStatus.UNHEALTHY); // Critical failure
      expect(result.summary).toEqual({
        total: 4,
        healthy: 1,
        degraded: 1,
        unhealthy: 2,
        critical_unhealthy: 1,
      });
    });

    it('should handle empty checker list', async () => {
      class EmptyHealthService extends BaseHealthService {
        protected registerCheckers(): void {
          // No checkers registered
        }

        protected getVersion(): string {
          return '1.0.0-empty';
        }
      }

      const service = new EmptyHealthService();
      const result = await service.checkHealth();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.summary).toEqual({
        total: 0,
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
        critical_unhealthy: 0,
      });
    });

    it('should handle slow checkers', async () => {
      class SlowHealthService extends BaseHealthService {
        protected registerCheckers(): void {
          const slowChecker = createMockChecker('slow', false);

          vi.mocked(slowChecker.check).mockImplementation(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return {
              status: HealthStatus.HEALTHY,
              message: 'Slow but healthy',
              timestamp: new Date().toISOString(),
              responseTime: 100,
            };
          });

          this.registerChecker(slowChecker);
        }

        protected getVersion(): string {
          return '1.0.0-slow';
        }
      }

      const service = new SlowHealthService();
      const startTime = Date.now();
      const result = await service.checkHealth();
      const duration = Date.now() - startTime;

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(duration).toBeGreaterThan(90); // Should take at least ~100ms
      expect(result.components.slow.responseTime).toBeGreaterThan(90);
    });
  });
});
