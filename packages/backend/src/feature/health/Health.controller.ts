import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/response';
import { JsonSuccess, NotFoundError, ApiErrorCode } from '../../types/response.types';
import { mainHealthService } from './services/MainHealthService';
import { HealthStatus } from './Health.types';

/**
 * Get complete system health status
 * GET /health
 */
export const getSystemHealth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const includeDetails = req.query.details !== 'false';
  const health = await mainHealthService.checkHealth(req, res, includeDetails);

  // Set appropriate HTTP status code based on health
  let statusCode = 200;
  if (health.status === HealthStatus.DEGRADED) {
    statusCode = 200; // Still operational
  } else if (health.status === HealthStatus.UNHEALTHY) {
    statusCode = 503; // Service Unavailable
  }

  next(new JsonSuccess(health, statusCode));
});

/**
 * Get health status for a specific component
 * GET /health/:component
 */
export const getComponentHealth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { component } = req.params;

  const componentHealth = await mainHealthService.checkSingleComponent(req, res, component);

  if (!componentHealth) {
    throw new NotFoundError(
      `Health checker not found for component: ${component}`,
      404,
      ApiErrorCode.RESOURCE_NOT_FOUND,
    );
  }

  // Set appropriate status code
  let statusCode = 200;
  if (componentHealth.status === HealthStatus.DEGRADED) {
    statusCode = 200;
  } else if (componentHealth.status === HealthStatus.UNHEALTHY) {
    statusCode = componentHealth.critical ? 503 : 200;
  }

  next(new JsonSuccess(componentHealth, statusCode));
});

/**
 * Get simple health check (for load balancers)
 * GET /health/ping
 */
export const getSimpleHealth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const isHealthy = await mainHealthService.isHealthy(req, res);

  if (isHealthy) {
    next(new JsonSuccess({ status: 'ok', timestamp: new Date().toISOString() }));
  } else {
    next(new JsonSuccess({ status: 'error', timestamp: new Date().toISOString() }, 503));
  }
});

/**
 * Get available health checkers
 * GET /health/checkers
 */
export const getAvailableCheckers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const checkers = mainHealthService.getCheckerNames();

  next(
    new JsonSuccess({
      checkers,
      count: checkers.length,
    }),
  );
});

/**
 * Get system uptime
 * GET /health/uptime
 */
export const getUptime = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const uptimeMs = mainHealthService.getUptime();
  const uptimeSeconds = Math.floor(uptimeMs / 1000);

  next(
    new JsonSuccess({
      uptime_ms: uptimeMs,
      uptime_seconds: uptimeSeconds,
      uptime_human: formatUptime(uptimeSeconds),
      timestamp: new Date().toISOString(),
    }),
  );
});

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}
