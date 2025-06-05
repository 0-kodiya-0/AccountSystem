import { useEffect, useRef, useCallback, useState } from 'react';
import {
    SocketConfig,
    SocketConnectionState,
    SocketConnectionInfo,
    SocketEventPayloads,
    SocketEventListener
} from '../types';
import { SocketClient } from '../client/socket-client';

interface UseSocketOptions {
    autoConnect?: boolean;
    autoSubscribe?: boolean;
    accountId?: string;
}

interface UseSocketReturn {
    // Connection state
    connectionState: SocketConnectionState;
    connectionInfo: SocketConnectionInfo;
    isConnected: boolean;
    isSupported: boolean;

    // Connection control
    connect: () => Promise<void>;
    disconnect: () => void;
    reconnect: () => Promise<void>;

    // Subscription management
    subscribe: (accountId: string) => Promise<void>;
    unsubscribe: (accountId: string) => Promise<void>;
    subscriptions: string[];

    // Event listeners
    on: <K extends keyof SocketEventPayloads>(
        event: K,
        listener: SocketEventListener<SocketEventPayloads[K]>
    ) => void;
    off: <K extends keyof SocketEventPayloads>(
        event: K,
        listener?: SocketEventListener<SocketEventPayloads[K]>
    ) => void;

    // Utilities
    getLatency: () => number | null;
    ping: () => void;
}

export const useSocket = (
    config: SocketConfig,
    options: UseSocketOptions = {}
): UseSocketReturn => {
    const {
        autoConnect = true,
        autoSubscribe = true,
        accountId
    } = options;

    const clientRef = useRef<SocketClient | null>(null);
    const [connectionState, setConnectionState] = useState<SocketConnectionState>(
        SocketConnectionState.DISCONNECTED
    );
    const [connectionInfo, setConnectionInfo] = useState<SocketConnectionInfo>({
        state: SocketConnectionState.DISCONNECTED,
        reconnectAttempts: 0
    });
    const [subscriptions, setSubscriptions] = useState<string[]>([]);
    const [isSupported] = useState(() => {
        // Check if Socket.IO is supported
        return typeof window !== 'undefined' &&
            typeof window.WebSocket !== 'undefined';
    });

    // Connection control methods
    const connect = useCallback(async () => {
        if (!clientRef.current || !isSupported) {
            throw new Error('Socket client not available');
        }
        await clientRef.current.connect();
    }, [isSupported]);

    const disconnect = useCallback(() => {
        if (!clientRef.current) return;
        clientRef.current.disconnect();
    }, []);

    const reconnect = useCallback(async () => {
        if (!clientRef.current || !isSupported) {
            throw new Error('Socket client not available');
        }
        clientRef.current.disconnect();
        await clientRef.current.connect();
    }, [isSupported]);

    // Subscription methods
    const subscribe = useCallback(async (targetAccountId: string) => {
        if (!clientRef.current || !isSupported) {
            throw new Error('Socket client not available');
        }
        await clientRef.current.subscribe(targetAccountId);
    }, [isSupported]);

    const unsubscribe = useCallback(async (targetAccountId: string) => {
        if (!clientRef.current || !isSupported) {
            throw new Error('Socket client not available');
        }
        await clientRef.current.unsubscribe(targetAccountId);
    }, [isSupported]);

    // Event listener methods
    const on = useCallback(<K extends keyof SocketEventPayloads>(
        event: K,
        listener: SocketEventListener<SocketEventPayloads[K]>
    ) => {
        if (!clientRef.current || !isSupported) return;
        clientRef.current.on(event, listener);
    }, [isSupported]);

    const off = useCallback(<K extends keyof SocketEventPayloads>(
        event: K,
        listener?: SocketEventListener<SocketEventPayloads[K]>
    ) => {
        if (!clientRef.current || !isSupported) return;
        clientRef.current.off(event, listener);
    }, [isSupported]);

    // Utility methods
    const getLatency = useCallback(() => {
        if (!clientRef.current || !isSupported) return null;
        return clientRef.current.getLatency();
    }, [isSupported]);

    const ping = useCallback(async () => {
        if (!clientRef.current || !isSupported) return;
        const client = clientRef.current as SocketClient;
        if (client.isConnected()) {
            await client.ping();
        }
    }, [isSupported]);

    // Initialize client
    useEffect(() => {
        if (!isSupported) return;

        clientRef.current = new SocketClient(config);

        return () => {
            if (clientRef.current) {
                clientRef.current.disconnect();
                clientRef.current = null;
            }
        };
    }, [config.url, isSupported]);

    // Monitor connection state
    useEffect(() => {
        if (!clientRef.current) return;

        const pollConnectionState = () => {
            const newState = clientRef.current!.getConnectionState();
            const newInfo = clientRef.current!.getConnectionInfo();
            const newSubscriptions = clientRef.current!.getSubscriptions();

            setConnectionState(newState);
            setConnectionInfo(newInfo);
            setSubscriptions(newSubscriptions);
        };

        // Poll connection state every second
        const interval = setInterval(pollConnectionState, 1000);

        // Initial poll
        pollConnectionState();

        return () => clearInterval(interval);
    }, [clientRef.current]);

    // Auto-connect
    useEffect(() => {
        if (!autoConnect || !clientRef.current || !isSupported) return;

        const connectAsync = async () => {
            try {
                await clientRef.current!.connect();
            } catch (error) {
                console.warn('Failed to auto-connect socket:', error);
            }
        };

        connectAsync();
    }, [autoConnect, isSupported]);

    // Auto-subscribe to account
    useEffect(() => {
        if (!autoSubscribe || !accountId || !clientRef.current || !isSupported) return;

        const subscribeToAccount = async () => {
            if (connectionState === SocketConnectionState.CONNECTED) {
                try {
                    await clientRef.current!.subscribe(accountId);
                } catch (error) {
                    console.warn(`Failed to auto-subscribe to ${accountId}:`, error);
                }
            }
        };

        subscribeToAccount();
    }, [autoSubscribe, accountId, connectionState, isSupported]);

    return {
        // Connection state
        connectionState,
        connectionInfo,
        isConnected: connectionState === SocketConnectionState.CONNECTED,
        isSupported,

        // Connection control
        connect,
        disconnect,
        reconnect,

        // Subscription management
        subscribe,
        unsubscribe,
        subscriptions,

        // Event listeners
        on,
        off,

        // Utilities
        getLatency,
        ping
    };
};