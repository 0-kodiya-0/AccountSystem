import { useEffect, useCallback, useState, useRef } from 'react';
import { useNotifications } from './useNotifications';
import { useAppStore } from '../store/useAppStore';
import { ServiceManager } from '../services/ServiceManager';
import { SocketConfig, RealtimeNotificationUpdate, SocketConnectionState } from '../types';

interface UseRealtimeNotificationsOptions {
  socketConfig: SocketConfig;
  accountId?: string;
  autoConnect?: boolean;
  autoSubscribe?: boolean;
  enableSound?: boolean;
  enableBrowserNotifications?: boolean;
  maxRetainedUpdates?: number;
}

export const useRealtimeNotifications = (options: UseRealtimeNotificationsOptions) => {
  const {
    socketConfig,
    accountId,
    autoConnect = true,
    autoSubscribe = true,
    enableSound = true,
    enableBrowserNotifications = true,
    maxRetainedUpdates = 50,
  } = options;

  const { session } = useAppStore();
  const targetAccountId = accountId || session.currentAccountId;

  const [connectionInfo, setConnectionInfo] = useState({
    state: SocketConnectionState.DISCONNECTED,
    reconnectAttempts: 0,
  });
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<RealtimeNotificationUpdate[]>([]);
  const [lastUpdate, setLastUpdate] = useState<RealtimeNotificationUpdate | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(enableSound);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get socket client from ServiceManager
  const getSocketClient = () => {
    const serviceManager = ServiceManager.getInstance();
    if (!serviceManager.isInitialized()) {
      throw new Error('ServiceManager not initialized');
    }

    if (!serviceManager.hasSocketClient()) {
      serviceManager.initializeSocket(socketConfig);
    }

    return serviceManager.socketClient;
  };

  const requestBrowserPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      setBrowserNotificationsEnabled(true);
      return true;
    }

    if (Notification.permission === 'denied') {
      setBrowserNotificationsEnabled(false);
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setBrowserNotificationsEnabled(granted);
      return granted;
    } catch (error) {
      setBrowserNotificationsEnabled(false);
      return false;
    }
  }, []);

  const clearUpdates = useCallback(() => {
    setRecentUpdates([]);
    setLastUpdate(null);
    setUpdateCount(0);
  }, []);

  // Initialize browser notifications permission
  useEffect(() => {
    if (!enableBrowserNotifications) return;
    if ('Notification' in window) {
      setBrowserNotificationsEnabled(Notification.permission === 'granted');
    }
  }, [enableBrowserNotifications]);

  // Initialize sound
  useEffect(() => {
    if (!soundEnabled) {
      audioRef.current = null;
      return;
    }

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const createNotificationSound = () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      };

      audioRef.current = { play: createNotificationSound } as HTMLAudioElement;
    } catch (error) {
      audioRef.current = null;
    }

    return () => {
      audioRef.current = null;
    };
  }, [soundEnabled]);

  // Monitor connection state and subscriptions
  useEffect(() => {
    const pollConnectionState = () => {
      try {
        const socketClient = getSocketClient();
        const newInfo = socketClient.getConnectionInfo();
        const newSubscriptions = socketClient.getSubscriptions();

        setConnectionInfo(newInfo);
        setSubscriptions(newSubscriptions);
      } catch (error) {
        setConnectionInfo({
          state: SocketConnectionState.DISCONNECTED,
          reconnectAttempts: 0,
        });
        setSubscriptions([]);
      }
    };

    const interval = setInterval(pollConnectionState, 1000);
    pollConnectionState(); // Initial poll

    return () => clearInterval(interval);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      try {
        const socketClient = getSocketClient();
        socketClient.connect().catch((error) => {
          console.error('Failed to auto-connect:', error);
        });
      } catch (error) {
        console.error('Failed to get socket client for auto-connect:', error);
      }
    }
  }, [autoConnect]);

  // Auto-subscribe when connected and account is available
  useEffect(() => {
    if (autoSubscribe && targetAccountId && connectionInfo.state === SocketConnectionState.CONNECTED) {
      try {
        const socketClient = getSocketClient();
        socketClient.subscribe(targetAccountId).catch((error) => {
          console.warn(`Auto-subscription failed for ${targetAccountId}:`, error);
        });
      } catch (error) {
        console.error('Failed to get socket client for auto-subscribe:', error);
      }
    }
  }, [autoSubscribe, targetAccountId, connectionInfo.state]);

  const isConnected = connectionInfo.state === SocketConnectionState.CONNECTED;

  return {
    isConnected,
    connectionInfo,
    recentUpdates,
    lastUpdate,
    browserNotificationsEnabled,
    requestBrowserPermission,
    clearUpdates,
    soundEnabled,
    updateCount,
    subscriptions,
  };
};
