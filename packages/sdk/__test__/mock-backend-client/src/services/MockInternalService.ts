import { MockHttpClient } from '../client/MockHttpClient';
import {
  ApiErrorCode,
  AuthSDKError,
  ComponentHealth,
  HealthCheckersResponse,
  HealthPingResponse,
  HealthSummaryResponse,
  InternalSystemHealth,
  MockInternalClientConfig,
  UptimeResponse,
} from '../types';

export class MockInternalService {
  private httpClient: MockHttpClient;

  constructor(config: MockInternalClientConfig) {
    this.httpClient = new MockHttpClient(config);
  }

  // ============================================================================
  // Internal Health API Methods
  // ============================================================================

  /**
   * Get complete internal system health status
   * @param includeDetails - Include detailed information (default: true)
   */
  async getInternalSystemHealth(includeDetails: boolean = true): Promise<InternalSystemHealth> {
    try {
      return await this.httpClient.get<InternalSystemHealth>('/internal/health', {
        params: { details: includeDetails.toString() },
      });
    } catch (error) {
      throw this.handleError(error, 'Failed to get internal system health');
    }
  }

  /**
   * Get internal API specific health status
   */
  async getInternalApiHealth(): Promise<ComponentHealth> {
    try {
      return await this.httpClient.get<ComponentHealth>('/internal/health/api');
    } catch (error) {
      throw this.handleError(error, 'Failed to get internal API health');
    }
  }

  /**
   * Simple internal health ping for load balancers
   */
  async pingInternal(): Promise<HealthPingResponse> {
    try {
      return await this.httpClient.get<HealthPingResponse>('/internal/health/ping');
    } catch (error) {
      throw this.handleError(error, 'Failed to ping internal health endpoint');
    }
  }

  /**
   * Get internal server uptime
   */
  async getInternalUptime(): Promise<UptimeResponse> {
    try {
      return await this.httpClient.get<UptimeResponse>('/internal/health/uptime');
    } catch (error) {
      throw this.handleError(error, 'Failed to get internal uptime');
    }
  }

  /**
   * Get internal health summary (minimal response)
   */
  async getInternalHealthSummary(): Promise<HealthSummaryResponse> {
    try {
      return await this.httpClient.get<HealthSummaryResponse>('/internal/health/summary');
    } catch (error) {
      throw this.handleError(error, 'Failed to get internal health summary');
    }
  }

  /**
   * Get available internal health checkers
   */
  async getInternalHealthCheckers(): Promise<HealthCheckersResponse> {
    try {
      return await this.httpClient.get<HealthCheckersResponse>('/internal/health/checkers');
    } catch (error) {
      throw this.handleError(error, 'Failed to get internal health checkers');
    }
  }

  private handleError(error: any, context: string): AuthSDKError {
    if (error instanceof AuthSDKError) {
      return error;
    }

    return new AuthSDKError(
      `${context}: ${error?.message || 'Unknown error'}`,
      error?.code || ApiErrorCode.UNKNOWN_ERROR,
      error?.statusCode || 0,
    );
  }
}
