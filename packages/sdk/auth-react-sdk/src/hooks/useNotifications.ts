import { useState, useEffect, useCallback } from 'react';
import { Notification, AuthSDKError, CreateNotificationRequest } from '../types';
import { useAuth } from '../context/auth-context';
import { useCurrentAccount } from '../store/account-store';

/**
 * Hook for managing notifications
 */
export const useNotifications = (accountId?: string) => {
    const { client } = useAuth();
    const currentAccount = useCurrentAccount();
    const targetAccountId = accountId || currentAccount?.id;

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchNotifications = useCallback(async () => {
        if (!targetAccountId) return;

        try {
            setLoading(true);
            setError(null);
            const response = await client.getNotifications(targetAccountId);
            setNotifications(response.notifications);
            setUnreadCount(response.unreadCount);
        } catch (err) {
            const message = err instanceof AuthSDKError ? err.message : 'Failed to fetch notifications';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [client, targetAccountId]);

    const markAsRead = useCallback(async (notificationId: string) => {
        if (!targetAccountId) return;

        try {
            await client.markNotificationAsRead(targetAccountId, notificationId);
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            const message = err instanceof AuthSDKError ? err.message : 'Failed to mark notification as read';
            setError(message);
            throw err;
        }
    }, [client, targetAccountId]);

    const markAllAsRead = useCallback(async () => {
        if (!targetAccountId) return;

        try {
            await client.markAllNotificationsAsRead(targetAccountId);
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            const message = err instanceof AuthSDKError ? err.message : 'Failed to mark all notifications as read';
            setError(message);
            throw err;
        }
    }, [client, targetAccountId]);

    const deleteNotification = useCallback(async (notificationId: string) => {
        if (!targetAccountId) return;

        try {
            await client.deleteNotification(targetAccountId, notificationId);
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            // Update unread count if the deleted notification was unread
            const notification = notifications.find(n => n.id === notificationId);
            if (notification && !notification.read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (err) {
            const message = err instanceof AuthSDKError ? err.message : 'Failed to delete notification';
            setError(message);
            throw err;
        }
    }, [client, targetAccountId, notifications]);

    const deleteAllNotifications = useCallback(async () => {
        if (!targetAccountId) return;

        try {
            const result = await client.deleteAllNotifications(targetAccountId);
            setNotifications([]);
            setUnreadCount(0);
            return result;
        } catch (err) {
            const message = err instanceof AuthSDKError ? err.message : 'Failed to delete all notifications';
            setError(message);
            throw err;
        }
    }, [client, targetAccountId]);

    const updateNotification = useCallback(async (notificationId: string, updates: Partial<Notification>) => {
        if (!targetAccountId) return;

        try {
            const updated = await client.updateNotification(targetAccountId, notificationId, updates);
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? updated : n)
            );
            
            // Update unread count if read status changed
            const originalNotification = notifications.find(n => n.id === notificationId);
            if (originalNotification && updates.read !== undefined) {
                if (!originalNotification.read && updates.read) {
                    // Notification was marked as read
                    setUnreadCount(prev => Math.max(0, prev - 1));
                } else if (originalNotification.read && !updates.read) {
                    // Notification was marked as unread
                    setUnreadCount(prev => prev + 1);
                }
            }
            
            return updated;
        } catch (err) {
            const message = err instanceof AuthSDKError ? err.message : 'Failed to update notification';
            setError(message);
            throw err;
        }
    }, [client, targetAccountId, notifications]);

    const createNotification = useCallback(async (notification: CreateNotificationRequest) => {
        if (!targetAccountId) return;

        try {
            const created = await client.createNotification(targetAccountId, notification);
            setNotifications(prev => [created, ...prev]);
            if (!created.read) {
                setUnreadCount(prev => prev + 1);
            }
            return created;
        } catch (err) {
            const message = err instanceof AuthSDKError ? err.message : 'Failed to create notification';
            setError(message);
            throw err;
        }
    }, [client, targetAccountId]);

    useEffect(() => {
        fetchNotifications();
    }, []);

    return {
        notifications,
        unreadCount,
        loading,
        error,
        refetch: fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications,
        updateNotification,
        createNotification,
        clearError: () => setError(null)
    };
};