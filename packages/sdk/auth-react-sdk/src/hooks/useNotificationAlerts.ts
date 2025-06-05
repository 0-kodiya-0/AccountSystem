import { useNotificationsContext } from "../context/notifications-context";

/**
 * Hook for real-time notification updates and alerts
 */
export const useNotificationAlerts = () => {
    const {
        lastUpdate,
        recentUpdates,
        clearUpdates,
        soundEnabled,
        setSoundEnabled,
        browserNotificationsEnabled,
        requestBrowserPermission
    } = useNotificationsContext();

    return {
        lastUpdate,
        recentUpdates,
        clearUpdates,
        soundEnabled,
        setSoundEnabled,
        browserNotificationsEnabled,
        requestBrowserPermission,
        hasRecentUpdates: recentUpdates.length > 0,
        latestUpdateType: lastUpdate?.type
    };
};
