import { SocketClient } from '../client/SocketClient';
import {
  SocketCallback,
  TokenVerificationResponse,
  TokenInfoResponse,
  UserResponse,
  UserEmailResponse,
  UserExistsResponse,
  SessionInfoResponse,
  SessionAccountsResponse,
  SessionValidationResponse,
  Account,
} from '../types';

export class SocketService {
  private socketClient: SocketClient;

  constructor(socketClient: SocketClient) {
    this.socketClient = socketClient;
  }

  // ========================================================================
  // Authentication & Token Management
  // ========================================================================

  verifyToken(
    token: string,
    tokenType: 'access' | 'refresh' = 'access',
    callback: SocketCallback<TokenVerificationResponse>,
  ): void {
    this.socketClient.emit('auth:verify-token', { token, tokenType }, callback);
  }

  async verifyTokenAsync(
    token: string,
    tokenType: 'access' | 'refresh' = 'access',
  ): Promise<TokenVerificationResponse> {
    return this.socketClient.emitWithResponse('auth:verify-token', { token, tokenType });
  }

  getTokenInfo(
    token: string,
    tokenType: 'access' | 'refresh' = 'access',
    callback: SocketCallback<TokenInfoResponse>,
  ): void {
    this.socketClient.emit('auth:token-info', { token, tokenType }, callback);
  }

  async getTokenInfoAsync(token: string, tokenType: 'access' | 'refresh' = 'access'): Promise<TokenInfoResponse> {
    return this.socketClient.emitWithResponse('auth:token-info', { token, tokenType });
  }

  // ========================================================================
  // User Management
  // ========================================================================

  getUserById(accountId: string, callback: SocketCallback<UserResponse>): void {
    this.socketClient.emit('users:get-by-id', { accountId }, callback);
  }

  async getUserByIdAsync(accountId: string): Promise<UserResponse> {
    return this.socketClient.emitWithResponse('users:get-by-id', { accountId });
  }

  getUserByEmail(email: string, callback: SocketCallback<UserEmailResponse>): void {
    this.socketClient.emit('users:get-by-email', { email }, callback);
  }

  async getUserByEmailAsync(email: string): Promise<UserEmailResponse> {
    return this.socketClient.emitWithResponse('users:get-by-email', { email });
  }

  checkUserExists(accountId: string, callback: SocketCallback<UserExistsResponse>): void {
    this.socketClient.emit('users:exists', { accountId }, callback);
  }

  async checkUserExistsAsync(accountId: string): Promise<UserExistsResponse> {
    return this.socketClient.emitWithResponse('users:exists', { accountId });
  }

  // ========================================================================
  // Session Management
  // ========================================================================

  getSessionInfo(sessionCookie: string | undefined, callback: SocketCallback<SessionInfoResponse>): void {
    this.socketClient.emit('session:get-info', { sessionCookie }, callback);
  }

  async getSessionInfoAsync(sessionCookie?: string): Promise<SessionInfoResponse> {
    return this.socketClient.emitWithResponse('session:get-info', { sessionCookie });
  }

  getSessionAccounts(
    data: { accountIds?: string[]; sessionCookie?: string },
    callback: SocketCallback<SessionAccountsResponse>,
  ): void {
    this.socketClient.emit('session:get-accounts', data, callback);
  }

  async getSessionAccountsAsync(accountIds?: string[], sessionCookie?: string): Promise<SessionAccountsResponse> {
    return this.socketClient.emitWithResponse('session:get-accounts', { accountIds, sessionCookie });
  }

  validateSession(
    data: { accountId?: string; sessionCookie?: string },
    callback: SocketCallback<SessionValidationResponse>,
  ): void {
    this.socketClient.emit('session:validate', data, callback);
  }

  async validateSessionAsync(accountId?: string, sessionCookie?: string): Promise<SessionValidationResponse> {
    return this.socketClient.emitWithResponse('session:validate', { accountId, sessionCookie });
  }

  // ========================================================================
  // Health & Status
  // ========================================================================

  healthCheck(
    callback: SocketCallback<{
      status: 'healthy';
      timestamp: string;
      server: 'internal-socket';
      serviceId: string;
      serviceName: string;
      authenticated: boolean;
    }>,
  ): void {
    this.socketClient.emit('health', {}, callback);
  }

  async healthCheckAsync(): Promise<{
    status: 'healthy';
    timestamp: string;
    server: 'internal-socket';
    serviceId: string;
    serviceName: string;
    authenticated: boolean;
  }> {
    return this.socketClient.emitWithResponse('health', {});
  }

  ping(
    callback: SocketCallback<{
      pong: true;
      timestamp: string;
      serviceId: string;
      serviceName: string;
    }>,
  ): void {
    this.socketClient.emit('ping', {}, callback);
  }

  async pingAsync(): Promise<{
    pong: true;
    timestamp: string;
    serviceId: string;
    serviceName: string;
  }> {
    return this.socketClient.emitWithResponse('ping', {});
  }

  // ========================================================================
  // Event Listeners
  // ========================================================================

  onUserUpdated(callback: (data: { accountId: string; user: Account; timestamp: string }) => void): void {
    this.socketClient.on('user-updated', callback);
  }

  onUserDeleted(callback: (data: { accountId: string; timestamp: string }) => void): void {
    this.socketClient.on('user-deleted', callback);
  }

  onSessionExpired(callback: (data: { accountId: string; sessionId: string; timestamp: string }) => void): void {
    this.socketClient.on('session-expired', callback);
  }

  onServiceNotification(
    callback: (data: { message: string; level: 'info' | 'warn' | 'error'; timestamp: string }) => void,
  ): void {
    this.socketClient.on('service-notification', callback);
  }

  onMaintenanceMode(callback: (data: { enabled: boolean; message?: string; timestamp: string }) => void): void {
    this.socketClient.on('maintenance-mode', callback);
  }

  // ========================================================================
  // Event Listener Management
  // ========================================================================

  removeUserUpdatedListener(callback?: (data: { accountId: string; user: Account; timestamp: string }) => void): void {
    this.socketClient.off('user-updated', callback);
  }

  removeUserDeletedListener(callback?: (data: { accountId: string; timestamp: string }) => void): void {
    this.socketClient.off('user-deleted', callback);
  }

  removeSessionExpiredListener(
    callback?: (data: { accountId: string; sessionId: string; timestamp: string }) => void,
  ): void {
    this.socketClient.off('session-expired', callback);
  }

  removeServiceNotificationListener(
    callback?: (data: { message: string; level: 'info' | 'warn' | 'error'; timestamp: string }) => void,
  ): void {
    this.socketClient.off('service-notification', callback);
  }

  removeMaintenanceModeListener(
    callback?: (data: { enabled: boolean; message?: string; timestamp: string }) => void,
  ): void {
    this.socketClient.off('maintenance-mode', callback);
  }

  removeAllListeners(): void {
    this.socketClient.removeAllListeners();
  }
}
