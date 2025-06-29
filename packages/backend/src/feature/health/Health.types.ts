export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

export interface HealthCheckResult {
  status: HealthStatus;
  message?: string;
  details?: Record<string, any>;
  timestamp: string;
  responseTime?: number;
}

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  details?: Record<string, any>;
  responseTime?: number;
  lastCheck: string;
  critical: boolean; // Whether this component being down affects overall health
}

export interface SystemHealth {
  status: HealthStatus;
  version: string;
  timestamp: string;
  uptime: number;
  environment: string;
  components: Record<string, ComponentHealth>;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    critical_unhealthy: number;
  };
}

export interface HealthChecker {
  name: string;
  critical: boolean;
  check(): Promise<HealthCheckResult>;
}
