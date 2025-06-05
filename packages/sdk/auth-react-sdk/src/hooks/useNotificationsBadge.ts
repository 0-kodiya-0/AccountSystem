import { useNotificationsContext } from "../context/notifications-context";

/**
 * Hook for notification badge/counter display
 */
export const useNotificationsBadge = () => {
    const { unreadCount, hasUnreadNotifications } = useNotificationsContext();

    return {
        unreadCount,
        hasUnread: hasUnreadNotifications(),
        badgeText: unreadCount > 99 ? '99+' : unreadCount.toString(),
        showBadge: hasUnreadNotifications()
    };
};