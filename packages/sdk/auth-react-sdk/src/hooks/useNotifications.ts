import { useCallback, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { LoadingState, type CreateNotificationRequest, type Notification } from '../types';

export const useNotifications = (accountId?: string) => {
  const store = useAppStore();

  const targetAccountId = accountId || store.session.currentAccountId;
  const notifications = targetAccountId ? store.notifications.byAccount.get(targetAccountId) || [] : [];
  const unreadCount = targetAccountId ? store.notifications.unreadCounts.get(targetAccountId) || 0 : 0;
  const loadingState = targetAccountId
    ? store.notifications.loadingStates.get(targetAccountId) || LoadingState.IDLE
    : LoadingState.IDLE;
  const error = targetAccountId ? store.notifications.errors.get(targetAccountId) : null;

  const loadNotifications = useCallback(
    async (options = {}) => {
      if (!targetAccountId) return null;
      return store.loadNotifications(targetAccountId, options);
    },
    [store.loadNotifications, targetAccountId],
  );

  const createNotification = useCallback(
    async (notification: CreateNotificationRequest) => {
      if (!targetAccountId) throw new Error('No account ID');
      return store.createNotification(targetAccountId, notification);
    },
    [store.createNotification, targetAccountId],
  );

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!targetAccountId) throw new Error('No account ID');
      return store.markNotificationAsRead(targetAccountId, notificationId);
    },
    [store.markNotificationAsRead, targetAccountId],
  );

  const markAllAsRead = useCallback(async () => {
    if (!targetAccountId) throw new Error('No account ID');
    return store.markAllNotificationsAsRead(targetAccountId);
  }, [store.markAllNotificationsAsRead, targetAccountId]);

  const updateNotification = useCallback(
    async (notificationId: string, updates: Partial<Notification>) => {
      if (!targetAccountId) throw new Error('No account ID');
      return store.updateNotification(targetAccountId, notificationId, updates);
    },
    [store.updateNotification, targetAccountId],
  );

  const deleteNotification = useCallback(
    async (notificationId: string) => {
      if (!targetAccountId) throw new Error('No account ID');
      return store.deleteNotification(targetAccountId, notificationId);
    },
    [store.deleteNotification, targetAccountId],
  );

  const deleteAllNotifications = useCallback(async () => {
    if (!targetAccountId) throw new Error('No account ID');
    return store.deleteAllNotifications(targetAccountId);
  }, [store.deleteAllNotifications, targetAccountId]);

  const clearError = useCallback(() => {
    if (targetAccountId) {
      store.clearError(targetAccountId);
    }
  }, [store.clearError, targetAccountId]);

  const resetState = useCallback(() => {
    if (targetAccountId) {
      store.resetNotificationsState(targetAccountId);
    }
  }, [store.resetNotificationsState, targetAccountId]);

  useEffect(() => {
    if (targetAccountId && notifications.length === 0 && loadingState === LoadingState.IDLE && !error) {
      loadNotifications();
    }
  }, [targetAccountId, loadingState, error]);

  return {
    notifications,
    unreadCount,
    loadingState,
    isLoading: loadingState === LoadingState.LOADING,
    isReady: loadingState === LoadingState.READY,
    isIdle: loadingState === LoadingState.IDLE,
    isError: loadingState === LoadingState.ERROR,
    error,
    loadNotifications,
    createNotification,
    markAsRead,
    markAllAsRead,
    updateNotification,
    deleteNotification,
    deleteAllNotifications,
    clearError,
    resetState,
  };
};
