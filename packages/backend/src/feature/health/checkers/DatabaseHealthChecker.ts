import mongoose from 'mongoose';
import { HealthChecker, HealthCheckResult, HealthStatus } from '../Health.types';
import { getAuthConnectionStatus, getModels } from '../../../config/db.config';

export class DatabaseHealthChecker implements HealthChecker {
  name = 'database';
  critical = true;

  async check(): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      // Check if database connections are ready
      const models = await getModels();

      // Test a simple query to ensure database is responsive
      await models.accounts.Account.findOne().limit(1);

      const responseTime = Date.now() - start;

      const connectionState = getAuthConnectionStatus().readyState;

      if (connectionState !== mongoose.ConnectionStates.connected) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: 'Database connection not established',
          details: {
            accounts_state: connectionState,
            connection_states: mongoose.ConnectionStates,
          },
          timestamp: new Date().toISOString(),
          responseTime,
        };
      }

      return {
        status: HealthStatus.HEALTHY,
        message: 'Database connections are healthy',
        details: {
          accounts_state: 'connected',
          response_time_ms: responseTime,
        },
        timestamp: new Date().toISOString(),
        responseTime,
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: 'Database health check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - start,
      };
    }
  }
}
