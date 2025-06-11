import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useSocket } from './useSocket';
import { useNotifications } from './useNotifications';
import { useAuthStore } from '../store/authStore';
import {
  SocketConfig,
  NotificationSocketEvents,
  RealtimeNotificationUpdate,
  type Notification,
} from '../types';

interface UseRealtimeNotificationsOptions {
  socketConfig: SocketConfig;
  accountId?: string;
  autoSubscribe?: boolean;
  enableSound?: boolean;
  enableBrowserNotifications?: boolean;
  maxRetainedUpdates?: number;
}

export const useRealtimeNotifications = (
  options: UseRealtimeNotificationsOptions,
) => {
  const {
    socketConfig,
    accountId,
    autoSubscribe = true,
    enableSound = true,
    enableBrowserNotifications = true,
    maxRetainedUpdates = 50,
  } = options;

  const store = useAuthStore();
  const currentAccount = store.getCurrentAccount();

  const targetAccountId = useMemo(() => {
    return accountId || currentAccount?.id;
  }, [accountId, currentAccount?.id]);

  const {
    connectionState,
    isConnected,
    subscribe: socketSubscribe,
    unsubscribe: socketUnsubscribe,
    subscriptions,
    on,
    off,
  } = useSocket(socketConfig, {
    autoConnect: true,
    autoSubscribe: autoSubscribe && !!targetAccountId,
    accountId: targetAccountId,
  });

  const { markAsRead, refetch } = useNotifications(targetAccountId);

  const [recentUpdates, setRecentUpdates] = useState<
    RealtimeNotificationUpdate[]
  >([]);
  const [lastUpdate, setLastUpdate] =
    useState<RealtimeNotificationUpdate | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(enableSound);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] =
    useState(false);
  const [updateCount, setUpdateCount] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const subscribe = useCallback(
    async (accountId: string) => {
      await socketSubscribe(accountId);
    },
    [socketSubscribe],
  );

  const unsubscribe = useCallback(
    async (accountId: string) => {
      await socketUnsubscribe(accountId);
    },
    [socketUnsubscribe],
  );

  const clearUpdates = useCallback(() => {
    setRecentUpdates([]);
    setLastUpdate(null);
    setUpdateCount(0);
  }, []);

  const setSoundEnabledWithPersistence = useCallback((enabled: boolean) => {
    setSoundEnabled(enabled);
    try {
      localStorage.setItem(
        'accountsystem-notification-sound',
        JSON.stringify(enabled),
      );
    } catch (error) {
      console.warn('Failed to persist sound preference:', error);
    }
  }, []);

  useEffect(() => {
    if (!enableBrowserNotifications) return;
    if ('Notification' in window) {
      setBrowserNotificationsEnabled(Notification.permission === 'granted');
    }
  }, [enableBrowserNotifications]);

  useEffect(() => {
    if (!soundEnabled) {
      audioRef.current = null;
      return;
    }

    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const createNotificationSound = () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          400,
          audioContext.currentTime + 0.1,
        );

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          audioContext.currentTime + 0.3,
        );

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

  useEffect(() => {
    const addUpdate = (update: RealtimeNotificationUpdate) => {
      setRecentUpdates((prev) =>
        [update, ...prev].slice(0, maxRetainedUpdates),
      );
      setLastUpdate(update);
      setUpdateCount((prev) => prev + 1);
    };

    const handleNewNotification = (notification: Notification) => {
      const update: RealtimeNotificationUpdate = {
        type: 'new',
        notification,
        accountId: notification.accountId,
        timestamp: Date.now(),
      };

      addUpdate(update);

      if (soundEnabled && audioRef.current) {
        try {
          audioRef.current.play();
        } catch (error) {
          console.warn('Failed to play notification sound:', error);
        }
      }

      if (
        browserNotificationsEnabled &&
        Notification.permission === 'granted'
      ) {
        const browserNotif = new Notification(notification.title, {
          body: notification.message,
          icon: '/notification-icon.png',
          tag: notification.id,
          badge: '/notification-badge.png',
        });

        browserNotif.onclick = () => {
          window.focus();
          browserNotif.close();
          markAsRead(notification.id).catch(console.warn);
        };

        setTimeout(() => browserNotif.close(), 5000);
      }

      refetch();
    };

    const handleUpdatedNotification = (notification: Notification) => {
      addUpdate({
        type: 'updated',
        notification,
        accountId: notification.accountId,
        timestamp: Date.now(),
      });
      refetch();
    };

    const handleDeletedNotification = (notificationId: string) => {
      addUpdate({
        type: 'deleted',
        notificationId,
        accountId: targetAccountId!,
        timestamp: Date.now(),
      });
      refetch();
    };

    const handleAllRead = (data: { accountId: string }) => {
      addUpdate({
        type: 'all_read',
        accountId: data.accountId,
        timestamp: Date.now(),
      });
      refetch();
    };

    on(NotificationSocketEvents.NEW_NOTIFICATION, handleNewNotification);
    on(
      NotificationSocketEvents.UPDATED_NOTIFICATION,
      handleUpdatedNotification,
    );
    on(
      NotificationSocketEvents.DELETED_NOTIFICATION,
      handleDeletedNotification,
    );
    on(NotificationSocketEvents.ALL_READ, handleAllRead);

    return () => {
      off(NotificationSocketEvents.NEW_NOTIFICATION, handleNewNotification);
      off(
        NotificationSocketEvents.UPDATED_NOTIFICATION,
        handleUpdatedNotification,
      );
      off(
        NotificationSocketEvents.DELETED_NOTIFICATION,
        handleDeletedNotification,
      );
      off(NotificationSocketEvents.ALL_READ, handleAllRead);
    };
  }, [
    soundEnabled,
    browserNotificationsEnabled,
    maxRetainedUpdates,
    targetAccountId,
  ]);

  useEffect(() => {
    try {
      const savedPreference = localStorage.getItem(
        'accountsystem-notification-sound',
      );
      if (savedPreference !== null) {
        setSoundEnabled(JSON.parse(savedPreference));
      }
    } catch (error) {
      console.warn('Failed to load sound preference:', error);
    }
  }, []);

  useEffect(() => {
    if (autoSubscribe && targetAccountId && isConnected) {
      subscribe(targetAccountId).catch((error) => {
        console.warn(`Auto-subscription failed for ${targetAccountId}:`, error);
      });
    }
  }, [autoSubscribe, targetAccountId, isConnected]);

  return {
    isConnected,
    connectionState: connectionState.toString(),
    recentUpdates,
    lastUpdate,
    browserNotificationsEnabled,
    requestBrowserPermission,
    subscribe,
    unsubscribe,
    clearUpdates,
    soundEnabled,
    setSoundEnabled: setSoundEnabledWithPersistence,
    updateCount,
    subscriptions: subscriptions || [],
  };
};
