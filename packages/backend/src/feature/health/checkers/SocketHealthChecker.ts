import { Request, Response } from 'express';
import { HealthChecker, HealthCheckResult, HealthStatus } from '../Health.types';
import socketConfig from '../../../config/socket.config';
import { getInternalServerEnabled } from '../../../config/env.config';

export class SocketHealthChecker implements HealthChecker {
  name = 'socket_io';
  critical = false;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async check(req: Request, res: Response): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      const externalInitialized = socketConfig.isExternalSocketIOInitialized();
      const internalInitialized = socketConfig.isInternalSocketIOInitialized();
      const internalEnabled = getInternalServerEnabled();

      let status = HealthStatus.HEALTHY;
      let message = 'Socket.IO services are healthy';

      if (!externalInitialized) {
        status = HealthStatus.DEGRADED;
        message = 'External Socket.IO not initialized';
      }

      if (internalEnabled && !internalInitialized) {
        status = HealthStatus.DEGRADED;
        message = 'Internal Socket.IO not initialized';
      }

      const details: Record<string, any> = {
        external_socket: {
          initialized: externalInitialized,
        },
        internal_socket: {
          enabled: internalEnabled,
          initialized: internalInitialized,
        },
      };

      if (externalInitialized) {
        try {
          const externalIO = socketConfig.getExternalSocketIO();
          details.external_socket.engine_client_count = externalIO.engine.clientsCount;
        } catch {
          // Socket might not be available
        }
      }

      if (internalInitialized) {
        try {
          const internalIO = socketConfig.getInternalSocketIO();
          details.internal_socket.engine_client_count = internalIO.engine.clientsCount;
        } catch {
          // Socket might not be available
        }
      }

      return {
        status,
        message,
        details,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: HealthStatus.DEGRADED,
        message: 'Socket.IO health check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - start,
      };
    }
  }
}
