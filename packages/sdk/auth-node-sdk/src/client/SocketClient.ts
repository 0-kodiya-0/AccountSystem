import { io, Socket } from 'socket.io-client';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketClientConfig,
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

export class SocketClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private config: SocketClientConfig;
  private reconnectAttempts = 0;

  constructor(config: SocketClientConfig) {
    this.config = {
      namespace: '/internal-socket',
      timeout: 30000,
      enableLogging: false,
      autoConnect: true,
      maxReconnectAttempts: 5,
      ...config,
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socketUrl = this.config.baseUrl;
      const namespace = this.config.namespace!;

      this.socket = io(`${socketUrl}${namespace}`, {
        auth: {
          serviceId: this.config.serviceId,
          serviceName: this.config.serviceName,
          serviceSecret: this.config.serviceSecret,
        },
        timeout: this.config.timeout,
        autoConnect: this.config.autoConnect,
        reconnection: true,
        reconnectionAttempts: this.config.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        transports: ['websocket', 'polling'],
      });

      this.setupEventHandlers(resolve, reject);
    });
  }

  private setupEventHandlers(resolve: () => void, reject: (error: Error) => void): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      if (this.config.enableLogging) {
        console.log(`[Socket] Connected as ${this.config.serviceName}`);
      }
      this.reconnectAttempts = 0;
      resolve();
    });

    this.socket.on('connected', (data) => {
      if (this.config.enableLogging) {
        console.log('[Socket] Connection confirmed:', data);
      }
    });

    this.socket.on('connect_error', (error) => {
      if (this.config.enableLogging) {
        console.error('[Socket] Connection error:', error);
      }
      reject(new Error(`Socket connection failed: ${error.message}`));
    });

    this.socket.on('disconnect', (reason) => {
      if (this.config.enableLogging) {
        console.log('[Socket] Disconnected:', reason);
      }
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
      if (this.config.enableLogging) {
        console.log(`[Socket] Reconnection attempt ${attemptNumber}/${this.config.maxReconnectAttempts}`);
      }
    });

    this.socket.on('reconnect_failed', () => {
      if (this.config.enableLogging) {
        console.error('[Socket] Failed to reconnect');
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private ensureConnected(): void {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Socket not connected. Call connect() first.');
    }
  }

  // ========================================================================
  // API Methods
  // ========================================================================

  verifyToken(
    token: string,
    tokenType: 'access' | 'refresh' = 'access',
    callback: SocketCallback<TokenVerificationResponse>,
  ): void {
    this.ensureConnected();
    this.socket!.emit('auth:verify-token', { token, tokenType }, callback);
  }

  getTokenInfo(
    token: string,
    tokenType: 'access' | 'refresh' = 'access',
    callback: SocketCallback<TokenInfoResponse>,
  ): void {
    this.ensureConnected();
    this.socket!.emit('auth:token-info', { token, tokenType }, callback);
  }

  getUserById(accountId: string, callback: SocketCallback<UserResponse>): void {
    this.ensureConnected();
    this.socket!.emit('users:get-by-id', { accountId }, callback);
  }

  getUserByEmail(email: string, callback: SocketCallback<UserEmailResponse>): void {
    this.ensureConnected();
    this.socket!.emit('users:get-by-email', { email }, callback);
  }

  checkUserExists(accountId: string, callback: SocketCallback<UserExistsResponse>): void {
    this.ensureConnected();
    this.socket!.emit('users:exists', { accountId }, callback);
  }

  getSessionInfo(sessionCookie: string | undefined, callback: SocketCallback<SessionInfoResponse>): void {
    this.ensureConnected();
    this.socket!.emit('session:get-info', { sessionCookie }, callback);
  }

  getSessionAccounts(
    data: { accountIds?: string[]; sessionCookie?: string },
    callback: SocketCallback<SessionAccountsResponse>,
  ): void {
    this.ensureConnected();
    this.socket!.emit('session:get-accounts', data, callback);
  }

  validateSession(
    data: { accountId?: string; sessionCookie?: string },
    callback: SocketCallback<SessionValidationResponse>,
  ): void {
    this.ensureConnected();
    this.socket!.emit('session:validate', data, callback);
  }

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
    this.ensureConnected();
    this.socket!.emit('health', {}, callback);
  }

  ping(
    callback: SocketCallback<{
      pong: true;
      timestamp: string;
      serviceId: string;
      serviceName: string;
    }>,
  ): void {
    this.ensureConnected();
    this.socket!.emit('ping', {}, callback);
  }

  // ========================================================================
  // Event Listeners
  // ========================================================================

  onUserUpdated(callback: (data: { accountId: string; user: Account; timestamp: string }) => void): void {
    this.ensureConnected();
    this.socket!.on('user-updated', callback);
  }

  onUserDeleted(callback: (data: { accountId: string; timestamp: string }) => void): void {
    this.ensureConnected();
    this.socket!.on('user-deleted', callback);
  }

  onSessionExpired(callback: (data: { accountId: string; sessionId: string; timestamp: string }) => void): void {
    this.ensureConnected();
    this.socket!.on('session-expired', callback);
  }

  onServiceNotification(
    callback: (data: { message: string; level: 'info' | 'warn' | 'error'; timestamp: string }) => void,
  ): void {
    this.ensureConnected();
    this.socket!.on('service-notification', callback);
  }

  onMaintenanceMode(callback: (data: { enabled: boolean; message?: string; timestamp: string }) => void): void {
    this.ensureConnected();
    this.socket!.on('maintenance-mode', callback);
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}
