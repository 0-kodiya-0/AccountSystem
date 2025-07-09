import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/response';
import { JsonSuccess } from '../../types/response.types';
import { internalHealthService } from './services/InternalHealthService';
import { HealthStatus } from './Health.types';

/**
 * Get complete internal system health status
 * GET /health
 */
export const getInternalSystemHealth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const includeDetails = req.query.details !== 'false';
  const health = await internalHealthService.checkHealth(req, res, includeDetails);

  // Add internal server specific metadata
  const enhancedHealth = {
    ...health,
    server_info: {
      type: 'internal-api',
      version: '1.0.0',
      features: {
        httpApi: true,
        socketApi: true,
        authentication: 'header-based',
        typescript: true,
      },
    },
  };

  // Set appropriate status code based on health
  let statusCode = 200;
  if (health.status === HealthStatus.DEGRADED) {
    statusCode = 200; // Still operational
  } else if (health.status === HealthStatus.UNHEALTHY) {
    statusCode = 503; // Service Unavailable
  }

  next(new JsonSuccess(enhancedHealth, statusCode));
});

/**
 * Get internal API specific health status
 * GET /health/api
 */
export const getInternalApiHealth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const apiHealth = await internalHealthService.checkSingleComponent(req, res, 'internal_api');

  if (!apiHealth) {
    // If component not found, return basic status
    next(
      new JsonSuccess({
        name: 'internal_api',
        status: 'unknown',
        message: 'Internal API health checker not available',
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  // Set appropriate status code
  let statusCode = 200;
  if (apiHealth.status === HealthStatus.DEGRADED) {
    statusCode = 200;
  } else if (apiHealth.status === HealthStatus.UNHEALTHY) {
    statusCode = 503;
  }

  next(new JsonSuccess(apiHealth, statusCode));
});

/**
 * Simple health ping for load balancers
 * GET /health/ping
 */
export const getInternalHealthPing = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const isHealthy = await internalHealthService.isHealthy();

  const response = {
    status: isHealthy ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    server: 'internal-api',
  };

  const statusCode = isHealthy ? 200 : 503;
  next(new JsonSuccess(response, statusCode));
});

/**
 * Get internal server uptime
 * GET /health/uptime
 */
export const getInternalUptime = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const uptimeMs = internalHealthService.getUptime();
  const uptimeSeconds = Math.floor(uptimeMs / 1000);

  next(
    new JsonSuccess({
      uptime_ms: uptimeMs,
      uptime_seconds: uptimeSeconds,
      uptime_human: formatUptime(uptimeSeconds),
      timestamp: new Date().toISOString(),
      server: 'internal-api',
    }),
  );
});

/**
 * Get internal health summary (minimal response)
 * GET /health/summary
 */
export const getInternalHealthSummary = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const health = await internalHealthService.checkHealth(req, res, false);

  const summary = {
    status: health.status,
    timestamp: health.timestamp,
    uptime: health.uptime,
    environment: health.environment,
    components_summary: health.summary,
  };

  const statusCode = health.status === HealthStatus.UNHEALTHY ? 503 : 200;
  next(new JsonSuccess(summary, statusCode));
});

/**
 * Get available internal health checkers
 * GET /health/checkers
 */
export const getInternalHealthCheckers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const checkers = internalHealthService.getCheckerNames();

  next(
    new JsonSuccess({
      checkers,
      count: checkers.length,
      server: 'internal-api',
    }),
  );
});

// Helper function to format uptime
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
