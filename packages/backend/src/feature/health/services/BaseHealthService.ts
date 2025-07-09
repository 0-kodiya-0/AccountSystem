import { HealthChecker, SystemHealth, HealthStatus, ComponentHealth } from '../Health.types';
import { logger } from '../../../utils/logger';
import { getNodeEnv } from '../../../config/env.config';
import { Request, Response } from 'express';

export abstract class BaseHealthService {
  protected checkers: HealthChecker[] = [];
  private startTime: number = Date.now();

  constructor() {
    this.registerCheckers();
  }

  protected abstract registerCheckers(): void;

  public registerChecker(checker: HealthChecker): void {
    this.checkers.push(checker);
  }

  public async checkHealth(req: Request, res: Response, includeDetails: boolean = true): Promise<SystemHealth> {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;

    const componentResults: Record<string, ComponentHealth> = {};

    // Run all health checks in parallel
    const checkPromises = this.checkers.map(async (checker) => {
      try {
        const result = await checker.check(req, res);
        return {
          checker,
          result,
        };
      } catch (error) {
        logger.error(`Health check failed for ${checker.name}:`, error);
        return {
          checker,
          result: {
            status: HealthStatus.UNHEALTHY,
            message: 'Health check threw an exception',
            details: {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            timestamp: new Date().toISOString(),
          },
        };
      }
    });

    const results = await Promise.all(checkPromises);

    // Process results
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    let criticalUnhealthy = 0;

    results.forEach(({ checker, result }) => {
      const component: ComponentHealth = {
        name: checker.name,
        status: result.status,
        message: result.message,
        responseTime: result.responseTime,
        lastCheck: result.timestamp,
        critical: checker.critical,
      };

      if (includeDetails && result.details) {
        component.details = result.details;
      }

      componentResults[checker.name] = component;

      // Count statuses
      switch (result.status) {
        case HealthStatus.HEALTHY:
          healthy++;
          break;
        case HealthStatus.DEGRADED:
          degraded++;
          break;
        case HealthStatus.UNHEALTHY:
          unhealthy++;
          if (checker.critical) {
            criticalUnhealthy++;
          }
          break;
      }
    });

    // Determine overall system health
    let systemStatus: HealthStatus;
    if (criticalUnhealthy > 0) {
      systemStatus = HealthStatus.UNHEALTHY;
    } else if (unhealthy > 0 || degraded > 0) {
      systemStatus = HealthStatus.DEGRADED;
    } else {
      systemStatus = HealthStatus.HEALTHY;
    }

    return {
      status: systemStatus,
      version: this.getVersion(),
      timestamp,
      uptime,
      environment: getNodeEnv(),
      components: componentResults,
      summary: {
        total: this.checkers.length,
        healthy,
        degraded,
        unhealthy,
        critical_unhealthy: criticalUnhealthy,
      },
    };
  }

  public async checkSingleComponent(
    req: Request,
    res: Response,
    componentName: string,
  ): Promise<ComponentHealth | null> {
    const checker = this.checkers.find((c) => c.name === componentName);
    if (!checker) {
      return null;
    }

    try {
      const result = await checker.check(req, res);
      return {
        name: checker.name,
        status: result.status,
        message: result.message,
        details: result.details,
        responseTime: result.responseTime,
        lastCheck: result.timestamp,
        critical: checker.critical,
      };
    } catch (error) {
      logger.error(`Health check failed for ${checker.name}:`, error);
      return {
        name: checker.name,
        status: HealthStatus.UNHEALTHY,
        message: 'Health check threw an exception',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        responseTime: undefined,
        lastCheck: new Date().toISOString(),
        critical: checker.critical,
      };
    }
  }

  public getCheckerNames(): string[] {
    return this.checkers.map((c) => c.name);
  }

  public async isHealthy(req: Request, res: Response): Promise<boolean> {
    const health = await this.checkHealth(req, res, false);
    return health.status === HealthStatus.HEALTHY;
  }

  public getUptime(): number {
    return Date.now() - this.startTime;
  }

  protected abstract getVersion(): string;
}
