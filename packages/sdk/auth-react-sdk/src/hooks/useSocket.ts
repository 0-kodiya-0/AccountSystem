import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  SocketConfig,
  SocketConnectionState,
  SocketConnectionInfo,
  SocketEventPayloads,
  SocketEventListener,
} from '../types';
import { SocketClient } from '../client/socketClient';

interface UseSocketOptions {
  autoConnect?: boolean;
  autoSubscribe?: boolean;
  accountId?: string;
}

export const useSocket = (config: SocketConfig, options: UseSocketOptions = {}) => {
  const { autoConnect = true, autoSubscribe = true, accountId } = options;
  const { session } = useAppStore();

  const clientRef = useRef<SocketClient | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<SocketConnectionInfo>({
    state: SocketConnectionState.DISCONNECTED,
    reconnectAttempts: 0,
  });
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [isSupported] = useState(() => {
    return typeof window !== 'undefined' && typeof window.WebSocket !== 'undefined';
  });

  // Use current account from store if no accountId provided
  const targetAccountId = accountId || session.currentAccountId;

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
  const subscribe = useCallback(
    async (targetAccountId: string) => {
      if (!clientRef.current || !isSupported) {
        throw new Error('Socket client not available');
      }
      await clientRef.current.subscribe(targetAccountId);
    },
    [isSupported],
  );

  const unsubscribe = useCallback(
    async (targetAccountId: string) => {
      if (!clientRef.current || !isSupported) {
        throw new Error('Socket client not available');
      }
      await clientRef.current.unsubscribe(targetAccountId);
    },
    [isSupported],
  );

  // Event listener methods
  const on = useCallback(
    <K extends keyof SocketEventPayloads>(event: K, listener: SocketEventListener<SocketEventPayloads[K]>) => {
      if (!clientRef.current || !isSupported) return;
      clientRef.current.on(event, listener);
    },
    [isSupported],
  );

  const off = useCallback(
    <K extends keyof SocketEventPayloads>(event: K, listener?: SocketEventListener<SocketEventPayloads[K]>) => {
      if (!clientRef.current || !isSupported) return;
      clientRef.current.off(event, listener);
    },
    [isSupported],
  );

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

  // Auto-subscribe to account
  useEffect(() => {
    if (!autoSubscribe || !targetAccountId || !clientRef.current || !isSupported) return;

    if (connectionInfo.state === SocketConnectionState.CONNECTED) {
      clientRef
        .current!.subscribe(targetAccountId)
        .catch((error) => console.warn(`Failed to auto-subscribe to ${targetAccountId}:`, error));
    }
  }, [targetAccountId, connectionInfo]);

  // Monitor connection state
  useEffect(() => {
    if (!clientRef.current) return;

    const pollConnectionState = () => {
      const newInfo = clientRef.current!.getConnectionInfo();
      const newSubscriptions = clientRef.current!.getSubscriptions();

      setConnectionInfo(newInfo);
      setSubscriptions(newSubscriptions);
    };

    const interval = setInterval(pollConnectionState, 5000);
    pollConnectionState();

    return () => clearInterval(interval);
  }, [connectionInfo]);

  // Initialize client
  useEffect(() => {
    if (!isSupported) return;

    clientRef.current = new SocketClient(config);

    if (autoConnect)
      clientRef.current!.connect().catch((error) => console.warn('Failed to auto-connect socket:', error));

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
        setConnectionInfo({
          state: SocketConnectionState.DISCONNECTED,
          reconnectAttempts: 0,
        });
      }
    };
  }, []);

  return {
    connectionInfo,
    isConnected: connectionInfo.state === SocketConnectionState.CONNECTED,
    isSupported,
    connect,
    disconnect,
    reconnect,
    subscribe,
    unsubscribe,
    subscriptions,
    on,
    off,
    getLatency,
    ping,
  };
};
