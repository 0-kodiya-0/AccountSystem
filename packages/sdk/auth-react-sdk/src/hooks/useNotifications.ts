import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { CreateNotificationRequest } from '../types';

export interface UseNotificationsOptions {
  accountId?: string;
  autoFetch?: boolean; // Default true - auto-fetch notifications on mount
}

export const useNotifications = (options: UseNotificationsOptions = {}) => {
  const { accountId, autoFetch = true } = options;

  // Get current account ID from store if not provided
  const currentAccountId = useAppStore((state) => state.session.currentAccountId);
  const targetAccountId = accountId || currentAccountId;

  // Get notifications data from store
  const notifications = useAppStore((state) => (targetAccountId ? state.notifications.get(targetAccountId) || [] : []));

  // Get store actions directly
  const loadNotifications = useAppStore((state) => state.loadNotifications);
  const createNotification = useAppStore((state) => state.createNotification);
  const markNotificationAsRead = useAppStore((state) => state.markNotificationAsRead);
  const markAllNotificationsAsRead = useAppStore((state) => state.markAllNotificationsAsRead);
  const deleteNotification = useAppStore((state) => state.deleteNotification);
  const deleteAllNotifications = useAppStore((state) => state.deleteAllNotifications);

  // Auto-fetch notifications if enabled and account ID is available
  useEffect(() => {
    if (!autoFetch || !targetAccountId) return;

    // Only fetch if we don't have notifications already
    if (notifications.length === 0) {
      loadNotifications(targetAccountId).catch((error) => {
        console.warn('Failed to auto-fetch notifications:', error);
      });
    }
  }, [autoFetch, targetAccountId, notifications.length]);

  // Derived data
  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;
  const hasNotifications = notifications.length > 0;
  const hasUnread = unreadCount > 0;

  // Pre-filtered data for common use cases
  const unreadNotifications = notifications.filter((n) => !n.read);
  const readNotifications = notifications.filter((n) => n.read);

  return {
    // Data
    notifications,
    unreadNotifications,
    readNotifications,
    unreadCount,
    readCount,
    hasNotifications,
    hasUnread,

    // Direct store actions (no wrappers needed)
    loadNotifications,
    createNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    deleteAllNotifications,

    // Target account ID for actions
    accountId: targetAccountId,
  };
};
