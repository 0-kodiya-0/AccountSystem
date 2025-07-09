import { Request, Response } from 'express';
import { HealthChecker, HealthCheckResult, HealthStatus } from '../Health.types';
/* BUILD_REMOVE_START */
import { oauthMockService } from '../../../mocks/oauth/OAuthMockService';
import { emailMock } from '../../../mocks/email/EmailServiceMock';
import * as SessionMock from '../../session/__mock__/Session.service.mock';
import * as TokenMock from '../../tokens/__mock__/Token.service.mock';
import * as TwoFAMock from '../../twofa/__mock__/TwoFA.service.mock';
/* BUILD_REMOVE_END */
import {
  getNodeEnv,
  isMockEnabled, // BUILD_REMOVE
} from '../../../config/env.config';

export class MockServicesHealthChecker implements HealthChecker {
  name = 'mock_services';
  critical = false;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async check(req: Request, res: Response): Promise<HealthCheckResult> {
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
      const sessionStatus = SessionMock.getSessionMockStatus(req);
      const tokenStatus = TokenMock.getTokenInfoMock(req);
      const twoFAStatus = TwoFAMock.getTwoFAStatus();

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
          session_mock: { enabled: true, stats: sessionStatus },
          token_mock: { enabled: true, stats: tokenStatus },
          twofa_mock: { enabled: true, stats: twoFAStatus },
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
