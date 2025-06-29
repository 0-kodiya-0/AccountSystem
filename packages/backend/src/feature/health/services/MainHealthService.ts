import { BaseHealthService } from './BaseHealthService';
import { DatabaseHealthChecker } from '../checkers/DatabaseHealthChecker';
import { MockServicesHealthChecker } from '../checkers/MockServicesHealthChecker';
import { SocketHealthChecker } from '../checkers/SocketHealthChecker';
import { EnvironmentHealthChecker } from '../checkers/EnvironmentHealthChecker';

export class MainHealthService extends BaseHealthService {
  protected registerCheckers(): void {
    this.checkers = [
      new EnvironmentHealthChecker(),
      new DatabaseHealthChecker(),
      new SocketHealthChecker(),
      new MockServicesHealthChecker(),
    ];
  }

  protected getVersion(): string {
    return '1.0.0';
  }
}

// Create singleton instance for main application
export const mainHealthService = new MainHealthService();
