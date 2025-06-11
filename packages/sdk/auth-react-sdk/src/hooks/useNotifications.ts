import { useEffect, useCallback, useState, useMemo } from 'react';
import { useServices } from './core/useServices';
import { useDataLoading } from './useLoading';
import {
  Notification,
  AuthSDKError,
  CreateNotificationRequest,
} from '../types';
import { useAuthStore } from '../store/authStore';

export const useNotifications = (accountId?: string) => {
  const { notificationService } = useServices();
  const { getCurrentAccount, accountsData } = useAuthStore();

  const targetAccountId = useMemo(
    () => accountId || getCurrentAccount()?.id,
    [accountId, accountsData],
  );

  // Initialize loading state with contextual entity name
  const entityName = targetAccountId
    ? 'notifications'
    : 'notifications (no account)';

  const {
    loadingInfo,
    isPending,
    isReady,
    hasError,
    setPending,
    setReady,
    setError: setLoadingError,
    updateLoadingReason,
    clearError: clearLoadingError,
  } = useDataLoading(entityName);

  // Local state for notifications data
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // OPTIMIZED: useCallback with minimal dependencies
  const fetchNotifications = useCallback(async () => {
    if (!targetAccountId) {
      setLoadingError('No account ID available for fetching notifications');
      return;
    }

    try {
      setPending('Loading notifications');
      clearLoadingError();

      updateLoadingReason('Fetching notifications from server');
      const response =
        await notificationService.getNotifications(targetAccountId);

      updateLoadingReason('Processing notification data');
      setNotifications(response.notifications);
      setUnreadCount(response.unreadCount);

      setReady(
        `Loaded ${response.notifications.length} notifications (${response.unreadCount} unread)`,
      );
    } catch (err) {
      const message =
        err instanceof AuthSDKError
          ? err.message
          : 'Failed to fetch notifications';
      setLoadingError(message);
    }
  }, [
    targetAccountId,
    notificationService,
    setPending,
    setReady,
    setLoadingError,
    updateLoadingReason,
    clearLoadingError,
  ]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!targetAccountId) {
        setLoadingError(
          'No account ID available for marking notification as read',
        );
        throw new Error('No account ID available');
      }

      try {
        updateLoadingReason('Marking notification as read');
        await notificationService.markNotificationAsRead(
          targetAccountId,
          notificationId,
        );

        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        if (isReady) {
          updateLoadingReason(`${notifications.length} notifications loaded`);
        }
      } catch (err) {
        const message =
          err instanceof AuthSDKError
            ? err.message
            : 'Failed to mark notification as read';
        setLoadingError(message);
        throw err;
      }
    },
    [
      targetAccountId,
      notificationService,
      notifications.length,
      isReady,
      updateLoadingReason,
      setLoadingError,
    ],
  );

  const markAllAsRead = useCallback(async () => {
    if (!targetAccountId) {
      setLoadingError(
        'No account ID available for marking all notifications as read',
      );
      throw new Error('No account ID available');
    }

    try {
      updateLoadingReason('Marking all notifications as read');
      await notificationService.markAllNotificationsAsRead(targetAccountId);

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);

      if (isReady) {
        updateLoadingReason(
          `All ${notifications.length} notifications marked as read`,
        );
      }
    } catch (err) {
      const message =
        err instanceof AuthSDKError
          ? err.message
          : 'Failed to mark all notifications as read';
      setLoadingError(message);
      throw err;
    }
  }, [
    targetAccountId,
    notificationService,
    notifications.length,
    isReady,
    updateLoadingReason,
    setLoadingError,
  ]);

  const deleteNotification = useCallback(
    async (notificationId: string) => {
      if (!targetAccountId) {
        setLoadingError('No account ID available for deleting notification');
        throw new Error('No account ID available');
      }

      try {
        updateLoadingReason('Deleting notification');
        await notificationService.deleteNotification(
          targetAccountId,
          notificationId,
        );

        // Update unread count if the deleted notification was unread
        const notification = notifications.find((n) => n.id === notificationId);
        if (notification && !notification.read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }

        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

        if (isReady) {
          const remainingCount = notifications.length - 1;
          updateLoadingReason(`${remainingCount} notifications remaining`);
        }
      } catch (err) {
        const message =
          err instanceof AuthSDKError
            ? err.message
            : 'Failed to delete notification';
        setLoadingError(message);
        throw err;
      }
    },
    [
      targetAccountId,
      notificationService,
      notifications,
      isReady,
      updateLoadingReason,
      setLoadingError,
    ],
  );

  const deleteAllNotifications = useCallback(async () => {
    if (!targetAccountId) {
      setLoadingError('No account ID available for deleting all notifications');
      throw new Error('No account ID available');
    }

    try {
      updateLoadingReason('Deleting all notifications');
      const result =
        await notificationService.deleteAllNotifications(targetAccountId);

      setNotifications([]);
      setUnreadCount(0);

      if (isReady) {
        updateLoadingReason(`Deleted ${result.deletedCount} notifications`);
      }

      return result;
    } catch (err) {
      const message =
        err instanceof AuthSDKError
          ? err.message
          : 'Failed to delete all notifications';
      setLoadingError(message);
      throw err;
    }
  }, [
    targetAccountId,
    notificationService,
    isReady,
    updateLoadingReason,
    setLoadingError,
  ]);

  const updateNotification = useCallback(
    async (notificationId: string, updates: Partial<Notification>) => {
      if (!targetAccountId) {
        setLoadingError('No account ID available for updating notification');
        throw new Error('No account ID available');
      }

      try {
        updateLoadingReason('Updating notification');
        const updated = await notificationService.updateNotification(
          targetAccountId,
          notificationId,
          updates,
        );

        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? updated : n)),
        );

        // Update unread count if read status changed
        const originalNotification = notifications.find(
          (n) => n.id === notificationId,
        );
        if (originalNotification && updates.read !== undefined) {
          if (!originalNotification.read && updates.read) {
            // Notification was marked as read
            setUnreadCount((prev) => Math.max(0, prev - 1));
          } else if (originalNotification.read && !updates.read) {
            // Notification was marked as unread
            setUnreadCount((prev) => prev + 1);
          }
        }

        if (isReady) {
          updateLoadingReason(`${notifications.length} notifications loaded`);
        }

        return updated;
      } catch (err) {
        const message =
          err instanceof AuthSDKError
            ? err.message
            : 'Failed to update notification';
        setLoadingError(message);
        throw err;
      }
    },
    [
      targetAccountId,
      notificationService,
      notifications,
      isReady,
      updateLoadingReason,
      setLoadingError,
    ],
  );

  const createNotification = useCallback(
    async (notification: CreateNotificationRequest) => {
      if (!targetAccountId) {
        setLoadingError('No account ID available for creating notification');
        throw new Error('No account ID available');
      }

      try {
        updateLoadingReason('Creating new notification');
        const created = await notificationService.createNotification(
          targetAccountId,
          notification,
        );

        setNotifications((prev) => [created, ...prev]);
        if (!created.read) {
          setUnreadCount((prev) => prev + 1);
        }

        if (isReady) {
          const totalCount = notifications.length + 1;
          const unreadTotal = unreadCount + (created.read ? 0 : 1);
          updateLoadingReason(
            `${totalCount} notifications loaded (${unreadTotal} unread)`,
          );
        }

        return created;
      } catch (err) {
        const message =
          err instanceof AuthSDKError
            ? err.message
            : 'Failed to create notification';
        setLoadingError(message);
        throw err;
      }
    },
    [
      targetAccountId,
      notificationService,
      notifications.length,
      unreadCount,
      isReady,
      updateLoadingReason,
      setLoadingError,
    ],
  );

  const clearErrors = useCallback(() => {
    clearLoadingError();
  }, [clearLoadingError]);

  // OPTIMIZED: Auto-fetch notifications when account changes or on mount
  useEffect(() => {
    if (!targetAccountId) {
      setLoadingError('No account available for loading notifications');
      return;
    }

    fetchNotifications().catch((error) => {
      console.warn('Failed to fetch notifications on mount:', error);
    });
  }, [targetAccountId]);

  // OPTIMIZED: Monitor for account changes and update loading reason
  useEffect(() => {
    if (targetAccountId && isReady && notifications.length >= 0) {
      updateLoadingReason(
        `${notifications.length} notifications loaded (${unreadCount} unread)`,
      );
    }
  }, [
    targetAccountId,
    isReady,
    notifications.length,
    unreadCount,
    updateLoadingReason,
  ]);

  return {
    // Data
    notifications,
    unreadCount,

    // Loading states
    loadingInfo,
    isPending,
    isReady,
    hasError,

    // Actions
    refetch: fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    updateNotification,
    createNotification,
    clearError: clearErrors,
    clearErrors,
  };
};
