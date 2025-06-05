import { useNotificationsContext } from "../context/notifications-context";

/**
 * Hook for notification settings and preferences
 */
export const useNotificationSettings = () => {
    const {
        soundEnabled,
        setSoundEnabled,
        browserNotificationsEnabled,
        requestBrowserPermission,
        isConnected,
        connectionState,
        subscribe,
        unsubscribe
    } = useNotificationsContext();

    return {
        soundEnabled,
        setSoundEnabled,
        browserNotificationsEnabled,
        requestBrowserPermission,
        isConnected,
        connectionState,
        subscribe,
        unsubscribe,
        isRealTimeAvailable: isConnected
    };
};