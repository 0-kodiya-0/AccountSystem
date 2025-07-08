import { HealthChecker, HealthCheckResult, HealthStatus } from '../Health.types';
/* BUILD_REMOVE_START */
import { oauthMockService } from '../../../mocks/oauth/OAuthMockService';
import { emailMock } from '../../../mocks/email/EmailServiceMock';
/* BUILD_REMOVE_END */
import {
  getNodeEnv,
  isMockEnabled, // BUILD_REMOVE
} from '../../../config/env.config';

export class MockServicesHealthChecker implements HealthChecker {
  name = 'mock_services';
  critical = false;

  async check(): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      /* BUILD_REMOVE_START */
      const isProduction = getNodeEnv() === 'production';
      const mockEnabled = isMockEnabled();

      if (isProduction) {
        /* BUILD_REMOVE_END */
        return {
          status: HealthStatus.HEALTHY,
          message: 'Mock services disabled in production',
          details: {
            environment: 'production',
            mock_enabled: false,
          },
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - start,
        };
      } // BUILD_REMOVE

      /* BUILD_REMOVE_START */
      if (!mockEnabled) {
        return {
          status: HealthStatus.HEALTHY,
          message: 'Mock services disabled',
          details: {
            mock_enabled: false,
          },
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - start,
        };
      }

      // Check OAuth mock service
      const oauthStats = oauthMockService.getStats();
      const emailStats = emailMock.getStats();

      return {
        status: HealthStatus.HEALTHY,
        message: 'Mock services are healthy',
        details: {
          oauth_mock: {
            enabled: oauthMockService.isEnabled(),
            stats: oauthStats,
          },
          email_mock: {
            enabled: emailMock.isEnabled(),
            stats: emailStats,
          },
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - start,
      };
      /* BUILD_REMOVE_END */
    } catch (error) {
      return {
        status: HealthStatus.DEGRADED,
        message: 'Mock services health check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - start,
      };
    }
  }
}
