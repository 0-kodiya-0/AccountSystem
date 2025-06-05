import { io, Socket } from 'socket.io-client';
import {
    SocketConfig,
    SocketConnectionState,
    SocketConnectionInfo,
    SocketManager,
    NotificationSocketEvents,
    SocketEventPayloads,
    SocketEventListener
} from '../types';

export class SocketClient implements SocketManager {
    private socket: Socket | null = null;
    private config: SocketConfig;
    private connectionInfo: SocketConnectionInfo;
    private subscriptions = new Set<string>();
    private listeners = new Map<string, Set<SocketEventListener>>();
    private reconnectTimer: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private lastPingTime = 0;

    constructor(config: SocketConfig) {
        this.config = {
            reconnect: true,
            maxReconnectAttempts: 5,
            reconnectDelay: 1000,
            timeout: 5000,
            transports: ['websocket', 'polling'],
            path: '/socket.io',
            ...config
        };

        this.connectionInfo = {
            state: SocketConnectionState.DISCONNECTED,
            reconnectAttempts: 0
        };
    }

    async connect(): Promise<void> {
        if (this.socket?.connected) {
            return;
        }

        return new Promise((resolve, reject) => {
            this.updateConnectionState(SocketConnectionState.CONNECTING);

            this.socket = io(this.config.url, {
                path: this.config.path,
                transports: this.config.transports,
                timeout: this.config.timeout,
                forceNew: this.config.forceNew,
                reconnection: false // We'll handle reconnection manually
            });

            this.socket.on('connect', () => {
                this.connectionInfo.connectedAt = new Date();
                this.connectionInfo.reconnectAttempts = 0;
                this.updateConnectionState(SocketConnectionState.CONNECTED);

                // Start ping monitoring
                this.startPingMonitoring();

                // Re-subscribe to all previous subscriptions
                this.resubscribeAll();

                resolve();
            });

            this.socket.on('disconnect', (reason: string) => {
                this.updateConnectionState(SocketConnectionState.DISCONNECTED);
                this.stopPingMonitoring();

                if (this.config.reconnect && reason !== 'io client disconnect') {
                    this.scheduleReconnect();
                }
            });

            this.socket.on('connect_error', (error: Error) => {
                this.connectionInfo.lastError = error.message;
                this.updateConnectionState(SocketConnectionState.ERROR);

                if (this.connectionInfo.reconnectAttempts === 0) {
                    reject(error);
                } else {
                    this.scheduleReconnect();
                }
            });

            // Set up event listeners
            this.setupEventListeners();
        });
    }

    disconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.stopPingMonitoring();

        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        this.subscriptions.clear();
        this.updateConnectionState(SocketConnectionState.DISCONNECTED);
    }

    async subscribe(accountId: string): Promise<void> {
        if (!this.socket?.connected) {
            throw new Error('Socket not connected');
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Subscription timeout'));
            }, this.config.timeout);

            this.socket!.emit(NotificationSocketEvents.SUBSCRIBE, { accountId });

            const onSubscribed = (data: SocketEventPayloads[NotificationSocketEvents.SUBSCRIBED]) => {
                if (data.accountId === accountId) {
                    clearTimeout(timeout);
                    this.subscriptions.add(accountId);
                    this.socket!.off(NotificationSocketEvents.SUBSCRIBED, onSubscribed);
                    resolve();
                }
            };

            this.socket!.on(NotificationSocketEvents.SUBSCRIBED, onSubscribed);
        });
    }

    async unsubscribe(accountId: string): Promise<void> {
        if (!this.socket?.connected) {
            this.subscriptions.delete(accountId);
            return;
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Unsubscription timeout'));
            }, this.config.timeout);

            this.socket!.emit(NotificationSocketEvents.UNSUBSCRIBE, { accountId });

            const onUnsubscribed = (data: SocketEventPayloads[NotificationSocketEvents.UNSUBSCRIBED]) => {
                if (data.accountId === accountId) {
                    clearTimeout(timeout);
                    this.subscriptions.delete(accountId);
                    this.socket!.off(NotificationSocketEvents.UNSUBSCRIBED, onUnsubscribed);
                    resolve();
                }
            };

            this.socket!.on(NotificationSocketEvents.UNSUBSCRIBED, onUnsubscribed);
        });
    }

    getConnectionState(): SocketConnectionState {
        return this.connectionInfo.state;
    }

    getLatency(): number | null {
        return this.connectionInfo.latency || null;
    }

    isConnected(): boolean {
        return this.socket?.connected || false;
    }

    getConnectionInfo(): SocketConnectionInfo {
        return { ...this.connectionInfo };
    }

    getSubscriptions(): string[] {
        return Array.from(this.subscriptions);
    }

    // Event listener management
    on<K extends keyof SocketEventPayloads>(
        event: K,
        listener: SocketEventListener<SocketEventPayloads[K]>
    ): void {
        const eventStr = event as string;
        if (!this.listeners.has(eventStr)) {
            this.listeners.set(eventStr, new Set());
        }
        this.listeners.get(eventStr)!.add(listener);

        if (this.socket) {
            this.socket.on(eventStr, listener);
        }
    }

    off<K extends keyof SocketEventPayloads>(
        event: K,
        listener?: SocketEventListener<SocketEventPayloads[K]>
    ): void {
        const eventStr = event as string;
        const eventListeners = this.listeners.get(eventStr);

        if (listener && eventListeners) {
            eventListeners.delete(listener);
            if (eventListeners.size === 0) {
                this.listeners.delete(eventStr);
            }
        } else {
            this.listeners.delete(eventStr);
        }

        if (this.socket) {
            if (listener) {
                this.socket.off(eventStr, listener);
            } else {
                this.socket.off(eventStr);
            }
        }
    }

    private setupEventListeners(): void {
        if (!this.socket) return;

        // Re-attach all existing listeners
        for (const [event, listeners] of this.listeners.entries()) {
            for (const listener of listeners) {
                this.socket.on(event, listener);
            }
        }

        // Handle pong for latency calculation
        this.socket.on(NotificationSocketEvents.PONG, (data: SocketEventPayloads[NotificationSocketEvents.PONG]) => {
            const latency = Date.now() - this.lastPingTime;
            this.connectionInfo.latency = latency;
        });
    }

    private updateConnectionState(state: SocketConnectionState): void {
        this.connectionInfo.state = state;
    }

    private scheduleReconnect(): void {
        if (!this.config.reconnect) return;

        if (this.connectionInfo.reconnectAttempts >= this.config.maxReconnectAttempts!) {
            this.updateConnectionState(SocketConnectionState.ERROR);
            this.connectionInfo.lastError = 'Max reconnection attempts reached';
            return;
        }

        this.updateConnectionState(SocketConnectionState.RECONNECTING);
        this.connectionInfo.reconnectAttempts++;

        const delay = this.config.reconnectDelay! * Math.pow(2, this.connectionInfo.reconnectAttempts - 1);

        this.reconnectTimer = setTimeout(() => {
            this.connect().catch((error) => {
                console.warn('Reconnection failed:', error);
            });
        }, delay);
    }

    private async resubscribeAll(): Promise<void> {
        const subscriptions = Array.from(this.subscriptions);

        for (const accountId of subscriptions) {
            try {
                await this.subscribe(accountId);
            } catch (error) {
                console.warn(`Failed to resubscribe to ${accountId}:`, error);
                this.subscriptions.delete(accountId);
            }
        }
    }

    private startPingMonitoring(): void {
        this.pingInterval = setInterval(() => {
            if (this.socket?.connected) {
                this.lastPingTime = Date.now();
                this.socket.emit(NotificationSocketEvents.PING);
            }
        }, 30000); // Ping every 30 seconds
    }

    private stopPingMonitoring(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
}