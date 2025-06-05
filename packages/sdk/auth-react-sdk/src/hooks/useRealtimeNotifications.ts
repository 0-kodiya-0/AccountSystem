import { useEffect, useCallback, useState, useRef } from 'react';
import { useSocket } from './useSocket';
import { useNotifications } from './useNotifications';
import { useCurrentAccount } from '../store/account-store';
import {
    SocketConfig,
    NotificationSocketEvents,
    RealtimeNotificationUpdate
} from '../types';
import type { Notification } from '../types';

interface UseRealtimeNotificationsOptions {
    socketConfig: SocketConfig;
    accountId?: string;
    autoSubscribe?: boolean;
    enableSound?: boolean;
    enableBrowserNotifications?: boolean;
    maxRetainedUpdates?: number;
}

interface UseRealtimeNotificationsReturn {
    // Socket connection info
    isConnected: boolean;
    connectionState: string;

    // Real-time updates
    recentUpdates: RealtimeNotificationUpdate[];
    lastUpdate: RealtimeNotificationUpdate | null;

    // Notification permissions
    browserNotificationsEnabled: boolean;
    requestBrowserPermission: () => Promise<boolean>;

    // Controls
    subscribe: (accountId: string) => Promise<void>;
    unsubscribe: (accountId: string) => Promise<void>;
    clearUpdates: () => void;

    // Sound controls
    soundEnabled: boolean;
    setSoundEnabled: (enabled: boolean) => void;

    // Statistics
    updateCount: number;
    subscriptions: string[];
}

export const useRealtimeNotifications = (
    options: UseRealtimeNotificationsOptions
): UseRealtimeNotificationsReturn => {
    const {
        socketConfig,
        accountId,
        autoSubscribe = true,
        enableSound = true,
        enableBrowserNotifications = true,
        maxRetainedUpdates = 50
    } = options;

    const currentAccount = useCurrentAccount();
    const targetAccountId = accountId || currentAccount?.id;

    // Socket connection
    const {
        connectionState,
        isConnected,
        subscribe: socketSubscribe,
        unsubscribe: socketUnsubscribe,
        subscriptions,
        on,
        off
    } = useSocket(socketConfig, {
        autoConnect: true,
        autoSubscribe: autoSubscribe && !!targetAccountId,
        accountId: targetAccountId
    });

    // Notifications hook for local state management
    const {
        markAsRead,
        refetch
    } = useNotifications(targetAccountId);

    // Local state
    const [recentUpdates, setRecentUpdates] = useState<RealtimeNotificationUpdate[]>([]);
    const [lastUpdate, setLastUpdate] = useState<RealtimeNotificationUpdate | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(enableSound);
    const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
    const [updateCount, setUpdateCount] = useState(0);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Request browser notification permission
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
            console.warn('Failed to request notification permission:', error);
            setBrowserNotificationsEnabled(false);
            return false;
        }
    }, []);

    // Subscription management
    const subscribe = useCallback(async (accountId: string) => {
        try {
            await socketSubscribe(accountId);
        } catch (error) {
            console.warn(`Failed to subscribe to notifications for ${accountId}:`, error);
            throw error;
        }
    }, [socketSubscribe]);

    const unsubscribe = useCallback(async (accountId: string) => {
        try {
            await socketUnsubscribe(accountId);
        } catch (error) {
            console.warn(`Failed to unsubscribe from notifications for ${accountId}:`, error);
            throw error;
        }
    }, [socketUnsubscribe]);

    // Clear updates history
    const clearUpdates = useCallback(() => {
        setRecentUpdates([]);
        setLastUpdate(null);
        setUpdateCount(0);
    }, []);

    // Custom sound control with persistence
    const setSoundEnabledWithPersistence = useCallback((enabled: boolean) => {
        setSoundEnabled(enabled);

        // Persist preference to localStorage
        try {
            localStorage.setItem('accountsystem-notification-sound', JSON.stringify(enabled));
        } catch (error) {
            console.warn('Failed to persist sound preference:', error);
        }
    }, []);

    // Initialize browser notifications
    useEffect(() => {
        if (!enableBrowserNotifications) return;

        const checkPermission = () => {
            if ('Notification' in window) {
                setBrowserNotificationsEnabled(Notification.permission === 'granted');
            }
        };

        checkPermission();
    }, [enableBrowserNotifications]);

    // Initialize notification sound
    useEffect(() => {
        if (!soundEnabled) return;

        // Create a subtle notification sound using Web Audio API
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

            audioRef.current = { play: createNotificationSound } as any;
        } catch (error) {
            console.warn('Failed to initialize notification sound:', error);
        }
    }, [soundEnabled]);

    // Handle real-time notification events
    useEffect(() => {
        const handleNewNotification = (notification: Notification) => {
            const update: RealtimeNotificationUpdate = {
                type: 'new',
                notification,
                accountId: notification.accountId,
                timestamp: Date.now()
            };

            setRecentUpdates(prev => {
                const newUpdates = [update, ...prev];
                return newUpdates.slice(0, maxRetainedUpdates);
            });
            setLastUpdate(update);
            setUpdateCount(prev => prev + 1);

            // Play sound
            if (soundEnabled && audioRef.current) {
                try {
                    audioRef.current.play();
                } catch (error) {
                    console.warn('Failed to play notification sound:', error);
                }
            }

            // Show browser notification
            if (browserNotificationsEnabled && Notification.permission === 'granted') {
                const browserNotif = new Notification(notification.title, {
                    body: notification.message,
                    icon: '/notification-icon.png', // You should provide this
                    tag: notification.id,
                    badge: '/notification-badge.png'
                });

                browserNotif.onclick = () => {
                    window.focus();
                    browserNotif.close();

                    // Mark as read when clicked
                    markAsRead(notification.id).catch(console.warn);
                };

                // Auto-close after 5 seconds
                setTimeout(() => browserNotif.close(), 5000);
            }

            // Refresh local notifications list
            refetch();
        };

        const handleUpdatedNotification = (notification: Notification) => {
            const update: RealtimeNotificationUpdate = {
                type: 'updated',
                notification,
                accountId: notification.accountId,
                timestamp: Date.now()
            };

            setRecentUpdates(prev => {
                const newUpdates = [update, ...prev];
                return newUpdates.slice(0, maxRetainedUpdates);
            });
            setLastUpdate(update);
            setUpdateCount(prev => prev + 1);

            refetch();
        };

        const handleDeletedNotification = (notificationId: string) => {
            const update: RealtimeNotificationUpdate = {
                type: 'deleted',
                notificationId,
                accountId: targetAccountId!,
                timestamp: Date.now()
            };

            setRecentUpdates(prev => {
                const newUpdates = [update, ...prev];
                return newUpdates.slice(0, maxRetainedUpdates);
            });
            setLastUpdate(update);
            setUpdateCount(prev => prev + 1);

            refetch();
        };

        const handleAllRead = (data: { accountId: string }) => {
            const update: RealtimeNotificationUpdate = {
                type: 'all_read',
                accountId: data.accountId,
                timestamp: Date.now()
            };

            setRecentUpdates(prev => {
                const newUpdates = [update, ...prev];
                return newUpdates.slice(0, maxRetainedUpdates);
            });
            setLastUpdate(update);
            setUpdateCount(prev => prev + 1);

            refetch();
        };

        // Register event listeners
        on(NotificationSocketEvents.NEW_NOTIFICATION, handleNewNotification);
        on(NotificationSocketEvents.UPDATED_NOTIFICATION, handleUpdatedNotification);
        on(NotificationSocketEvents.DELETED_NOTIFICATION, handleDeletedNotification);
        on(NotificationSocketEvents.ALL_READ, handleAllRead);

        return () => {
            // Cleanup event listeners
            off(NotificationSocketEvents.NEW_NOTIFICATION, handleNewNotification);
            off(NotificationSocketEvents.UPDATED_NOTIFICATION, handleUpdatedNotification);
            off(NotificationSocketEvents.DELETED_NOTIFICATION, handleDeletedNotification);
            off(NotificationSocketEvents.ALL_READ, handleAllRead);
        };
    }, [
        soundEnabled, browserNotificationsEnabled, maxRetainedUpdates,
        targetAccountId
    ]);

    // Load sound preference on mount
    useEffect(() => {
        try {
            const savedPreference = localStorage.getItem('accountsystem-notification-sound');
            if (savedPreference !== null) {
                setSoundEnabled(JSON.parse(savedPreference));
            }
        } catch (error) {
            console.warn('Failed to load sound preference:', error);
        }
    }, []);

    // Auto-subscribe to target account when it changes
    useEffect(() => {
        if (autoSubscribe && targetAccountId && isConnected) {
            subscribe(targetAccountId).catch(error => {
                console.warn(`Auto-subscription failed for ${targetAccountId}:`, error);
            });
        }
    }, [autoSubscribe, targetAccountId, isConnected]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Stop any ongoing audio context
            if (audioRef.current && typeof audioRef.current === 'object' && 'stop' in audioRef.current) {
                try {
                    (audioRef.current as any).stop();
                } catch (error) {
                    // Ignore cleanup errors
                }
            }
        };
    }, []);

    return {
        // Socket connection info
        isConnected,
        connectionState: connectionState.toString(),

        // Real-time updates
        recentUpdates,
        lastUpdate,

        // Notification permissions
        browserNotificationsEnabled,
        requestBrowserPermission,

        // Controls
        subscribe,
        unsubscribe,
        clearUpdates,

        // Sound controls
        soundEnabled,
        setSoundEnabled: setSoundEnabledWithPersistence,

        // Statistics
        updateCount,
        subscriptions: subscriptions || []
    };
};