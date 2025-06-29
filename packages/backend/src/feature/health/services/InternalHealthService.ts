import { BaseHealthService } from './BaseHealthService';
import { InternalApiHealthChecker } from '../checkers/InternalApiHealthChecker';

export class InternalHealthService extends BaseHealthService {
  protected registerCheckers(): void {
    this.checkers = [new InternalApiHealthChecker()];
  }

  protected getVersion(): string {
    return '1.0.0-internal';
  }
}

// Create singleton instance for internal API
export const internalHealthService = new InternalHealthService();
