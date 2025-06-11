'use client';

import * as React from 'react';
import { NotificationItem } from './notification-item';
import { Loader2, Bell } from 'lucide-react';
import { useNotifications } from '../../../sdk/auth-react-sdk/src';

interface NotificationListProps {
  maxHeight?: string;
  showActions?: boolean;
  limit?: number;
  accountId?: string;
}

export function NotificationList({ maxHeight = '600px', showActions = true, limit, accountId }: NotificationListProps) {
  const { notifications, isLoading, error } = useNotifications(accountId);

  const displayNotifications = limit ? notifications.slice(0, limit) : notifications;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        <p className="text-sm">Failed to load notifications</p>
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  if (displayNotifications.length === 0) {
    return (
      <div className="text-center py-8">
        <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">No notifications yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1" style={{ maxHeight, overflowY: 'auto' }}>
      {displayNotifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          showActions={showActions}
          accountId={accountId}
        />
      ))}
    </div>
  );
}
