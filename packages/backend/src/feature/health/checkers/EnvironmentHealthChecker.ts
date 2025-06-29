import { HealthChecker, HealthCheckResult, HealthStatus } from '../Health.types';
import { envConfig, getNodeEnv } from '../../../config/env.config';

export class EnvironmentHealthChecker implements HealthChecker {
  name = 'environment';
  critical = true;

  async check(): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      const environment = getNodeEnv();
      const config = envConfig.getAll();

      // Check for required environment variables
      const requiredVars = [
        'JWT_SECRET',
        'SESSION_SECRET',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'BASE_URL',
        'APP_NAME',
      ];

      const missingVars = requiredVars.filter((varName) => !config[varName]);

      if (missingVars.length > 0) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: 'Missing required environment variables',
          details: {
            missing_variables: missingVars,
            environment,
          },
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - start,
        };
      }

      return {
        status: HealthStatus.HEALTHY,
        message: 'Environment configuration is healthy',
        details: {
          environment,
          config_loaded: true,
          variables_count: Object.keys(config).length,
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: 'Environment health check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - start,
      };
    }
  }
}
