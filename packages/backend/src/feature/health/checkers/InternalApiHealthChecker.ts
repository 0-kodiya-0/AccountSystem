import { HealthChecker, HealthCheckResult, HealthStatus } from '../Health.types';
import {
  getInternalServerEnabled,
  getInternalPort,
  getInternalServerKeyPath,
  getInternalServerCertPath,
  getInternalCACertPath,
} from '../../../config/env.config';
import socketConfig from '../../../config/socket.config';
import { logger } from '../../../utils/logger';
import { Request, Response } from 'express';

export class InternalApiHealthChecker implements HealthChecker {
  name = 'internal_api';
  critical = false; // Internal API is not critical for main application functionality

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async check(req: Request, res: Response): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      const isEnabled = getInternalServerEnabled();

      if (!isEnabled) {
        return {
          status: HealthStatus.HEALTHY,
          message: 'Internal API is disabled',
          details: {
            enabled: false,
            reason: 'disabled_by_configuration',
          },
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - start,
        };
      }

      // Check if internal socket is initialized
      const socketStatus = await this.checkInternalSocketStatus();

      // Determine overall health
      let status = HealthStatus.HEALTHY;
      let message = 'Internal API is healthy';

      if (!socketStatus.initialized) {
        status = HealthStatus.DEGRADED;
        message = 'Internal Socket.IO is not initialized';
      }

      return {
        status,
        message,
        details: {
          enabled: true,
          port: getInternalPort(),
          socket_io: socketStatus,
          ssl_configured: this.checkSSLConfiguration(),
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: 'Internal API health check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          enabled: getInternalServerEnabled(),
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - start,
      };
    }
  }

  private async checkInternalSocketStatus(): Promise<{
    initialized: boolean;
    connected_clients: number;
    namespace: string;
  }> {
    try {
      const isInitialized = socketConfig.isInternalSocketIOInitialized();

      if (!isInitialized) {
        return {
          initialized: false,
          connected_clients: 0,
          namespace: '/internal',
        };
      }

      const internalIO = socketConfig.getInternalSocketIO();
      const connectedClients = internalIO.engine.clientsCount || 0;

      return {
        initialized: true,
        connected_clients: connectedClients,
        namespace: '/internal',
      };
    } catch (error) {
      logger.debug('Internal socket status check failed:', error);

      return {
        initialized: false,
        connected_clients: 0,
        namespace: '/internal',
      };
    }
  }

  private checkSSLConfiguration(): boolean {
    try {
      const keyPath = getInternalServerKeyPath();
      const certPath = getInternalServerCertPath();
      const caPath = getInternalCACertPath();

      return !!(keyPath && certPath && caPath);
    } catch {
      return false;
    }
  }
}
