import { io, Socket } from 'socket.io-client';
import { AuthSDKConfig, InternalNotificationData } from '../types';

export class AuthSocketClient {
    private config: AuthSDKConfig;
    private socket: Socket | null = null;
    private subscriptions = new Set<string>();

    constructor(config: AuthSDKConfig) {
        this.config = config;
    }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.socket?.connected) {
                resolve();
                return;
            }

            const socketUrl = this.config.authServiceUrl + '/internal-notifications';

            this.socket = io(socketUrl, {
                auth: {
                    serviceId: this.config.serviceName.toUpperCase(),
                    serviceName: this.config.serviceName
                },
                transports: ['websocket'],
                forceNew: true,
                timeout: 10000
            });

            this.socket.on('connect', () => {
                console.log(`Connected to auth service notifications as ${this.config.serviceName}`);
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                console.error('Failed to connect to auth service notifications:', error);
                reject(error);
            });

            this.socket.on('error', (error) => {
                console.error('Auth service notification error:', error);
            });

            this.socket.on('disconnect', (reason) => {
                console.log(`Disconnected from auth service notifications: ${reason}`);
            });
        });
    }

    async subscribeToAccount(accountId: string): Promise<void> {
        if (!this.socket?.connected) {
            throw new Error('Socket not connected. Call connect() first.');
        }

        return new Promise((resolve, reject) => {
            this.socket!.emit('subscribe-account', { accountId });

            this.socket!.once('subscribed', (data) => {
                if (data.accountId === accountId) {
                    this.subscriptions.add(accountId);
                    resolve();
                }
            });

            this.socket!.once('error', (error) => {
                reject(new Error(error.message));
            });

            setTimeout(() => {
                reject(new Error('Subscription timeout'));
            }, 5000);
        });
    }

    async unsubscribeFromAccount(accountId: string): Promise<void> {
        if (!this.socket?.connected) {
            return;
        }

        return new Promise((resolve, reject) => {
            this.socket!.emit('unsubscribe-account', { accountId });

            this.socket!.once('unsubscribed', (data) => {
                if (data.accountId === accountId) {
                    this.subscriptions.delete(accountId);
                    resolve();
                }
            });

            this.socket!.once('error', (error) => {
                reject(new Error(error.message));
            });

            setTimeout(() => {
                reject(new Error('Unsubscription timeout'));
            }, 5000);
        });
    }

    async subscribeToAccounts(accountIds: string[]): Promise<void> {
        if (!this.socket?.connected) {
            throw new Error('Socket not connected. Call connect() first.');
        }

        return new Promise((resolve, reject) => {
            this.socket!.emit('subscribe-accounts', { accountIds });

            this.socket!.once('bulk-subscribed', (data) => {
                accountIds.forEach(id => this.subscriptions.add(id));
                resolve();
            });

            this.socket!.once('error', (error) => {
                reject(new Error(error.message));
            });

            setTimeout(() => {
                reject(new Error('Bulk subscription timeout'));
            }, 10000);
        });
    }

    onNotification(event: string, callback: (data: InternalNotificationData) => void): void {
        if (!this.socket) {
            throw new Error('Socket not initialized. Call connect() first.');
        }

        this.socket.on(event, callback);
    }

    offNotification(event: string, callback?: (data: InternalNotificationData) => void): void {
        if (!this.socket) {
            return;
        }

        if (callback) {
            this.socket.off(event, callback);
        } else {
            this.socket.off(event);
        }
    }

    ping(): Promise<any> {
        if (!this.socket?.connected) {
            throw new Error('Socket not connected');
        }

        return new Promise((resolve, reject) => {
            this.socket!.emit('ping');

            this.socket!.once('pong', (data) => {
                resolve(data);
            });

            setTimeout(() => {
                reject(new Error('Ping timeout'));
            }, 5000);
        });
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.subscriptions.clear();
        }
    }

    get isConnected(): boolean {
        return this.socket?.connected || false;
    }

    get getSubscriptions(): string[] {
        return Array.from(this.subscriptions);
    }
}