import { useMemo } from "react";
import { useNotificationsContext } from "../context/notifications-context";
import { NotificationType } from "../types";

/**
 * Hook for notification list/feed display
 */
export const useNotificationsFeed = (options?: {
    type?: NotificationType;
    limit?: number;
    unreadOnly?: boolean;
}) => {
    const {
        notifications,
        getNotificationsByType,
        markAsRead,
        deleteNotification,
        loading,
        error
    } = useNotificationsContext();

    const { type, limit = 20, unreadOnly = false } = options || {};

    const filteredNotifications = useMemo(() => {
        let filtered = notifications;

        if (type) {
            filtered = getNotificationsByType(type);
        }

        if (unreadOnly) {
            filtered = filtered.filter(n => !n.read);
        }

        if (limit) {
            filtered = filtered
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, limit);
        }

        return filtered;
    }, [notifications, type, unreadOnly, limit, getNotificationsByType]);

    return {
        notifications: filteredNotifications,
        loading,
        error,
        markAsRead,
        deleteNotification,
        isEmpty: filteredNotifications.length === 0,
        hasMore: filteredNotifications.length === limit && notifications.length > limit
    };
};
