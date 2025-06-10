import React, { createContext, useContext, useCallback, ReactNode, useEffect, JSX } from 'react';
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications';
import { useNotifications } from '../hooks/useNotifications';
import { useCurrentAccount } from '../store/account-store';
import {
    Notification,
    CreateNotificationRequest,
    SocketConfig,
    RealtimeNotificationUpdate,
    NotificationType,
    AuthSDKError
} from '../types';

interface NotificationsContextValue {
    // Current notifications state
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    error: string | null;

    // Real-time connection
    isConnected: boolean;
    connectionState: string;
    recentUpdates: RealtimeNotificationUpdate[];
    lastUpdate: RealtimeNotificationUpdate | null;
    updateCount: number;

    // Notification management
    createNotification: (notification: CreateNotificationRequest) => Promise<Notification>;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (notificationId: string) => Promise<void>;
    deleteAllNotifications: () => Promise<void>;
    updateNotification: (notificationId: string, updates: Partial<Notification>) => Promise<Notification>;

    // Real-time controls
    subscribe: (accountId: string) => Promise<void>;
    unsubscribe: (accountId: string) => Promise<void>;
    clearUpdates: () => void;
    refetch: () => Promise<void>;

    // Browser notifications
    browserNotificationsEnabled: boolean;
    requestBrowserPermission: () => Promise<boolean>;

    // Sound controls
    soundEnabled: boolean;
    setSoundEnabled: (enabled: boolean) => void;

    // Utilities
    clearError: () => void;
    getNotificationsByType: (type: NotificationType) => Notification[];
    getUnreadNotifications: () => Notification[];
    hasUnreadNotifications: () => boolean;
    getLatestNotifications: (count: number) => Notification[];
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

interface NotificationsProviderProps {
    children: ReactNode;
    socketConfig: SocketConfig;
    accountId?: string;
    autoSubscribe?: boolean;
    enableSound?: boolean;
    enableBrowserNotifications?: boolean;
    maxRetainedUpdates?: number;
    pollingInterval?: number;
}

export const NotificationsProvider = ({
    children,
    socketConfig,
    accountId,
    autoSubscribe = true,
    enableSound = true,
    enableBrowserNotifications = true,
    maxRetainedUpdates = 50,
    pollingInterval
}: NotificationsProviderProps): JSX.Element | null => {
    const currentAccount = useCurrentAccount();
    const targetAccountId = accountId || currentAccount?.id;

    // Core notifications hook
    const {
        notifications,
        unreadCount,
        loading,
        error,
        markAsRead: markAsReadBase,
        markAllAsRead: markAllAsReadBase,
        deleteNotification: deleteNotificationBase,
        deleteAllNotifications: deleteAllNotificationsBase,
        updateNotification: updateNotificationBase,
        createNotification: createNotificationBase,
        refetch,
        clearError
    } = useNotifications(targetAccountId);

    // Real-time notifications hook
    const {
        isConnected,
        connectionState,
        recentUpdates,
        lastUpdate,
        updateCount,
        subscribe,
        unsubscribe,
        clearUpdates,
        browserNotificationsEnabled,
        requestBrowserPermission,
        soundEnabled,
        setSoundEnabled
    } = useRealtimeNotifications({
        socketConfig,
        accountId: targetAccountId,
        autoSubscribe,
        enableSound,
        enableBrowserNotifications,
        maxRetainedUpdates
    });

    // Enhanced notification management methods
    const createNotification = useCallback(async (notification: CreateNotificationRequest): Promise<Notification> => {
        if (!targetAccountId) {
            throw new Error('No account ID available for creating notification');
        }

        try {
            const created = await createNotificationBase(notification);
            if (!created) {
                throw new Error('Failed to create notification - no data returned');
            }

            // If real-time is not connected, manually refetch to update local state
            if (!isConnected) {
                await refetch();
            }

            return created;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to create notification';
            throw new Error(message);
        }
    }, [targetAccountId, createNotificationBase, isConnected, refetch]);

    const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
        try {
            await markAsReadBase(notificationId);

            // If real-time is not connected, manually refetch
            if (!isConnected) {
                await refetch();
            }
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to mark notification as read';
            throw new Error(message);
        }
    }, [markAsReadBase, isConnected, refetch]);

    const markAllAsRead = useCallback(async (): Promise<void> => {
        try {
            await markAllAsReadBase();

            // If real-time is not connected, manually refetch
            if (!isConnected) {
                await refetch();
            }
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to mark all notifications as read';
            throw new Error(message);
        }
    }, [markAllAsReadBase, isConnected, refetch]);

    const deleteNotification = useCallback(async (notificationId: string): Promise<void> => {
        try {
            await deleteNotificationBase(notificationId);

            // If real-time is not connected, manually refetch
            if (!isConnected) {
                await refetch();
            }
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to delete notification';
            throw new Error(message);
        }
    }, [deleteNotificationBase, isConnected, refetch]);

    const deleteAllNotifications = useCallback(async (): Promise<void> => {
        if (!targetAccountId) {
            throw new Error('No account ID available for deleting notifications');
        }

        try {
            // Call the base hook's deleteAllNotifications method
            await deleteAllNotificationsBase();

            // If real-time is not connected, manually refetch
            if (!isConnected) {
                await refetch();
            }
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to delete all notifications';
            throw new Error(message);
        }
    }, [targetAccountId, deleteAllNotificationsBase, isConnected, refetch]);

    const updateNotification = useCallback(async (
        notificationId: string,
        updates: Partial<Notification>
    ): Promise<Notification> => {
        if (!targetAccountId) {
            throw new Error('No account ID available for updating notification');
        }

        try {
            // Call the base hook's updateNotification method
            const updated = await updateNotificationBase(notificationId, updates);
            if (!updated) {
                throw new Error('Failed to update notification - no data returned');
            }

            // If real-time is not connected, manually refetch
            if (!isConnected) {
                await refetch();
            }

            return updated;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to update notification';
            throw new Error(message);
        }
    }, [targetAccountId, updateNotificationBase, isConnected, refetch]);

    // Utility methods
    const getNotificationsByType = useCallback((type: NotificationType): Notification[] => {
        return notifications.filter(notification => notification.type === type);
    }, [notifications]);

    const getUnreadNotifications = useCallback((): Notification[] => {
        return notifications.filter(notification => !notification.read);
    }, [notifications]);

    const hasUnreadNotifications = useCallback((): boolean => {
        return unreadCount > 0;
    }, [unreadCount]);

    const getLatestNotifications = useCallback((count: number): Notification[] => {
        return notifications
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, count);
    }, [notifications]);


    // Polling for notifications (fallback when real-time is not available)
    useEffect(() => {
        if (!pollingInterval || isConnected) return;

        const interval = setInterval(() => {
            refetch().catch(console.warn);
        }, pollingInterval);

        return () => clearInterval(interval);
    }, [isConnected]);

    const contextValue: NotificationsContextValue = {
        // Current notifications state
        notifications,
        unreadCount,
        loading,
        error,

        // Real-time connection
        isConnected,
        connectionState,
        recentUpdates,
        lastUpdate,
        updateCount,

        // Notification management
        createNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications,
        updateNotification,

        // Real-time controls
        subscribe,
        unsubscribe,
        clearUpdates,
        refetch,

        // Browser notifications
        browserNotificationsEnabled,
        requestBrowserPermission,

        // Sound controls
        soundEnabled,
        setSoundEnabled,

        // Utilities
        clearError,
        getNotificationsByType,
        getUnreadNotifications,
        hasUnreadNotifications,
        getLatestNotifications
    };

    return (
        <NotificationsContext.Provider value={contextValue}>
            {children}
        </NotificationsContext.Provider>
    );
};

export const useNotificationsContext = (): NotificationsContextValue => {
    const context = useContext(NotificationsContext);
    if (!context) {
        throw new Error('useNotificationsContext must be used within a NotificationsProvider');
    }
    return context;
};
