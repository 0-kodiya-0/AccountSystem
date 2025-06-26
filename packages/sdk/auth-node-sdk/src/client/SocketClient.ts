import { io, Socket } from 'socket.io-client';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketClientConfig,
  SocketCallback,
  SocketResponse,
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
  // Core Socket Communication Methods
  // ========================================================================

  emit<T>(event: string, data: any, callback?: SocketCallback<T>): void {
    this.ensureConnected();
    if (callback) {
      this.socket!.emit(event as any, data, callback);
    } else {
      this.socket!.emit(event as any, data);
    }
  }

  emitWithResponse<T>(event: string, data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      this.ensureConnected();
      this.socket!.emit(event as any, data, (response: SocketResponse<T>) => {
        if (response.success) {
          resolve(response.data as T);
        } else {
          reject(new Error(response.error?.message || 'Socket request failed'));
        }
      });
    });
  }

  on<T>(event: string, handler: (data: T) => void): void {
    this.ensureConnected();
    this.socket!.on(event as any, handler);
  }

  off(event: string, handler?: (...args: any[]) => void): void {
    if (this.socket) {
      if (handler) {
        this.socket.off(event as any, handler);
      } else {
        this.socket.off(event as any);
      }
    }
  }

  once<T>(event: string, handler: (data: T) => void): void {
    this.ensureConnected();
    this.socket!.once(event as any, handler);
  }

  removeAllListeners(event?: string): void {
    if (this.socket) {
      if (event) {
        this.socket.removeAllListeners(event as any);
      } else {
        this.socket.removeAllListeners();
      }
    }
  }

  // ========================================================================
  // Connection Management
  // ========================================================================

  async reconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
    }
    return this.connect();
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

  getConnectionId(): string | undefined {
    return this.socket?.id;
  }

  getTransport(): string | undefined {
    return this.socket?.io.engine?.transport?.name;
  }

  isLoggingEnabled(): boolean {
    return this.config.enableLogging || false;
  }

  getConfig(): SocketClientConfig {
    return { ...this.config };
  }

  // ========================================================================
  // Event Handler Helpers
  // ========================================================================

  onConnect(handler: () => void): void {
    if (this.socket) {
      this.socket.on('connect', handler);
    }
  }

  onDisconnect(handler: (reason: string) => void): void {
    if (this.socket) {
      this.socket.on('disconnect', handler);
    }
  }

  onConnectError(handler: (error: Error) => void): void {
    if (this.socket) {
      this.socket.on('connect_error', handler);
    }
  }

  onReconnect(handler: (attemptNumber: number) => void): void {
    if (this.socket) {
      this.socket.on('reconnect_attempt', handler);
    }
  }

  onReconnectFailed(handler: () => void): void {
    if (this.socket) {
      this.socket.on('reconnect_failed', handler);
    }
  }

  // ========================================================================
  // Ping/Pong Utilities
  // ========================================================================

  async ping(): Promise<number> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Ping timeout'));
      }, this.config.timeout || 30000);

      this.socket!.emit('ping', {}, () => {
        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        resolve(latency);
      });
    });
  }

  // ========================================================================
  // Raw Socket Access (for advanced use cases)
  // ========================================================================

  getRawSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
    return this.socket;
  }
}
